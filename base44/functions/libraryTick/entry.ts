import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql } from "../../shared/supabase.ts";
import { safeEqual } from "../../shared/libraryAccess.ts";
import { deliverMessage, sendAssignmentDigests } from "../../shared/libraryNotify.ts";

// Zadanie serwera: wysyłka zaplanowanych wiadomości (idempotentnie), zbiorcze powiadomienia
// o nowych materiałach i czyszczenie historii zmian po 12 miesiącach.
// Wywołanie: administrator albo token zadania z ustawień modułu (porównanie w czasie stałym).

const LIMIT_H = 20;   // najwyżej 20 wysłanych wiadomości na godzinę

export default async function (req) {
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