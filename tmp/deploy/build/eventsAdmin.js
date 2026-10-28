var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// supabase/functions/_shared/shim.ts
var waitUntil;
var init_shim = __esm({
  "supabase/functions/_shared/shim.ts"() {
    waitUntil = (p) => {
      try {
        globalThis.EdgeRuntime?.waitUntil?.(p);
      } catch {
      }
    };
  }
});

// supabase/functions/_shared/supabase.ts
async function runSql(_base44, query, readOnly = false) {
  const q = String(query || "").trim().replace(/;+\s*$/, "");
  if (!q) return [];
  const rows = await rpc(null, "exm_exec_sql", { q, read_only: readOnly || READ_RE.test(q) });
  return Array.isArray(rows) ? rows : [];
}
async function rpc(_base44, fn, args) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SRK2, Authorization: `Bearer ${SRK2}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15e3)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase RPC ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
function escStr(value) {
  const s = String(value);
  let d = "$q$";
  for (let n = 1; (s + d).indexOf(d) !== s.length; n++) d = `$q${n}$`;
  return `${d}${s}${d}`;
}
function textField(body, key, { max = 2e3, required = true } = {}) {
  const v = body ? body[key] : void 0;
  if (v === void 0 || v === null || String(v).trim() === "") {
    if (required) {
      const e = new Error(`Brak pola: ${key}`);
      e.isValidation = true;
      throw e;
    }
    return null;
  }
  const s = String(v).trim();
  if (s.length > max) {
    const e = new Error(`Pole ${key} jest zbyt d\u0142ugie`);
    e.isValidation = true;
    throw e;
  }
  return s;
}
async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}
var SUPA_URL2, SRK2, PROJECT_REF, READ_RE;
var init_supabase = __esm({
  "supabase/functions/_shared/supabase.ts"() {
    SUPA_URL2 = Deno.env.get("SUPABASE_URL") || "";
    SRK2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    PROJECT_REF = SUPA_URL2.replace(/^https:\/\//, "").split(".")[0] || "fqhvxhnbeyvwubpnuzxe";
    READ_RE = /^\s*(select|with|values|show|explain)\b/i;
  }
});

// supabase/functions/_shared/snapshot.ts
async function clearSnap(base44, prefix) {
  for (const k of MEM.keys()) if (k.startsWith(prefix)) MEM.delete(k);
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const rows = await ent.filter({ key: { $regex: `^${prefix}` } }).catch(() => []);
  await Promise.all(rows.map((r) => ent.update(r.id, { refreshed_at: "2000-01-01T00:00:00.000Z" }).catch(() => {
  })));
}
var MEM;
var init_snapshot = __esm({
  "supabase/functions/_shared/snapshot.ts"() {
    init_shim();
    MEM = /* @__PURE__ */ new Map();
  }
});

// supabase/functions/_shared/settings.ts
async function ensureSettingsTable(base44) {
  if (TABLE_OK) return;
  TABLE_OK = true;
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_date timestamptz DEFAULT now()
    )`
  );
}
async function getSetting(base44, key) {
  await ensureSettingsTable(base44);
  const rows = await runSql(
    base44,
    `SELECT value FROM public.app_settings WHERE key = ${escStr(key)}`,
    true
  );
  const value = rows && rows.length > 0 ? rows[0].value : null;
  if (key === "smtp") FIRMA = await getSetting(base44, "firma").catch(() => null);
  return value;
}
async function loadAppUrl(base44) {
  if (Date.now() - APP_URL_AT < 3e5) return APP_URL;
  const s = await getSetting(base44, "app").catch(() => null);
  APP_URL = safeAppUrl(s?.url);
  APP_URL_AT = Date.now();
  return APP_URL;
}
var TABLE_OK, FIRMA, DEFAULT_APP_URL, APP_URL, safeAppUrl, APP_URL_AT;
var init_settings = __esm({
  "supabase/functions/_shared/settings.ts"() {
    init_supabase();
    init_snapshot();
    TABLE_OK = true;
    FIRMA = null;
    DEFAULT_APP_URL = globalThis.Deno?.env?.get?.("APP_URL") || "";
    APP_URL = DEFAULT_APP_URL;
    safeAppUrl = (u) => !u || /preview--/i.test(String(u)) ? DEFAULT_APP_URL : String(u).replace(/\/+$/, "");
    APP_URL_AT = 0;
  }
});

// supabase/functions/_shared/tickets.ts
var tickets_exports = {};
__export(tickets_exports, {
  SCANNERS_KEY: () => SCANNERS_KEY,
  TICKET_SCHEMA_SQL: () => TICKET_SCHEMA_SQL,
  canScan: () => canScan,
  cancelRegTicket: () => cancelRegTicket,
  checkTicket: () => checkTicket,
  cleanName: () => cleanName,
  ensureTicketSchema: () => ensureTicketSchema,
  eventCounts: () => eventCounts,
  issueOrderTickets: () => issueOrderTickets,
  loadEvent: () => loadEvent,
  newCode: () => newCode,
  newToken: () => newToken,
  normCode: () => normCode,
  parseScan: () => parseScan,
  regTicket: () => regTicket,
  salesClosed: () => salesClosed,
  scannerScope: () => scannerScope,
  seatsTaken: () => seatsTaken,
  showCode: () => showCode,
  ticketLines: () => ticketLines,
  ticketPdfUrl: () => ticketPdfUrl,
  ticketUrl: () => ticketUrl,
  ticketsAllowed: () => ticketsAllowed,
  ticketsHtml: () => ticketsHtml,
  validToken: () => validToken
});
async function ensureTicketSchema(base44) {
  if (schemaReady) return;
  await runSql(base44, TICKET_SCHEMA_SQL);
  schemaReady = true;
}
function newCode() {
  const b = rnd(7);
  return [...b.slice(0, 3)].map((x) => LETTERS[x % LETTERS.length]).join("") + [...b.slice(3)].map((x) => String(x % 10)).join("");
}
function parseScan(raw) {
  const s = String(raw || "").trim().slice(0, 500);
  const m = s.match(/[#?&]t=([A-Za-z0-9]{24,64})/);
  if (m) return { token: m[1] };
  if (validToken(s)) return { token: s };
  const c = normCode(s);
  return c ? { code: c } : null;
}
function salesClosed(ev, now = Date.now()) {
  if (!ev || ev.status !== "Opublikowane") return "To wydarzenie nie jest ju\u017C dost\u0119pne.";
  if (!ev.tickets || !(Number(ev.price) > 0) || ev.format === "Online") return "Na to wydarzenie nie sprzedaj\u0119 bilet\xF3w.";
  if (!ev.start_datetime) return "Sprzeda\u017C bilet\xF3w jeszcze si\u0119 nie zacz\u0119\u0142a.";
  const deadline = ev.registration_deadline ? Date.parse(ev.registration_deadline) : Date.parse(ev.start_datetime) - 15 * 6e4;
  if (now > deadline) return "Sprzeda\u017C bilet\xF3w jest zamkni\u0119ta.";
  return null;
}
async function seatsTaken(base44, eventId, exceptOrderId = null) {
  const [r] = await runSql(base44, `SELECT
      (SELECT count(*) FROM public.event_tickets WHERE event_id = ${escStr(eventId)} AND status <> 'anulowany')::int AS sold,
      (SELECT COALESCE(sum((it->>'quantity')::int), 0) FROM public.orders o, jsonb_array_elements(o.items) it
        WHERE o.status IN ('PENDING','NEW','WAITING_FOR_CONFIRMATION') AND o.created_date > now() - interval '30 minutes'
          AND it->>'event_id' = ${escStr(eventId)} ${exceptOrderId ? `AND o.id <> ${escStr(exceptOrderId)}` : ""})::int AS pending`, true);
  return { sold: Number(r?.sold) || 0, pending: Number(r?.pending) || 0 };
}
async function ticketLines(base44, items) {
  const wanted = /* @__PURE__ */ new Map();
  for (const it of items) {
    const id = String(it?.id || "").slice(0, 64);
    const holders = (Array.isArray(it?.holders) ? it.holders : []).slice(0, 10).map(cleanName);
    if (!id || !holders.length) throw new Error("Bilet: podaj imi\u0119 i nazwisko ka\u017Cdej osoby");
    if (holders.some((h) => h.length < 3)) throw new Error("Bilet: podaj imi\u0119 i nazwisko ka\u017Cdej osoby");
    wanted.set(id, [...wanted.get(id) || [], ...holders]);
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
    if (holders.length > 10) throw new Error("Bilet: najwy\u017Cej 10 bilet\xF3w na jedno wydarzenie w zam\xF3wieniu");
    total += holders.length;
    if (Number(ev.capacity) > 0) {
      const { sold, pending } = await seatsTaken(base44, id);
      const left = Number(ev.capacity) - sold - pending;
      if (holders.length > left) throw new Error(left > 0 ? `Brak wolnych miejsc: zosta\u0142o ${left}` : "Brak wolnych miejsc na to wydarzenie");
    }
    const unit = Math.round(Number(ev.price) * 100);
    out.push({ event_id: id, kind: "bilet", product_id: `bilet:${id}`, name: `Bilet \u2014 ${String(ev.title).slice(0, 120)}`, unitPrice: String(unit), quantity: holders.length, holders });
  }
  if (total > 20) throw new Error("Bilet: najwy\u017Cej 20 bilet\xF3w w jednym zam\xF3wieniu");
  return out;
}
async function insertTicket(base44, t) {
  for (let i = 0; i < 6; i++) {
    const rows = await runSql(base44, `INSERT INTO public.event_tickets (code, token, event_id, order_id, line_no, holder_name, buyer_email, price, source)
      VALUES (${escStr(newCode())}, ${escStr(newToken())}, ${escStr(t.event_id)}, ${t.order_id ? escStr(t.order_id) : "NULL"}, ${t.line_no},
        ${escStr(t.holder_name)}, ${t.buyer_email ? escStr(t.buyer_email) : "NULL"}, ${Number(t.price) || 0}, ${escStr(t.source || "zakup")})
      ON CONFLICT DO NOTHING RETURNING *`).catch((e) => {
      if (!/duplicate|unique/i.test(String(e?.message))) throw e;
      return [];
    });
    if (rows?.length) return rows[0];
    if (t.order_id) {
      const had = await runSql(base44, `SELECT * FROM public.event_tickets WHERE order_id = ${escStr(t.order_id)} AND line_no = ${t.line_no}`, true);
      if (had?.length) return had[0];
    }
  }
  throw new Error("Nie uda\u0142o si\u0119 nada\u0107 numeru biletu");
}
async function issueOrderTickets(base44, order, items) {
  const lines = (items || []).filter((i) => i.kind === "bilet" && i.event_id);
  if (!lines.length) return [];
  await ensureTicketSchema(base44);
  const email = String(order.buyer_email || "").trim().toLowerCase();
  const out = [];
  let n = 0;
  for (const l of lines) {
    const holders = Array.isArray(l.holders) && l.holders.length ? l.holders : [order.buyer_name || "Uczestnik"];
    for (const h of holders.slice(0, 20)) {
      out.push(await insertTicket(base44, {
        event_id: l.event_id,
        order_id: String(order.id),
        line_no: n++,
        holder_name: cleanName(h) || "Uczestnik",
        buyer_email: email,
        price: Number(l.unitPrice) / 100
      }));
    }
    if (email) {
      await runSql(base44, `INSERT INTO public.registrations (id, event_id, first_name, email, consent, status, source, created_at)
        VALUES (gen_random_uuid()::text, ${escStr(l.event_id)}, ${escStr(String(order.buyer_name || "").split(" ")[0] || "Uczestnik")}, ${escStr(email)}, TRUE, 'Zapisany', 'bilet', now())
        ON CONFLICT (event_id, email) DO UPDATE SET status = 'Zapisany', source = 'bilet'
          WHERE public.registrations.status NOT IN ('Zapisany','Obecny')`).catch((e) => console.error("bilet: zapis", e?.message));
    }
  }
  const evIds = [...new Set(lines.map((l) => String(l.event_id)))];
  out.overbooked = await runSql(base44, `SELECT e.id, e.title, e.capacity, COUNT(t.id)::int AS sold
      FROM public.events e JOIN public.event_tickets t ON t.event_id = e.id AND t.status <> 'anulowany'
     WHERE e.id IN (${evIds.map(escStr).join(",")}) AND COALESCE(e.capacity, 0) > 0
     GROUP BY e.id, e.title, e.capacity HAVING COUNT(t.id) > e.capacity`, true).catch(() => []);
  return out;
}
async function loadEvent(base44, id) {
  const rows = await runSql(base44, `SELECT id, title, slug, subtitle, format, location, start_datetime, duration_minutes, status, price::float8 AS price,
      capacity, registration_deadline, COALESCE(tickets, false) AS tickets, ticket_template, short_path FROM public.events WHERE id = ${escStr(id)}`, true);
  return rows?.[0] || null;
}
async function scannerScope(base44, me2) {
  if (!me2) return null;
  if (me2.role === "admin") return { all: true, admin: true };
  const email = String(me2.email || "").toLowerCase();
  const list = await getSetting(base44, SCANNERS_KEY).catch(() => null) || [];
  const mine = (Array.isArray(list) ? list : []).filter((s) => String(s.email || "").toLowerCase() === email && (!s.until || Date.parse(s.until) > Date.now()));
  if (!mine.length) return null;
  if (mine.some((s) => !s.event_id)) return { all: true };
  return { all: false, events: mine.map((s) => String(s.event_id)) };
}
async function checkTicket(base44, { scan, eventId, by, scope, undo = false }) {
  await ensureTicketSchema(base44);
  const where = scan.token ? `token = ${escStr(scan.token)}` : `code = ${escStr(scan.code)}`;
  const [t] = await runSql(base44, `SELECT t.*, e.title AS event_title FROM public.event_tickets t LEFT JOIN public.events e ON e.id = t.event_id WHERE ${where}`, true);
  if (!t) return { result: "nieznany" };
  const base = { code: showCode(t.code), name: t.holder_name, event_id: t.event_id, event_title: t.event_title };
  if (!canScan(scope, t.event_id)) return { result: "brak_uprawnien", ...base };
  if (eventId && String(eventId) !== String(t.event_id)) return { result: "inne_wydarzenie", ...base };
  if (undo) {
    const r2 = await runSql(base44, `UPDATE public.event_tickets SET status = 'wazny', checked_at = NULL, checked_by = NULL
      WHERE id = ${escStr(t.id)} AND status = 'wykorzystany' RETURNING id`);
    if (r2?.length && t.buyer_email) {
      await runSql(base44, `UPDATE public.registrations SET status = 'Zapisany' WHERE event_id = ${escStr(t.event_id)}
        AND lower(email) = ${escStr(String(t.buyer_email).toLowerCase())} AND status = 'Obecny'`).catch(() => {
      });
    }
    return { result: r2?.length ? "cofniety" : "bez_zmian", ...base };
  }
  if (t.status === "anulowany") return { result: "anulowany", ...base };
  const r = await runSql(base44, `UPDATE public.event_tickets SET status = 'wykorzystany', checked_at = now(), checked_by = ${escStr(by)}
    WHERE id = ${escStr(t.id)} AND status = 'wazny' RETURNING checked_at`);
  if (!r?.length) {
    const [cur] = await runSql(base44, `SELECT status, checked_at, checked_by FROM public.event_tickets WHERE id = ${escStr(t.id)}`, true);
    return { result: cur?.status === "anulowany" ? "anulowany" : "wykorzystany", ...base, checked_at: cur?.checked_at, checked_by: cur?.checked_by };
  }
  if (t.buyer_email) {
    await runSql(base44, `UPDATE public.registrations SET status = 'Obecny' WHERE event_id = ${escStr(t.event_id)}
      AND lower(email) = ${escStr(String(t.buyer_email).toLowerCase())} AND status = 'Zapisany'`).catch(() => {
    });
  }
  return { result: "ok", ...base, checked_at: r[0].checked_at };
}
async function eventCounts(base44, eventId) {
  await ensureTicketSchema(base44);
  const [r] = await runSql(base44, `SELECT count(*) FILTER (WHERE status <> 'anulowany')::int AS sold,
      count(*) FILTER (WHERE status = 'wykorzystany')::int AS checked FROM public.event_tickets WHERE event_id = ${escStr(eventId)}`, true);
  return { sold: Number(r?.sold) || 0, checked: Number(r?.checked) || 0 };
}
function ticketsHtml(tickets, events) {
  if (!tickets.length) return "";
  const byEv = /* @__PURE__ */ new Map();
  for (const t of tickets) byEv.set(t.event_id, [...byEv.get(t.event_id) || [], t]);
  const blocks = [...byEv.entries()].map(([id, list]) => {
    const ev = events.get(id) || {};
    return `<div style="margin:0 0 18px;border:1px solid #C9A24A;padding:22px;">
      <p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 10px;">BILET${list.length > 1 ? "Y" : ""}</p>
      <p style="margin:0 0 6px;color:#F5EFE1;font-size:20px;">${esc2(ev.title || "")}</p>
      ${ev.start_datetime ? `<p style="margin:0 0 14px;color:#8A8A8C;">${esc2(when(ev.start_datetime))} (czas polski)${ev.format === "Online" ? " \xB7 online" : ""}</p>` : ""}
      ${list.map((t) => `<p style="margin:0 0 10px;color:#E2E2E2;">${esc2(t.holder_name)} \xB7 <b style="color:#C9A24A;letter-spacing:2px;">${esc2(showCode(t.code))}</b><br>
        <a href="${esc2(ticketPdfUrl(t.token))}" style="color:#C9A24A;">Pobierz bilet (PDF)</a> \xB7 <a href="${esc2(ticketUrl(t.token))}" style="color:#8A8A8C;">otw\xF3rz na telefonie</a></p>`).join("")}
    </div>`;
  }).join("");
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">${blocks}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Bilet jest imienny i wa\u017Cny na jedno wej\u015Bcie. Przy wej\u015Bciu poka\u017C kod QR \u2014 na telefonie albo wydrukowany. Ka\u017Cd\u0105 osob\u0119 wpuszczam na jej bilet, wi\u0119c bilety dla innych przeka\u017C im wcze\u015Bniej (PDF albo link). Wszystkie bilety s\u0105 te\u017C w Moim koncie \u2192 Spotkania, po zalogowaniu tym adresem e-mail.</p></div>`;
}
async function regTicket(base44, eventId, reg) {
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
  return insertTicket(base44, {
    event_id: String(eventId),
    order_id: key,
    line_no: 0,
    holder_name: cleanName(reg.first_name) || "Uczestnik",
    buyer_email: String(reg.email).trim().toLowerCase(),
    price: 0,
    source: "zapis"
  });
}
async function cancelRegTicket(base44, regId) {
  if (!regId) return;
  await ensureTicketSchema(base44);
  await runSql(base44, `UPDATE public.event_tickets SET status = 'anulowany' WHERE order_id = ${escStr(`zapis:${regId}`)} AND status = 'wazny'`);
}
var TICKET_SCHEMA_SQL, schemaReady, LETTERS, rnd, showCode, normCode, TOKEN_ABC, newToken, validToken, ticketUrl, ticketPdfUrl, cleanName, SCANNERS_KEY, canScan, esc2, when, ticketsAllowed;
var init_tickets = __esm({
  "supabase/functions/_shared/tickets.ts"() {
    init_supabase();
    init_settings();
    TICKET_SCHEMA_SQL = `
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
    schemaReady = false;
    LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
    rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
    showCode = (c) => c && c.length === 7 ? `${c.slice(0, 3)}-${c.slice(3)}` : String(c || "");
    normCode = (s) => {
      const v = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return /^[A-Z]{3}[0-9]{4}$/.test(v) ? v : null;
    };
    TOKEN_ABC = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    newToken = () => [...rnd(32)].map((x) => TOKEN_ABC[x % TOKEN_ABC.length]).join("");
    validToken = (t) => typeof t === "string" && /^[A-Za-z0-9]{24,64}$/.test(t);
    ticketUrl = (token) => `${APP_URL}/bilet#t=${token}`;
    ticketPdfUrl = (token) => `${APP_URL}/functions/tickets?pdf=${token}`;
    cleanName = (v) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    SCANNERS_KEY = "bilety_skanerzy";
    canScan = (scope, eventId) => !!scope && (scope.all || scope.events.includes(String(eventId)));
    esc2 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    when = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    ticketsAllowed = (ev) => !!ev && ev.format !== "Online";
  }
});

// supabase/functions/_shared/compat.ts
import nodemailer from "npm:nodemailer@6.9.13";
import { setImmediate as nodeSetImmediate, clearImmediate as nodeClearImmediate } from "node:timers";
var g = globalThis;
if (typeof g.setImmediate !== "function") g.setImmediate = nodeSetImmediate;
if (typeof g.clearImmediate !== "function") g.clearImmediate = nodeClearImmediate;
var SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
var SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
var ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
var PRIV_BUCKET = "private";
var PUB_BUCKET = "public";
var LEGACY_BASE44_URL = () => Deno.env.get("EXM_LEGACY_BASE44_URL") || "https://exmortis-return-path.base44.app";
var H = () => ({ apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" });
var val = (v) => encodeURIComponent(String(v));
var inVal = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
var col = (f) => `data->>${encodeURIComponent(f)}`;
var OP_MAP = { $ne: "neq", $gt: "gt", $gte: "gte", $lt: "lt", $lte: "lte" };
function atom(field, cond) {
  if (cond === null) return `${col(field)}=is.null`;
  if (cond === true || cond === false) return `${col(field)}=eq.${cond}`;
  if (typeof cond !== "object" || Array.isArray(cond)) {
    return Array.isArray(cond) ? `${col(field)}=in.(${cond.map(inVal).join(",")})` : `${col(field)}=eq.${val(cond)}`;
  }
  const [op, v] = Object.entries(cond)[0];
  if (op === "$in" || op === "$nin") {
    const list = Array.isArray(v) ? v : [v];
    return `${col(field)}=${op === "$in" ? "in" : "not.in"}.(${list.map(inVal).join(",")})`;
  }
  if (op === "$exists") return `${col(field)}=is.${v ? "not.null" : "null"}`;
  if (op === "$regex") return `${col(field)}=like.*${encodeURIComponent(String(v))}*`;
  if (op in OP_MAP) return `${col(field)}=${OP_MAP[op]}.${val(v)}`;
  throw new Error(`Nieobs\u0142ugiwany operator filtra: ${op}`);
}
function conditions(query) {
  const parts = [];
  for (const [field, cond] of Object.entries(query || {})) {
    if (field === "$or" || field === "$and") {
      const sep = field === "$or" ? "or" : "and";
      const inner = cond.map((sub) => {
        const [f, c] = Object.entries(sub)[0];
        return atom(f, c).replace("=", ".");
      });
      parts.push(`${sep}=(${inner.join(",")})`);
    } else {
      parts.push(atom(field, cond));
    }
  }
  return parts;
}
function orderExpr(sort) {
  const dir = String(sort).startsWith("-") ? "desc" : "asc";
  const field = String(sort).replace(/^-/, "");
  const built = ["created_date", "updated_date"].includes(field);
  return `${built ? field : encodeURIComponent("data->>" + field)}.${dir}`;
}
async function pgGet(table, qs) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, { headers: H(), signal: AbortSignal.timeout(2e4) });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}
var row2rec = (r) => ({
  ...r.data || {},
  id: r.id,
  created_date: r.created_date,
  updated_date: r.updated_date,
  created_by_id: r.created_by_id
});
var rec2row = (rec) => {
  const data = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!["id", "created_date", "updated_date", "created_by_id"].includes(k)) data[k] = v;
  }
  return data;
};
var tableOf = (name) => "exm_" + name.toLowerCase();
function parseArgs(args) {
  const [query, second] = args;
  if (second && typeof second === "object" && !Array.isArray(second)) {
    const o = second;
    return { query: query || {}, sort: o.sort, limit: o.limit, cursor: o.cursor, distinct: o.distinct, page: true };
  }
  return { query: query || {}, sort: second, limit: args[2], cursor: args[3], distinct: null, page: false };
}
function makeEntity(name) {
  const table = tableOf(name);
  async function fetchPage(parts, sort, limit, cursor) {
    const order = sort ? `&order=${orderExpr(String(sort))}` : "";
    const lim = Math.max(1, Math.min(Number(limit) || 50, 2e3));
    const off = Math.max(0, Number(cursor ?? 0) || 0);
    const qs = `${parts.join("&")}${order}&limit=${lim + 1}&offset=${off}`;
    const rows = await pgGet(table, qs);
    const has_more = rows.length > lim;
    return { items: (has_more ? rows.slice(0, lim) : rows).map(row2rec), next_cursor: has_more ? String(off + lim) : null, has_more };
  }
  return {
    async get(id) {
      const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
      return rows[0] ? row2rec(rows[0]) : null;
    },
    async filter(...args) {
      const { query, sort, limit, cursor, distinct, page } = parseArgs(args);
      const parts = conditions(query);
      if (distinct) {
        const rows = await pgGet(table, `select=v:${encodeURIComponent("data->>" + distinct)}&limit=2000`);
        return { items: [...new Set(rows.map((r) => r.v).filter((v) => v !== null && v !== void 0))] };
      }
      if (!page) {
        const order = sort ? `&order=${orderExpr(String(sort))}` : "";
        const lim = limit ? `&limit=${Math.min(Number(limit) || 50, 2e3)}` : "";
        return (await pgGet(table, `${parts.join("&")}${order}${lim}`)).map(row2rec);
      }
      return fetchPage(parts, sort, limit, cursor);
    },
    // Base44: list(sort, limit, skip) — pierwszy argument to sortowanie, nie zapytanie.
    // Tylko obiekt (albo brak argumentów) oznacza listę ze stronicą; reszta to tablica rekordów.
    async list(...args) {
      const [first, limit, skip] = args;
      if (first === void 0 || first === null || typeof first === "string") {
        const order = first ? `&order=${orderExpr(String(first))}` : "";
        const lim = Math.max(1, Math.min(Number(limit) || 2e3, 2e3));
        const off = Math.max(0, Number(skip) || 0);
        return (await pgGet(table, `select=*${order}&limit=${lim}&offset=${off}`)).map(row2rec);
      }
      const options = first;
      if (!Object.keys(options).length) return (await pgGet(table, "limit=2000")).map(row2rec);
      return this.filter(options.query || {}, { sort: options.sort, limit: options.limit, cursor: options.cursor, distinct: options.distinct });
    },
    async count(query = {}) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${conditions(query).join("&") || "select=id"}&limit=0`, {
        method: "HEAD",
        headers: { ...H(), Prefer: "count=exact" },
        signal: AbortSignal.timeout(2e4)
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      const range = res.headers.get("content-range") || "/0";
      return Number(range.split("/")[1]) || 0;
    },
    async aggregate(body = {}) {
      const parts = conditions(body.query || {});
      const rows = (await pgGet(table, `${parts.join("&") || "select=*"}&limit=20000`)).map(row2rec);
      const groupBy = body.groupBy || (body.dateBucket ? body.dateBucket.field : null);
      const bucketUnit = body.dateBucket ? body.dateBucket.unit || "day" : null;
      const groups = /* @__PURE__ */ new Map();
      for (const r of rows) {
        let g3 = groupBy ? r[groupBy] ?? null : "";
        if (g3 && bucketUnit && groupBy) {
          const d = new Date(g3);
          g3 = bucketUnit === "month" ? d.toISOString().slice(0, 7) : bucketUnit === "week" ? String(d.getUTCFullYear()) + "-W" + Math.ceil(((+d - +new Date(d.getUTCFullYear(), 0, 1)) / 864e5 + new Date(d.getUTCFullYear(), 0, 1).getUTCDay() + 1) / 7) : d.toISOString().slice(0, 10);
        }
        const key = String(g3);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      const num = (r, f) => Number(r[f]) || 0;
      const out = [...groups.entries()].map(([key, rs]) => {
        const row = { [groupBy || "okres"]: key === "null" ? null : key, count: rs.length };
        for (const f of body.sum || []) row[`sum_${f}`] = rs.reduce((a, r) => a + num(r, f), 0);
        for (const f of body.avg || []) row[`avg_${f}`] = rs.length ? rs.reduce((a, r) => a + num(r, f), 0) / rs.length : 0;
        for (const f of body.min || []) row[`min_${f}`] = rs.length ? Math.min(...rs.map((r) => num(r, f))) : 0;
        for (const f of body.max || []) row[`max_${f}`] = rs.length ? Math.max(...rs.map((r) => num(r, f))) : 0;
        return row;
      });
      out.sort((a, b) => String(Object.values(a)[0]).localeCompare(String(Object.values(b)[0])));
      return { rows: out };
    },
    async create(rec) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const row = { id: crypto.randomUUID(), created_date: now, updated_date: now, created_by_id: rec.created_by_id || null, data: rec2row(rec) };
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method: "POST", headers: { ...H(), Prefer: "return=representation" }, body: JSON.stringify(row), signal: AbortSignal.timeout(2e4) });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return row2rec((await res.json())[0]);
    },
    async bulkCreate(recs) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const rows = (recs || []).map((rec) => ({ id: crypto.randomUUID(), created_date: now, updated_date: now, created_by_id: rec.created_by_id || null, data: rec2row(rec) }));
      if (!rows.length) return [];
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method: "POST", headers: { ...H(), Prefer: "return=representation" }, body: JSON.stringify(rows), signal: AbortSignal.timeout(3e4) });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).map(row2rec);
    },
    async update(id, patch) {
      const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
      if (!rows[0]) return null;
      const data = { ...rows[0].data, ...rec2row(patch) };
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, {
        method: "PATCH",
        headers: { ...H(), Prefer: "return=representation" },
        body: JSON.stringify({ data, updated_date: (/* @__PURE__ */ new Date()).toISOString() }),
        signal: AbortSignal.timeout(2e4)
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return row2rec((await res.json())[0]);
    },
    async updateMany(query, ops) {
      const $set = ops.$set || {};
      const $inc = ops.$inc || {};
      const $unset = ops.$unset || [];
      let changed = 0;
      for (let round = 0; round < 20; round++) {
        const ids = (await pgGet(table, `${conditions(query).join("&")}&select=id&limit=500`)).map((r) => String(r.id));
        if (!ids.length) break;
        await Promise.all(ids.map(async (id) => {
          const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
          const data = { ...rows[0]?.data || {}, ...$set };
          for (const [f, n] of Object.entries($inc)) data[f] = (Number(data[f]) || 0) + Number(n);
          for (const f of $unset) delete data[f];
          const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, {
            method: "PATCH",
            headers: { ...H(), Prefer: "return=minimal" },
            body: JSON.stringify({ data, updated_date: (/* @__PURE__ */ new Date()).toISOString() }),
            signal: AbortSignal.timeout(2e4)
          });
          if (res.ok) changed++;
        }));
      }
      return { ok: true, changed };
    },
    async bulkUpdate(list) {
      for (const item of list || []) await this.update(item.id, item);
      return { ok: true, count: (list || []).length };
    },
    async delete(id) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, { method: "DELETE", headers: H(), signal: AbortSignal.timeout(2e4) });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      return { ok: true };
    },
    async deleteMany(query = {}) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${conditions(query).join("&")}`, { method: "DELETE", headers: H(), signal: AbortSignal.timeout(6e4) });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      return { ok: true };
    },
    subscribe: () => () => {
    }
  };
}
var ENTITIES = /* @__PURE__ */ new Map();
function entities() {
  return new Proxy({}, {
    get: (_t, name) => {
      if (!ENTITIES.has(name)) ENTITIES.set(name, makeEntity(name));
      return ENTITIES.get(name);
    }
  });
}
var HOSTING_BASE = "";
var HOSTING_BASE_AT = 0;
async function hostingBase() {
  if (HOSTING_BASE && Date.now() - HOSTING_BASE_AT < 3e5) return HOSTING_BASE;
  let url = String(Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  if (!url || /preview--/i.test(url)) {
    const r = await fetch(`${SUPA_URL}/rest/v1/app_settings?key=eq.app&select=value&limit=1`, {
      headers: H(),
      signal: AbortSignal.timeout(1e4)
    }).catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    url = String(j?.[0]?.value?.url || "").replace(/\/+$/, "");
    if (/preview--/i.test(url)) url = "";
  }
  if (url) {
    HOSTING_BASE = url;
    HOSTING_BASE_AT = Date.now();
  }
  return url;
}
var Core = {
  async SendEmail(opts) {
    const host = Deno.env.get("SMTP_HOST");
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    if (!host || !user || !pass) throw new Error("Wysy\u0142ka awaryjna: brak sekret\xF3w SMTP_HOST/SMTP_USER/SMTP_PASS");
    const port = Number(Deno.env.get("SMTP_PORT") || 587);
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transport.sendMail({
      from: `${opts.from_name || "Exmortis"} <${user}>`,
      to: opts.to,
      subject: opts.subject || "(bez tematu)",
      html: opts.html || opts.body || "",
      text: opts.text || ""
    });
    return { ok: true };
  },
  async CreateFileSignedUrl({ file_uri, expires_in = 300 }) {
    if (/^https?:\/\//.test(file_uri)) return { signed_url: file_uri };
    if (/^cf\//.test(String(file_uri))) {
      const name = String(file_uri).replace(/^cf\/(private|public)\//, "");
      if (!/^[A-Za-z0-9._-]{1,160}$/.test(name)) throw new Error("Podpis pliku: nieprawid\u0142owa nazwa pliku");
      const key = Deno.env.get("MEDIA_SECRET") || Deno.env.get("BOOKING_HMAC_KEY");
      if (!key) throw new Error("Podpis pliku: brak sekretu MEDIA_SECRET");
      const base = await hostingBase();
      if (!base) throw new Error("Podpis pliku: brak adresu aplikacji (ustawienie app)");
      const exp2 = Math.floor(Date.now() / 1e3) + Math.max(60, Math.min(Number(expires_in) || 300, 604800));
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${name}.${exp2}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
      return { signed_url: `${base}/media/private/${encodeURIComponent(name)}?e=${exp2}&s=${mac}` };
    }
    let bucket = "", path = "";
    const m = file_uri.match(/^(?:supabase:\/\/)([^/]+)\/(.+)$/);
    if (m) {
      bucket = m[1];
      path = m[2];
    } else {
      const [head, ...rest] = String(file_uri).split("/");
      bucket = /privat/i.test(head) ? PRIV_BUCKET : PUB_BUCKET;
      path = rest.join("/");
    }
    const exp = Math.max(60, Math.min(Number(expires_in) || 300, 604800));
    const legacy = async () => {
      const key = Deno.env.get("BOOKING_HMAC_KEY");
      if (!key) throw new Error("Podpis pliku: brak sekretu BOOKING_HMAC_KEY");
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`sign:${file_uri}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const res = await fetch(`${LEGACY_BASE44_URL()}/functions/legacySign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: file_uri, sig: mac, expires_in: exp }),
        signal: AbortSignal.timeout(15e3)
      });
      if (!res.ok) throw new Error(`Podpis pliku (stare miejsce): ${res.status}`);
      const j = await res.json().catch(() => null);
      if (!j || !j.signed_url) throw new Error("Podpis pliku: brak linku");
      return { signed_url: j.signed_url };
    };
    try {
      const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
        method: "POST",
        headers: { ...H() },
        body: JSON.stringify({ expiresIn: exp }),
        signal: AbortSignal.timeout(2e4)
      });
      if (!res.ok) return await legacy();
      const j = await res.json();
      const rel = j.signedURL || j.token ? j.signedURL || `/object/sign/${bucket}/${path}?token=${j.token}` : null;
      if (!rel) return await legacy();
      return { signed_url: `${SUPA_URL}/storage/v1${rel}` };
    } catch {
      return await legacy();
    }
  },
  async UploadPrivateFile({ file }) {
    const name = `${Date.now()}-${(file.name || "plik").replace(/[^\w.\-]/g, "_")}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/${PRIV_BUCKET}/${name}`, {
      method: "POST",
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
      body: file,
      signal: AbortSignal.timeout(6e4)
    });
    if (!res.ok) throw new Error(`Storage upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { file_uri: `${PRIV_BUCKET}/${name}` };
  },
  async UploadPublicFile({ file }) {
    const name = `${Date.now()}-${(file.name || "plik").replace(/[^\w.\-]/g, "_")}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/${PUB_BUCKET}/${name}`, {
      method: "POST",
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
      body: file,
      signal: AbortSignal.timeout(6e4)
    });
    if (!res.ok) throw new Error(`Storage upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { file_url: `${SUPA_URL}/storage/v1/object/public/${PUB_BUCKET}/${name}` };
  },
  async GenerateImage({ prompt }) {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("Generowanie obraz\xF3w: brak sekretu OPENAI_API_KEY");
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
      signal: AbortSignal.timeout(12e4)
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const b64 = (await res.json()).data?.[0]?.b64_json;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { url } = await this.UploadPublicFile({ file: new Blob([bytes], { type: "image/png" }) });
    return { url };
  }
};
var connectors = {
  async getConnection(type) {
    if (type === "supabase") return { accessToken: SRK, connectionConfig: {} };
    throw new Error(`\u0141\u0105cznik "${type}" nie dzia\u0142a po migracji \u2014 przenie\u015B token do sekret\xF3w i czytaj go w kodzie (Deno.env.get)`);
  }
};
var CURRENT_REQ = null;
var jwtOf = (req) => {
  const h = (req?.headers.get("authorization") || "").match(/^Bearer (.+)$/i);
  return h ? h[1] : "";
};
async function me() {
  const token = jwtOf(CURRENT_REQ);
  if (!token) return null;
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1e4) });
  if (!res.ok) return null;
  const u = await res.json();
  let profile = null;
  try {
    const rows = await pgGet("exm_user", `${col("email")}=eq.${val(u.email)}&limit=1`);
    profile = rows[0] || null;
  } catch {
  }
  const d = profile?.data || {};
  return {
    id: String(u.id),
    email: u.email,
    full_name: d.full_name || u.user_metadata?.full_name || String(u.email || "").split("@")[0],
    role: d.role || u.user_metadata?.role || "user",
    created_date: profile?.created_date || u.created_at
  };
}
async function updateMe(patch) {
  const user = await me();
  if (!user) throw new Error("Logowanie wymagane");
  const data = { full_name: patch.full_name, ...rec2row(patch) };
  const res = await fetch(`${SUPA_URL}/rest/v1/exm_user?${col("email")}=eq.${val(user.email)}`, {
    method: "PATCH",
    headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
  const rows = await res.json();
  return { ...user, ...rows[0]?.data || {}, ...patch };
}
async function inviteUser(email, role = "user") {
  const res = await fetch(`${SUPA_URL}/auth/v1/invite`, {
    method: "POST",
    headers: { ...H() },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) throw new Error(`Supabase invite ${res.status}: ${(await res.text()).slice(0, 200)}`);
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await fetch(`${SUPA_URL}/rest/v1/exm_user`, {
      method: "POST",
      headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ email, role, data: { email, full_name: email.split("@")[0], role }, created_date: now, updated_date: now }),
      signal: AbortSignal.timeout(2e4)
    });
  } catch {
  }
  return { ok: true };
}
async function invoke(name, payload) {
  const res = await fetch(`${SUPA_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12e4)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Funkcja ${name}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return { data };
}
function createClientFromRequest(req) {
  CURRENT_REQ = req;
  const ents = entities();
  return {
    entities: ents,
    auth: {
      me,
      isAuthenticated: async () => await me() !== null,
      updateMe,
      logout: () => new Response(null, { status: 204 })
    },
    users: { inviteUser },
    functions: { invoke },
    asServiceRole: {
      entities: ents,
      integrations: { Core },
      connectors,
      users: { inviteUser },
      aiGateway: {
        connection: async () => {
          throw new Error("aiGateway: po migracji u\u017Cywaj OpenAI (sekret OPENAI_API_KEY)");
        }
      }
    }
  };
}

// supabase/functions/eventsAdmin/index.ts
init_shim();
init_supabase();
init_settings();
init_snapshot();

// supabase/functions/_shared/smtp.ts
init_settings();
import nodemailer2 from "npm:nodemailer@6.9.13";

// supabase/functions/_shared/emailLayout.ts
init_settings();
var BRAND = {
  bg: "#0A0A0B",
  card: "#111113",
  line: "#2A2A2C",
  text: "#E8E6E1",
  muted: "#A3A3A6",
  faint: "#7A7A7D",
  gold: "#C9A24A",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
};
var SOCIAL = [
  ["Instagram", "https://www.instagram.com/e.x.m.o.r.t.i.s/"],
  ["Facebook", "https://www.facebook.com/dawidkowalczyk.exmortis"],
  ["YouTube", "https://www.youtube.com/@e.x.m.o.r.t.i.s"],
  ["WhatsApp", "https://whatsapp.com/channel/0029VbDYXi1Lo4hfFPvT3O3G"]
];
var MARKETING = /* @__PURE__ */ new Set(["listy", "newsletter", "kampania"]);
var esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function emailButton(label, url, { secondary = false } = {}) {
  const bg = secondary ? "transparent" : BRAND.gold;
  const fg = secondary ? BRAND.gold : BRAND.bg;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr>
<td style="border-radius:2px;background:${bg};border:1px solid ${BRAND.gold};">
<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${BRAND.sans};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${fg};text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}
function normalizeBody(html) {
  let s = String(html || "");
  s = s.replace(/<p style="[^"]*">\s*EXMORTIS\s*<\/p>/g, "");
  s = s.replace(/<p style="[^"]*">\s*WRACAM Z SIEBIE · UCZĘ WRACAĆ\s*<\/p>/g, "");
  s = s.replace(/background:#0A0A0B;\s*padding:[^;"]*;?/g, "");
  s = s.replace(/font-family:Cinzel,\s*Georgia,\s*serif/g, "font-family:Georgia,serif");
  s = s.replace(/color:#8A8A8C/g, `color:${BRAND.muted}`).replace(/color:#5C5C5E/g, `color:${BRAND.faint}`).replace(/color:#3D3D3F/g, `color:${BRAND.faint}`);
  s = s.replace(
    /<p[^>]*>\s*<a\s+href="(https?:[^"]+)"[^>]*>\s*([^<]{2,60}?)\s*<\/a>\s*<\/p>/g,
    (_, href, label) => emailButton(label.replace(/&amp;/g, "&").replace(/&quot;/g, '"'), href.replace(/&amp;/g, "&"))
  );
  s = s.replace(/<h1 style="[^"]*">/g, `<h1 style="margin:0 0 18px;font-family:${BRAND.serif};font-size:28px;line-height:1.25;font-weight:normal;color:#F5EFE1;">`);
  s = s.replace(/<h1>/g, `<h1 style="margin:0 0 18px;font-family:${BRAND.serif};font-size:28px;line-height:1.25;font-weight:normal;color:#F5EFE1;">`);
  s = s.replace(/<h2>/g, `<h2 style="margin:28px 0 12px;font-family:${BRAND.serif};font-size:21px;line-height:1.3;font-weight:normal;color:#F5EFE1;">`);
  return s;
}
function textOf(html) {
  return String(html || "").replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}
function emailLayout(html, { firma = null, appUrl = APP_URL, kind = "", preheader = "", unsubUrl = "" } = {}) {
  const body = normalizeBody(html);
  const site = String(appUrl || APP_URL).replace(/\/+$/, "");
  const pre = (preheader || textOf(body).replace(/^(EXMORTIS\s*)+/, "")).slice(0, 140);
  const marketing = MARKETING.has(kind) || !!unsubUrl;
  const hasCrisis = /116\s?123/.test(body);
  const contact = firma?.email || "kontakt@exmortis.pl";
  const firmLine = [firma?.nazwa || firma?.osoba, firma?.adres, firma?.nip && `NIP ${firma.nip}`, firma?.regon && `REGON ${firma.regon}`].filter(Boolean).map(esc).join(" \xB7 ");
  const link = (href, label) => `<a href="${esc(href)}" target="_blank" style="color:${BRAND.muted};text-decoration:underline;">${esc(label)}</a>`;
  const small = `font-family:${BRAND.sans};font-size:12px;line-height:1.7;color:${BRAND.faint};margin:0 0 10px;`;
  const footer = [
    `<p style="font-family:${BRAND.sans};font-size:11px;letter-spacing:3px;color:${BRAND.gold};margin:0 0 14px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>`,
    `<p style="${small}">${SOCIAL.map(([l, u]) => link(u, l)).join(" &nbsp;\xB7&nbsp; ")}</p>`,
    `<p style="${small}">${link(`mailto:${contact}`, contact)} &nbsp;\xB7&nbsp; ${link(site, site.replace(/^https?:\/\//, ""))}</p>`,
    hasCrisis ? "" : `<p style="${small}">exmortis to mentoring, nie terapia. Je\u015Bli jest Ci bardzo ci\u0119\u017Cko: <span style="color:${BRAND.muted};">116 123</span> \xB7 <span style="color:${BRAND.muted};">800 70 2222</span> (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 w zagro\u017Ceniu \u017Cycia <span style="color:${BRAND.muted};">112</span>.</p>`,
    firmLine ? `<p style="${small}">${firmLine}</p>` : "",
    `<p style="${small}">${link(`${site}/regulamin`, "Regulamin")} &nbsp;\xB7&nbsp; ${link(`${site}/polityka-prywatnosci`, "Polityka prywatno\u015Bci")}</p>`,
    marketing ? `<p style="${small}">Dostajesz Listy powrotu, bo zapisano ten adres na ${esc(site.replace(/^https?:\/\//, ""))} i potwierdzono zapis.${unsubUrl ? ` ${link(unsubUrl, "Wypisz si\u0119 jednym klikni\u0119ciem")}.` : " Aby si\u0119 wypisa\u0107, odpowiedz na ten list s\u0142owem STOP."}</p>` : `<p style="${small}">To wiadomo\u015B\u0107 dotycz\u0105ca Twojego konta, zam\xF3wienia lub zapisu na ${esc(site.replace(/^https?:\/\//, ""))}. Mo\u017Cesz na ni\u0105 po prostu odpowiedzie\u0107.</p>`
  ].join("");
  return `<!DOCTYPE html>
<html lang="pl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>exmortis</title>
<style>
  body{margin:0;padding:0;background:${BRAND.bg};}
  a{color:${BRAND.gold};}
  img{border:0;line-height:100%;outline:none;text-decoration:none;}
  table{border-collapse:collapse;}
  .exm-body p,.exm-body li,.exm-body td{font-size:16px;}
  @media (max-width:620px){
    .exm-card{padding:28px 22px !important;}
    .exm-wrap{padding:16px 10px !important;}
    .exm-body h1{font-size:24px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.bg};font-size:1px;line-height:1px;">${esc(pre)}${"&#8203;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};">
<tr><td align="center" class="exm-wrap" style="padding:32px 16px;">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
    <tr><td align="center" style="padding:8px 0 26px;">
      <a href="${esc(site)}" target="_blank" style="text-decoration:none;">
        <img src="${esc(site)}/exmortis-logo-500.png" width="64" height="64" alt="exmortis" style="display:block;width:64px;height:64px;margin:0 auto 12px;font-family:${BRAND.serif};font-size:18px;color:${BRAND.gold};">
        <span style="font-family:${BRAND.sans};font-size:12px;letter-spacing:6px;color:${BRAND.gold};">EXMORTIS</span>
      </a>
    </td></tr>
    <tr><td class="exm-card" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-top:2px solid ${BRAND.gold};padding:44px 44px 36px;">
      <div class="exm-body" style="font-family:${BRAND.serif};font-size:16px;line-height:1.7;color:${BRAND.text};">
${body}
      </div>
    </td></tr>
    <tr><td align="center" style="padding:30px 12px 8px;text-align:center;">
${footer}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// supabase/functions/_shared/smtp.ts
init_supabase();
import { setImmediate as nodeSetImmediate2, clearImmediate as nodeClearImmediate2 } from "node:timers";
var g2 = globalThis;
if (typeof g2.setImmediate !== "function") g2.setImmediate = nodeSetImmediate2;
if (typeof g2.clearImmediate !== "function") g2.clearImmediate = nodeClearImmediate2;
var mailReady = (s) => !!(s && s.status === "dziala" && s.host && s.user && s.password);
var CFG = null;
var CFG_AT = 0;
async function mailConfig(base44) {
  if (CFG_AT && Date.now() - CFG_AT < 3e4) return CFG;
  CFG = await getSetting(base44, "smtp").catch(() => null);
  CFG_AT = Date.now();
  return CFG;
}
var MCFG = null;
var MCFG_AT = 0;
async function mailConfigMarketing(base44) {
  if (MCFG_AT && Date.now() - MCFG_AT < 3e4) return MCFG;
  MCFG = await getSetting(base44, "smtp_marketing").catch(() => null);
  MCFG_AT = Date.now();
  return MCFG;
}
var MARKETING_KINDS = /* @__PURE__ */ new Set(["listy", "ogloszenie"]);
async function requireMail(base44) {
  if (!mailReady(await getSetting(base44, "smtp").catch(() => null))) throw new Error("Wymaga skonfigurowanej wysy\u0142ki e-mail (Ustawienia \u2192 Wysy\u0142ka e-mail).");
}
function htmlToText(html) {
  return String(html || "").replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
    const txt = t.replace(/<[^>]+>/g, "").trim();
    return !txt ? href : txt === href || href.startsWith("mailto:") || href.startsWith("tel:") ? txt : `${txt} (${href})`;
  }).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, "\n\n").replace(/<li[^>]*>/gi, "\u2022 ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}
var MAIL_BUDGET = 240;
var LIMIT_MARK = "Czeka na limit wysy\u0142ki (najwy\u017Cej 240 maili na 2 godziny)";
var SENT = { at: 0, n: 0 };
async function sentLast2h(base44) {
  if (Date.now() - SENT.at < 3e4) return SENT.n;
  const since = new Date(Date.now() - 2 * 36e5).toISOString();
  const rows = await base44.asServiceRole.entities.MailQueue.filter({ status: "wyslany", sent_at: { $gte: since } }, "-created_date", 1e3).catch(() => null);
  SENT = { at: Date.now(), n: rows ? rows.filter((r) => r.blad !== "kana\u0142: newsletter").length : SENT.n };
  return SENT.n;
}
async function smtpSend(smtp, { to, subject, html, attachments, headers, kind = "", preheader = "" }) {
  if (!smtp || !smtp.host || !smtp.user || !smtp.password) throw new Error("Wysy\u0142ka e-mail nie jest skonfigurowana");
  const port = Number(smtp.port) || 587;
  const transporter = nodemailer2.createTransport({
    host: smtp.host,
    port,
    secure: port === 465,
    auth: { user: smtp.user, pass: smtp.password },
    // Twarde limity: bez nich zerwane połączenie wisi dwie minuty i funkcja kończy się bez śladu w dzienniku.
    connectionTimeout: 15e3,
    greetingTimeout: 15e3,
    socketTimeout: 6e4
  });
  const addr = smtp.from || smtp.user;
  const unsubUrl = String(headers?.["List-Unsubscribe"] || "").replace(/^<|>$/g, "");
  const full = emailLayout(html, {
    firma: FIRMA,
    kind,
    preheader,
    unsubUrl,
    appUrl: APP_URL
  });
  await transporter.sendMail({
    from: `"${String(smtp.from_name || "exmortis").replace(/"/g, "")}" <${addr}>`,
    ...smtp.reply_to ? { replyTo: smtp.reply_to } : {},
    to,
    subject,
    html: full,
    text: htmlToText(full.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<div style="display:none[^>]*>[\s\S]*?<\/div>/, "")),
    ...headers && typeof headers === "object" ? { headers } : {},
    ...Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}
  });
}
async function inPool(items, fn, n = 6) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  }));
}
async function afterSent(base44, kind, to) {
  if (kind === "listy_potwierdzenie") {
    await runSql(base44, `UPDATE public.subscribers SET confirm_sent_at = now() WHERE email = ${escStr(String(to).toLowerCase())} AND status = 'pending'`).catch(() => {
    });
  }
}
async function sendMail(base44, { to, subject, html, attachments, kind = "inne", ref, waznyDo, headers, preheader = "" }) {
  if (!to) throw new Error("Brak adresata");
  const Q = base44.asServiceRole.entities.MailQueue;
  const base = { to_email: String(to || ""), subject, kind, ...ref ? { ref: String(ref) } : {}, ...waznyDo ? { wazny_do: new Date(waznyDo).toISOString() } : {} };
  let smtp = await mailConfig(base44);
  let viaMarketing = false;
  if (MARKETING_KINDS.has(kind)) {
    const m = await mailConfigMarketing(base44);
    if (mailReady(m) && String(m.host || "").toLowerCase() !== String(smtp?.host || "").toLowerCase()) {
      smtp = m;
      viaMarketing = true;
    }
  }
  if (!mailReady(smtp)) {
    await Q.create({ ...base, html, attachments: attachments || [], status: "kolejka" });
    return "kolejka";
  }
  if (!viaMarketing && await sentLast2h(base44) >= MAIL_BUDGET) {
    await Q.create({ ...base, html, attachments: attachments || [], status: "kolejka", blad: LIMIT_MARK, ...headers ? { headers } : {} });
    return "kolejka";
  }
  try {
    await smtpSend(smtp, { to, subject, html, attachments, headers, kind, preheader });
    if (!viaMarketing) SENT.n++;
  } catch (e) {
    await Q.create({ ...base, html, attachments: attachments || [], status: "blad", blad: String(e?.message || e).slice(0, 500) });
    throw e;
  }
  await Q.create({ ...base, status: "wyslany", sent_at: (/* @__PURE__ */ new Date()).toISOString(), ...viaMarketing ? { blad: "kana\u0142: newsletter" } : {} });
  await afterSent(base44, kind, to);
  return "wyslany";
}

// supabase/functions/_shared/events.ts
init_settings();
init_tickets();
var warsawFmt = (opts) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", ...opts });
function plDate(value) {
  return warsawFmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(value));
}
function plTime(value) {
  return warsawFmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
function plWhen(value) {
  return `${plDate(value)} \xB7 ${plTime(value)}`;
}
var CITY = {
  "Europe/London": "Londyn",
  "America/New_York": "Nowy Jork",
  "Asia/Tokyo": "Tokio",
  "Europe/Dublin": "Dublin",
  "Europe/Berlin": "Berlin",
  "Europe/Paris": "Pary\u017C",
  "America/Chicago": "Chicago",
  "America/Los_Angeles": "Los Angeles",
  "Europe/Oslo": "Oslo"
};
var validTz = (tz) => {
  try {
    return !!tz && !!new Intl.DateTimeFormat("pl-PL", { timeZone: tz });
  } catch {
    return false;
  }
};
function mailWhen(value, tz) {
  const pl = `${plDate(value)} \xB7 ${plTime(value)} (czas polski, Warszawa)`;
  if (!validTz(tz) || tz === "Europe/Warsaw") return pl;
  const f = (o) => new Intl.DateTimeFormat("pl-PL", { timeZone: tz, ...o }).format(new Date(value));
  const local = f({ hour: "2-digit", minute: "2-digit", hour12: false });
  if (local === plTime(value) && f({ day: "numeric" }) === warsawFmt({ day: "numeric" }).format(new Date(value))) return pl;
  const day = f({ day: "numeric" }) !== warsawFmt({ day: "numeric" }).format(new Date(value)) ? `${f({ weekday: "long", day: "numeric", month: "long" })}, ` : "";
  return `${pl} \xB7 ${day}${local} u Ciebie (${CITY[tz] || tz.split("/").pop().replace(/_/g, " ")})`;
}
function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function icsStamp(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
var isOnline = (ev) => ev.format === "Online";
function joinUrl(ev, token = null) {
  const q = token ? `?t=${token}` : "";
  if (ev.short_path) return `${APP_URL}/${ev.short_path}/dolacz${q}`;
  return ev.slug ? `${APP_URL}/spotkania/${ev.slug}/dolacz${q}` : null;
}
async function joinToken(cancelToken) {
  if (!cancelToken) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`join:${cancelToken}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
function icsLocal(d) {
  const o = {};
  for (const p of warsawFmt({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d)) o[p.type] = p.value;
  return `${o.year}${o.month}${o.day}T${o.hour === "24" ? "00" : o.hour}${o.minute}${o.second}`;
}
function buildIcs(ev, token = null) {
  const start = new Date(ev.start_datetime);
  const end = new Date(start.getTime() + (Number(ev.duration_minutes) || 60) * 6e4);
  const esc3 = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const url = isOnline(ev) ? joinUrl(ev, token) : null;
  const place = isOnline(ev) ? "" : ev.location || "";
  const desc = [ev.subtitle || "", url ? `Do\u0142\u0105cz do spotkania (pok\xF3j otwiera si\u0119 kilka minut przed startem):
${url}` : ""].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EXMORTIS//Spotkania//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.id}@exmortis`,
    `SEQUENCE:${Math.floor(Date.now() / 1e3) - 17e8}`,
    `DTSTAMP:${icsStamp(/* @__PURE__ */ new Date())}`,
    `DTSTART;TZID=Europe/Warsaw:${icsLocal(start)}`,
    `DTEND;TZID=Europe/Warsaw:${icsLocal(end)}`,
    `SUMMARY:${esc3(ev.title)}`,
    `DESCRIPTION:${esc3(desc)}`,
    ...place ? [`LOCATION:${esc3(place)}`] : [],
    ...url ? [`URL:${url}`] : [],
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc3(ev.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}
function icsAttachment(ev, token = null) {
  return {
    filename: "exmortis-spotkanie.ics",
    content: buildIcs(ev, token),
    contentType: "text/calendar; charset=utf-8"
  };
}
function coverOf(ev) {
  let c = ev?.cover;
  if (typeof c === "string") {
    try {
      c = JSON.parse(c);
    } catch {
      c = null;
    }
  }
  return c && typeof c === "object" ? c : null;
}
function shell(ev, content) {
  const c = coverOf(ev);
  const img = c?.crops?.mail ? `<img src="${escHtml(c.crops.mail)}" alt="${escHtml(c.alt || ev.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:0 0 24px;${ev.status === "Odwo\u0142ane" ? "filter:grayscale(1);" : ""}" />` : "";
  return `<div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>${img}
    ${content}
    <p style="color:#8A8A8C;font-size:12px;line-height:1.7;margin-top:28px;">exmortis to mentoring, nie terapia. Je\u015Bli jest Ci bardzo ci\u0119\u017Cko: 116 123 \xB7 800 70 2222 (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 w zagro\u017Ceniu \u017Cycia 112.</p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>
  </div>`;
}
function cancelLink(token) {
  return `<p style="margin-top:28px;font-size:12px;"><a href="${APP_URL}/functions/eventsCancel?token=${token}" style="color:#8A8A8C;">Nie mog\u0119 przyj\u015B\u0107 \u2014 zwalniam miejsce</a></p>`;
}
function meetingLine(ev, reg) {
  return `<p style="color:#C9A24A;letter-spacing:1px;">${escHtml(mailWhen(ev.start_datetime, reg?.tz))} \xB7 ${escHtml(ev.format || "")}</p>
    <p style="color:#8A8A8C;">${escHtml(ev.location || "")}</p>`;
}
function joinBlock(ev, token = null) {
  const url = isOnline(ev) && joinUrl(ev, token);
  if (url) {
    return `${emailButton("DO\u0141\u0104CZ DO SPOTKANIA", url)}<p style="margin-top:0;font-size:13px;color:#A3A3A6;line-height:1.6;">Przycisk prowadzi na Twoj\u0105 stron\u0119 do\u0142\u0105czenia. Pok\xF3j otwiera si\u0119 kilka minut przed startem \u2014 wtedy pojawi si\u0119 tam przycisk wej\u015Bcia do Zoom. Zachowaj ten e-mail albo dodaj spotkanie do kalendarza.</p><p style="color:#8A8A8C;font-size:12px;line-height:1.6;">Przycisk jest przypisany do Twojego zapisu \u2014 nie przekazuj tego maila dalej. Na stronie spotkania wejdziesz te\u017C, wpisuj\u0105c adres e-mail podany przy zapisie.</p>`;
  }
  if (ev.format === "Online" && ev.external_url) {
    return `<p style="margin-top:20px;"><a href="${escHtml(ev.external_url)}" style="color:#C9A24A;">Do\u0142\u0105cz do spotkania tutaj</a></p>`;
  }
  return `<p style="margin-top:20px;color:#8A8A8C;">${escHtml(ev.location || "")} \u2014 przyjd\u017A kilka minut wcze\u015Bniej.</p>`;
}
async function ticketBlock(base44, ev, reg) {
  try {
    const t = await regTicket(base44, ev?.id || reg?.event_id, reg);
    if (!t) return "";
    return `<div style="margin:22px 0;border:1px solid #C9A24A;padding:20px;"><p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 10px;">TW\xD3J BILET</p><p style="margin:0 0 8px;color:#E2E2E2;">${escHtml(t.holder_name)} \xB7 <b style="color:#C9A24A;letter-spacing:2px;">${escHtml(showCode(t.code))}</b></p>` + emailButton("POBIERZ BILET (PDF)", ticketPdfUrl(t.token)) + `<p style="margin:0;font-size:13px;color:#8A8A8C;line-height:1.6;"><a href="${ticketUrl(t.token)}" style="color:#C9A24A;">Otw\xF3rz bilet na telefonie</a>. Przy wej\u015Bciu poka\u017C kod QR \u2014 na telefonie albo wydrukowany. Bilet jest imienny i wa\u017Cny na jedno wej\u015Bcie. Znajdziesz go te\u017C w Moim koncie \u2192 Spotkania.</p></div>`;
  } catch (e) {
    console.error("bilet zapisu:", e?.message);
    return "";
  }
}
async function sendCancelledMail(base44, ev, reg, reason) {
  return sendMail(base44, {
    kind: "odwolanie",
    ref: reg.id,
    waznyDo: ev.start_datetime,
    to: reg.email,
    subject: `EXMORTIS \xB7 Odwo\u0142ane \u2014 ${ev.title}`,
    html: shell(
      ev,
      `<h1 style="font-size:24px;">To spotkanie si\u0119 nie odb\u0119dzie</h1>${meetingLine(ev, reg)}<p style="line-height:1.7;">${escHtml(reg.first_name)}, przepraszam \u2014 spotkanie \xAB${escHtml(ev.title)}\xBB zosta\u0142o odwo\u0142ane.</p>` + (reason ? `<p style="line-height:1.7;color:#8A8A8C;">${escHtml(reason)}</p>` : "") + `<p style="margin-top:20px;"><a href="${APP_URL}/spotkania" style="color:#C9A24A;">Zobacz kolejne terminy</a></p>` + cancelLink(reg.cancel_token)
    )
  });
}
async function sendReminderMail(base44, ev, reg, kind) {
  const jt = await joinToken(reg.cancel_token);
  const head = kind === "1h" ? "Za godzin\u0119 si\u0119 widzimy" : kind === "now" ? "Do zobaczenia wkr\xF3tce" : "Jutro si\u0119 widzimy";
  const lead = kind === "1h" ? `${escHtml(reg.first_name)}, za godzin\u0119 spotykamy si\u0119 na \xAB${escHtml(ev.title)}\xBB. Zostaw wszystko i po prostu przyjd\u017A.` : kind === "now" ? `${escHtml(reg.first_name)}, przypominam o spotkaniu \xAB${escHtml(ev.title)}\xBB \u2014 ${escHtml(mailWhen(ev.start_datetime, reg.tz))}. Czekam na Ciebie.` : `${escHtml(reg.first_name)}, jutro o ${escHtml(plTime(ev.start_datetime))} (czas polski) spotykamy si\u0119 na \xAB${escHtml(ev.title)}\xBB. To kr\xF3tkie przypomnienie \u2014 nic nie musisz robi\u0107, tylko przyj\u015B\u0107.`;
  return sendMail(base44, {
    kind: "przypomnienie",
    ref: reg.id,
    waznyDo: ev.start_datetime,
    to: reg.email,
    subject: `EXMORTIS \xB7 ${head} \u2014 ${ev.title}`,
    html: shell(ev, `<h1 style="font-size:24px;">${head}</h1>${meetingLine(ev, reg)}<p style="line-height:1.7;">${lead}</p>${joinBlock(ev, jt)}${await ticketBlock(base44, ev, reg)}${cancelLink(reg.cancel_token)}`)
  });
}
async function sendRecordingMail(base44, ev, reg, inviteHtml) {
  const konto = `${APP_URL}/konto?tab=spotkania`;
  const rejestracja = `${APP_URL}/register?returnTo=${encodeURIComponent("/konto?tab=spotkania")}`;
  const until = ev.recording_until ? escHtml(plWhen(ev.recording_until)) : "";
  return sendMail(base44, {
    kind: "nagranie",
    ref: reg.id,
    waznyDo: ev.recording_until || void 0,
    to: reg.email,
    subject: `EXMORTIS \xB7 Nagranie czeka w Twoim koncie \u2014 ${ev.title}`,
    html: shell(
      ev,
      `<h1 style="font-size:24px;">Nagranie czeka w Twoim koncie</h1><p style="line-height:1.7;">${escHtml(reg.first_name)}, nagranie ze spotkania \xAB${escHtml(ev.title)}\xBB jest w Twoim koncie na exmortis.pl` + (until ? `. Dost\u0119pne do: <strong>${until}</strong> (czasu polskiego) \u2014 potem zniknie.` : ".") + `</p><p><a href="${escHtml(konto)}" style="display:inline-block;background:#C9A24A;color:#0A0A0B;text-decoration:none;padding:12px 22px;font-weight:bold;">Obejrzyj w koncie</a></p><p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Zaloguj si\u0119 adresem <strong>${escHtml(reg.email)}</strong> \u2014 tym samym, kt\xF3ry by\u0142 podany przy zapisie. Nie masz jeszcze konta? <a href="${escHtml(rejestracja)}" style="color:#C9A24A;">Za\u0142\xF3\u017C je na ten sam adres</a> \u2014 nagranie pojawi si\u0119 od razu.</p>` + inviteHtml
    )
  });
}
async function sendSpotFreedMail(base44, ev, reg) {
  const jt = await joinToken(reg.cancel_token);
  return sendMail(base44, {
    kind: "miejsce",
    ref: reg.id,
    waznyDo: ev.start_datetime,
    to: reg.email,
    subject: `EXMORTIS \xB7 Zwolni\u0142o si\u0119 miejsce \u2014 ${ev.title}`,
    html: shell(
      ev,
      `<h1 style="font-size:24px;">Zwolni\u0142o si\u0119 miejsce</h1>${meetingLine(ev, reg)}<p style="line-height:1.7;">${escHtml(reg.first_name)}, kto\u015B zrezygnowa\u0142 \u2014 miejsce na \xAB${escHtml(ev.title)}\xBB jest Twoje. Do zobaczenia na spotkaniu.</p>` + joinBlock(ev, jt) + await ticketBlock(base44, ev, reg) + cancelLink(reg.cancel_token)
    )
  });
}
async function sendRescheduleMail(base44, ev, reg) {
  const jt = await joinToken(reg.cancel_token);
  return sendMail(base44, {
    kind: "zmiana_terminu",
    ref: reg.id,
    waznyDo: ev.start_datetime,
    to: reg.email,
    subject: `EXMORTIS \xB7 Nowy termin \u2014 ${ev.title}`,
    html: shell(
      ev,
      `<h1 style="font-size:24px;">Nowy termin spotkania</h1>${meetingLine(ev, reg)}<p style="line-height:1.7;">${escHtml(reg.first_name)}, termin spotkania \xAB${escHtml(ev.title)}\xBB si\u0119 zmieni\u0142. Tw\xF3j zapis jest aktualny. W za\u0142\u0105czniku nowy plik kalendarza \u2014 po otwarciu zaktualizuje wydarzenie.</p>` + joinBlock(ev, jt) + cancelLink(reg.cancel_token)
    ),
    attachments: [icsAttachment(ev, jt)]
  });
}
async function sendBroadcastMail(base44, ev, reg, subject, text) {
  return sendMail(base44, {
    kind: "ogloszenie",
    to: reg.email,
    subject,
    html: shell(
      ev,
      `<h1 style="font-size:24px;">${escHtml(ev.title)}</h1><p style="line-height:1.7;">${escHtml(reg.first_name)},</p><div style="line-height:1.7;">${escHtml(text).replace(/\r?\n/g, "<br/>")}</div>` + cancelLink(reg.cancel_token)
    )
  });
}

// supabase/functions/eventsAdmin/index.ts
var EVENT_TYPES = [
  "Spotkanie otwarte",
  "Wiecz\xF3r powrotu",
  "Live",
  "Webinar",
  "Warsztat",
  "Warsztat online",
  "Kr\u0105g",
  "Retreat",
  "Spotkanie stacjonarne",
  "Inne"
];
var FORMATS = ["Online", "Stacjonarnie"];
var REG_TYPES = ["Zapis na stronie", "Link zewn\u0119trzny", "Bez zapisu"];
var STATUSES = ["Opublikowane", "Szkic", "Odwo\u0142ane"];
var STAGES = ["\u015Amier\u0107", "Pr\xF3g", "Powr\xF3t", "Inny", "Wszystkie"];
var pick = (list, value, fallback) => list.includes(value) ? value : fallback;
function slugify(s) {
  return String(s).toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200);
}
function numOrNull(v) {
  if (v === null || v === void 0 || v === "") return null;
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
function cleanCover(c) {
  if (!c || typeof c !== "object" || !c.src) return null;
  const url = (u) => typeof u === "string" && /^https:\/\//.test(u) ? u.slice(0, 1e3) : null;
  const num = (v, min, max, d) => Math.min(max, Math.max(min, Number.isFinite(Number(v)) ? Number(v) : d));
  const crops = {};
  for (const k of ["wide", "tall", "tile", "og", "mail"]) if (url(c.crops?.[k])) crops[k] = url(c.crops[k]);
  return {
    src: url(c.src),
    alt: String(c.alt || "").trim().slice(0, 300),
    fx: num(c.fx, 0, 1, 0.5),
    fy: num(c.fy, 0, 1, 0.5),
    dim: num(c.dim, 0, 80, 45),
    source: c.source === "szablon" ? "szablon" : "wgrana",
    variant: num(c.variant, 0, 2, 0),
    crops
  };
}
async function ensureEventColumns(base44) {
  await runSql(
    base44,
    `ALTER TABLE public.events
       ADD COLUMN IF NOT EXISTS cancel_reason text,
       ADD COLUMN IF NOT EXISTS registration_deadline timestamptz,
       ADD COLUMN IF NOT EXISTS recording_until timestamptz,
       ADD COLUMN IF NOT EXISTS mailing_group text,
       ADD COLUMN IF NOT EXISTS what_registered text,
       ADD COLUMN IF NOT EXISTS join_password text,
       ADD COLUMN IF NOT EXISTS cover jsonb,
       ADD COLUMN IF NOT EXISTS tickets boolean DEFAULT false,
       ADD COLUMN IF NOT EXISTS ticket_template jsonb,
       ADD COLUMN IF NOT EXISTS open_minutes int DEFAULT 15,
       ADD COLUMN IF NOT EXISTS zoom_faq boolean DEFAULT true,
       ADD COLUMN IF NOT EXISTS short_path text`
  );
}
function warsawEvening(y, m, day) {
  for (const off of [2, 1]) {
    const d = /* @__PURE__ */ new Date(
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
      hour12: false
    }).formatToParts(d)) {
      parts[p.type] = p.value;
    }
    if (Number(parts.year) === y && Number(parts.month) === m && Number(parts.day) === day && `${parts.hour}:${parts.minute}` === "20:00") {
      return d.toISOString();
    }
  }
  return (/* @__PURE__ */ new Date(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T19:00:00Z`)).toISOString();
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    if (body.action !== "list" && body.action !== "get") await clearSnap(base44, "events");
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
      const tk = await runSql(base44, `SELECT event_id, count(*) FILTER (WHERE status <> 'anulowany')::int AS sold,
          count(*) FILTER (WHERE status = 'wykorzystany')::int AS checked FROM public.event_tickets GROUP BY event_id`, true).catch(() => []);
      const tkBy = new Map((tk || []).map((r) => [String(r.event_id), r]));
      for (const e of rows || []) {
        const t = tkBy.get(String(e.id));
        e.tickets_sold = t?.sold || 0;
        e.tickets_checked = t?.checked || 0;
      }
      return Response.json({ events: rows || [] });
    }
    if (body.action === "get") {
      const id = String(body.id || "");
      const evRows = await runSql(base44, `SELECT * FROM public.events WHERE id = ${escStr(id)}`, true);
      const parts = await runSql(
        base44,
        `SELECT id, first_name, email, question_for_dawid, status, source, created_at, to_jsonb(r)->>'joined_at' AS joined_at
         FROM public.registrations r WHERE event_id = ${escStr(id)}
         ORDER BY created_at ASC`,
        true
      );
      const ids = (parts || []).map((p) => p.id);
      const pending = ids.length ? await base44.asServiceRole.entities.MailQueue.filter({ kind: "zapis", ref: { $in: ids }, status: { $in: ["kolejka", "blad"] } }, "-created_date", 1e3) : [];
      const unsent = new Set(pending.map((m) => m.ref));
      for (const p of parts || []) p.mail_unsent = unsent.has(p.id);
      return Response.json({ event: evRows && evRows[0] || null, participants: parts || [] });
    }
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
      const description = textField(ev, "description", { required: false, max: 2e4 });
      const for_whom = textField(ev, "for_whom", { required: false, max: 300 });
      const price = Math.max(0, Number(ev.price) || 0);
      const checkout_url = textField(ev, "checkout_url", { required: false, max: 500 });
      const capacity = numOrNull(ev.capacity);
      const registration_type = pick(REG_TYPES, ev.registration_type, "Zapis na stronie");
      const external_url = textField(ev, "external_url", { required: false, max: 1e3 });
      const join_link = textField(ev, "join_link", { required: false, max: 1e3 });
      const join_password = textField(ev, "join_password", { required: false, max: 100 });
      const recording_url = textField(ev, "recording_url", { required: false, max: 1e3 });
      const what_registered = textField(ev, "what_registered", { required: false, max: 500 });
      const mailing_group = textField(ev, "mailing_group", { required: false, max: 200 });
      const cancel_reason = textField(ev, "cancel_reason", { required: false, max: 1e3 });
      const stage = pick(STAGES, ev.stage, "Wszystkie");
      const cover = cleanCover(ev.cover);
      const cover_image = cover?.crops?.wide || textField(ev, "cover_image", { required: false, max: 1e3 });
      if (cover && !cover.alt) throw new Error("Dodaj opis ok\u0142adki (tekst alternatywny).");
      const status = pick(STATUSES, ev.status, "Szkic");
      if (format === "Online" && join_link && !/^https:\/\/([a-z0-9-]+\.)*zoom\.us\//i.test(join_link)) throw new Error("To nie wygl\u0105da na link do Zoom");
      const open_minutes = Math.min(120, Math.max(0, Math.round(Number(ev.open_minutes ?? 15))));
      const zoom_faq = ev.zoom_faq !== false;
      const short_path = String(ev.short_path || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
      let startSql = "NULL";
      if (ev.start_datetime) {
        const d = new Date(ev.start_datetime);
        if (isNaN(d.getTime())) throw new Error("Niepoprawna data");
        startSql = `${escStr(d.toISOString())}::timestamptz`;
      }
      if (status === "Opublikowane") {
        if (!ev.start_datetime) throw new Error("Ustaw dat\u0119, zanim opublikujesz wydarzenie.");
        if (new Date(ev.start_datetime) < /* @__PURE__ */ new Date()) throw new Error("Data nie mo\u017Ce by\u0107 w przesz\u0142o\u015Bci.");
        if (price > 0 && !checkout_url && !(ev.tickets === true && format !== "Online")) {
          throw new Error("Wydarzenie p\u0142atne wymaga ceny i linku p\u0142atno\u015Bci.");
        }
      }
      const cols = `title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
        location, description, for_whom, price, checkout_url, capacity, registration_type,
        external_url, join_link, join_password, recording_url, recording_until,
        registration_deadline, what_registered, mailing_group, stage, cover_image,
        cancel_reason, status, cover, open_minutes, zoom_faq, short_path, tickets`;
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
        ${cancel_reason ? escStr(cancel_reason) : "NULL"}, ${escStr(status)},
        ${cover ? `${escStr(JSON.stringify(cover))}::jsonb` : "NULL"}, ${open_minutes}, ${zoom_faq}, ${short_path ? escStr(short_path) : "NULL"}, ${ev.tickets === true && format !== "Online" ? "TRUE" : "FALSE"}`;
      let rows;
      let rescheduled = 0;
      if (ev.id) {
        const old = (await runSql(base44, `SELECT start_datetime FROM public.events WHERE id = ${escStr(ev.id)}`, true))[0];
        if (old?.start_datetime && ev.start_datetime && new Date(old.start_datetime).getTime() !== new Date(ev.start_datetime).getTime()) {
          const r = await runSql(base44, `UPDATE public.registrations SET reminder_24h_sent = FALSE, reminder_1h_sent = FALSE
            WHERE event_id = ${escStr(ev.id)} AND status IN ('Zapisany','Obecny') RETURNING 1`);
          rescheduled = r.length || -1;
        }
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
      return Response.json({ ok: true, event: rows && rows[0], rescheduled: Math.max(0, rescheduled) });
    }
    if (body.action === "notifyReschedule") {
      const id = String(body.id || "");
      const ev = (await runSql(base44, `SELECT * FROM public.events WHERE id = ${escStr(id)}`, true))[0];
      if (!ev) throw new Error("Nie znaleziono wydarzenia");
      const recs = await runSql(base44, `SELECT id, first_name, email, cancel_token FROM public.registrations
        WHERE event_id = ${escStr(id)} AND status IN ('Zapisany','Obecny','Lista rezerwowa')`, true);
      let n = 0;
      await inPool(recs, async (r) => {
        try {
          await sendRescheduleMail(base44, ev, r);
          n += 1;
        } catch {
        }
      });
      return Response.json({ ok: true, queued: n });
    }
    if (body.action === "duplicate") {
      await ensureEventColumns(base44);
      const id = String(body.id || "");
      const rows = await runSql(
        base44,
        `INSERT INTO public.events
           (id, title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
            location, description, for_whom, price, checkout_url, capacity, registration_type,
            external_url, join_password, recording_url, recording_until, registration_deadline,
            what_registered, mailing_group, stage, cover_image, cover, status, created_at)
         SELECT gen_random_uuid()::text, title,
            slug || '-kopia-' || substr(md5(random()::text), 1, 6),
            subtitle, event_type, format, NULL, duration_minutes,
            location, description, for_whom, price, checkout_url, capacity, registration_type,
            external_url, NULL, NULL, NULL, NULL,
            what_registered, mailing_group, stage, cover_image, cover, 'Szkic', now()
         FROM public.events WHERE id = ${escStr(id)}
         RETURNING id, slug, title`
      );
      return Response.json({ ok: true, event: rows && rows[0] });
    }
    if (body.action === "repeat") {
      await ensureEventColumns(base44);
      const id = String(body.id || "");
      const months = Math.min(24, Math.max(1, Math.round(Number(body.months) || 6)));
      const src = await runSql(base44, `SELECT * FROM public.events WHERE id = ${escStr(id)}`, true);
      const ev = src && src[0];
      if (!ev) throw new Error("Nie znaleziono wydarzenia");
      const now = /* @__PURE__ */ new Date();
      let m = now.getUTCMonth() + 1;
      let y = now.getUTCFullYear();
      const created = [];
      for (let i = 0; i < months; i++) {
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
        let day = null;
        for (let d = 1; d <= 7; d++) {
          if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 4) {
            day = d;
            break;
          }
        }
        const iso = warsawEvening(y, m, day);
        const ins = await runSql(
          base44,
          `INSERT INTO public.events
             (id, title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
              location, description, for_whom, price, checkout_url, capacity, registration_type,
              external_url, join_password, recording_url, recording_until, registration_deadline,
              what_registered, mailing_group, stage, cover_image, cover, status, created_at)
           SELECT gen_random_uuid()::text, title,
              ${escStr((ev.slug || slugify(ev.title) || "wieczor") + "-" + y + "-" + String(m).padStart(2, "0"))},
              subtitle, event_type, format, ${escStr(iso)}::timestamptz, duration_minutes,
              location, description, for_whom, price, checkout_url, capacity, registration_type,
              external_url, NULL, NULL, NULL, NULL,
              what_registered, mailing_group, stage, cover_image, cover, 'Szkic', now()
           FROM public.events WHERE id = ${escStr(id)}
           RETURNING id, slug, title`
        );
        if (ins && ins[0]) created.push(ins[0]);
      }
      return Response.json({ ok: true, created });
    }
    if (body.action === "cancel") {
      const id = String(body.id || "");
      const reason = textField(body, "reason", { required: false, max: 1e3 });
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
        `UPDATE public.events SET status = 'Odwo\u0142ane', cancel_reason = ${reason ? escStr(reason) : "NULL"} WHERE id = ${escStr(id)}`
      );
      const recs = await runSql(
        base44,
        `SELECT id, first_name, email, cancel_token FROM public.registrations
         WHERE event_id = ${escStr(id)} AND status IN ('Zapisany','Obecny')`,
        true
      );
      waitUntil(inPool(recs, (r) => sendCancelledMail(base44, ev, r, reason).catch(() => {
      })));
      return Response.json({ ok: true, notified: recs.length });
    }
    if (body.action === "promote") {
      const id = String(body.id || "");
      const evRows = await runSql(
        base44,
        `SELECT id, title, slug, subtitle, format, start_datetime, duration_minutes, location, join_link, external_url, short_path
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
        waitUntil(sendSpotFreedMail(base44, ev, promoted[0]).catch(() => {
        }));
        return Response.json({ ok: true, promoted: promoted[0].first_name });
      }
      return Response.json({ ok: true, promoted: null });
    }
    if (body.action === "remindNow") {
      const id = String(body.id || "");
      const evRows = await runSql(
        base44,
        `SELECT id, title, slug, subtitle, event_type, format, start_datetime, duration_minutes,
           location, join_link, external_url, short_path
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
      await requireMail(base44);
      let sent = 0;
      await inPool(recs, async (r) => {
        try {
          await sendReminderMail(base44, ev, r, "now");
          sent += 1;
        } catch {
        }
      });
      return Response.json({ ok: true, sent, total: recs.length });
    }
    if (body.action === "sendRecording") {
      const id = String(body.id || "");
      const evRows = await runSql(base44, `SELECT * FROM public.events WHERE id = ${escStr(id)}`, true);
      const ev = evRows && evRows[0];
      if (!ev) throw new Error("Nie znaleziono wydarzenia");
      if (!ev.recording_url) throw new Error("Najpierw wpisz link do nagrania.");
      if (!ev.recording_until || new Date(ev.recording_until) <= /* @__PURE__ */ new Date()) throw new Error("Najpierw udost\u0119pnij nagranie w kontach (np. \u201E24 h od teraz\u201D) i zapisz spotkanie.");
      const recs = await runSql(
        base44,
        `SELECT id, first_name, email, cancel_token FROM public.registrations
         WHERE event_id = ${escStr(id)} AND status IN ('Zapisany','Obecny') AND recording_sent = FALSE`,
        true
      );
      await requireMail(base44);
      let sent = 0;
      await inPool(recs, async (r) => {
        try {
          await sendRecordingMail(base44, ev, r, "");
          await runSql(base44, `UPDATE public.registrations SET recording_sent = TRUE WHERE id = ${escStr(r.id)}`);
          sent += 1;
        } catch {
        }
      });
      return Response.json({ ok: true, sent, total: recs.length });
    }
    if (body.action === "deleteParticipant") {
      await runSql(
        base44,
        `DELETE FROM public.registrations WHERE id = ${escStr(String(body.id || ""))}`
      );
      return Response.json({ ok: true });
    }
    if (body.action === "delete") {
      const id = String(body.id || "");
      const st = await runSql(base44, `SELECT status FROM public.events WHERE id = ${escStr(id)}`, true);
      if (!st || st.length === 0) throw new Error("Nie znaleziono wydarzenia");
      if (st[0].status !== "Szkic") throw new Error("Usun\u0105\u0107 mo\u017Cna tylko szkic \u2014 inne wydarzenia odwo\u0142aj lub zostaw jako archiwum.");
      await runSql(base44, `DELETE FROM public.registrations WHERE event_id = ${escStr(id)}`);
      await runSql(base44, `DELETE FROM public.events WHERE id = ${escStr(id)}`);
      return Response.json({ ok: true });
    }
    if (body.action === "present") {
      const id = String(body.id || "");
      const status = pick(["Obecny", "Zapisany", "Wypisany", "Lista rezerwowa"], body.status, "Obecny");
      const upd = await runSql(
        base44,
        `UPDATE public.registrations SET status = ${escStr(status)} WHERE id = ${escStr(id)} RETURNING id, event_id, first_name, email`
      );
      const r0 = upd?.[0];
      if (r0) {
        const tk = await Promise.resolve().then(() => (init_tickets(), tickets_exports));
        await (status === "Wypisany" ? tk.cancelRegTicket(base44, r0.id) : status === "Lista rezerwowa" ? Promise.resolve() : tk.regTicket(base44, r0.event_id, r0)).catch((e) => console.error("bilet zapisu:", e?.message));
      }
      return Response.json({ ok: true });
    }
    if (body.action === "broadcast") {
      const id = String(body.id || "");
      const subject = textField(body, "subject", { max: 200 });
      const text = textField(body, "text", { max: 1e4 });
      const evRows = await runSql(base44, `SELECT title FROM public.events WHERE id = ${escStr(id)}`, true);
      const ev = evRows && evRows[0];
      const recipients = await runSql(
        base44,
        `SELECT email, first_name, cancel_token FROM public.registrations
         WHERE event_id = ${escStr(id)} AND status IN ('Zapisany','Obecny','Lista rezerwowa')`,
        true
      );
      await requireMail(base44);
      let sent = 0;
      await inPool(recipients, async (r) => {
        try {
          await sendBroadcastMail(base44, ev || { title: "Spotkanie" }, r, subject, text);
          sent += 1;
        } catch {
        }
      });
      return Response.json({ ok: true, sent, total: recipients.length });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
};
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
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
export {
  ensureEventColumns
};
