// Kalendarz Google dla rezerwacji 1:1 — wyłącznie zakresy calendar.app.created i calendar.freebusy.
// Aplikacja pisze tylko do własnego kalendarza „exmortis · sesje”; z kalendarza głównego czyta wyłącznie zajętość.
// Token zostaje po stronie serwera: nigdy nie trafia do odpowiedzi, do rejestru ani do treści wydarzenia.
// Każdy błąd Google trafia do kolejki ponowień i nigdy nie przewraca ani nie cofa rezerwacji.
import { runSql, escStr } from "./supabase.ts";

const API = "https://www.googleapis.com/calendar/v3";
const CAL_NAME = "exmortis · sesje";
const TZ = "Europe/Warsaw";
const CACHE_MS = 5 * 60 * 1000;

let busyCache = { at: 0, from: 0, to: 0, ranges: [] };

// Krótki powód z Google — bez tokenu i bez treści żądania.
async function gerr(r) {
  const t = await r.text().catch(() => "");
  let m = "";
  try { m = JSON.parse(t)?.error?.message || ""; } catch { /* nie-json */ }
  return `${r.status}${m ? " · " + m.slice(0, 160) : ""}`;
}

async function token(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");
  if (!accessToken) throw new Error("brak tokenu Google");
  return accessToken;
}

const call = (tk, path, init = {}) =>
  fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json", ...(init.headers || {}) } });

async function mark(base44, status, error = null) {
  await runSql(base44, `UPDATE public.bk_settings SET google_status = ${escStr(status)}, google_status_at = now(),
    google_error = ${error ? escStr(String(error).slice(0, 500)) : "NULL"} WHERE id = 1`).catch(() => {});
}

// Własny kalendarz aplikacji: powstaje raz, potem używamy zapisanego identyfikatora.
export async function ensureCalendar(base44) {
  const [row] = await runSql(base44, `SELECT google_calendar_id FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  if (row?.google_calendar_id) return row.google_calendar_id;
  const tk = await token(base44);
  const r = await call(tk, "/calendars", { method: "POST", body: JSON.stringify({ summary: CAL_NAME, timeZone: TZ }) });
  if (!r.ok) throw new Error(await gerr(r));
  const j = await r.json();
  await runSql(base44, `UPDATE public.bk_settings SET google_calendar_id = ${escStr(j.id)}, updated_at = now() WHERE id = 1`);
  return j.id;
}

export async function typeDuration(base44, typeId) {
  const [r] = await runSql(base44, `SELECT duration_min FROM public.bk_types WHERE id = ${escStr(typeId)}::uuid`, true).catch(() => []);
  return r?.duration_min || null;
}

export async function busyOn(base44) {
  const [s] = await runSql(base44, `SELECT google_busy FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  return s?.google_busy !== false;
}

export const overlapsBusy = (startIso, endIso, ranges) => {
  const a = new Date(startIso).getTime(), b = new Date(endIso).getTime();
  return (ranges || []).some((r) => a < r.to && b > r.from);
};

// Zajętość kalendarza głównego, najwyżej 5 minut w pamięci instancji.
export async function freeBusy(base44, from, to, fresh = false) {
  const f = new Date(from).getTime(), t = new Date(to).getTime(), now = Date.now();
  if (!fresh && busyCache.ranges.length && now - busyCache.at < CACHE_MS && busyCache.from <= f && busyCache.to >= t) {
    return { ok: true, cached: true, ranges: busyCache.ranges };
  }
  try {
    const tk = await token(base44);
    const r = await call(tk, "/freeBusy", { method: "POST", body: JSON.stringify({
      timeMin: new Date(f).toISOString(), timeMax: new Date(t).toISOString(), items: [{ id: "primary" }] }) });
    if (!r.ok) throw new Error(await gerr(r));
    const j = await r.json();
    // Google potrafi zwrócić 200 i wpisać błąd dopiero przy kalendarzu — wtedy traktujemy to jak brak odpowiedzi.
    const cal = j?.calendars?.primary;
    if (cal?.errors?.length) throw new Error(`freeBusy: ${cal.errors[0]?.reason || "błąd"}`);
    const ranges = (cal?.busy || []).map((b) => ({ from: new Date(b.start).getTime(), to: new Date(b.end).getTime() }));
    busyCache = { at: now, from: f, to: t, ranges };
    await mark(base44, "ok");
    return { ok: true, cached: false, ranges };
  } catch (e) {
    await mark(base44, "error", e.message);
    return { ok: false, ranges: [] };
  }
}

// Sloty: odejmij zajętość z Google tak samo jak ręczną blokadę. Brak odpowiedzi nic nie blokuje.
export async function dropBusy(base44, slots, from, to) {
  if (!slots.length || !(await busyOn(base44))) return slots;
  const b = await freeBusy(base44, from, to);
  if (!b.ok) return slots;
  return slots.filter((s) => !overlapsBusy(s.start, s.end, b.ranges));
}

// Ostatni sprawdzian tuż przed zapisem — bez pamięci podręcznej.
export async function takenByGoogle(base44, startIso, endIso) {
  if (!(await busyOn(base44))) return false;
  const b = await freeBusy(base44, startIso, endIso, true);
  return b.ok && overlapsBusy(startIso, endIso, b.ranges);
}

async function queue(base44, bookingId, op, error) {
  await runSql(base44, `INSERT INTO public.bk_gcal_queue (booking_id, op, attempts, last_error)
    VALUES (${escStr(bookingId)}::uuid, ${escStr(op)}, 1, ${escStr(String(error).slice(0, 500))})
    ON CONFLICT (booking_id, op) DO UPDATE SET attempts = bk_gcal_queue.attempts + 1, last_error = EXCLUDED.last_error`).catch(() => {});
}

async function loadRow(base44, bookingId) {
  const r = await runSql(base44, `SELECT k.id, k.starts_at, k.ends_at, k.first_name, k.status, k.gcal_event_id,
      t.name AS type FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
    WHERE k.id = ${escStr(bookingId)}::uuid`, true).catch(() => []);
  return r?.[0] || null;
}

// Tytuł i czas. Bez e-maila, bez odpowiedzi z formularza, bez danych o zdrowiu.
async function push(base44, row) {
  const cal = await ensureCalendar(base44);
  const tk = await token(base44);
  const body = {
    summary: ["exmortis", row.type, row.first_name].filter(Boolean).join(" · "),
    start: { dateTime: new Date(row.starts_at).toISOString(), timeZone: TZ },
    end: { dateTime: new Date(row.ends_at).toISOString(), timeZone: TZ },
  };
  const path = row.gcal_event_id
    ? `/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(row.gcal_event_id)}`
    : `/calendars/${encodeURIComponent(cal)}/events`;
  const r = await call(tk, `${path}?sendUpdates=none`, { method: row.gcal_event_id ? "PATCH" : "POST", body: JSON.stringify(body) });
  if (row.gcal_event_id && (r.status === 404 || r.status === 410)) {
    await runSql(base44, `UPDATE public.bk_bookings SET gcal_event_id = NULL WHERE id = ${escStr(row.id)}::uuid`).catch(() => {});
    return push(base44, { ...row, gcal_event_id: null });
  }
  if (!r.ok) throw new Error(await gerr(r));
  const j = await r.json();
  await runSql(base44, `UPDATE public.bk_bookings SET gcal_event_id = ${escStr(j.id)}, gcal_synced_at = now() WHERE id = ${escStr(row.id)}::uuid`).catch(() => {});
  return j.id;
}

// Rezerwacja → wydarzenie, przeniesienie → aktualizacja, anulowanie → usunięcie.
export async function syncBooking(base44, bookingId, op) {
  try {
    const row = await loadRow(base44, bookingId);
    if (!row) return { ok: false };
    if (op === "delete" || row.status !== "POTWIERDZONA") {
      if (row.gcal_event_id) {
        const cal = await ensureCalendar(base44);
        const tk = await token(base44);
        const r = await call(tk, `/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(row.gcal_event_id)}?sendUpdates=none`, { method: "DELETE" });
        if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(await gerr(r));
        await runSql(base44, `UPDATE public.bk_bookings SET gcal_event_id = NULL, gcal_synced_at = now() WHERE id = ${escStr(row.id)}::uuid`).catch(() => {});
      }
    } else {
      await push(base44, row);
    }
    await runSql(base44, `DELETE FROM public.bk_gcal_queue WHERE booking_id = ${escStr(row.id)}::uuid`).catch(() => {});
    await mark(base44, "ok");
    return { ok: true };
  } catch (e) {
    await queue(base44, bookingId, op === "delete" ? "delete" : "upsert", e.message);
    await mark(base44, "error", e.message);
    return { ok: false, error: e.message };
  }
}

// Zadanie cykliczne: dokończ to, co się wcześniej nie udało.
export async function retryGoogle(base44) {
  const rows = await runSql(base44, `SELECT booking_id, op FROM public.bk_gcal_queue ORDER BY created_at LIMIT 20`, true).catch(() => []);
  let done = 0, left = 0;
  for (const r of rows) {
    const res = await syncBooking(base44, r.booking_id, r.op);
    if (res.ok) done++; else left++;
  }
  return { google_done: done, google_left: left };
}

// Stan połączenia dla panelu. Konto czytamy z Google (zakres e-mail), a gdy się nie uda — zostawiamy puste.
export async function googleStatus(base44) {
  const [s] = await runSql(base44, `SELECT google_calendar_id, google_busy, google_status, google_status_at, google_error
    FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  const [q] = await runSql(base44, `SELECT count(*)::int AS n FROM public.bk_gcal_queue`, true).catch(() => []);
  let account = null, connected = false;
  try {
    const tk = await token(base44);
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tk}` } });
    if (r.ok) { const j = await r.json(); account = j.email || null; connected = true; }
    else connected = (await freeBusy(base44, new Date().toISOString(), new Date(Date.now() + 3600e3).toISOString())).ok;
  } catch { /* brak połączenia */ }
  return {
    connected, account, calendar_id: s?.google_calendar_id || null, busy: s?.google_busy !== false,
    status: s?.google_status || null, status_at: s?.google_status_at || null, error: s?.google_error || null,
    pending: q?.n || 0, scopes: ["calendar.app.created", "calendar.freebusy", "email"],
  };
}