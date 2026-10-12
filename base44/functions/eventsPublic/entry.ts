import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import { runSql, escStr, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { getSetting, loadAppUrl } from "../../shared/settings.ts";
import { getSnap, clearSnap } from "../../shared/snapshot.ts";
import { rpcRegister, RPC_ERRORS, saveConsents, afterSaved, enqueue, flushQueue, snapEvent, ensureTzColumn } from "../../shared/registrations.ts";
import { sendConfirmationMail, sendReminderMail, sendRecordingMail, plWhen, APP_URL, buildIcs, joinState, joinToken } from "../../shared/events.ts";
import { sendMail, adminTo } from "../../shared/smtp.ts";

const ensureJoinColumns = (base44) => runSql(base44,
  `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS open_minutes int DEFAULT 15,
     ADD COLUMN IF NOT EXISTS zoom_faq boolean DEFAULT true, ADD COLUMN IF NOT EXISTS short_path text`);

const JOIN_CACHE = new Map();

// Kto może zobaczyć link / nagranie: zapisani (status Zapisany/Obecny). Lista w pamięci instancji (60 s),
// więc w szczycie każde wejście nie odpytuje bazy. Klucz: e-mail (małe litery) albo osobisty klucz z maila.
const REG_CACHE = new Map();
async function regAccess(base44, eventId, fresh = false) {
  const hit = REG_CACHE.get(eventId);
  if (hit && !fresh && Date.now() - hit.at < 60000) return hit;
  const rows = await runSql(base44,
    `SELECT lower(email) AS email, cancel_token FROM public.registrations
     WHERE event_id = ${escStr(String(eventId))} AND status IN ('Zapisany', 'Obecny')`, true);
  const emails = new Set(rows.map((r) => String(r.email || "")));
  const tokens = new Set((await Promise.all(rows.map((r) => joinToken(r.cancel_token)))).filter(Boolean));
  const out = { at: Date.now(), emails, tokens };
  REG_CACHE.set(eventId, out);
  return out;
}
// Prosty limit prób wpisania e-maila: 12 nietrafionych na 10 min z jednego IP (w pamięci instancji).
const MISSES = new Map();
function tooManyMisses(ip) {
  const m = MISSES.get(ip);
  return !!m && Date.now() - m.at < 600000 && m.n >= 12;
}
function addMiss(ip) {
  const m = MISSES.get(ip);
  if (!m || Date.now() - m.at > 600000) MISSES.set(ip, { at: Date.now(), n: 1 }); else m.n++;
}
let joinColsReady = false;

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

import { PUB_COLS, REG_COUNT, publicEvent } from "../../shared/publicData.ts";


export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (body.ping) return Response.json({ ok: true });

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
      const ev = await publicEvent(base44, slug);
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
      const ip = clientIp(req);
      const tz = typeof body.tz === "string" ? body.tz.slice(0, 64) : null;
      const d = { slug, first_name: firstName, email, question, listy: body.listy === true, source, ip, tz, at: new Date().toISOString() };
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
        join_url: regRow.status === "Zapisany" && ev.format === "Online"
          ? `${sp ? `/${sp}/dolacz` : `/spotkania/${slug}/dolacz`}${(await joinToken(regRow.cancel_token)) ? `?t=${await joinToken(regRow.cancel_token)}` : ""}` : null,
      });
    }

    // --- Strona dołączenia: link i hasło tylko w oknie czasowym (czas serwera) ---
    if (body.action === "join" || body.action === "ics") {
      const key = textField(body, "slug", { max: 200 });
      // Kopia wiersza spotkania w pamięci serwera (30 s): w szczycie goście nie trafiają do bazy, stan liczony z zegara.
      let hit = JOIN_CACHE.get(key);
      if (!hit || Date.now() - hit.at > 30000 || body.preview) {
        if (!joinColsReady) { await ensureJoinColumns(base44); joinColsReady = true; }
        const rows = await runSql(base44,
          `SELECT id, title, slug, subtitle, format, status, start_datetime, duration_minutes, location, join_link, join_password,
             recording_url, recording_until, open_minutes, short_path FROM public.events
           WHERE (slug = ${escStr(key)} OR short_path = ${escStr(key)}) ORDER BY slug = ${escStr(key)} DESC LIMIT 1`, true);
        hit = { at: Date.now(), ev: rows[0] || null };
        if (!body.preview) JOIN_CACHE.set(key, hit);
      }
      const ev = hit.ev;
      const me = body.preview ? await base44.auth.me().catch(() => null) : null;
      const admin = me?.role === "admin";
      if (!ev || !ev.start_datetime || (!admin && !["Opublikowane", "Odwołane"].includes(ev.status))) {
        return Response.json({ error: "Nie znaleziono spotkania" }, { status: 404 });
      }
      if (body.action === "ics") { await loadAppUrl(base44); return Response.json({ ics: buildIcs(ev) }); }
      const base = { title: ev.title, slug: ev.slug, start_datetime: ev.start_datetime, duration_minutes: ev.duration_minutes, open_minutes: Number(ev.open_minutes) || 15 };
      if (ev.format !== "Online") return Response.json({ ...base, state: "stacjonarne" });
      const state = admin && ["przed", "otwarte", "po"].includes(body.preview) ? body.preview : joinState(ev);
      // Link do pokoju i nagranie tylko dla zapisanych: osobisty klucz z maila albo e-mail podany przy zapisie.
      const rec = state === "po" && ev.recording_url && (!ev.recording_until || new Date(ev.recording_until) > new Date()) ? ev.recording_url : null;
      let okToken = null;
      if (((state === "otwarte" && ev.join_link) || rec) && !admin) {
        const ip = clientIp(req);
        const t = String(body.t || "").trim().toLowerCase();
        const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
        if (!t && !email) return Response.json({ ...base, state, need: true });
        if (tooManyMisses(ip)) return Response.json({ ...base, state, need: true, error: "Zbyt wiele prób. Spróbuj za kilka minut." });
        let acc = await regAccess(base44, ev.id);
        let ok = (t && acc.tokens.has(t)) || (email && acc.emails.has(email));
        if (!ok && Date.now() - acc.at > 10000) { acc = await regAccess(base44, ev.id, true); ok = (t && acc.tokens.has(t)) || (email && acc.emails.has(email)); }
        if (!ok) {
          addMiss(ip);
          return Response.json({ ...base, state, need: true, error: email ? "Nie znajduję zapisu na ten adres. Sprawdź pisownię albo użyj linku z e-maila." : "Ten link jest nieaktualny. Wpisz e-mail podany przy zapisie." });
        }
        okToken = t && acc.tokens.has(t) ? t : null;
        if (!okToken && email) {
          const r = (await runSql(base44, `SELECT cancel_token FROM public.registrations WHERE event_id = ${escStr(String(ev.id))} AND lower(email) = ${escStr(email)} AND status IN ('Zapisany', 'Obecny') LIMIT 1`, true).catch(() => []))[0];
          okToken = r ? await joinToken(r.cancel_token) : null;
        }
      }
      if (state === "otwarte") {
        if (!ev.join_link) {
          if (!admin) waitUntil(zoomAlarm(base44, ev).catch((e) => console.error("Alarm Zoom", e.message)));
          return Response.json({ ...base, state, missing: true });
        }
        return Response.json({ ...base, state, join_link: ev.join_link, join_password: ev.join_password || null, ok_token: okToken });
      }
      return Response.json({ ...base, state, recording_url: rec, ok_token: okToken });
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
      // Najwyżej jeden przebieg na minutę — zadanie jest publiczne (wywołuje je workflow),
      // więc ponowne wywołania z zewnątrz nie mogą mnożyć pracy ani wysyłek.
      const lock = await runSql(
        base44,
        `INSERT INTO public.app_settings (key, value, updated_date)
           VALUES ('events_tick', jsonb_build_object('at', now()), now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
           WHERE public.app_settings.updated_date < now() - interval '60 seconds'
         RETURNING key`
      ).catch(() => [{ key: "events_tick" }]);
      if (!lock || !lock.length) return Response.json({ ok: true, skipped: true });

      await ensureTzColumn(base44);
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
        e.start_datetime, e.duration_minutes, e.location, e.join_link, e.external_url, e.recording_url, e.short_path, e.recording_until`;

      // Wiersze są PRZEJMOWANE atomowo (flaga ustawiana przed wysyłką, SKIP LOCKED), więc dwa
      // równoległe przebiegi nigdy nie wyślą tego samego przypomnienia. Identyfikator zapisu idzie
      // jako reg_id — wcześniej r.id i e.id miały tę samą nazwę kolumny i nadpisywały się w wyniku.
      const claim = (flag, where, extraSet = "") => runSql(
        base44,
        `WITH c AS (
           SELECT r.id FROM public.registrations r JOIN public.events e ON e.id = r.event_id
            WHERE r.status IN ('Zapisany','Obecny') AND e.status = 'Opublikowane'
              AND e.start_datetime IS NOT NULL AND r.${flag} = FALSE AND ${where}
            ORDER BY e.start_datetime
            LIMIT 100
            FOR UPDATE OF r SKIP LOCKED
         ), u AS (
           UPDATE public.registrations r SET ${flag} = TRUE${extraSet}
             FROM c WHERE r.id = c.id
           RETURNING r.id AS reg_id, r.first_name, r.email, r.cancel_token, r.tz, r.event_id
         )
         SELECT u.reg_id, u.first_name, u.email, u.cancel_token, u.tz, ${evCols}
           FROM u JOIN public.events e ON e.id = u.event_id`
      );
      // 24 h: tylko spotkania dalej niż godzinę stąd (bliższe dostaną od razu przypomnienie 1 h, bez dubla).
      const due24 = await claim("reminder_24h_sent",
        `e.start_datetime > now() + interval '1 hour' AND e.start_datetime <= now() + interval '24 hours'`);
      const due1 = await claim("reminder_1h_sent",
        `e.start_datetime > now() AND e.start_datetime <= now() + interval '1 hour'`, ", reminder_24h_sent = TRUE");
      const dueRec = await claim("recording_sent",
        `e.recording_url IS NOT NULL
           AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') < now() - interval '12 hours'`);

      const regOf = (row) => ({ id: row.reg_id, first_name: row.first_name, email: row.email, cancel_token: row.cancel_token, tz: row.tz });
      // Nieudana wysyłka oddaje wiersz do kolejnego przebiegu.
      const release = (flag, row) => runSql(base44,
        `UPDATE public.registrations SET ${flag} = FALSE WHERE id = ${escStr(row.reg_id)}`).catch(() => {});
      // Kilka wysyłek naraz — przed spotkaniem liczy się czas.
      const pool = async (rows, fn, n = 5) => {
        let i = 0;
        await Promise.all(Array.from({ length: Math.min(n, rows.length) }, async () => {
          while (i < rows.length) { const row = rows[i++]; await fn(row); }
        }));
      };

      waitUntil(
        (async () => {
          await pool(due1, async (row) => {
            try { await sendReminderMail(base44, row, regOf(row), "1h"); } catch { await release("reminder_1h_sent", row); }
          });
          await pool(due24, async (row) => {
            try { await sendReminderMail(base44, row, regOf(row), "24h"); } catch { await release("reminder_24h_sent", row); }
          });
          if (dueRec.length > 0) {
            const next = await runSql(
              base44,
              `SELECT title, slug, start_datetime FROM public.events
               WHERE status = 'Opublikowane' AND start_datetime > now()
               ORDER BY start_datetime ASC LIMIT 1`,
              true
            ).catch(() => []);
            const inviteHtml = (next && next[0])
              ? `<p style="margin-top:24px;color:#8A8A8C;">Najbliższe spotkanie: «${next[0].title}» — ${plWhen(next[0].start_datetime)}. <a href="${APP_URL}/spotkania/${next[0].slug}" style="color:#C9A24A;">Zobacz i zapisz się</a>.</p>`
              : `<p style="margin-top:24px;color:#8A8A8C;">Jeśli chcesz porozmawiać o własnym powrocie — <a href="${APP_URL}/powrot" style="color:#C9A24A;">umów rozmowę kwalifikacyjną POWRÓT</a>.</p>`;
            await pool(dueRec, async (row) => {
              try { await sendRecordingMail(base44, row, regOf(row), inviteHtml); } catch { await release("recording_sent", row); }
            });
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