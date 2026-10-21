import { waitUntil } from "base44:runtime";
import { runSql, escStr, rpc } from "./supabase.ts";
import { mirrorRecord, consentFilter } from "./mirror.ts";
import { getSetting, loadAppUrl } from "./settings.ts";
import { sendConfirmationMail } from "./events.ts";
import { sendMail } from "./smtp.ts";
import { regulaminVersion } from "./legalDocs.ts";

// Zapisy na spotkania: dwa zapytania do Supabase (odczyt + INSERT), bez zmian struktury tabel.
// Gdy Supabase nie odpowiada — zgłoszenie trafia do kolejki w bazie aplikacji i jest ponawiane.

export const ACTIVE = ["Zapisany", "Obecny", "Lista rezerwowa"];
export const MAX_PROBY = 8; // tick co 15 min → ok. 2 godziny ponowień
export const REGULAMIN_TEXT = "Akceptuję regulamin.";
export const REGULAMIN_VERSION = "1.0";
export const LISTY_TEXT = "Chcę też dostawać Listy powrotu — jeden list w każdy poniedziałek.";

const ts = (v) => (v ? `${escStr(v)}::timestamptz` : "now()");

export const RPC_ERRORS = {
  not_found: [404, "Nie znaleziono wydarzenia"],
  unavailable: [400, "To wydarzenie nie jest już dostępne."],
  no_site: [400, "To wydarzenie nie przyjmuje zapisów na stronie."],
  closed: [400, "Zapisy zamknięte."],
  rate: [429, "Za dużo zapisów w krótkim czasie. Spróbuj za kilka minut."],
};

// Cały zapis jednym wywołaniem funkcji bazy public.exm_register (walidacja, limit IP, unikalność, lista rezerwowa).
export function rpcRegister(base44, d, skipRate = false) {
  return rpc(base44, "exm_register", {
    p_slug: d.slug, p_email: d.email, p_first_name: d.first_name, p_question: d.question || null,
    p_source: d.source || null, p_ip: d.ip || "brak", p_listy: !!d.listy, p_at: d.at, p_skip_rate: skipRate,
  });
}

// Wydarzenie + liczba zapisanych + limit IP + istniejący zapis — jednym zapytaniem.
export async function loadForRegister(base44, slug, email, ip) {
  const rows = await runSql(
    base44,
    `SELECT row_to_json(e) AS ev,
       (SELECT COUNT(*) FROM public.registrations r WHERE r.event_id = e.id AND r.status IN ('Zapisany','Obecny'))::int AS registered,
       (SELECT COUNT(*) FROM public.registrations r WHERE r.ip = ${escStr(ip)} AND r.created_at > now() - interval '10 minutes')::int AS recent,
       (SELECT r.status FROM public.registrations r WHERE r.event_id = e.id AND r.email = ${escStr(email)}) AS existing
     FROM public.events e WHERE e.slug = ${escStr(slug)}`,
    true
  );
  return rows?.[0] || null;
}

// INSERT odporny na wyścig: indeks unikalny (event_id, email). null = adres już zapisany.
export async function insertRegistration(base44, ev, d) {
  const cap = Number(ev.capacity) || 0;
  const rows = await runSql(
    base44,
    `INSERT INTO public.registrations
       (id, event_id, first_name, email, question_for_dawid, consent, status, source, ip, listy_zgoda_at, created_at)
     VALUES (gen_random_uuid()::text, ${escStr(ev.id)}, ${escStr(d.first_name)}, ${escStr(d.email)},
       ${d.question ? escStr(d.question) : "NULL"}, TRUE,
       CASE WHEN ${cap} > 0 AND (SELECT COUNT(*) FROM public.registrations WHERE event_id = ${escStr(ev.id)} AND status IN ('Zapisany','Obecny')) >= ${cap}
         THEN 'Lista rezerwowa' ELSE 'Zapisany' END,
       ${d.source ? escStr(d.source) : "NULL"}, ${escStr(d.ip || "brak")}, ${d.listy ? ts(d.at) : "NULL"}, ${ts(d.at)})
     ON CONFLICT (event_id, email) DO UPDATE SET
       first_name = EXCLUDED.first_name, question_for_dawid = EXCLUDED.question_for_dawid, consent = TRUE,
       status = EXCLUDED.status, source = EXCLUDED.source, ip = EXCLUDED.ip,
       listy_zgoda_at = EXCLUDED.listy_zgoda_at, created_at = EXCLUDED.created_at
       WHERE public.registrations.status NOT IN ('Zapisany','Obecny','Lista rezerwowa')
     RETURNING id, first_name, email, status, cancel_token`
  );
  return rows?.[0] || null;
}

// Dowód zgody: e-mail + treść + data i godzina + IP + identyfikator zapisu (ref_id).
export async function saveConsents(base44, d, refId) {
  const base = { email: d.email, source: `spotkanie:${d.slug}`, ref_id: refId, ip: d.ip, given_at: d.at };
  const list = [{ ...base, kind: "wydarzenie", text: REGULAMIN_TEXT, doc_version: `regulamin ${await regulaminVersion(base44)}` }];
  if (d.listy) list.push({ ...base, kind: "newsletter", text: LISTY_TEXT });
  const made = await base44.asServiceRole.entities.Consent.bulkCreate(list);
  for (const c of made || []) await mirrorRecord(base44, "Consent", c.id);
}

// Po udanym zapisie: newsletter (jeśli zgoda) i e-mail potwierdzający.
let tzReady = false;
// Kolumna strefy gościa (do maili „u Ciebie”).
export async function ensureTzColumn(base44) {
  if (tzReady) return;
  await runSql(base44, `ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS tz text`);
  tzReady = true;
}

export function afterSaved(base44, ev, reg, d) {
  const tz = typeof d.tz === "string" && /^[A-Za-z_+\-\/0-9]{1,64}$/.test(d.tz) ? d.tz : null;
  if (tz) reg = { ...reg, tz };
  const jobs = [loadAppUrl(base44).then(() => sendConfirmationMail(base44, ev, reg))];
  if (tz) jobs.push(ensureTzColumn(base44).then(() => runSql(base44, `UPDATE public.registrations SET tz = ${escStr(tz)} WHERE id = ${escStr(reg.id)}`)));
  if (d.listy) {
    jobs.push(import("./newsletter.ts").then((m) => m.addSubscriber(base44, { email: d.email, name: d.first_name, consentGiven: true })));
  }
  return Promise.allSettled(jobs);
}

// Supabase nie odpowiada → kolejka + zgody od razu; ponowienie za 20 s i w każdym ticku.
export async function enqueue(base44, d, err) {
  const Q = base44.asServiceRole.entities.PendingRegistration;
  const p = await Q.create({ ...d, status: "oczekujace", proby: 0, blad: String(err?.message || err).slice(0, 300) });
  await saveConsents(base44, d, `kolejka:${p.id}`);
  console.log("Zapis w kolejce:", p.id, String(err?.message || err).slice(0, 200));
  waitUntil(new Promise((r) => setTimeout(r, 20000)).then(() => flushQueue(base44)).catch(() => {}));
  return p;
}

export async function flushQueue(base44, { simulateDown = false } = {}) {
  const Q = base44.asServiceRole.entities.PendingRegistration;
  const items = await Q.filter({ status: "oczekujace" }, "created_date", 50);
  let moved = 0, failed = 0;
  for (const p of items) {
    try {
      if (simulateDown) throw new Error("Symulowana awaria Supabase");
      const res = await rpcRegister(base44, p, true);
      if (res.error) throw new Error(`Zapis odrzucony: ${res.error}`);
      const reg = res.reg || null;
      const ev = res.ev;
      const regId = reg?.id || res.reg_id;
      const affected = await consentFilter(base44, { ref_id: `kolejka:${p.id}` });
      await base44.asServiceRole.entities.Consent.updateMany({ ref_id: `kolejka:${p.id}` }, { $set: { ref_id: regId } });
      for (const c of affected) await mirrorRecord(base44, "Consent", c.id);
      await Q.update(p.id, { status: "przeniesione", reg_id: regId, przeniesiono_at: new Date().toISOString() });
      if (reg) await afterSaved(base44, ev, reg, p);
      moved++;
    } catch (e) {
      const proby = (p.proby || 0) + 1;
      const dead = proby >= MAX_PROBY;
      await Q.update(p.id, { proby, blad: String(e?.message || e).slice(0, 300), status: dead ? "nieudane" : "oczekujace" });
      if (dead) failed++;
    }
  }
  const alarm = await sendAlarm(base44); // także zaległe, jeśli poprzednia wysyłka alarmu się nie udała
  return { checked: items.length, moved, failed, alarm };
}

// E-mail alarmowy na adres firmy z ustawień (SMTP; zapasowo poczta platformy, potem administratorzy).
export async function sendAlarm(base44) {
  const Q = base44.asServiceRole.entities.PendingRegistration;
  const total = await Q.filter({ status: "nieudane" }, "created_date", 1000);
  const fresh = total.filter((x) => !x.alarm_at);
  if (!fresh.length) return null;
  const firma = await getSetting(base44, "firma").catch(() => null);
  const subject = `exmortis: ${fresh.length} zapis(ów) na spotkanie nie udało się przenieść`;
  const html = `<p>Nie udało się zapisać w bazie Supabase <strong>${fresh.length}</strong> nowych zgłoszeń na spotkania (łącznie nieprzeniesionych: ${total.length}), mimo ${MAX_PROBY} prób.</p>
<p>Zgłoszenia nie zginęły — są w bazie aplikacji (PendingRegistration, status „nieudane”). Po usunięciu awarii zmień ich status na „oczekujące”, a zostaną przeniesione automatycznie.</p>
<p>Spotkania: ${[...new Set(fresh.map((x) => x.slug))].join(", ")}</p>`;
  let via = null;
  const to = firma?.email;
  if (to) {
    via = await sendMail(base44, { to, subject, html, kind: "alarm" }).then((r) => (r === "wyslany" ? "smtp" : null)).catch(() => null);
    if (!via) via = await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html }).then(() => "platforma").catch(() => null);
  }
  if (!via) {
    const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
    for (const a of admins) {
      if (await base44.asServiceRole.integrations.Core.SendEmail({ to: a.email, subject, body: html }).then(() => true).catch(() => false)) via = "admin";
    }
  }
  const at = new Date().toISOString();
  await Promise.all(fresh.map((x) => Q.update(x.id, { alarm_at: at })));
  return { count: fresh.length, via };
}

// Ostatnia kopia publicznych danych wydarzenia — do sprawdzenia zapisu, gdy Supabase nie działa.
export async function snapEvent(base44, slug) {
  const row = (await base44.asServiceRole.entities.PublicSnapshot.filter({ key: `events:get:${slug}` }, "-refreshed_at", 1).catch(() => []))[0];
  return row?.value?.v || null;
}