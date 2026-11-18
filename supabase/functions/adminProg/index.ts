// Rozmowa na progu — panel administratora (18.11.2026). Tylko rola admin.
// Lista z synchronizacją statusów (zamówienie → pakiet → rezerwacja), szczegóły, zamknięcie, notatka,
// wiadomość do uczestnika, podsumowanie (zapis, udostępnienie w koncie, pominięcie), usunięcie zgłoszenia.
import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, textField, requireAdmin } from "../_shared/supabase.ts";
import { loadAppUrl } from "../_shared/settings.ts";
import { progSync, progLog, STATUS_LABEL, PYTANIA, mailWiadomosc, mailPodsumowanie, sendProg } from "../_shared/prog.ts";

const APP_COLS = `a.id, a.created_date, a.full_name, a.email, a.phone, a.status, a.status_at, a.podsumowanie_chce,
  a.order_id, a.package_id, a.booking_id, a.pay_expires_at, a.notatka`;

async function one(base44, id: string) {
  const r = await runSql(base44, `SELECT ${APP_COLS}, a.ankieta FROM public.prog_applications a WHERE a.id = ${escStr(id)}::uuid`, true);
  if (!r.length) throw new Error("Nie ma takiego zgłoszenia.");
  return r[0];
}

async function setStatus(base44, app, to: string, actor: string, summary: string) {
  await runSql(base44, `UPDATE public.prog_applications SET status = ${escStr(to)}, status_at = now(), updated_date = now() WHERE id = ${escStr(app.id)}::uuid`);
  await progLog(base44, app.id, "status", summary, actor, app.status, to);
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    const actor = String(admin?.email || "admin");
    const body = await req.json().catch(() => ({}));
    const a = String(body.action || "list");

    if (a === "list") {
      await progSync(base44);
      const rows = await runSql(base44, `SELECT ${APP_COLS},
          (SELECT k.starts_at FROM public.bk_bookings k WHERE k.id = a.booking_id) AS termin,
          s.status AS podsumowanie, s.shared_at AS podsumowanie_at
        FROM public.prog_applications a LEFT JOIN public.prog_summaries s ON s.application_id = a.id
        ORDER BY a.status_at DESC LIMIT 300`, true);
      const stats = (await runSql(base44, `SELECT
          count(*)::int AS wszystkie,
          count(*) FILTER (WHERE status = 'do_platnosci')::int AS do_platnosci,
          count(*) FILTER (WHERE status IN ('oplacone','termin_wybrany'))::int AS w_toku,
          count(*) FILTER (WHERE status = 'odbyta')::int AS odbyte,
          (SELECT count(*)::int FROM public.prog_summaries WHERE status IN ('oczekuje','przygotowywane')) AS podsumowania
        FROM public.prog_applications`, true))[0];
      return Response.json({ rows, stats, labels: STATUS_LABEL });
    }

    const id = textField(body, "id", { max: 60 });
    const app = await one(base44, id);

    if (a === "detail") {
      const [log, sum, booking] = await Promise.all([
        runSql(base44, `SELECT at, kind, from_status, to_status, summary, actor FROM public.prog_log WHERE application_id = ${escStr(id)}::uuid ORDER BY at DESC LIMIT 100`, true),
        runSql(base44, `SELECT status, tresc, updated_at, shared_at, read_at FROM public.prog_summaries WHERE application_id = ${escStr(id)}::uuid`, true),
        app.booking_id ? runSql(base44, `SELECT starts_at, ends_at, status FROM public.bk_bookings WHERE id = ${escStr(app.booking_id)}::uuid`, true) : Promise.resolve([]),
      ]);
      return Response.json({ app, pytania: PYTANIA, log, summary: sum[0] || null, booking: booking[0] || null });
    }

    if (a === "close") {
      if (app.status === "zamkniete") return Response.json({ ok: true });
      const why = textField(body, "why", { max: 500, required: false });
      await runSql(base44, `UPDATE public.prog_applications SET pay_token_hash = NULL WHERE id = ${escStr(id)}::uuid`);
      await setStatus(base44, app, "zamkniete", actor, `Zamknięte przez prowadzącego${why ? `: ${why}` : ""}`);
      return Response.json({ ok: true });
    }

    if (a === "note") {
      const t = textField(body, "notatka", { max: 4000, required: false });
      await runSql(base44, `UPDATE public.prog_applications SET notatka = ${t ? escStr(t) : "NULL"}, updated_date = now() WHERE id = ${escStr(id)}::uuid`);
      return Response.json({ ok: true });
    }

    if (a === "mail") {
      const tresc = textField(body, "tresc", { max: 6000 });
      const url = await loadAppUrl(base44);
      await sendProg(base44, "prog_wiadomosc", id, app.email, mailWiadomosc(app.full_name, tresc, body.konto ? `${url}/konto?tab=rozmowa` : ""));
      await progLog(base44, id, "wiadomosc", "Wiadomość e-mail od prowadzącego", actor);
      return Response.json({ ok: true });
    }

    if (a === "summary_save" || a === "summary_share") {
      const tresc = textField(body, "tresc", { max: 20000 });
      if (!["odbyta", "nieobecnosc", "termin_wybrany", "oplacone"].includes(app.status))
        return Response.json({ error: "Podsumowanie można dodać po opłaceniu spotkania." }, { status: 400 });
      const share = a === "summary_share";
      await runSql(base44, `INSERT INTO public.prog_summaries (application_id, status, tresc, updated_at${share ? ", shared_at" : ""})
        VALUES (${escStr(id)}::uuid, ${escStr(share ? "wyslane" : "przygotowywane")}, ${escStr(tresc)}, now()${share ? ", now()" : ""})
        ON CONFLICT (application_id) DO UPDATE SET tresc = EXCLUDED.tresc, status = EXCLUDED.status, updated_at = now()${share ? ", shared_at = now()" : ""}`);
      if (share) {
        const url = await loadAppUrl(base44);
        await sendProg(base44, "prog_podsumowanie", id, app.email, mailPodsumowanie(app.full_name, app.email, url));
        await progLog(base44, id, "podsumowanie", "Podsumowanie udostępnione w koncie, powiadomienie e-mail wysłane", actor);
      } else {
        await progLog(base44, id, "podsumowanie", "Podsumowanie zapisane (wersja robocza)", actor);
      }
      return Response.json({ ok: true });
    }

    if (a === "summary_skip") {
      await runSql(base44, `INSERT INTO public.prog_summaries (application_id, status) VALUES (${escStr(id)}::uuid, 'pominiete')
        ON CONFLICT (application_id) DO UPDATE SET status = 'pominiete', updated_at = now()`);
      await progLog(base44, id, "podsumowanie", "Podsumowanie pominięte", actor);
      return Response.json({ ok: true });
    }

    // Trwałe usunięcie zgłoszenia z ankietą, historią i podsumowaniem. Zamówienie i rezerwacja zostają (rozliczenia).
    if (a === "delete") {
      if (body.confirm !== "USUŃ") return Response.json({ error: "Potwierdź usunięcie." }, { status: 400 });
      await runSql(base44, `UPDATE public.orders SET prog_app_id = NULL WHERE prog_app_id = ${escStr(id)}::uuid`);
      await runSql(base44, `DELETE FROM public.prog_applications WHERE id = ${escStr(id)}::uuid`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    const msg = String(error?.message || error);
    return Response.json({ error: msg === "FORBIDDEN" ? "Brak dostępu" : msg.slice(0, 300) }, { status: msg === "FORBIDDEN" ? 403 : 400 });
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
