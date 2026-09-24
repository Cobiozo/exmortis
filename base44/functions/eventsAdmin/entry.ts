import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, textField, requireAdmin } from "../../shared/supabase.ts";
import { getSetting } from "../../shared/settings.ts";
import { sendBroadcastMail } from "../../shared/events.ts";

// Administracja wydarzeniami: lista, szczegóły z uczestnikami, zapis/edycja,
// duplikacja, usuwanie, oznaczanie obecności i wysyłka wiadomości do zapisanych.

const EVENT_TYPES = ["Spotkanie otwarte", "Live", "Webinar", "Warsztat", "Krąg", "Retreat"];
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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    // --- Lista wydarzeń z licznikami zapisów ---
    if (body.action === "list") {
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
      const recording_url = textField(ev, "recording_url", { required: false, max: 1000 });
      const stage = pick(STAGES, ev.stage, "Wszystkie");
      const cover_image = textField(ev, "cover_image", { required: false, max: 1000 });
      const status = pick(STATUSES, ev.status, "Szkic");

      let startSql = "NULL";
      if (ev.start_datetime) {
        const d = new Date(ev.start_datetime);
        if (isNaN(d.getTime())) throw new Error("Niepoprawna data");
        startSql = `${escStr(d.toISOString())}::timestamptz`;
      }

      const cols = `title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
        location, description, for_whom, price, checkout_url, capacity, registration_type,
        external_url, join_link, recording_url, stage, cover_image, status`;
      const vals = `${escStr(title)}, ${escStr(slug)}, ${subtitle ? escStr(subtitle) : "NULL"},
        ${escStr(event_type)}, ${escStr(format)}, ${startSql}, ${duration},
        ${location ? escStr(location) : "NULL"}, ${description ? escStr(description) : "NULL"},
        ${for_whom ? escStr(for_whom) : "NULL"}, ${price}, ${checkout_url ? escStr(checkout_url) : "NULL"},
        ${capacity === null ? "NULL" : String(capacity)}, ${escStr(registration_type)},
        ${external_url ? escStr(external_url) : "NULL"}, ${join_link ? escStr(join_link) : "NULL"},
        ${recording_url ? escStr(recording_url) : "NULL"}, ${escStr(stage)},
        ${cover_image ? escStr(cover_image) : "NULL"}, ${escStr(status)}`;

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
      const id = String(body.id || "");
      const rows = await runSql(
        base44,
        `INSERT INTO public.events
           (id, title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
            location, description, for_whom, price, checkout_url, capacity, registration_type,
            external_url, join_link, recording_url, stage, cover_image, status, created_at)
         SELECT gen_random_uuid()::text, title,
            slug || '-kopia-' || substr(md5(random()::text), 1, 6),
            subtitle, event_type, format, NULL, duration_minutes,
            location, description, for_whom, price, checkout_url, capacity, registration_type,
            external_url, join_link, NULL, stage, cover_image, 'Szkic', now()
         FROM public.events WHERE id = ${escStr(id)}
         RETURNING id, slug, title`
      );
      return Response.json({ ok: true, event: rows && rows[0] });
    }

    // --- Usunięcie wydarzenia (razem ze zapisami) ---
    if (body.action === "delete") {
      await runSql(base44, `DELETE FROM public.events WHERE id = ${escStr(String(body.id || ""))}`);
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
        `SELECT email, first_name FROM public.registrations
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