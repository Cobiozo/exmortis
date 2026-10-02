import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import { runSql, escStr, textField, emailField } from "../../shared/supabase.ts";
import { getSetting } from "../../shared/settings.ts";
import { sendConfirmationMail, sendReminderMail, sendRecordingMail, plWhen, APP_URL } from "../../shared/events.ts";

// Publiczny moduł Spotkań: lista nadchodzących/minionych wydarzeń, szczegóły,
// zapisy (z listą rezerwową) oraz przetwarzanie zaległych przypomnień („tick").
// join_link nigdy nie opuszcza serwera — trafia wyłącznie do e-maili zapisanym.

// Bez e.location, join_link i join_password — to dane prywatne (adres tylko dla zapisanych).
const PUB_COLS = `e.id, e.title, e.slug, e.subtitle, e.event_type, e.format, e.start_datetime,
  e.duration_minutes, e.description, e.for_whom, e.price, e.checkout_url,
  e.capacity, e.registration_type, e.external_url, e.recording_url, e.recording_until, e.stage,
  e.cover_image, e.status, e.cancel_reason, e.registration_deadline, e.what_registered`;
const REG_COUNT = `(SELECT COUNT(*) FROM public.registrations r
  WHERE r.event_id = e.id AND r.status IN ('Zapisany','Obecny'))::int AS registered`;

async function smtpConfig(base44) {
  return getSetting(base44, "smtp").catch(() => null);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // --- Lista nadchodzących (Opublikowane + Odwołane) i minionych z nagraniami ---
    if (body.action === "list") {
      const [upcoming, past] = await Promise.all([
        runSql(
          base44,
          `SELECT ${PUB_COLS}, ${REG_COUNT}
           FROM public.events e
           WHERE e.status IN ('Opublikowane','Odwołane')
             AND e.start_datetime IS NOT NULL
             AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') >= now()
           ORDER BY e.start_datetime ASC`,
          true
        ),
        runSql(
          base44,
          `SELECT ${PUB_COLS}
           FROM public.events e
           WHERE e.status = 'Opublikowane'
             AND e.recording_url IS NOT NULL
             AND e.start_datetime IS NOT NULL
             AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') < now()
           AND (e.recording_until IS NULL OR e.recording_until > now())
           ORDER BY e.start_datetime DESC
           LIMIT 20`,
          true
        ),
      ]);
      return Response.json({ upcoming: upcoming || [], past: past || [] });
    }

    // --- Szczegóły jednego wydarzenia (bez join_link) ---
    if (body.action === "get") {
      const slug = textField(body, "slug", { max: 200 });
      const rows = await runSql(
        base44,
        `SELECT ${PUB_COLS}, ${REG_COUNT}
         FROM public.events e
         WHERE e.slug = ${escStr(slug)}`,
        true
      );
      if (!rows || rows.length === 0) {
        return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      }
      return Response.json({ event: rows[0] });
    }

    // --- Zapis na wydarzenie (z obsługą listy rezerwowej) ---
    if (body.action === "register") {
      const slug = textField(body, "slug", { max: 200 });
      const firstName = textField(body, "first_name", { max: 120 });
      const email = emailField(body);
      const question = textField(body, "question", { required: false, max: 2000 });
      const listy = body.listy === true;
      if (body.consent !== true) {
        return Response.json({ error: "Wymagana jest zgoda na przetwarzanie danych." }, { status: 400 });
      }
      const source = typeof body.source === "string" && body.source.trim() !== ""
        ? body.source.trim().slice(0, 100)
        : null;

      const evRows = await runSql(
        base44,
        `SELECT e.*, ${REG_COUNT} FROM public.events e WHERE e.slug = ${escStr(slug)}`,
        true
      );
      const ev = evRows && evRows[0];
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      if (ev.status !== "Opublikowane") {
        return Response.json({ error: "To wydarzenie nie jest już dostępne." }, { status: 400 });
      }
      if (ev.registration_type !== "Zapis na stronie") {
        return Response.json({ error: "To wydarzenie nie przyjmuje zapisów na stronie." }, { status: 400 });
      }
      // Zapisy otwarte do registration_deadline (domyślnie 15 min przed startem).
      const deadline = ev.registration_deadline
        ? new Date(ev.registration_deadline)
        : ev.start_datetime
          ? new Date(new Date(ev.start_datetime).getTime() - 15 * 60000)
          : null;
      if (deadline && new Date() > deadline) {
        return Response.json({ error: "Zapisy zamknięte.", closed: true }, { status: 400 });
      }

      const existing = await runSql(
        base44,
        `SELECT id, status FROM public.registrations
         WHERE event_id = ${escStr(ev.id)} AND email = ${escStr(email)}`,
        true
      );
      if (existing.length > 0 && ["Zapisany", "Obecny", "Lista rezerwowa"].includes(existing[0].status)) {
        return Response.json({ ok: true, already: true });
      }

      const capacity = ev.capacity ? Number(ev.capacity) : 0;
      const status = capacity > 0 && (ev.registered || 0) >= capacity ? "Lista rezerwowa" : "Zapisany";

      const qSql = question ? escStr(question) : "NULL";
      let reg;
      if (existing.length > 0) {
        reg = await runSql(
          base44,
          `UPDATE public.registrations SET
             first_name = ${escStr(firstName)},
             question_for_dawid = ${qSql},
             consent = TRUE,
             status = ${escStr(status)},
             created_at = now()
           WHERE id = ${escStr(existing[0].id)}
           RETURNING id, first_name, email, status, cancel_token`
        );
      } else {
        reg = await runSql(
          base44,
          `INSERT INTO public.registrations
             (id, event_id, first_name, email, question_for_dawid, consent, status, source)
           VALUES (gen_random_uuid()::text, ${escStr(ev.id)}, ${escStr(firstName)}, ${escStr(email)},
             ${qSql}, TRUE, ${escStr(status)}, ${source ? escStr(source) : "NULL"})
           RETURNING id, first_name, email, status, cancel_token`
        );
      }
      const regRow = reg && reg[0];
      // Zgoda na Listy powrotu → zapis w liście newslettera (z datą zgody).
      if (listy) {
        waitUntil(
          import("../../shared/newsletter.ts")
            .then((m) => m.addSubscriber(base44, { email, name: firstName, consentGiven: true }))
            .catch(() => {})
        );
      }
      waitUntil(
        smtpConfig(base44)
          .then((smtp) => smtp && sendConfirmationMail(smtp, ev, regRow))
          .catch(() => {})
      );
      return Response.json({
        ok: true,
        status: regRow.status,
        first_name: regRow.first_name,
        checkout_url: Number(ev.price) > 0 ? ev.checkout_url : null,
        join_link: regRow.status === "Zapisany" ? ev.join_link || null : null,
        join_password: regRow.status === "Zapisany" ? ev.join_password || null : null,
      });
    }

    // --- „Przypomnij mi" dla wydarzeń z zewnętrznym linkiem ---
    if (body.action === "remind") {
      const slug = textField(body, "slug", { max: 200 });
      const email = emailField(body);
      const firstName = textField(body, "first_name", { required: false, max: 120 }) || "Nieznajomy";
      const source = typeof body.source === "string" && body.source.trim() !== ""
        ? body.source.trim().slice(0, 100)
        : null;

      const evRows = await runSql(
        base44,
        `SELECT ${PUB_COLS} FROM public.events e
         WHERE e.slug = ${escStr(slug)} AND e.status = 'Opublikowane'
           AND e.registration_type = 'Link zewnętrzny'`,
        true
      );
      const ev = evRows && evRows[0];
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });

      await runSql(
        base44,
        `INSERT INTO public.registrations
           (id, event_id, first_name, email, consent, status, source)
         VALUES (gen_random_uuid()::text, ${escStr(ev.id)}, ${escStr(firstName)}, ${escStr(email)},
           TRUE, 'Zapisany', ${source ? escStr(source) : "NULL"})
         ON CONFLICT (event_id, email) DO NOTHING`
      );
      return Response.json({ ok: true });
    }

    // --- Tick: higiena danych (zapisy 90 dni po spotkaniu) + przypomnienia
    //     24 h / 1 h przed oraz podziękowania z nagraniem ---
    if (body.action === "tick") {
      const removed = await runSql(
        base44,
        `DELETE FROM public.registrations r USING public.events e
         WHERE r.event_id = e.id
           AND e.start_datetime IS NOT NULL
           AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') + interval '90 days' < now()
         RETURNING r.id`
      );
      const evCols = `e.id, e.title, e.slug, e.subtitle, e.event_type, e.format,
        e.start_datetime, e.duration_minutes, e.location, e.join_link, e.external_url, e.recording_url`;
      const [due24, due1, dueRec] = await Promise.all([
        runSql(
          base44,
          `SELECT r.id, r.first_name, r.email, r.cancel_token, ${evCols}
           FROM public.registrations r JOIN public.events e ON e.id = r.event_id
           WHERE r.status IN ('Zapisany','Obecny') AND e.status = 'Opublikowane'
             AND e.start_datetime IS NOT NULL
             AND e.start_datetime > now() AND e.start_datetime <= now() + interval '24 hours'
             AND r.reminder_24h_sent = FALSE
           LIMIT 100`,
          true
        ),
        runSql(
          base44,
          `SELECT r.id, r.first_name, r.email, r.cancel_token, ${evCols}
           FROM public.registrations r JOIN public.events e ON e.id = r.event_id
           WHERE r.status IN ('Zapisany','Obecny') AND e.status = 'Opublikowane'
             AND e.start_datetime IS NOT NULL
             AND e.start_datetime > now() AND e.start_datetime <= now() + interval '1 hour'
             AND r.reminder_1h_sent = FALSE
           LIMIT 100`,
          true
        ),
        runSql(
          base44,
          `SELECT r.id, r.first_name, r.email, ${evCols}
           FROM public.registrations r JOIN public.events e ON e.id = r.event_id
           WHERE r.status IN ('Zapisany','Obecny') AND e.status = 'Opublikowane'
             AND e.recording_url IS NOT NULL AND e.start_datetime IS NOT NULL
             AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') < now() - interval '12 hours'
             AND r.recording_sent = FALSE
           LIMIT 100`,
          true
        ),
      ]);

      waitUntil(
        (async () => {
          const smtp = await smtpConfig(base44).catch(() => null);
          if (!smtp) return;
          for (const row of due24) {
            try {
              await sendReminderMail(smtp, row, row, "24h");
              await runSql(base44, `UPDATE public.registrations SET reminder_24h_sent = TRUE WHERE id = ${escStr(row.id)}`);
            } catch {}
          }
          for (const row of due1) {
            try {
              await sendReminderMail(smtp, row, row, "1h");
              await runSql(base44, `UPDATE public.registrations SET reminder_1h_sent = TRUE WHERE id = ${escStr(row.id)}`);
            } catch {}
          }
          if (dueRec.length > 0) {
            const next = await runSql(
              base44,
              `SELECT title, slug, start_datetime FROM public.events
               WHERE status = 'Opublikowane' AND start_datetime > now()
               ORDER BY start_datetime ASC LIMIT 1`,
              true
            );
            const inviteHtml = (next && next[0])
              ? `<p style="margin-top:24px;color:#8A8A8C;">Najbliższe spotkanie: «${next[0].title}» — ${plWhen(next[0].start_datetime)}. <a href="${APP_URL}/spotkania/${next[0].slug}" style="color:#C9A24A;">Zobacz i zapisz się</a>.</p>`
              : `<p style="margin-top:24px;color:#8A8A8C;">Jeśli chcesz porozmawiać o własnym powrocie — <a href="${APP_URL}/powrot" style="color:#C9A24A;">umów rozmowę kwalifikacyjną POWRÓT</a>.</p>`;
            for (const row of dueRec) {
              try {
                await sendRecordingMail(smtp, row, row, inviteHtml);
                await runSql(base44, `UPDATE public.registrations SET recording_sent = TRUE WHERE id = ${escStr(row.id)}`);
              } catch {}
            }
          }
        })()
      );
      return Response.json({
        ok: true,
        removed: (removed || []).length,
        due: { r24: due24.length, r1: due1.length, rec: dueRec.length },
      });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}