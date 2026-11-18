// Rozmowa na progu — publiczne zgłoszenie z krótką ankietą przed płatnością (18.11.2026).
// Akcje: availability (orientacyjna dostępność terminów), submit (zgłoszenie + osobisty link do płatności),
// status (stan linku do płatności). Bez pytań o zdrowie i bez automatycznej oceny psychologicznej.
import { createClientFromRequest } from "../_shared/compat.ts";
import { waitUntil } from "../_shared/shim.ts";
import { runSql, escStr, textField, emailField, clientIp } from "../_shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";
import { loadAppUrl } from "../_shared/settings.ts";
import { sendMail, adminTo } from "../_shared/smtp.ts";
import { wrap, escHtml } from "../_shared/powrotSurvey.ts";
import {
  PROG_SLUG, PAY_DAYS, OBSZARY, PYTANIA, SCOPE_TEXT, newToken, tokenHash, appByToken, progLog, progProductId,
  mailZgloszenie, sendProg,
} from "../_shared/prog.ts";

const DAY_FMT = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long" });

async function availability(base44) {
  const t = await runSql(base44, `SELECT id FROM public.bk_types WHERE slug = ${escStr(PROG_SLUG)} AND active LIMIT 1`, true);
  if (!t.length) return { count: 0, dni: [] };
  const rows = await runSql(base44, `SELECT slot_start FROM public.bk_free_slots(${escStr(t[0].id)}::uuid, now(), now() + interval '60 days') ORDER BY slot_start`, true);
  const dni: string[] = [];
  for (const r of rows) {
    const d = DAY_FMT.format(new Date(r.slot_start));
    if (!dni.includes(d)) dni.push(d);
    if (dni.length >= 3) break;
  }
  return { count: rows.length, dni };
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "availability") return Response.json(await availability(base44));

    if (action === "status") {
      const app = await appByToken(base44, String(body.t || ""));
      if (!app) return Response.json({ state: "invalid" });
      if (app.status !== "do_platnosci") return Response.json({ state: "done", status: app.status });
      if (!app.valid) return Response.json({ state: "expired" });
      return Response.json({ state: "ok", full_name: app.full_name, email: app.email, expires_at: app.pay_expires_at });
    }

    if (action !== "submit") return Response.json({ error: "Nieznana akcja" }, { status: 400 });

    if (!(await ipAllowed(base44, clientIp(req), "prog_zgloszenie", 5, 3600000))) {
      return Response.json({ error: TOO_MANY }, { status: 429 });
    }
    const fullName = textField(body, "full_name", { max: 200 });
    const email = emailField(body).toLowerCase();
    const phone = textField(body, "phone", { max: 50, required: false });
    if (body.consent_adult !== true) return Response.json({ error: "Potwierdź, że masz ukończone 18 lat." }, { status: 400 });
    if (body.consent_scope !== true) return Response.json({ error: "Potwierdź, że rozumiesz charakter spotkania." }, { status: 400 });

    const a = (body.ankieta && typeof body.ankieta === "object") ? body.ankieta : {};
    const ankieta: Record<string, string> = {};
    for (const q of PYTANIA) {
      const v = textField(a, q.key, { max: q.max, required: q.required });
      if (v) ankieta[q.key] = v;
    }
    if (!OBSZARY.includes(ankieta.obszar)) return Response.json({ error: "Wybierz obszar, który najlepiej opisuje Twoją sytuację." }, { status: 400 });
    const chce = body.podsumowanie_chce !== false;

    // Kolejna Rozmowa na progu najwcześniej 30 dni po poprzedniej (ta sama zasada sprawdzana przy płatności).
    const prodId = await progProductId(base44);
    if (prodId) {
      const recent = await runSql(base44, `SELECT 1 FROM public.orders o WHERE lower(o.buyer_email) = ${escStr(email)} AND o.status = 'COMPLETED'
          AND o.created_date > now() - interval '30 days' AND o.items @> ${escStr(JSON.stringify([{ product_id: prodId }]))}::jsonb LIMIT 1`, true).catch(() => []);
      if (recent.length) return Response.json({ error: "Kolejną Rozmowę na progu możesz zamówić najwcześniej miesiąc po poprzedniej. Jeśli sprawa jest pilna, napisz do mnie przez stronę Kontakt." }, { status: 400 });
    }

    const token = newToken();
    const hash = await tokenHash(token);
    // To samo zgłoszenie czekające na płatność (ten sam e-mail, ostatnie 7 dni) — aktualizacja zamiast duplikatu.
    const dupe = await runSql(base44, `SELECT id FROM public.prog_applications WHERE lower(email) = ${escStr(email)}
      AND status = 'do_platnosci' AND created_date > now() - interval '${PAY_DAYS} days' ORDER BY created_date DESC LIMIT 1`, true);
    let id: string;
    const cols = `full_name = ${escStr(fullName)}, phone = ${phone ? escStr(phone) : "NULL"}, ankieta = ${escStr(JSON.stringify(ankieta))}::jsonb,
      podsumowanie_chce = ${chce ? "TRUE" : "FALSE"}, consent_adult = TRUE, consent_scope = TRUE, consent_scope_text = ${escStr(SCOPE_TEXT)},
      pay_token_hash = ${escStr(hash)}, pay_expires_at = now() + interval '${PAY_DAYS} days', updated_date = now()`;
    if (dupe.length) {
      id = String(dupe[0].id);
      await runSql(base44, `UPDATE public.prog_applications SET ${cols} WHERE id = ${escStr(id)}`);
      await progLog(base44, id, "system", "Zgłoszenie wysłane ponownie — odpowiedzi zaktualizowane, nowy link do płatności", "uczestnik");
    } else {
      const r = await runSql(base44, `INSERT INTO public.prog_applications (full_name, email) VALUES (${escStr(fullName)}, ${escStr(email)}) RETURNING id`);
      id = String(r[0].id);
      await runSql(base44, `UPDATE public.prog_applications SET ${cols} WHERE id = ${escStr(id)}`);
      await progLog(base44, id, "status", "Zgłoszenie z ankietą wysłane ze strony", "uczestnik", null, "do_platnosci");
    }

    const url = await loadAppUrl(base44);
    const payUrl = `${url}/rozmowa-na-progu/zgloszenie?t=${token}`;
    const av = await availability(base44).catch(() => ({ count: 0, dni: [] as string[] }));
    const terminy = av.dni.length ? `Najbliższe wolne dni: ${av.dni.join(", ")}.` : "";
    waitUntil((async () => {
      await sendProg(base44, "prog_zgloszenie", id, email, mailZgloszenie(fullName, payUrl, terminy)).catch((e) => console.error("prog mail:", String(e?.message || e).slice(0, 200)));
      const to = await adminTo(base44).catch(() => null);
      if (to) await sendMail(base44, {
        kind: "prog_admin", ref: id, to, subject: "Nowe zgłoszenie: Rozmowa na progu",
        html: wrap(`<p>Nowe zgłoszenie na Rozmowę na progu od: ${escHtml(fullName)}.</p><p>Odpowiedzi z ankiety są tylko w panelu.</p>
          <p><a style="color:#C9A24A" href="${url}/admin/rozmowa">Otwórz panel</a></p>`),
      }).catch(() => {});
    })());
    return Response.json({ ok: true, token, availability: av });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 300) }, { status: 400 });
  }
};

// === Supabase Edge ===
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
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status: 500, headers: CORS });
  }
});
