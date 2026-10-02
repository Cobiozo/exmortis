import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import { runSql, escStr, textField, requireAdmin } from "../../shared/supabase.ts";
import { getSetting } from "../../shared/settings.ts";
import {
  sendBroadcastMail,
  sendCancelledMail,
  sendSpotFreedMail,
  sendReminderMail,
  sendRecordingMail,
} from "../../shared/events.ts";

// Administracja wydarzeniami: lista, szczegóły z uczestnikami, zapis/edycja,
// duplikacja, powtarzanie (Wieczory powrotu), odwołanie, usuwanie, obecność,
// awans z listy rezerwowej, przypomnienie „teraz", wysyłka nagrania,
// usuwanie danych uczestnika i wiadomości do zapisanych.

const EVENT_TYPES = [
  "Spotkanie otwarte",
  "Wieczór powrotu",
  "Live",
  "Webinar",
  "Warsztat",
  "Warsztat online",
  "Krąg",
  "Retreat",
  "Spotkanie stacjonarne",
  "Inne",
];
const FORMATS = ["Online", "Stacjonarnie"];
const REG_TYPES = ["Zapis na stronie", "Link zewnętrzny", "Bez zapisu"];
const STATUSES = ["Opublikowane", "Szkic", "Odwołane"];
const STAGES = ["Śmierć", "Próg", "Powrót", "Inny", "Wszystkie"];

const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dtOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function escDt(v) {
  const iso = dtOrNull(v);
  return iso ? `${escStr(iso)}::timestamptz` : "NULL";
}

// Dodatkowe kolumny modułu spotkań (idempotentnie).
export async function ensureEventColumns(base44) {
  await runSql(
    base44,
    `ALTER TABLE public.events
       ADD COLUMN IF NOT EXISTS cancel_reason text,
       ADD COLUMN IF NOT EXISTS registration_deadline timestamptz,
       ADD COLUMN IF NOT EXISTS recording_until timestamptz,
       ADD COLUMN IF NOT EXISTS mailing_group text,
       ADD COLUMN IF NOT EXISTS what_registered text,
       ADD COLUMN IF NOT EXISTS join_password text`
  );
}

// Godzina 20:00 w Europe/Warsaw dla danego dnia → ISO.
function warsawEvening(y, m, day) {
  for (const off of [2, 1]) {
    const d = new Date(
      `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T20:00:00+0${off}:00`
    );
    const parts = {};
    for (const p of new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d)) {
      parts[p.type] = p.value;
    }
    if (
      Number(parts.year) === y &&
      Number(parts.month) === m &&
      Number(parts.day) === day &&
      `${parts.hour}:${parts.minute}` === "20:00"
    ) {
      return d.toISOString();
    }
  }
  return new Date(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T19:00:00Z`).toISOString();
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    // --- Lista wydarzeń z licznikami zapisów ---
    if (body.action === "list") {
      await ensureEventColumns(base44);
      const rows = await runSql(
        base44,
        `SELECT e.*,
           (SELECT COUNT(*) FROM public.registrations r
             WHERE r.event_id = e.id AND r.status IN ('Zapisany','Obecny'))::int AS registered,
           (SELECT COUNT(*) FROM public.registrations r
             WHERE r.event_id = e.id AND r.status = 'Lista rezerwowa')::int AS waitlist
         FROM public.events e
         ORDER BY COALESCE(e.start_datetime, e.created_at) DESC`,
        true
      );
      return Response.json({ events: rows || [] });
    }

    // --- Szczegóły wydarzenia + uczestnicy ---
    if (body.action === "get") {
      const id = String(body.id || "");
      const evRows = await runSql(base44, `SELECT * FROM public.events WHERE id = ${escStr(id)}`, true);
      const parts = await runSql(
        base44,
        `SELECT id, first_name, email, question_for_dawid, status, source, created_at
         FROM public.registrations WHERE event_id = ${escStr(id)}
         ORDER BY created_at ASC`,
        true
      );
      return Response.json({ event: (evRows && evRows[0]) || null, participants: parts || [] });
    }

    // --- Zapis nowego lub istniejącego wydarzenia ---
    if (body.action === "save") {
      await ensureEventColumns(base44);
      const ev = body.event;
      if (!ev || typeof ev !== "object") {
        return Response.json({ error: "Brak danych wydarzenia" }, { status: 400 });
      }
      const title = textField(ev, "title", { max: 200 });
      const slug = (typeof ev.slug === "string" && ev.slug.trim() !== "" ? ev.slug.trim() : slugify(title)).slice(0, 200);
      const subtitle = textField(ev, "subtitle", { required: false, max: 500 });
      const event_type = pick(EVENT_TYPES, ev.event_type, "Spotkanie otwarte");
      const format = pick(FORMATS, ev.format, "Online");
      const duration = Math.max(5, Math.round(Number(ev.duration_minutes) || 60));
      const location = textField(ev, "location", { required: false, max: 300 });
      const description = textField(ev, "description", { required: false, max: 20000 });
      const for_whom = textField(ev, "for_whom", { required: false, max: 300 });
      const price = Math.max(0, Number(ev.price) || 0);
      const checkout_url = textField(ev, "checkout_url", { required: false, max: 500 });
      const capacity = numOrNull(ev.capacity);
      const registration_type = pick(REG_TYPES, ev.registration_type, "Zapis na stronie");
      const external_url = textField(ev, "external_url", { required: false, max: 1000 });
      const join_link = textField(ev, "join_link", { required: false, max: 1000 });
      const join_password = textField(ev, "join_password", { required: false, max: 100 });
      const recording_url = textField(ev, "recording_url", { required: false, max: 1000 });
      const what_registered = textField(ev, "what_registered", { required: false, max: 500 });
      const mailing_group = textField(ev, "mailing_group", { required: false, max: 200 });
      const cancel_reason = textField(ev, "cancel_reason", { required: false, max: 1000 });
      const stage = pick(STAGES, ev.stage, "Wszystkie");
      const cover_image = textField(ev, "cover_image", { required: false, max: 1000 });
      const status = pick(STATUSES, ev.status, "Szkic");

      let startSql = "NULL";
      if (ev.start_datetime) {
        const d = new Date(ev.start_datetime);
        if (isNaN(d.getTime())) throw new Error("Niepoprawna data");
        startSql = `${escStr(d.toISOString())}::timestamptz`;
      }

      // Walidacja przy publikacji.
      if (status === "Opublikowane") {
        if (!ev.start_datetime) throw new Error("Ustaw datę, zanim opublikujesz wydarzenie.");
        if (new Date(ev.start_datetime) < new Date()) throw new Error("Data nie może być w przeszłości.");
        if (format === "Online" && !join_link && !external_url) {
          throw new Error("Wydarzenie online wymaga linku Zoom albo linku transmisji.");
        }
        if (price > 0 && !checkout_url) {
          throw new Error("Wydarzenie płatne wymaga ceny i linku płatności.");
        }
      }

      const cols = `title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
        location, description, for_whom, price, checkout_url, capacity, registration_type,
        external_url, join_link, join_password, recording_url, recording_until,
        registration_deadline, what_registered, mailing_group, stage, cover_image,
        cancel_reason, status`;
      const vals = `${escStr(title)}, ${escStr(slug)}, ${subtitle ? escStr(subtitle) : "NULL"},
        ${escStr(event_type)}, ${escStr(format)}, ${startSql}, ${duration},
        ${location ? escStr(location) : "NULL"}, ${description ? escStr(description) : "NULL"},
        ${for_whom ? escStr(for_whom) : "NULL"}, ${price}, ${checkout_url ? escStr(checkout_url) : "NULL"},
        ${capacity === null ? "NULL" : String(capacity)}, ${escStr(registration_type)},
        ${external_url ? escStr(external_url) : "NULL"}, ${join_link ? escStr(join_link) : "NULL"},
        ${join_password ? escStr(join_password) : "NULL"}, ${recording_url ? escStr(recording_url) : "NULL"},
        ${escDt(ev.recording_until)}, ${escDt(ev.registration_deadline)},
        ${what_registered ? escStr(what_registered) : "NULL"},
        ${mailing_group ? escStr(mailing_group) : "NULL"}, ${escStr(stage)},
        ${cover_image ? escStr(cover_image) : "NULL"},
        ${cancel_reason ? escStr(cancel_reason) : "NULL"}, ${escStr(status)}`;

      let rows;
      if (ev.id) {
        rows = await runSql(
          base44,
          `UPDATE public.events SET (${cols}) = (${vals}) WHERE id = ${escStr(ev.id)} RETURNING id, slug`
        );
      } else {
        rows = await runSql(
          base44,
          `INSERT INTO public.events (id, ${cols}) VALUES (gen_random_uuid()::text, ${vals}) RETURNING id, slug`
        );
      }
      return Response.json({ ok: true, event: rows && rows[0] });
    }

    // --- Duplikacja (spotkania cykliczne): wszystko poza datą i zapisami ---
    if (body.action === "duplicate") {
      await ensureEventColumns(base44);
      const id = String(body.id || "");
      const rows = await runSql(
        base44,
        `INSERT INTO public.events
           (id, title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
            location, description, for_whom, price, checkout_url, capacity, registration_type,
            external_url, join_password, recording_url, recording_until, registration_deadline,
            what_registered, mailing_group, stage, cover_image, status, created_at)
         SELECT gen_random_uuid()::text, title,
            slug || '-kopia-' || substr(md5(random()::text), 1, 6),
            subtitle, event_type, format, NULL, duration_minutes,
            location, description, for_whom, price, checkout_url, capacity, registration_type,
            external_url, NULL, NULL, NULL, NULL,
            what_registered, mailing_group, stage, cover_image, 'Szkic', now()
         FROM public.events WHERE id = ${escStr(id)}
         RETURNING id, slug, title`
      );
      return Response.json({ ok: true, event: rows && rows[0] });
    }

    // --- Powtarzaj: szkicy Wieczorów powrotu — pierwszy czwartek miesiąca, 20:00 ---
    if (body.action === "repeat") {
      await ensureEventColumns(base44);
      const id = String(body.id || "");
      const months = Math.min(24, Math.max(1, Math.round(Number(body.months) || 6)));
      const src = await runSql(base44, `SELECT * FROM public.events WHERE id = ${escStr(id)}`, true);
      const ev = src && src[0];
      if (!ev) throw new Error("Nie znaleziono wydarzenia");
      const now = new Date();
      let m = now.getUTCMonth() + 1;
      let y = now.getUTCFullYear();
      const created = [];
      for (let i = 0; i < months; i++) {
        m += 1;
        if (m > 12) { m = 1; y += 1; }
        let day = null;
        for (let d = 1; d <= 7; d++) {
          if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 4) { day = d; break; }
        }
        const iso = warsawEvening(y, m, day);
        const ins = await runSql(
          base44,
          `INSERT INTO public.events
             (id, title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
              location, description, for_whom, price, checkout_url, capacity, registration_type,
              external_url, join_password, recording_url, recording_until, registration_deadline,
              what_registered, mailing_group, stage, cover_image, status, created_at)
           SELECT gen_random_uuid()::text, title,
              ${escStr((ev.slug || slugify(ev.title) || "wieczor") + "-" + y + "-" + String(m).padStart(2, "0"))},
              subtitle, event_type, format, ${escStr(iso)}::timestamptz, duration_minutes,
              location, description, for_whom, price, checkout_url, capacity, registration_type,
              external_url, NULL, NULL, NULL, NULL,
              what_registered, mailing_group, stage, cover_image, 'Szkic', now()
           FROM public.events WHERE id = ${escStr(id)}
           RETURNING id, slug, title`
        );
        if (ins && ins[0]) created.push(ins[0]);
      }
      return Response.json({ ok: true, created });
    }

    // --- Odwołanie: status + powód + e-mail do zapisanych ---
    if (body.action === "cancel") {
      const id = String(body.id || "");
      const reason = textField(body, "reason", { required: false, max: 1000 });
      const evRows = await runSql(
        base44,
        `SELECT id, title, subtitle, event_type, format, start_datetime, duration_minutes, location
         FROM public.events WHERE id = ${escStr(id)}`,
        true
      );
      const ev = evRows && evRows[0];
      if (!ev) throw new Error("Nie znaleziono wydarzenia");
      await runSql(
        base44,
        `UPDATE public.events SET status = 'Odwołane', cancel_reason = ${
          reason ? escStr(reason) : "NULL"
        } WHERE id = ${escStr(id)}`
      );
      const recs = await runSql(
        base44,
        `SELECT id, first_name, email, cancel_token FROM public.registrations
         WHERE event_id = ${escStr(id)} AND status IN ('Zapisany','Obecny')`,
        true
      );
      waitUntil(
        (async () => {
          const smtp = await getSetting(base44, "smtp").catch(() => null);
          if (!smtp) return;
          for (const r of recs) {
            try {
              await sendCancelledMail(smtp, ev, r, reason);
            } catch {}
          }
        })()
      );
      return Response.json({ ok: true, notified: recs.length });
    }

    // --- Awans pierwszej osoby z listy rezerwowej ---
    if (body.action === "promote") {
      const id = String(body.id || "");
      const evRows = await runSql(
        base44,
        `SELECT id, title, subtitle, format, start_datetime, duration_minutes, location, join_link, external_url
         FROM public.events WHERE id = ${escStr(id)}`,
        true
      );
      const ev = evRows && evRows[0];
      if (!ev) throw new Error("Nie znaleziono wydarzenia");
      const promoted = await runSql(
        base44,
        `UPDATE public.registrations SET status = 'Zapisany'
         WHERE id = (
           SELECT id FROM public.registrations
           WHERE event_id = ${escStr(id)} AND status = 'Lista rezerwowa'
           ORDER BY created_at ASC LIMIT 1
         )
         RETURNING id, first_name, email, cancel_token`
      );
      if (promoted && promoted.length > 0) {
        waitUntil(
          getSetting(base44, "smtp")
            .then((smtp) => smtp && sendSpotFreedMail(smtp, ev, promoted[0]))
            .catch(() => {})
        );
        return Response.json({ ok: true, promoted: promoted[0].first_name });
      }
      return Response.json({ ok: true, promoted: null });
    }

    // --- Przypomnienie wysłane ręcznie z panelu ---
    if (body.action === "remindNow") {
      const id = String(body.id || "");
      const evRows = await runSql(
        base44,
        `SELECT id, title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
           location, join_link, external_url
         FROM public.events WHERE id = ${escStr(id)}`,
        true
      );
      const ev = evRows && evRows[0];
      if (!ev) throw new Error("Nie znaleziono wydarzenia");
      const recs = await runSql(
        base44,
        `SELECT id, first_name, email, cancel_token FROM public.registrations
         WHERE event_id = ${escStr(id)} AND status IN ('Zapisany','Obecny')`,
        true
      );
      const smtp = await getSetting(base44, "smtp").catch(() => null);
      if (!smtp) throw new Error("SMTP nie jest skonfigurowany (Integracje)");
      let sent = 0;
      for (const r of recs) {
        try {
          await sendReminderMail(smtp, ev, r, "now");
          sent += 1;
        } catch {}
      }
      return Response.json({ ok: true, sent, total: recs.length });
    }

    // --- Wysyłka nagrania do zapisanych ---
    if (body.action === "sendRecording") {
      const id = String(body.id || "");
      const evRows = await runSql(base44, `SELECT * FROM public.events WHERE id = ${escStr(id)}`, true);
      const ev = evRows && evRows[0];
      if (!ev) throw new Error("Nie znaleziono wydarzenia");
      if (!ev.recording_url) throw new Error("Najpierw wpisz link do nagrania.");
      const recs = await runSql(
        base44,
        `SELECT id, first_name, email, cancel_token FROM public.registrations
         WHERE event_id = ${escStr(id)} AND status IN ('Zapisany','Obecny') AND recording_sent = FALSE`,
        true
      );
      const smtp = await getSetting(base44, "smtp").catch(() => null);
      if (!smtp) throw new Error("SMTP nie jest skonfigurowany (Integracje)");
      let sent = 0;
      for (const r of recs) {
        try {
          await sendRecordingMail(smtp, ev, r, "");
          await runSql(base44, `UPDATE public.registrations SET recording_sent = TRUE WHERE id = ${escStr(r.id)}`);
          sent += 1;
        } catch {}
      }
      return Response.json({ ok: true, sent, total: recs.length });
    }

    // --- Usunięcie danych uczestnika (na żądanie) ---
    if (body.action === "deleteParticipant") {
      await runSql(
        base44,
        `DELETE FROM public.registrations WHERE id = ${escStr(String(body.id || ""))}`
      );
      return Response.json({ ok: true });
    }

    // --- Usunięcie wydarzenia (tylko szkice) ---
    if (body.action === "delete") {
      const id = String(body.id || "");
      const st = await runSql(base44, `SELECT status FROM public.events WHERE id = ${escStr(id)}`, true);
      if (!st || st.length === 0) throw new Error("Nie znaleziono wydarzenia");
      if (st[0].status !== "Szkic") throw new Error("Usunąć można tylko szkic — inne wydarzenia odwołaj lub zostaw jako archiwum.");
      await runSql(base44, `DELETE FROM public.registrations WHERE event_id = ${escStr(id)}`);
      await runSql(base44, `DELETE FROM public.events WHERE id = ${escStr(id)}`);
      return Response.json({ ok: true });
    }

    // --- Zmiana statusu uczestnika (np. „Obecny") ---
    if (body.action === "present") {
      const id = String(body.id || "");
      const status = pick(["Obecny", "Zapisany", "Wypisany", "Lista rezerwowa"], body.status, "Obecny");
      await runSql(
        base44,
        `UPDATE public.registrations SET status = ${escStr(status)} WHERE id = ${escStr(id)}`
      );
      return Response.json({ ok: true });
    }

    // --- Wiadomość do zapisanych (np. zmiana godziny) ---
    if (body.action === "broadcast") {
      const id = String(body.id || "");
      const subject = textField(body, "subject", { max: 200 });
      const text = textField(body, "text", { max: 10000 });
      const evRows = await runSql(base44, `SELECT title FROM public.events WHERE id = ${escStr(id)}`, true);
      const ev = evRows && evRows[0];
      const recipients = await runSql(
        base44,
        `SELECT email, first_name, cancel_token FROM public.registrations
         WHERE event_id = ${escStr(id)} AND status IN ('Zapisany','Obecny','Lista rezerwowa')`,
        true
      );
      const smtp = await getSetting(base44).catch(() => null);
      if (!smtp) throw new Error("SMTP nie jest skonfigurowany (Integracje)");
      let sent = 0;
      for (const r of recipients) {
        try {
          await sendBroadcastMail(smtp, ev || { title: "Spotkanie" }, r, subject, text);
          sent += 1;
        } catch {}
      }
      return Response.json({ ok: true, sent, total: recipients.length });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}