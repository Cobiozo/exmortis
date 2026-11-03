// Seria startowa „Listy powrotu — początek drogi”.
//
// Zasady (ustalone z właścicielem 3.11.2026):
//  - po zapisie osoba dostaje tylko potwierdzenie (poza serią);
//  - list 1 serii — w pierwszy poniedziałek PO dniu zapisu, o 8:00 czasu polskiego
//    (zapis w poniedziałek → list 1 w kolejny poniedziałek);
//  - kolejne listy — co poniedziałek o 8:00;
//  - osoby zapisane przed włączeniem serii startują od listu 1 w pierwszy poniedziałek po włączeniu;
//  - w trakcie serii osoba NIE dostaje bieżących kampanii (wariant A); po ostatnim liście — bieżące;
//  - poprawiony list: każdy dostaje najnowszą wersję (treść czytana w chwili wysyłki);
//  - wypisanie zatrzymuje serię od razu.
import { runSql, escStr } from "./supabase.ts";
import { sendMail, campaignEmailHtml } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";

export const START_KIND = "start";
const START_NAME = "Listy powrotu — początek drogi";

// Pierwszy poniedziałek 8:00 (czas polski) PO dniu z wyrażenia `ts` (timestamptz).
export const nextMonday8 = (ts: string) =>
  `((((${ts}) AT TIME ZONE 'Europe/Warsaw')::date + (8 - extract(isodow from ((${ts}) AT TIME ZONE 'Europe/Warsaw')::date))::int) + time '08:00') AT TIME ZONE 'Europe/Warsaw'`;

export async function ensureSeriesTables(base44) {
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.nl_series (
    id text PRIMARY KEY,
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'start',
    active boolean NOT NULL DEFAULT false,
    activated_at timestamptz,
    created_date timestamptz DEFAULT now()
  )`);
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.nl_series_letters (
    id text PRIMARY KEY,
    series_id text NOT NULL,
    position int NOT NULL,
    subject text NOT NULL DEFAULT '',
    preheader text NOT NULL DEFAULT '',
    content text NOT NULL DEFAULT '',
    buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_date timestamptz DEFAULT now()
  )`);
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.nl_series_progress (
    subscriber_id text NOT NULL,
    series_id text NOT NULL,
    next_position int NOT NULL DEFAULT 1,
    next_at timestamptz NOT NULL,
    done_at timestamptz,
    last_sent_at timestamptz,
    PRIMARY KEY (subscriber_id, series_id)
  )`);
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.nl_series_sends (
    series_id text NOT NULL,
    subscriber_id text NOT NULL,
    position int NOT NULL,
    email text NOT NULL,
    sent_at timestamptz DEFAULT now(),
    PRIMARY KEY (series_id, subscriber_id, position)
  )`);
  // Jedna seria startowa — tworzona raz, wyłączona (włącza ją właściciel).
  const have = await runSql(base44, `SELECT id FROM public.nl_series WHERE kind = '${START_KIND}' LIMIT 1`, true).catch(() => []);
  if (!have?.length) {
    await runSql(base44, `INSERT INTO public.nl_series (id, name, kind, active) VALUES (gen_random_uuid()::text, ${escStr(START_NAME)}, '${START_KIND}', false)`);
  }
}

// Warunek SQL dla kampanii (alias subskrybenta: s): gdy seria startowa jest aktywna,
// bieżące kampanie dostają tylko osoby, które ją ukończyły.
export const CAMPAIGN_AFTER_START = ` AND NOT EXISTS (
  SELECT 1 FROM public.nl_series ss WHERE ss.active AND ss.kind = '${START_KIND}'
    AND NOT EXISTS (SELECT 1 FROM public.nl_series_progress p
      WHERE p.series_id = ss.id AND p.subscriber_id = s.id AND p.done_at IS NOT NULL))`;

export async function startSeries(base44) {
  await ensureSeriesTables(base44);
  const rows = await runSql(base44, `SELECT * FROM public.nl_series WHERE kind = '${START_KIND}' LIMIT 1`, true);
  return rows[0];
}

const lettersOf = (base44, seriesId) =>
  runSql(base44, `SELECT id, position, subject, preheader, content, buttons, updated_date FROM public.nl_series_letters
    WHERE series_id = ${escStr(seriesId)} ORDER BY position`, true);

// Dopisanie do serii aktywnych osób bez postępu (nowe zapisy i — przy pierwszym włączeniu — wszyscy obecni).
async function enrol(base44, s) {
  const base = `GREATEST(sb.created_date, ${escStr(new Date(s.activated_at).toISOString())}::timestamptz)`;
  await runSql(base44, `INSERT INTO public.nl_series_progress (subscriber_id, series_id, next_position, next_at)
    SELECT sb.id, ${escStr(s.id)}, 1, ${nextMonday8(base)}
    FROM public.subscribers sb
    WHERE sb.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.nl_series_progress p WHERE p.series_id = ${escStr(s.id)} AND p.subscriber_id = sb.id)
    ON CONFLICT DO NOTHING`);
}

// ===== Akcje panelu =====
export async function seriesState(base44) {
  const s = await startSeries(base44);
  const letters = await lettersOf(base44, s.id);
  const stats = await runSql(base44, `SELECT
      count(*) FILTER (WHERE p.done_at IS NULL AND sb.status = 'active') AS w_trakcie,
      count(*) FILTER (WHERE p.done_at IS NOT NULL) AS ukonczyli,
      min(p.next_at) FILTER (WHERE p.done_at IS NULL AND sb.status = 'active') AS najblizsza
    FROM public.nl_series_progress p JOIN public.subscribers sb ON sb.id = p.subscriber_id
    WHERE p.series_id = ${escStr(s.id)}`, true).catch(() => []);
  const perLetter = await runSql(base44, `SELECT p.next_position AS pozycja, count(*) AS osoby
    FROM public.nl_series_progress p JOIN public.subscribers sb ON sb.id = p.subscriber_id
    WHERE p.series_id = ${escStr(s.id)} AND p.done_at IS NULL AND sb.status = 'active'
    GROUP BY p.next_position ORDER BY p.next_position`, true).catch(() => []);
  const waiting = await runSql(base44, `SELECT count(*) AS n FROM public.subscribers sb WHERE sb.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM public.nl_series_progress p WHERE p.series_id = ${escStr(s.id)} AND p.subscriber_id = sb.id)`, true).catch(() => []);
  const firstMonday = await runSql(base44, `SELECT ${nextMonday8("now()")} AS t`, true).catch(() => []);
  return {
    series: { id: s.id, name: s.name, active: !!s.active, activated_at: s.activated_at },
    letters,
    stats: {
      w_trakcie: Number(stats?.[0]?.w_trakcie || 0),
      ukonczyli: Number(stats?.[0]?.ukonczyli || 0),
      najblizsza: stats?.[0]?.najblizsza || null,
      bez_serii: Number(waiting?.[0]?.n || 0),
      na_liscie: (perLetter || []).map((r) => ({ pozycja: Number(r.pozycja), osoby: Number(r.osoby) })),
    },
    pierwszy_poniedzialek: firstMonday?.[0]?.t || null,
  };
}

export async function seriesSaveLetter(base44, body, buttons) {
  const s = await startSeries(base44);
  const subject = String(body.subject || "").trim().slice(0, 300);
  if (!subject) throw new Error("Podaj temat listu");
  const preheader = String(body.preheader || "").trim().slice(0, 140);
  const content = String(body.content || "").slice(0, 100000);
  const btn = escStr(JSON.stringify(buttons || []));
  if (body.id) {
    await runSql(base44, `UPDATE public.nl_series_letters SET subject = ${escStr(subject)}, preheader = ${escStr(preheader)},
      content = ${escStr(content)}, buttons = ${btn}::jsonb, updated_date = now()
      WHERE id = ${escStr(String(body.id))} AND series_id = ${escStr(s.id)}`);
    return String(body.id);
  }
  const cnt = await runSql(base44, `SELECT count(*) AS n FROM public.nl_series_letters WHERE series_id = ${escStr(s.id)}`, true);
  const n = Number(cnt?.[0]?.n || 0);
  if (n >= 20) throw new Error("Seria może mieć najwyżej 20 listów");
  const id = crypto.randomUUID();
  await runSql(base44, `INSERT INTO public.nl_series_letters (id, series_id, position, subject, preheader, content, buttons)
    VALUES (${escStr(id)}, ${escStr(s.id)}, ${n + 1}, ${escStr(subject)}, ${escStr(preheader)}, ${escStr(content)}, ${btn}::jsonb)`);
  return id;
}

// Usunięcie listu: dalsze listy przesuwają się o jedno miejsce w górę.
export async function seriesDeleteLetter(base44, id) {
  const s = await startSeries(base44);
  if (s.active) throw new Error("Wyłącz serię, zanim usuniesz list (osoby w trakcie mogłyby pominąć list)");
  const rows = await runSql(base44, `SELECT position FROM public.nl_series_letters WHERE id = ${escStr(id)} AND series_id = ${escStr(s.id)}`, true);
  if (!rows?.length) return;
  await runSql(base44, `DELETE FROM public.nl_series_letters WHERE id = ${escStr(id)}`);
  await runSql(base44, `UPDATE public.nl_series_letters SET position = position - 1 WHERE series_id = ${escStr(s.id)} AND position > ${Number(rows[0].position)}`);
}

// Zamiana miejscami z sąsiednim listem (dir = -1 w górę, 1 w dół).
export async function seriesMoveLetter(base44, id, dir) {
  const s = await startSeries(base44);
  const rows = await runSql(base44, `SELECT position FROM public.nl_series_letters WHERE id = ${escStr(id)} AND series_id = ${escStr(s.id)}`, true);
  if (!rows?.length) return;
  const from = Number(rows[0].position);
  const to = from + (dir < 0 ? -1 : 1);
  const other = await runSql(base44, `SELECT id FROM public.nl_series_letters WHERE series_id = ${escStr(s.id)} AND position = ${to}`, true);
  if (!other?.length) return;
  await runSql(base44, `UPDATE public.nl_series_letters SET position = ${to} WHERE id = ${escStr(id)}`);
  await runSql(base44, `UPDATE public.nl_series_letters SET position = ${from} WHERE id = ${escStr(String(other[0].id))}`);
}

export async function seriesSetActive(base44, on) {
  const s = await startSeries(base44);
  if (on) {
    const letters = await lettersOf(base44, s.id);
    const empty = (letters || []).filter((l) => !String(l.subject || "").trim() || !String(l.content || "").trim());
    if (!letters?.length) throw new Error("Seria nie ma jeszcze żadnego listu");
    if (empty.length) throw new Error(`List ${empty[0].position} nie ma tematu albo treści`);
    // Pierwsze włączenie zapamiętuje datę — od niej liczony jest start osób zapisanych wcześniej.
    await runSql(base44, `UPDATE public.nl_series SET active = TRUE, activated_at = COALESCE(activated_at, now()) WHERE id = ${escStr(s.id)}`);
    const fresh = await startSeries(base44);
    await enrol(base44, fresh);
  } else {
    await runSql(base44, `UPDATE public.nl_series SET active = FALSE WHERE id = ${escStr(s.id)}`);
  }
  return seriesState(base44);
}

// ===== Zadanie cykliczne (co 5 minut, przez cronTick → adminNewsletter campaigns.tick) =====
export async function seriesTick(base44, { budgetMs = 50000 } = {}) {
  const t0 = Date.now();
  const s = await startSeries(base44);
  if (!s?.active) return { aktywna: false };
  await enrol(base44, s);
  const letters = await lettersOf(base44, s.id);
  const total = letters.length;
  if (!total) return { aktywna: true, listy: 0 };
  const byPos = new Map(letters.map((l) => [Number(l.position), l]));
  const appUrl = await loadAppUrl(base44);
  let sent = 0, failed = 0, finished = 0;
  while (Date.now() - t0 < budgetMs) {
    const due = await runSql(base44, `SELECT p.subscriber_id, p.next_position, sb.email, sb.name, sb.unsub_token
      FROM public.nl_series_progress p JOIN public.subscribers sb ON sb.id = p.subscriber_id
      WHERE p.series_id = ${escStr(s.id)} AND p.done_at IS NULL AND sb.status = 'active' AND p.next_at <= now()
      ORDER BY p.next_at LIMIT 10`, true).catch(() => []);
    if (!due?.length) break;
    for (const r of due) {
      const pos = Number(r.next_position);
      const sid = escStr(String(r.subscriber_id));
      if (pos > total) {
        await runSql(base44, `UPDATE public.nl_series_progress SET done_at = now() WHERE series_id = ${escStr(s.id)} AND subscriber_id = ${sid}`);
        finished++;
        continue;
      }
      const l = byPos.get(pos);
      // Zabezpieczenie przed podwójną wysyłką tego samego listu (np. po błędzie zapisu postępu).
      const dup = await runSql(base44, `SELECT 1 FROM public.nl_series_sends WHERE series_id = ${escStr(s.id)} AND subscriber_id = ${sid} AND position = ${pos}`, true).catch(() => []);
      let ok = !!dup?.length;
      if (!ok && l) {
        try {
          const unsub = r.unsub_token ? `${appUrl}/listy/wypis?t=${r.unsub_token}` : "";
          await sendMail(base44, {
            kind: "listy", ref: `seria:${s.id}:${pos}`, to: r.email, subject: l.subject,
            html: campaignEmailHtml(String(l.content || ""), r.name || "", unsub, { buttons: Array.isArray(l.buttons) ? l.buttons : [] }),
            preheader: l.preheader || "",
            ...(unsub ? { headers: { "List-Unsubscribe": `<${unsub}>` } } : {}),
          });
          await runSql(base44, `INSERT INTO public.nl_series_sends (series_id, subscriber_id, position, email) VALUES (${escStr(s.id)}, ${sid}, ${pos}, ${escStr(r.email)}) ON CONFLICT DO NOTHING`);
          ok = true;
          sent++;
        } catch {
          failed++;
        }
      }
      if (ok) {
        const last = pos >= total;
        await runSql(base44, `UPDATE public.nl_series_progress SET next_position = ${pos + 1}, last_sent_at = now(),
            next_at = ${nextMonday8("now()")}${last ? ", done_at = now()" : ""}
          WHERE series_id = ${escStr(s.id)} AND subscriber_id = ${sid}`);
        if (last) finished++;
      } else {
        // Błąd wysyłki — ponowienie za godzinę (nie blokuje pozostałych).
        await runSql(base44, `UPDATE public.nl_series_progress SET next_at = now() + interval '1 hour' WHERE series_id = ${escStr(s.id)} AND subscriber_id = ${sid}`);
      }
      if (Date.now() - t0 >= budgetMs) break;
    }
  }
  return { aktywna: true, wyslane: sent, bledy: failed, ukonczyli: finished };
}
