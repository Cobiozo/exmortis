import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, requireAdmin, EMAIL_RE } from "../_shared/supabase.ts";
import { consentFilter } from "../_shared/mirror.ts";
import { safeEqual } from "../_shared/libraryAccess.ts";
import { getSetting, saveSetting, loadAppUrl } from "../_shared/settings.ts";
import { sendMail, mailConfig, mailReady } from "../_shared/smtp.ts";
import { moveLibraryEmail } from "../_shared/libraryAccess.ts";
import { libLog } from "../_shared/libraryNotify.ts";

// Zmiana adresu e-mail konta — wyłącznie z panelu administratora. Osobny moduł:
// istniejące tabele czyta i zmienia tylko w kolumnach adresu, z kopią i przywracaniem.

const TTL_H = 48;
const MAX_PROBY = 8;
// Supabase: tabela → kolumna adresu. orders zostają (adres na dokumentach bez zmian).
const SB = {
  registrations: "email", contact_messages: "email", podcast_applications: "email", powrot_applications: "email",
  quiz_result: "email", subscribers: "email", campaign_recipients: "email", users: "email", waitlist: "email", webinar_1_11: "email",
};
// Aplikacja: encja → pole adresu. Consent, License, Withdrawal zostają (dowody/dokumenty).
const APP = {
  Access: "user_email", ActiveStream: "user_email", LessonProgress: "user_email", ObokOdsluch: "user_email",
  ObokUczestnik: "user_email", PlaybackLog: "user_email", SecurityLog: "user_email", ContactMessage: "email",
  PodcastApplication: "email", PodcastGuest: "email", PowrotApplication: "email", PendingRegistration: "email",
};
const KEEP = { orders: "buyer_email", Consent: "email", License: "user_email", Withdrawal: "email" };

const lc = (s) => String(s || "").trim().toLowerCase();
const rx = (e) => ({ $regex: `^${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" });
const mask = (e) => { const [u, d] = String(e || "").split("@"); return d ? `${u.slice(0, 2)}***@${d}` : "—"; };
async function sha(t) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const enabled = async (b) => (await getSetting(b, "zmiana_email").catch(() => null))?.wlaczona !== false;
const wrap = (h) => `<div style="font-family:Arial,sans-serif;background:#0A0A0B;color:#E2E2E2;padding:32px"><p style="color:#C9A24A;letter-spacing:3px;font-size:12px">EXMORTIS</p>${h}</div>`;

// Wszystkie dane osoby (pełne wiersze) — do planu, kopii i przeniesienia.
async function collect(base44, email) {
  const sr = base44.asServiceRole.entities;
  const sb = {}, app = {}, keep = {};
  await Promise.all(Object.entries(SB).map(async ([t, c]) => { sb[t] = await runSql(base44, `SELECT * FROM public.${t} WHERE lower(${c}) = ${escStr(email)}`, true); }));
  keep.orders = (await runSql(base44, `SELECT id FROM public.orders WHERE lower(buyer_email) = ${escStr(email)}`, true)).length;
  for (const [e, f] of Object.entries(APP)) app[e] = await sr[e].filter({ [f]: rx(email) }, "-created_date", 5000);
  for (const e of ["Consent", "License", "Withdrawal"]) keep[e] = (await (e === "Consent"
    ? consentFilter(base44, { [KEEP[e]]: rx(email) }, "-created_date", 5000)
    : sr[e].filter({ [KEEP[e]]: rx(email) }, "-created_date", 5000))).length;
  const user = (await sr.User.filter({ email }))[0] || null;
  return { sb, app, keep, user };
}
function planOf(d) {
  return [
    ...Object.entries(d.sb).map(([t, r]) => ({ baza: "Supabase", zbior: t, liczba: r.length, akcja: "przeniesienie" })),
    ...Object.entries(d.app).map(([e, r]) => ({ baza: "Aplikacja", zbior: e, liczba: r.length, akcja: "przeniesienie" })),
    { baza: "Supabase", zbior: "orders", liczba: d.keep.orders, akcja: "zostaje (adres na dokumentach), dostępy przechodzą" },
    { baza: "Aplikacja", zbior: "Consent", liczba: d.keep.Consent, akcja: "bez zmian + adnotacja" },
    { baza: "Aplikacja", zbior: "License", liczba: d.keep.License, akcja: "zostaje (dokument)" },
    { baza: "Aplikacja", zbior: "Withdrawal", liczba: d.keep.Withdrawal, akcja: "zostaje (dokument)" },
    { baza: "Aplikacja", zbior: "Konto i rola", liczba: d.user ? 1 : 0, akcja: d.user ? `rola „${d.user.role}” → nowe konto, stare zablokowane` : "brak konta" },
  ].filter((x) => x.liczba > 0);
}

async function newUser(base44, email) {
  return (await base44.asServiceRole.entities.User.filter({ email }))[0] || null;
}

// Przeniesienie — idempotentne (można ponawiać). Kopia robiona raz, przed pierwszą zmianą.
async function transfer(base44, ch) {
  const sr = base44.asServiceRole.entities;
  const o = ch.old_email, n = ch.new_email;
  const nu = await newUser(base44, n);
  if (!nu) throw new Error("Nowe konto jeszcze nie istnieje (zaproszenie nieprzyjęte).");
  if (!ch.kopia) {
    const d = await collect(base44, o);
    const consents = await sr.Consent.filter({ email: rx(o) }, "-created_date", 5000);
    const kopia = { old_email: o, new_email: n, supabase: d.sb, aplikacja: d.app, consent_ids: consents.map((c) => c.id),
      konto_stare: d.user ? { id: d.user.id, role: d.user.role, imie: d.user.imie || null } : null, konto_nowe: { id: nu.id, role: nu.role } };
    await sr.EmailChange.update(ch.id, { kopia, kopia_at: new Date().toISOString(), plan: planOf(d) });
    ch.kopia = kopia;
  }
  await sr.EmailChange.update(ch.id, { status: "przenoszenie" });
  for (const [t, c] of Object.entries(SB)) {
    await runSql(base44, `UPDATE public.${t} SET ${c} = ${escStr(n)} WHERE lower(${c}) = ${escStr(o)}`);
  }
  for (const [e, f] of Object.entries(APP)) {
    const ids = (ch.kopia.aplikacja[e] || []).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) await sr[e].updateMany({ id: { $in: ids.slice(i, i + 500) } }, { $set: { [f]: n } });
  }
  // Biblioteka i wiadomości: krok dodatkowy po przeniesieniu adresu. Błąd biblioteki NIE może
  // zablokować zmiany adresu — wpis w historii bez pełnych adresów.
  try {
    await moveLibraryEmail(base44, o, n);
  } catch (e) {
    await libLog(base44, "zmiana_adresu", "biblioteka_blad", "klient", null, "danych biblioteki nie przeniesiono").catch(() => {});
  }
  const done = new Set((await sr.ConsentNote.filter({ change_id: ch.id }, "-created_date", 5000)).map((x) => x.consent_id));
  const date = new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
  const notes = ch.kopia.consent_ids.filter((id) => !done.has(id)).map((id) => ({ consent_id: id, change_id: ch.id, text: `adres zmieniony z ${o} na ${n}, ${date}` }));
  if (notes.length) await sr.ConsentNote.bulkCreate(notes);
  const old = ch.kopia.konto_stare;
  await sr.User.update(nu.id, { role: old?.role && old.role !== "zablokowane" ? old.role : "user", ...(old?.imie ? { imie: old.imie } : {}) });
  if (old) await sr.User.update(old.id, { role: "zablokowane" });
  await sr.EmailChange.update(ch.id, { status: "przeniesiono", przeniesiono_at: new Date().toISOString(), blad: null });
  await sendMail(base44, { to: o, kind: "zmiana_email", subject: "exmortis: adres e-mail konta został zmieniony", html: wrap(`<p>Adres e-mail konta został zmieniony.</p>`) }).catch(() => {});
}

async function restore(base44, ch) {
  const sr = base44.asServiceRole.entities;
  const k = ch.kopia;
  if (!k) throw new Error("Brak kopii.");
  for (const [t, c] of Object.entries(SB)) {
    const rows = k.supabase[t] || [];
    if (!rows.length) continue;
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length) await runSql(base44, `UPDATE public.${t} SET ${c} = ${escStr(k.old_email)} WHERE id IN (${ids.map(escStr).join(",")})`);
    else await runSql(base44, `UPDATE public.${t} SET ${c} = ${escStr(k.old_email)} WHERE lower(${c}) = ${escStr(k.new_email)}`);
  }
  for (const [e, f] of Object.entries(APP)) {
    const ids = (k.aplikacja[e] || []).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) await sr[e].updateMany({ id: { $in: ids.slice(i, i + 500) } }, { $set: { [f]: k.old_email } });
  }
  await sr.ConsentNote.deleteMany({ change_id: ch.id });
  if (k.konto_stare) await sr.User.update(k.konto_stare.id, { role: k.konto_stare.role });
  if (k.konto_nowe) await sr.User.update(k.konto_nowe.id, { role: k.konto_nowe.role === "zablokowane" ? "user" : k.konto_nowe.role }).catch(() => {});
  await sr.EmailChange.update(ch.id, { status: "przywrocono", przywrocono_at: new Date().toISOString() });
}

const view = (c) => ({ id: c.id, old: mask(c.old_email), new: c.new_email ? mask(c.new_email) : null, status: c.status, kto: c.kto, created_date: c.created_date,
  expires_at: c.expires_at, plan: c.plan || null, ma_kopie: !!c.kopia, kopia_at: c.kopia_at || null, blad: c.blad || null, proby: c.proby || 0 });

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));

    // ---- Publiczne: strona z linku ----
    if (body.action === "check" || body.action === "submit") {
      const ch = (await sr.EmailChange.filter({ token_hash: await sha(String(body.t || "")) }))[0];
      const valid = ch && ch.status === "wyslano" && new Date(ch.expires_at) > new Date();
      if (ch && ch.status === "wyslano" && !valid) await sr.EmailChange.update(ch.id, { status: "wygaslo" });
      if (!valid) return Response.json({ error: "Link wygasł albo został już użyty." }, { status: 410 });
      if (body.action === "check") return Response.json({ ok: true });
      const a = lc(body.email1), b = lc(body.email2);
      if (!EMAIL_RE.test(a)) return Response.json({ error: "Podaj poprawny adres e-mail." }, { status: 400 });
      if (a !== b) return Response.json({ error: "Adresy nie są takie same." }, { status: 400 });
      if (a === ch.old_email) return Response.json({ error: "To jest obecny adres." }, { status: 400 });
      if (await newUser(base44, a)) return Response.json({ error: "Ten adres jest już używany." }, { status: 400 });
      await sr.EmailChange.update(ch.id, { new_email: a, status: "podano", podano_at: new Date().toISOString(), token_hash: "uzyty:" + ch.id });
      return Response.json({ ok: true });
    }

    // ---- Ponawianie (harmonogram): wykrycie przyjęcia zaproszenia i ponowienie nieudanych przeniesień ----
    if (body.action === "tick") {
      // Dostęp: administrator albo cronTick z tokenem zadania (mb_settings). Najwyżej jeden przebieg na 5 minut.
      const who = await base44.auth.me().catch(() => null);
      if (who?.role !== "admin") {
        const tk = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
        const stored = tk?.[0]?.tick_token || "";
        const given = typeof body.tick_token === "string" ? body.tick_token : "";
        if (!stored || !given || !(await safeEqual(given, stored))) return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const lock = await runSql(
        base44,
        `INSERT INTO public.app_settings (key, value, updated_date)
           VALUES ('email_change_tick', jsonb_build_object('at', now()), now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
           WHERE public.app_settings.updated_date < now() - interval '240 seconds'
         RETURNING key`
      ).catch(() => [{ key: "email_change_tick" }]);
      if (!lock || !lock.length) return Response.json({ ok: true, skipped: true });
      const open = await sr.EmailChange.filter({ status: { $in: ["podano", "przenoszenie", "blad"] } }, "created_date", 50);
      let accepted = 0, moved = 0;
      for (const c of open) {
        if (c.status === "podano") { if (await newUser(base44, c.new_email)) { await sr.EmailChange.update(c.id, { status: "przyjeto" }); accepted++; } continue; }
        if ((c.proby || 0) >= MAX_PROBY) continue;
        try { await transfer(base44, c); moved++; } catch (e) { await sr.EmailChange.update(c.id, { status: "blad", proby: (c.proby || 0) + 1, blad: String(e?.message || e).slice(0, 300) }); }
      }
      const stale = await sr.EmailChange.filter({ status: "wyslano", expires_at: { $lt: new Date().toISOString() } }, "created_date", 200);
      for (const c of stale) await sr.EmailChange.update(c.id, { status: "wygaslo" });
      return Response.json({ ok: true, accepted, moved, expired: stale.length });
    }

    // ---- Administrator ----
    const me = await requireAdmin(base44);
    // Zaproszenie platformy może wysłać tylko sesja administratora — wysyłamy przy każdym wejściu do panelu.
    for (const c of (await sr.EmailChange.filter({ status: "podano" }, "created_date", 50)).filter((x) => !x.zaproszono_at)) {
      await base44.users.inviteUser(c.new_email, "user").then(() => sr.EmailChange.update(c.id, { zaproszono_at: new Date().toISOString() }))
        .catch((e) => sr.EmailChange.update(c.id, { blad: `Zaproszenie: ${String(e?.message || e).slice(0, 200)}` }));
    }

    if (body.action === "settings") {
      if (typeof body.wlaczona === "boolean") await saveSetting(base44, "zmiana_email", { wlaczona: body.wlaczona });
      return Response.json({ wlaczona: await enabled(base44) });
    }

    if (body.action === "log") {
      const rows = await sr.EmailChange.filter({}, "-created_date", 100);
      return Response.json({ log: rows.map(view) });
    }

    if (body.action === "aliases") {
      const e = lc(body.email);
      const rows = [...await sr.EmailChange.filter({ old_email: e, status: "przeniesiono" }), ...await sr.EmailChange.filter({ new_email: e, status: "przeniesiono" })];
      return Response.json({ aliases: rows.map((r) => ({ old: r.old_email, new: r.new_email, at: r.przeniesiono_at })) });
    }

    const email = lc(body.email);

    if (body.action === "state") {
      const [mail, on] = [mailReady(await mailConfig(base44)), await enabled(base44)];
      let ch = (await sr.EmailChange.filter({ old_email: email }, "-created_date", 1))[0] || null;
      if (ch?.status === "podano" && (await newUser(base44, ch.new_email))) { await sr.EmailChange.update(ch.id, { status: "przyjeto" }); ch = { ...ch, status: "przyjeto" }; }
      if (ch?.status === "wyslano" && new Date(ch.expires_at) < new Date()) { await sr.EmailChange.update(ch.id, { status: "wygaslo" }); ch = { ...ch, status: "wygaslo" }; }
      return Response.json({ mail, on, change: ch ? view(ch) : null });
    }

    if (body.action === "start") {
      if (!(await enabled(base44))) return Response.json({ error: "Funkcja wyłączona w ustawieniach." }, { status: 400 });
      if (!mailReady(await mailConfig(base44))) return Response.json({ error: "Wymaga skonfigurowanej wysyłki e-mail" }, { status: 400 });
      if (!EMAIL_RE.test(email)) return Response.json({ error: "Zły adres." }, { status: 400 });
      const open = await sr.EmailChange.filter({ old_email: email, status: { $in: ["wyslano", "podano", "przyjeto", "przenoszenie", "blad"] } });
      for (const c of open.filter((c) => c.status === "wyslano")) await sr.EmailChange.update(c.id, { status: "wygaslo" });
      if (open.some((c) => c.status !== "wyslano")) return Response.json({ error: "Dla tej osoby trwa już zmiana adresu." }, { status: 400 });
      const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
      const ch = await sr.EmailChange.create({ old_email: email, token_hash: await sha(token), status: "wyslano", kto: me.email,
        expires_at: new Date(Date.now() + TTL_H * 3600e3).toISOString(), test: body.test === true });
      const url = `${await loadAppUrl(base44)}/zmiana-adresu?t=${token}`;
      const r = await sendMail(base44, { to: email, kind: "zmiana_email", ref: ch.id, subject: "exmortis: zmiana adresu e-mail konta",
        html: wrap(`<p>Na Twoją prośbę możesz zmienić adres e-mail konta. Kliknij, aby podać nowy adres.</p><p><a href="${url}" style="display:inline-block;background:#C9A24A;color:#0A0A0B;padding:12px 24px;text-decoration:none">PODAJ NOWY ADRES</a></p><p style="color:#8A8A8C;font-size:12px">Link jest jednorazowy i ważny 48 godzin.</p>`) });
      return Response.json({ ok: true, sent: r, ...(body.test === true ? { test_token: token } : {}) });
    }

    const ch = body.id ? await sr.EmailChange.get(body.id) : null;
    if (!ch) return Response.json({ error: "Nie znaleziono procesu." }, { status: 404 });

    if (body.action === "plan") {
      const d = await collect(base44, ch.old_email);
      return Response.json({ plan: planOf(d), nowe_konto: !!(ch.new_email && (await newUser(base44, ch.new_email))) });
    }
    if (body.action === "transfer") {
      if (!["przyjeto", "blad"].includes(ch.status)) return Response.json({ error: "Zaproszenie nie zostało jeszcze przyjęte." }, { status: 400 });
      try { await transfer(base44, ch); }
      catch (e) {
        await sr.EmailChange.update(ch.id, { status: "blad", proby: (ch.proby || 0) + 1, blad: String(e?.message || e).slice(0, 300) });
        return Response.json({ error: `Przeniesienie przerwane, ponowię automatycznie: ${e?.message || e}` }, { status: 500 });
      }
      return Response.json({ ok: true });
    }
    if (body.action === "backup") return Response.json({ kopia: ch.kopia || null });
    if (body.action === "restore") { await restore(base44, ch); return Response.json({ ok: true }); }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error?.message === "FORBIDDEN") return Response.json({ error: "Brak dostępu" }, { status: 403 });
    return Response.json({ error: error.message }, { status: 500 });
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
