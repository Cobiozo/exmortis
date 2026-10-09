import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import { runSql, escStr, textField, emailField } from "../../shared/supabase.ts";
import { getSetting, loadAppUrl } from "../../shared/settings.ts";
import { getSnap, clearSnap } from "../../shared/snapshot.ts";
import { rpcRegister, RPC_ERRORS, saveConsents, afterSaved, enqueue, flushQueue, snapEvent } from "../../shared/registrations.ts";
import { sendConfirmationMail, sendReminderMail, sendRecordingMail, plWhen, APP_URL, buildIcs, joinState } from "../../shared/events.ts";
import { sendMail, adminTo } from "../../shared/smtp.ts";

const ensureJoinColumns = (base44) => runSql(base44,
  `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS open_minutes int DEFAULT 15,
     ADD COLUMN IF NOT EXISTS zoom_faq boolean DEFAULT true, ADD COLUMN IF NOT EXISTS short_path text`);

// Pokój otwarty, a linku brak — jeden alarm na spotkanie (kolejka maili = widoczny w panelu).
async function zoomAlarm(base44, ev) {
  const ref = `zoom:${ev.id}`;
  if ((await base44.asServiceRole.entities.MailQueue.filter({ kind: "alarm_zoom", ref }, "-created_date", 1)).length) return;
  const to = await adminTo(base44);
  const subject = `PILNE: brak linku Zoom — ${ev.title}`;
  if (!to) return base44.asServiceRole.entities.MailQueue.create({ to_email: "—", kind: "alarm_zoom", ref, subject, status: "pominiety", blad: "Uzupełnij e-mail firmy w Ustawieniach" });
  await sendMail(base44, { kind: "alarm_zoom", ref, to, subject,
    html: `<p>Pokój spotkania «${ev.title}» jest otwarty, a w panelu nie ma linku do Zoom. Uczestnicy widzą: „Za chwilę podamy link”.</p>` });
}

// Publiczny moduł Spotkań: lista nadchodzących/minionych wydarzeń, szczegóły,
// zapisy (z listą rezerwową) oraz przetwarzanie zaległych przypomnień („tick").
// join_link nigdy nie opuszcza serwera — trafia wyłącznie do e-maili zapisanym.

// Bez e.location, join_link i join_password — to dane prywatne (adres tylko dla zapisanych).
const PUB_COLS = `e.id, e.title, e.slug, e.subtitle, e.event_type, e.format, e.start_datetime,
  e.duration_minutes, e.description, e.for_whom, e.price, e.checkout_url,
  e.capacity, e.registration_type, e.external_url, e.recording_url, e.recording_until, e.stage,
  e.cover_image, e.cover, e.status, e.cancel_reason, e.registration_deadline, e.what_registered,
  e.open_minutes, e.zoom_faq`;
const REG_COUNT = `(SELECT COUNT(*) FROM public.registrations r
  WHERE r.event_id = e.id AND r.status IN ('Zapisany','Obecny'))::int AS registered`;


export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // --- Lista nadchodzących (Opublikowane + Odwołane) i minionych z nagraniami ---
    if (body.action === "list") {
      const data = await getSnap(base44, "events:list", async () => {
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
      return { upcoming: upcoming || [], past: past || [] };
      });
      return Response.json(data);
    }

    // --- Szczegóły jednego wydarzenia (bez join_link) ---
    if (body.action === "get") {
      const slug = textField(body, "slug", { max: 200 });
      const ev = await getSnap(base44, `events:get:${slug}`, async () => {
        const rows = await runSql(
          base44,
          `SELECT ${PUB_COLS}, ${REG_COUNT}
           FROM public.events e
           WHERE e.slug = ${escStr(slug)}`,
          true
        );
        return rows?.[0] || null;
      });
      if (!ev) {
        return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      }
      return Response.json({ event: ev });
    }

    // --- Zapis na wydarzenie (z obsługą listy rezerwowej i kolejką na wypadek awarii Supabase) ---
    if (body.action === "register") {
      // Pole-pułapka wypełnione → udajemy sukces, nic nie zapisujemy.
      if (body.website) return Response.json({ ok: true, status: "Zapisany", first_name: String(body.first_name || "").slice(0, 120) });
      const slug = textField(body, "slug", { max: 200 });
      const firstName = textField(body, "first_name", { max: 120 });
      const email = emailField(body).toLowerCase();
      const question = textField(body, "question", { required: false, max: 2000 });
      if (body.consent !== true) {
        return Response.json({ error: "Zaznacz, żeby się zapisać." }, { status: 400 });
      }
      const source = typeof body.source === "string" && body.source.trim() !== "" ? body.source.trim().slice(0, 100) : null;
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || "brak";
      const d = { slug, first_name: firstName, email, question, listy: body.listy === true, source, ip, at: new Date().toISOString() };
      // Symulacja awarii Supabase — tylko dla administratora (test kolejki).
      const isAdmin = (body.simulate_down === true || body.load_test === true) && (await base44.auth.me().catch(() => null))?.role === "admin";
      const simulate = isAdmin && body.simulate_down === true;

      const closedErr = (ev) => {
        if (ev.status !== "Opublikowane") return "To wydarzenie nie jest już dostępne.";
        if (ev.registration_type !== "Zapis na stronie") return "To wydarzenie nie przyjmuje zapisów na stronie.";
        const deadline = ev.registration_deadline ? new Date(ev.registration_deadline)
          : ev.start_datetime ? new Date(new Date(ev.start_datetime).getTime() - 15 * 60000) : null;
        if (deadline && new Date() > deadline) return "Zapisy zamknięte.";
        return null;
      };
      const queued = async (err) => {
        const snap = await snapEvent(base44, slug);
        const e = snap && closedErr(snap);
        if (e) return Response.json({ error: e, closed: e === "Zapisy zamknięte." }, { status: 400 });
        await enqueue(base44, d, err);
        return Response.json({ ok: true, status: "Zapisany", first_name: firstName, pending: true });
      };

      let res;
      try {
        if (simulate) throw new Error("Symulowana awaria Supabase");
        res = await rpcRegister(base44, d, isAdmin && body.load_test === true);
      } catch (err) {
        return queued(err);
      }
      if (res.error) {
        const [code, msg] = RPC_ERRORS[res.error] || [400, "Nie udało się zapisać."];
        return Response.json({ error: msg, closed: res.error === "closed" }, { status: code });
      }
      if (res.already) return Response.json({ ok: true, already: true });
      const regRow = res.reg;
      const sp = (await runSql(base44, `SELECT short_path FROM public.events WHERE slug = ${escStr(slug)}`, true).catch(() => []))[0]?.short_path || null;
      const ev = { ...res.ev, slug: res.ev.slug || slug, short_path: sp };
      // Zgody (dowód z datą, godziną i id zapisu) i e-mail potwierdzający — dopiero po udanym zapisie.
      waitUntil(Promise.allSettled([saveConsents(base44, d, regRow.id), loadAppUrl(base44).then(() => afterSaved(base44, ev, regRow, d))]));
      return Response.json({
        ok: true,
        status: regRow.status,
        first_name: regRow.first_name,
        checkout_url: Number(ev.price) > 0 ? ev.checkout_url : null,
        join_url: regRow.status === "Zapisany" && ev.format === "Online" ? (sp ? `/${sp}/dolacz` : `/spotkania/${slug}/dolacz`) : null,
      });
    }

    // --- Strona dołączenia: link i hasło tylko w oknie czasowym (czas serwera) ---
    if (body.action === "join" || body.action === "ics") {
      await ensureJoinColumns(base44);
      const key = textField(body, "slug", { max: 200 });
      const rows = await runSql(base44,
        `SELECT id, title, slug, subtitle, format, status, start_datetime, duration_minutes, location, join_link, join_password,
           recording_url, recording_until, open_minutes, short_path FROM public.events
         WHERE (slug = ${escStr(key)} OR short_path = ${escStr(key)}) ORDER BY slug = ${escStr(key)} DESC LIMIT 1`, true);
      const ev = rows[0];
      const me = body.preview ? await base44.auth.me().catch(() => null) : null;
      const admin = me?.role === "admin";
      if (!ev || !ev.start_datetime || (!admin && !["Opublikowane", "Odwołane"].includes(ev.status))) {
        return Response.json({ error: "Nie znaleziono spotkania" }, { status: 404 });
      }
      await loadAppUrl(base44);
      if (body.action === "ics") return Response.json({ ics: buildIcs(ev) });
      const base = { title: ev.title, slug: ev.slug, start_datetime: ev.start_datetime, duration_minutes: ev.duration_minutes, open_minutes: Number(ev.open_minutes) || 15 };
      if (ev.format !== "Online") return Response.json({ ...base, state: "stacjonarne" });
      const state = admin && ["przed", "otwarte", "po"].includes(body.preview) ? body.preview : joinState(ev);
      if (state === "otwarte") {
        if (!ev.join_link) {
          if (!admin) waitUntil(zoomAlarm(base44, ev).catch((e) => console.error("Alarm Zoom", e.message)));
          return Response.json({ ...base, state, missing: true });
        }
        return Response.json({ ...base, state, join_link: ev.join_link, join_password: ev.join_password || null });
      }
      const rec = state === "po" && ev.recording_url && (!ev.recording_until || new Date(ev.recording_until) > new Date()) ? ev.recording_url : null;
      return Response.json({ ...base, state, recording_url: rec });
    }

    // --- Ręczne przeniesienie kolejki (administrator; opcjonalnie z symulacją awarii) ---
    if (body.action === "flush") {
      const me = await base44.auth.me().catch(() => null);
      if (me?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
      return Response.json(await flushQueue(base44, { simulateDown: body.simulate_down === true }));
    }

    await loadAppUrl(base44);

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
      const queue = await flushQueue(base44).catch((e) => ({ error: e.message }));
      const retention = await (await import("../../shared/retention.ts")).runRetention(base44).catch((e) => ({ error: e.message }));
      const removed = await runSql(
        base44,
        `DELETE FROM public.registrations r USING public.events e
         WHERE r.event_id = e.id
           AND e.start_datetime IS NOT NULL
           AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') + interval '90 days' < now()
         RETURNING r.id`
      );
      const evCols = `e.id, e.title, e.slug, e.subtitle, e.event_type, e.format,
        e.start_datetime, e.duration_minutes, e.location, e.join_link, e.external_url, e.recording_url, e.short_path`;
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
          for (const row of due24) {
            try {
              await sendReminderMail(base44, row, row, "24h");
              await runSql(base44, `UPDATE public.registrations SET reminder_24h_sent = TRUE WHERE id = ${escStr(row.id)}`);
            } catch {}
          }
          for (const row of due1) {
            try {
              await sendReminderMail(base44, row, row, "1h");
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
                await sendRecordingMail(base44, row, row, inviteHtml);
                await runSql(base44, `UPDATE public.registrations SET recording_sent = TRUE WHERE id = ${escStr(row.id)}`);
              } catch {}
            }
          }
        })()
      );
      return Response.json({
        ok: true,
        removed: (removed || []).length,
        queue,
        retention,
        due: { r24: due24.length, r1: due1.length, rec: dueRec.length },
      });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}