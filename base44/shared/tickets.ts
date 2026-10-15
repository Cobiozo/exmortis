// Bilety na wydarzenia: imienne, z numerem ABC-1234 i kodem QR. Sprzedaż przez kasę (PayU), wydanie po opłaceniu,
// sprawdzanie przy wejściu skanerem (administrator albo osoby z uprawnieniem nadanym w panelu).
import { runSql, escStr } from "./supabase.ts";
import { APP_URL, getSetting } from "./settings.ts";

export const TICKET_SCHEMA_SQL = `
    ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tickets boolean DEFAULT false;
    ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_template jsonb;
    CREATE TABLE IF NOT EXISTS public.event_tickets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      token text NOT NULL UNIQUE,
      event_id text NOT NULL,
      order_id text,
      line_no int NOT NULL DEFAULT 0,
      holder_name text NOT NULL,
      buyer_email text,
      price numeric(10,2) NOT NULL DEFAULT 0,
      source text NOT NULL DEFAULT 'zakup',
      status text NOT NULL DEFAULT 'wazny' CHECK (status IN ('wazny','wykorzystany','anulowany')),
      checked_at timestamptz,
      checked_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (order_id, line_no)
    );
    CREATE INDEX IF NOT EXISTS event_tickets_event_idx ON public.event_tickets (event_id);
    CREATE INDEX IF NOT EXISTS event_tickets_email_idx ON public.event_tickets (lower(buyer_email));
    ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.event_tickets FROM PUBLIC, anon, authenticated;`;

let schemaReady = false;
export async function ensureTicketSchema(base44) {
  if (schemaReady) return;
  await runSql(base44, TICKET_SCHEMA_SQL);
  schemaReady = true;
}

// Numer biletu: 3 litery + 4 cyfry (bez I, O, Q — nie mylą się z cyframi). W bazie bez myślnika.
const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
export function newCode() {
  const b = rnd(7);
  return [...b.slice(0, 3)].map((x) => LETTERS[x % LETTERS.length]).join("") + [...b.slice(3)].map((x) => String(x % 10)).join("");
}
export const showCode = (c) => (c && c.length === 7 ? `${c.slice(0, 3)}-${c.slice(3)}` : String(c || ""));
// Wpisany ręcznie numer: „krt 4821”, „KRT-4821” → KRT4821.
export const normCode = (s) => {
  const v = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9]{4}$/.test(v) ? v : null;
};
const TOKEN_ABC = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newToken = () => [...rnd(32)].map((x) => TOKEN_ABC[x % TOKEN_ABC.length]).join("");
export const validToken = (t) => typeof t === "string" && /^[A-Za-z0-9]{24,64}$/.test(t);
// Kod QR zawiera adres strony biletu — zwykły aparat w telefonie otworzy bilet, skaner wyciągnie z niego klucz.
export const ticketUrl = (token) => `${APP_URL}/bilet#t=${token}`;
export const ticketPdfUrl = (token) => `${APP_URL}/functions/tickets?pdf=${token}`;
// Z odczytu skanera: adres z kluczem, sam klucz albo numer biletu.
export function parseScan(raw) {
  const s = String(raw || "").trim().slice(0, 500);
  const m = s.match(/[#?&]t=([A-Za-z0-9]{24,64})/);
  if (m) return { token: m[1] };
  if (validToken(s)) return { token: s };
  const c = normCode(s);
  return c ? { code: c } : null;
}

export const cleanName = (v) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

// Zapisy zamknięte: termin z panelu albo 15 minut przed startem.
export function salesClosed(ev, now = Date.now()) {
  if (!ev || ev.status !== "Opublikowane") return "To wydarzenie nie jest już dostępne.";
  if (!ev.tickets || !(Number(ev.price) > 0) || ev.format === "Online") return "Na to wydarzenie nie sprzedajemy biletów.";
  if (!ev.start_datetime) return "Sprzedaż biletów jeszcze się nie zaczęła.";
  const deadline = ev.registration_deadline ? Date.parse(ev.registration_deadline) : Date.parse(ev.start_datetime) - 15 * 60000;
  if (now > deadline) return "Sprzedaż biletów jest zamknięta.";
  return null;
}

// Zajęte miejsca: bilety ważne i wykorzystane + rezerwacja na niedokończone płatności z ostatnich 30 minut.
export async function seatsTaken(base44, eventId, exceptOrderId = null) {
  const [r] = await runSql(base44, `SELECT
      (SELECT count(*) FROM public.event_tickets WHERE event_id = ${escStr(eventId)} AND status <> 'anulowany')::int AS sold,
      (SELECT COALESCE(sum((it->>'quantity')::int), 0) FROM public.orders o, jsonb_array_elements(o.items) it
        WHERE o.status IN ('PENDING','NEW','WAITING_FOR_CONFIRMATION') AND o.created_date > now() - interval '30 minutes'
          AND it->>'event_id' = ${escStr(eventId)} ${exceptOrderId ? `AND o.id <> ${escStr(exceptOrderId)}` : ""})::int AS pending`, true);
  return { sold: Number(r?.sold) || 0, pending: Number(r?.pending) || 0 };
}

// Pozycje biletowe z koszyka → ceny i dane z serwera. Rzuca czytelny błąd (kasa pokazuje go klientowi).
export async function ticketLines(base44, items) {
  const wanted = new Map();
  for (const it of items) {
    const id = String(it?.id || "").slice(0, 64);
    const holders = (Array.isArray(it?.holders) ? it.holders : []).slice(0, 10).map(cleanName);
    if (!id || !holders.length) throw new Error("Bilet: podaj imię i nazwisko każdej osoby");
    if (holders.some((h) => h.length < 3)) throw new Error("Bilet: podaj imię i nazwisko każdej osoby");
    wanted.set(id, [...(wanted.get(id) || []), ...holders]);
  }
  if (!wanted.size) return [];
  await ensureTicketSchema(base44);
  const rows = await runSql(base44, `SELECT id, title, status, format, price::float8 AS price, capacity, start_datetime, registration_deadline,
      COALESCE(tickets, false) AS tickets FROM public.events WHERE id IN (${[...wanted.keys()].map(escStr).join(",")})`, true);
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const out = [];
  let total = 0;
  for (const [id, holders] of wanted) {
    const ev = byId.get(id);
    const closed = salesClosed(ev);
    if (closed) throw new Error(`Bilet: ${closed}`);
    if (holders.length > 10) throw new Error("Bilet: najwyżej 10 biletów na jedno wydarzenie w zamówieniu");
    total += holders.length;
    if (Number(ev.capacity) > 0) {
      const { sold, pending } = await seatsTaken(base44, id);
      const left = Number(ev.capacity) - sold - pending;
      if (holders.length > left) throw new Error(left > 0 ? `Brak wolnych miejsc: zostało ${left}` : "Brak wolnych miejsc na to wydarzenie");
    }
    const unit = Math.round(Number(ev.price) * 100);
    out.push({ event_id: id, kind: "bilet", product_id: `bilet:${id}`, name: `Bilet — ${String(ev.title).slice(0, 120)}`, unitPrice: String(unit), quantity: holders.length, holders });
  }
  if (total > 20) throw new Error("Bilet: najwyżej 20 biletów w jednym zamówieniu");
  return out;
}

// Wstawienie biletów z jednoczesnym losowaniem unikalnych numerów (rzadkie powtórki — ponowna próba).
async function insertTicket(base44, t) {
  for (let i = 0; i < 6; i++) {
    const rows = await runSql(base44, `INSERT INTO public.event_tickets (code, token, event_id, order_id, line_no, holder_name, buyer_email, price, source)
      VALUES (${escStr(newCode())}, ${escStr(newToken())}, ${escStr(t.event_id)}, ${t.order_id ? escStr(t.order_id) : "NULL"}, ${t.line_no},
        ${escStr(t.holder_name)}, ${t.buyer_email ? escStr(t.buyer_email) : "NULL"}, ${Number(t.price) || 0}, ${escStr(t.source || "zakup")})
      ON CONFLICT DO NOTHING RETURNING *`).catch((e) => { if (!/duplicate|unique/i.test(String(e?.message))) throw e; return []; });
    if (rows?.length) return rows[0];
    if (t.order_id) {
      const had = await runSql(base44, `SELECT * FROM public.event_tickets WHERE order_id = ${escStr(t.order_id)} AND line_no = ${t.line_no}`, true);
      if (had?.length) return had[0];
    }
  }
  throw new Error("Nie udało się nadać numeru biletu");
}

// Po opłaceniu zamówienia: bilety (idempotentnie po numerze zamówienia i pozycji) + zapis na wydarzenie kupującego.
export async function issueOrderTickets(base44, order, items) {
  const lines = (items || []).filter((i) => i.kind === "bilet" && i.event_id);
  if (!lines.length) return [];
  await ensureTicketSchema(base44);
  const email = String(order.buyer_email || "").trim().toLowerCase();
  const out = [];
  let n = 0;
  for (const l of lines) {
    const holders = Array.isArray(l.holders) && l.holders.length ? l.holders : [order.buyer_name || "Uczestnik"];
    for (const h of holders.slice(0, 20)) {
      out.push(await insertTicket(base44, { event_id: l.event_id, order_id: String(order.id), line_no: n++, holder_name: cleanName(h) || "Uczestnik",
        buyer_email: email, price: Number(l.unitPrice) / 100 }));
    }
    // Zapis kupującego: przypomnienia przed spotkaniem i (online) osobisty link dołączenia. Bez listy rezerwowej — miejsce jest opłacone.
    if (email) {
      await runSql(base44, `INSERT INTO public.registrations (id, event_id, first_name, email, consent, status, source, created_at)
        VALUES (gen_random_uuid()::text, ${escStr(l.event_id)}, ${escStr(String(order.buyer_name || "").split(" ")[0] || "Uczestnik")}, ${escStr(email)}, TRUE, 'Zapisany', 'bilet', now())
        ON CONFLICT (event_id, email) DO UPDATE SET status = 'Zapisany', source = 'bilet'
          WHERE public.registrations.status NOT IN ('Zapisany','Obecny')`).catch((e) => console.error("bilet: zapis", e?.message));
    }
  }
  // Limit miejsc sprawdzany jest przy zamówieniu (z płatnościami w toku z 30 min). Płatność zakończona później
  // może dać nadkomplet — bilet zostaje ważny (jest opłacony), a administrator dostaje ostrzeżenie.
  const evIds = [...new Set(lines.map((l) => String(l.event_id)))];
  out.overbooked = await runSql(base44, `SELECT e.id, e.title, e.capacity, COUNT(t.id)::int AS sold
      FROM public.events e JOIN public.event_tickets t ON t.event_id = e.id AND t.status <> 'anulowany'
     WHERE e.id IN (${evIds.map(escStr).join(",")}) AND COALESCE(e.capacity, 0) > 0
     GROUP BY e.id, e.title, e.capacity HAVING COUNT(t.id) > e.capacity`, true).catch(() => []);
  return out;
}

export async function loadEvent(base44, id) {
  const rows = await runSql(base44, `SELECT id, title, slug, subtitle, format, location, start_datetime, duration_minutes, status, price::float8 AS price,
      capacity, registration_deadline, COALESCE(tickets, false) AS tickets, ticket_template, short_path FROM public.events WHERE id = ${escStr(id)}`, true);
  return rows?.[0] || null;
}

// ---- Uprawnienie do skanowania: administrator albo osoba z listy (e-mail; wszystkie wydarzenia albo jedno; opcjonalnie do daty) ----
export const SCANNERS_KEY = "bilety_skanerzy";
export async function scannerScope(base44, me) {
  if (!me) return null;
  if (me.role === "admin") return { all: true, admin: true };
  const email = String(me.email || "").toLowerCase();
  const list = (await getSetting(base44, SCANNERS_KEY).catch(() => null)) || [];
  const mine = (Array.isArray(list) ? list : []).filter((s) => String(s.email || "").toLowerCase() === email && (!s.until || Date.parse(s.until) > Date.now()));
  if (!mine.length) return null;
  if (mine.some((s) => !s.event_id)) return { all: true };
  return { all: false, events: mine.map((s) => String(s.event_id)) };
}
export const canScan = (scope, eventId) => !!scope && (scope.all || scope.events.includes(String(eventId)));

// Sprawdzenie biletu przy wejściu — jedno atomowe przejście „ważny → wykorzystany”.
export async function checkTicket(base44, { scan, eventId, by, scope, undo = false }) {
  await ensureTicketSchema(base44);
  const where = scan.token ? `token = ${escStr(scan.token)}` : `code = ${escStr(scan.code)}`;
  const [t] = await runSql(base44, `SELECT t.*, e.title AS event_title FROM public.event_tickets t LEFT JOIN public.events e ON e.id = t.event_id WHERE ${where}`, true);
  if (!t) return { result: "nieznany" };
  const base = { code: showCode(t.code), name: t.holder_name, event_id: t.event_id, event_title: t.event_title };
  if (!canScan(scope, t.event_id)) return { result: "brak_uprawnien", ...base };
  if (eventId && String(eventId) !== String(t.event_id)) return { result: "inne_wydarzenie", ...base };
  if (undo) {
    const r = await runSql(base44, `UPDATE public.event_tickets SET status = 'wazny', checked_at = NULL, checked_by = NULL
      WHERE id = ${escStr(t.id)} AND status = 'wykorzystany' RETURNING id`);
    // Cofnięcie wejścia przywraca też obecność w zapisach (administrator widzi go znów jako „Zapisany").
    if (r?.length && t.buyer_email) {
      await runSql(base44, `UPDATE public.registrations SET status = 'Zapisany' WHERE event_id = ${escStr(t.event_id)}
        AND lower(email) = ${escStr(String(t.buyer_email).toLowerCase())} AND status = 'Obecny'`).catch(() => {});
    }
    return { result: r?.length ? "cofniety" : "bez_zmian", ...base };
  }
  if (t.status === "anulowany") return { result: "anulowany", ...base };
  const r = await runSql(base44, `UPDATE public.event_tickets SET status = 'wykorzystany', checked_at = now(), checked_by = ${escStr(by)}
    WHERE id = ${escStr(t.id)} AND status = 'wazny' RETURNING checked_at`);
  if (!r?.length) {
    const [cur] = await runSql(base44, `SELECT status, checked_at, checked_by FROM public.event_tickets WHERE id = ${escStr(t.id)}`, true);
    return { result: cur?.status === "anulowany" ? "anulowany" : "wykorzystany", ...base, checked_at: cur?.checked_at, checked_by: cur?.checked_by };
  }
  // Obecność w zapisach (lista uczestników w panelu).
  if (t.buyer_email) {
    await runSql(base44, `UPDATE public.registrations SET status = 'Obecny' WHERE event_id = ${escStr(t.event_id)}
      AND lower(email) = ${escStr(String(t.buyer_email).toLowerCase())} AND status = 'Zapisany'`).catch(() => {});
  }
  return { result: "ok", ...base, checked_at: r[0].checked_at };
}

export async function eventCounts(base44, eventId) {
  await ensureTicketSchema(base44);
  const [r] = await runSql(base44, `SELECT count(*) FILTER (WHERE status <> 'anulowany')::int AS sold,
      count(*) FILTER (WHERE status = 'wykorzystany')::int AS checked FROM public.event_tickets WHERE event_id = ${escStr(eventId)}`, true);
  return { sold: Number(r?.sold) || 0, checked: Number(r?.checked) || 0 };
}

// ---- E-mail z biletami (dołączany do potwierdzenia zamówienia) ----
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const when = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function ticketsHtml(tickets, events) {
  if (!tickets.length) return "";
  const byEv = new Map();
  for (const t of tickets) byEv.set(t.event_id, [...(byEv.get(t.event_id) || []), t]);
  const blocks = [...byEv.entries()].map(([id, list]) => {
    const ev = events.get(id) || {};
    return `<div style="margin:0 0 18px;border:1px solid #C9A24A;padding:22px;">
      <p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 10px;">BILET${list.length > 1 ? "Y" : ""}</p>
      <p style="margin:0 0 6px;color:#F5EFE1;font-size:20px;">${esc(ev.title || "")}</p>
      ${ev.start_datetime ? `<p style="margin:0 0 14px;color:#8A8A8C;">${esc(when(ev.start_datetime))} (czas polski)${ev.format === "Online" ? " · online" : ""}</p>` : ""}
      ${list.map((t) => `<p style="margin:0 0 10px;color:#E2E2E2;">${esc(t.holder_name)} · <b style="color:#C9A24A;letter-spacing:2px;">${esc(showCode(t.code))}</b><br>
        <a href="${esc(ticketPdfUrl(t.token))}" style="color:#C9A24A;">Pobierz bilet (PDF)</a> · <a href="${esc(ticketUrl(t.token))}" style="color:#8A8A8C;">otwórz na telefonie</a></p>`).join("")}
    </div>`;
  }).join("");
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">${blocks}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Bilet jest imienny i ważny na jedno wejście. Przy wejściu pokaż kod QR — na telefonie albo wydrukowany. Każdą osobę wpuszczamy na jej bilet, więc bilety dla innych przekaż im wcześniej (PDF albo link). Wszystkie bilety są też w Moim koncie → Spotkania, po zalogowaniu tym adresem e-mail.</p></div>`;
}

// ---- Bilety tylko na spotkania stacjonarne. Darmowe stacjonarne: bilet wydawany przy zapisie ----
export const ticketsAllowed = (ev) => !!ev && ev.format !== "Online";

// Jeden bilet na zapis (klucz zapis:<id zapisu>), idempotentnie; ponowny zapis po wypisaniu przywraca bilet.
export async function regTicket(base44, eventId, reg) {
  if (!eventId || !reg?.id || !reg?.email) return null;
  await ensureTicketSchema(base44);
  const [ev] = await runSql(base44, `SELECT format, COALESCE(tickets, false) AS tickets, price::float8 AS price FROM public.events WHERE id = ${escStr(String(eventId))}`, true);
  if (!ev || ev.tickets !== true || !ticketsAllowed(ev) || Number(ev.price) > 0) return null;
  const key = `zapis:${reg.id}`;
  const [had] = await runSql(base44, `SELECT * FROM public.event_tickets WHERE order_id = ${escStr(key)} AND line_no = 0`, true);
  if (had) {
    if (had.status !== "anulowany") return had;
    const [back] = await runSql(base44, `UPDATE public.event_tickets SET status = CASE WHEN checked_at IS NULL THEN 'wazny' ELSE 'wykorzystany' END
      WHERE id = ${escStr(had.id)} RETURNING *`);
    return back || had;
  }
  return insertTicket(base44, { event_id: String(eventId), order_id: key, line_no: 0, holder_name: cleanName(reg.first_name) || "Uczestnik",
    buyer_email: String(reg.email).trim().toLowerCase(), price: 0, source: "zapis" });
}

// Wypisanie z darmowego spotkania → bilet z zapisu anulowany (wykorzystanego nie ruszamy).
export async function cancelRegTicket(base44, regId) {
  if (!regId) return;
  await ensureTicketSchema(base44);
  await runSql(base44, `UPDATE public.event_tickets SET status = 'anulowany' WHERE order_id = ${escStr(`zapis:${regId}`)} AND status = 'wazny'`);
}