import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql } from "../_shared/supabase.ts";
import { safeEqual } from "../_shared/libraryAccess.ts";
import { deliverMessage, sendAssignmentDigests } from "../_shared/libraryNotify.ts";

// Zadanie serwera: wysyłka zaplanowanych wiadomości (idempotentnie), zbiorcze powiadomienia
// o nowych materiałach i czyszczenie historii zmian po 12 miesiącach.
// Wywołanie: administrator albo token zadania z ustawień modułu (porównanie w czasie stałym).

const LIMIT_H = 20;   // najwyżej 20 wysłanych wiadomości na godzinę

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const me = await base44.auth.me().catch(() => null);
    let allowed = !!(me && me.role === "admin");
    if (!allowed) {
      const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
      const stored = rows && rows[0] ? rows[0].tick_token : null;
      const given = typeof body.tick_token === "string" ? body.tick_token : "";
      allowed = !!stored && !!given && safeEqual(given, stored);
    }
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });

    // 1. Wiadomości zaplanowane na teraz — przejęcie atomowe, limit godzinowy.
    const used = await runSql(base44, `SELECT count(*)::int AS n FROM public.mb_messages
      WHERE sent_at > now() - interval '1 hour'`, true).catch(() => [{ n: 0 }]);
    const budget = Math.max(0, LIMIT_H - Number(((used || [])[0] || {}).n || 0));
    const delivered = [];
    if (budget > 0) {
      const due = await runSql(base44, `SELECT id FROM public.mb_messages
        WHERE status = 'ZAPLANOWANA' AND send_at <= now() ORDER BY send_at LIMIT ${budget}`, true).catch(() => []);
      for (const m of due || []) delivered.push(await deliverMessage(base44, m.id, "zadanie"));
    }

    // 2. Zbiorcze powiadomienia o nowych materiałach (jeden e-mail na osobę, bez treści materiału).
    const digests = await sendAssignmentDigests(base44).catch(() => null);

    // 3. Historia zmian — 12 miesięcy.
    const purged = await runSql(base44, `SELECT public.mb_log_purge() AS n`).catch(() => null);

    return Response.json({
      ok: true,
      wyslane: delivered.filter((d) => d && d.ok).length,
      pominięte: delivered.filter((d) => d && !d.ok).length,
      budzet: budget,
      powiadomienia: digests,
      historia_usunieta: Number(((purged || [])[0] || {}).n || 0),
    });
  } catch (e) {
    console.error("libraryTick:", String((e && e.message) || e).slice(0, 300));
    return Response.json({ error: "Nie udało się wykonać zadania." }, { status: 500 });
  }
}

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
