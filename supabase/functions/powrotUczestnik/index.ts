import { createClientFromRequest } from "../_shared/compat.ts";
import { waitUntil } from "../_shared/shim.ts";
import { runSql, esc, escStr, textField } from "../_shared/supabase.ts";
import { loadAppUrl, APP_URL as APP } from "../_shared/settings.ts";
import { sendMail, adminTo } from "../_shared/smtp.ts";
import { wrap, escHtml } from "../_shared/powrotSurvey.ts";

// Moje konto → „Mój POWRÓT” (18.11.2026): widok uczestnika programu (zalogowany, po adresie e-mail).
// Zwraca wyłącznie: status udziału, postęp sesji z pakietu „Sesja POWRÓT” i wiadomości z mentorem.
// Nigdy nie zwraca odpowiedzi z ankiety ani notatek mentora.
const PARTICIPANT = `('w_programie','wstrzymany','zakonczony')`;
const WRITTEN_PER_WEEK = 2;

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 });
    const email = String(me.email).trim().toLowerCase();
    const body = await req.json().catch(() => ({}));

    const apps = await runSql(base44, `SELECT id, full_name, status, wspolpraca_od, wspolpraca_do FROM public.powrot_applications
      WHERE lower(email) = ${escStr(email)} AND status IN ${PARTICIPANT} ORDER BY status_at DESC NULLS LAST LIMIT 1`, true);
    const app = apps && apps[0];
    if (!app) return Response.json({ participant: false });

    const weekCount = async () => {
      const r = await runSql(base44, `SELECT count(*)::int AS n FROM public.powrot_messages WHERE application_id = ${esc(app.id)}
        AND kierunek = 'uczestnik'
        AND date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw')`, true);
      return r?.[0]?.n ?? 0;
    };

    if (body.action === "send") {
      if (app.status !== "w_programie") return Response.json({ error: "Wiadomości są dostępne w trakcie programu." }, { status: 400 });
      const tresc = textField(body, "tresc", { max: 4000 });
      if ((await weekCount()) >= WRITTEN_PER_WEEK)
        return Response.json({ error: `W tym tygodniu wysłano już ${WRITTEN_PER_WEEK} wiadomości. Kolejną możesz wysłać od poniedziałku. W nagłej sytuacji: 116 123, 800 70 2222, 112.` }, { status: 429 });
      await runSql(base44, `INSERT INTO public.powrot_messages (application_id, kierunek, tresc) VALUES (${esc(app.id)}, 'uczestnik', ${esc(tresc)})`);
      await runSql(base44, `INSERT INTO public.powrot_log (application_id, kind, summary, actor) VALUES (${esc(app.id)}, 'wiadomosc', 'Wiadomość od uczestnika w Moim koncie', 'uczestnik')`).catch(() => {});
      waitUntil((async () => {
        await loadAppUrl(base44).catch(() => {});
        const admin = await adminTo(base44).catch(() => null);
        if (admin) await sendMail(base44, { kind: "powrot", ref: app.id, to: admin, subject: "Nowa wiadomość od uczestnika POWRÓT",
          html: wrap(`<p>Nowa wiadomość w Moim koncie od: ${escHtml(app.full_name)}. Odpowiedź do 48 godzin w dni robocze.</p><p>Treść jest tylko w panelu.</p><p><a style="color:#C9A24A" href="${APP}/admin/powrot">Otwórz panel</a></p>`) }).catch(() => {});
      })());
    }

    const [msgs, pk, n] = await Promise.all([
      runSql(base44, `SELECT id, kierunek, tresc, created_at FROM public.powrot_messages WHERE application_id = ${esc(app.id)} ORDER BY created_at DESC LIMIT 100`, true),
      runSql(base44, `SELECT pk.sessions_total, pk.sessions_used, pk.valid_until,
          (SELECT count(*)::int FROM public.bk_bookings k WHERE k.package_id = pk.id AND k.status = 'ODBYLA_SIE') AS odbyte,
          (SELECT min(k.starts_at) FROM public.bk_bookings k WHERE k.package_id = pk.id AND k.status = 'POTWIERDZONA' AND k.starts_at > now()) AS nastepna
        FROM public.bk_packages pk JOIN public.bk_types t ON t.id = pk.type_id
        WHERE t.slug = 'sesja-powrot' AND lower(pk.email_display) = ${escStr(email)} ORDER BY pk.created_at DESC LIMIT 1`, true),
      weekCount(),
    ]);
    return Response.json({
      participant: true,
      first_name: String(app.full_name || "").trim().split(/\s+/)[0] || "",
      status: app.status, od: app.wspolpraca_od, do: app.wspolpraca_do,
      sessions: pk?.[0] || null,
      messages: msgs || [],
      written_left: Math.max(0, WRITTEN_PER_WEEK - n),
      sent: body.action === "send",
    });
  } catch (error) {
    const msg = String(error?.message || error);
    return Response.json({ error: msg.slice(0, 300) }, { status: 400 });
  }
};

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
