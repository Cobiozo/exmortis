// Zamiennik @base44/sdk (createClientFromRequest) dla Supabase Edge Functions.
// Dostarcza dokładnie tę powierzchnię API, z której korzysta kod base44/functions + base44/shared:
//   auth.me/isAuthenticated/updateMe/logout · entities.* (filter/list/count/aggregate/get/create/update/
//   updateMany/bulkCreate/bulkUpdate/delete/deleteMany) · asServiceRole (to samo + integrations.Core,
//   connectors.getConnection, users.inviteUser, aiGateway) · users.inviteUser · functions.invoke.
// Dane trzymamy w tabelach exm_* (kolumna jsonb `data` + kolumny systemowe) — tak jak przy replikacji.
import nodemailer from "npm:nodemailer@6.9.13";

const SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";

const PRIV_BUCKET = "private";
const PUB_BUCKET = "public";
// Stare miejsce plików (Base44) — podpisy plików sprzed migracji przechodzą przez legacySign.
const LEGACY_BASE44_URL = () => Deno.env.get("EXM_LEGACY_BASE44_URL") || "https://exmortis-return-path.base44.app";

// ---- pomocnicze: PostgREST
const H = () => ({ apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" });
const val = (v: unknown) => encodeURIComponent(String(v));
const inVal = (v: unknown) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const col = (f: string) => `data->>${encodeURIComponent(f)}`;
const OP_MAP: Record<string, string> = { $ne: "neq", $gt: "gt", $gte: "gte", $lt: "lt", $lte: "lte" };

function atom(field: string, cond: unknown): string {
  if (cond === null) return `${col(field)}=is.null`;
  if (cond === true || cond === false) return `${col(field)}=eq.${cond}`;
  if (typeof cond !== "object" || Array.isArray(cond)) {
    return Array.isArray(cond) ? `${col(field)}=in.(${(cond as unknown[]).map(inVal).join(",")})` : `${col(field)}=eq.${val(cond)}`;
  }
  const [op, v] = Object.entries(cond as Record<string, unknown>)[0];
  if (op === "$in" || op === "$nin") {
    const list = Array.isArray(v) ? v : [v];
    return `${col(field)}=${op === "$in" ? "in" : "not.in"}.(${list.map(inVal).join(",")})`;
  }
  if (op === "$exists") return `${col(field)}=is.${v ? "not.null" : "null"}`;
  if (op === "$regex") return `${col(field)}=like.*${encodeURIComponent(String(v))}*`;
  if (op in OP_MAP) return `${col(field)}=${OP_MAP[op]}.${val(v)}`;
  throw new Error(`Nieobsługiwany operator filtra: ${op}`);
}

function conditions(query: Record<string, unknown>): string[] {
  const parts: string[] = [];
  for (const [field, cond] of Object.entries(query || {})) {
    if (field === "$or" || field === "$and") {
      const sep = field === "$or" ? "or" : "and";
      const inner = (cond as Record<string, unknown>[]).map((sub) => {
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

function orderExpr(sort: string): string {
  const dir = String(sort).startsWith("-") ? "desc" : "asc";
  const field = String(sort).replace(/^-/, "");
  const built = ["created_date", "updated_date"].includes(field);
  return `${built ? field : encodeURIComponent("data->>" + field)}.${dir}`;
}

async function pgGet(table: string, qs: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, { headers: H(), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const row2rec = (r: Record<string, unknown>) => ({
  ...(r.data as Record<string, unknown> || {}),
  id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id,
});
const rec2row = (rec: Record<string, unknown>) => {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!["id", "created_date", "updated_date", "created_by_id"].includes(k)) data[k] = v;
  }
  return data;
};
const tableOf = (name: string) => "exm_" + name.toLowerCase();

// Bez options → tablica rekordów (jak w Base44); z options → strona {items, next_cursor, has_more}.
function parseArgs(args: unknown[]) {
  const [query, second] = args as [Record<string, unknown>, Record<string, unknown> | string];
  if (second && typeof second === "object" && !Array.isArray(second)) {
    const o = second as Record<string, unknown>;
    return { query: query || {}, sort: o.sort, limit: o.limit, cursor: o.cursor, distinct: o.distinct, page: true };
  }
  return { query: query || {}, sort: second, limit: args[2], cursor: args[3], distinct: null, page: false };
}

// ---- encje
function makeEntity(name: string) {
  const table = tableOf(name);

  async function fetchPage(parts: string[], sort?: unknown, limit?: number, cursor?: number) {
    const order = sort ? `&order=${orderExpr(String(sort))}` : "";
    const lim = Math.max(1, Math.min(Number(limit) || 50, 2000));
    const off = Math.max(0, Number(cursor ?? 0) || 0);
    const qs = `${parts.join("&")}${order}&limit=${lim + 1}&offset=${off}`;
    const rows = await pgGet(table, qs);
    const has_more = rows.length > lim;
    return { items: (has_more ? rows.slice(0, lim) : rows).map(row2rec), next_cursor: has_more ? String(off + lim) : null, has_more };
  }

  return {
    async get(id: string) {
      const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
      return rows[0] ? row2rec(rows[0]) : null;
    },

    async filter(...args: unknown[]) {
      const { query, sort, limit, cursor, distinct, page } = parseArgs(args);
      const parts = conditions(query);
      if (distinct) {
        const rows = await pgGet(table, `select=v:${encodeURIComponent("data->>" + distinct)}&limit=2000`);
        return { items: [...new Set((rows as unknown as { v: unknown }[]).map((r) => r.v).filter((v) => v !== null && v !== undefined))] };
      }
      if (!page) {
        const order = sort ? `&order=${orderExpr(String(sort))}` : "";
        const lim = limit ? `&limit=${Math.min(Number(limit) || 50, 2000)}` : "";
        return (await pgGet(table, `${parts.join("&")}${order}${lim}`)).map(row2rec);
      }
      return fetchPage(parts, sort, limit, cursor);
    },

    // Base44: list(sort, limit, skip) — pierwszy argument to sortowanie, nie zapytanie.
    // Tylko obiekt (albo brak argumentów) oznacza listę ze stronicą; reszta to tablica rekordów.
    async list(...args: unknown[]) {
      const [first, limit, skip] = args;
      if (first === undefined || first === null || typeof first === "string") {
        const order = first ? `&order=${orderExpr(String(first))}` : "";
        const lim = Math.max(1, Math.min(Number(limit) || 2000, 2000));
        const off = Math.max(0, Number(skip) || 0);
        return (await pgGet(table, `select=*${order}&limit=${lim}&offset=${off}`)).map(row2rec);
      }
      const options = first as Record<string, unknown>;
      if (!Object.keys(options).length) return (await pgGet(table, "limit=2000")).map(row2rec);
      return this.filter(options.query || {}, { sort: options.sort, limit: options.limit, cursor: options.cursor, distinct: options.distinct });
    },

    async count(query: Record<string, unknown> = {}) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${conditions(query).join("&") || "select=id"}&limit=0`, {
        method: "HEAD", headers: { ...H(), Prefer: "count=exact" }, signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      const range = res.headers.get("content-range") || "/0";
      return Number(range.split("/")[1]) || 0;
    },

    async aggregate(body: { query?: Record<string, unknown>; groupBy?: string; sum?: string[]; avg?: string[]; min?: string[]; max?: string[]; dateBucket?: { field?: string; unit?: string } } = {}) {
      const parts = conditions(body.query || {});
      const rows = (await pgGet(table, `${parts.join("&") || "select=*"}&limit=20000`)).map(row2rec);
      const groupBy = body.groupBy || (body.dateBucket ? body.dateBucket.field : null);
      const bucketUnit = body.dateBucket ? body.dateBucket.unit || "day" : null;
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const r of rows) {
        let g: string | null = groupBy ? (r[groupBy] as string) ?? null : "";
        if (g && bucketUnit && groupBy) {
          const d = new Date(g);
          g = bucketUnit === "month" ? d.toISOString().slice(0, 7) : bucketUnit === "week" ? String(d.getUTCFullYear()) + "-W" + Math.ceil((((+d - +new Date(d.getUTCFullYear(), 0, 1)) / 86400000) + new Date(d.getUTCFullYear(), 0, 1).getUTCDay() + 1) / 7) : d.toISOString().slice(0, 10);
        }
        const key = String(g);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }
      const num = (r: Record<string, unknown>, f: string) => Number(r[f]) || 0;
      const out = [...groups.entries()].map(([key, rs]) => {
        const row: Record<string, unknown> = { [groupBy || "okres"]: key === "null" ? null : key, count: rs.length };
        for (const f of body.sum || []) row[`sum_${f}`] = rs.reduce((a, r) => a + num(r, f), 0);
        for (const f of body.avg || []) row[`avg_${f}`] = rs.length ? rs.reduce((a, r) => a + num(r, f), 0) / rs.length : 0;
        for (const f of body.min || []) row[`min_${f}`] = rs.length ? Math.min(...rs.map((r) => num(r, f))) : 0;
        for (const f of body.max || []) row[`max_${f}`] = rs.length ? Math.max(...rs.map((r) => num(r, f))) : 0;
        return row;
      });
      out.sort((a, b) => String(Object.values(a)[0]).localeCompare(String(Object.values(b)[0])));
      return { rows: out };
    },

    async create(rec: Record<string, unknown>) {
      const now = new Date().toISOString();
      const row = { id: crypto.randomUUID(), created_date: now, updated_date: now, created_by_id: (rec.created_by_id as string) || null, data: rec2row(rec) };
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method: "POST", headers: { ...H(), Prefer: "return=representation" }, body: JSON.stringify(row), signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return row2rec((await res.json())[0]);
    },

    async bulkCreate(recs: Record<string, unknown>[]) {
      const now = new Date().toISOString();
      const rows = (recs || []).map((rec) => ({ id: crypto.randomUUID(), created_date: now, updated_date: now, created_by_id: (rec.created_by_id as string) || null, data: rec2row(rec) }));
      if (!rows.length) return [];
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method: "POST", headers: { ...H(), Prefer: "return=representation" }, body: JSON.stringify(rows), signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).map(row2rec);
    },

    async update(id: string, patch: Record<string, unknown>) {
      const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
      if (!rows[0]) return null;
      const data = { ...(rows[0].data as Record<string, unknown>), ...rec2row(patch) };
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, {
        method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
        body: JSON.stringify({ data, updated_date: new Date().toISOString() }), signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return row2rec((await res.json())[0]);
    },

    async updateMany(query: Record<string, unknown>, ops: Record<string, unknown>) {
      const $set = (ops.$set || {}) as Record<string, unknown>;
      const $inc = (ops.$inc || {}) as Record<string, unknown>;
      const $unset = (ops.$unset || []) as string[];
      let changed = 0;
      for (let round = 0; round < 20; round++) {
        const ids = (await pgGet(table, `${conditions(query).join("&")}&select=id&limit=500`)).map((r) => String(r.id));
        if (!ids.length) break;
        await Promise.all(ids.map(async (id) => {
          const rows = await pgGet(table, `id=eq.${val(id)}&limit=1`);
          const data = { ...((rows[0]?.data as Record<string, unknown>) || {}), ...$set };
          for (const [f, n] of Object.entries($inc)) data[f] = (Number(data[f]) || 0) + Number(n);
          for (const f of $unset) delete data[f];
          const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, {
            method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
            body: JSON.stringify({ data, updated_date: new Date().toISOString() }), signal: AbortSignal.timeout(20000),
          });
          if (res.ok) changed++;
        }));
      }
      return { ok: true, changed };
    },

    async bulkUpdate(list: { id: string }[]) {
      for (const item of list || []) await this.update(item.id, item as Record<string, unknown>);
      return { ok: true, count: (list || []).length };
    },

    async delete(id: string) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${val(id)}`, { method: "DELETE", headers: H(), signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      return { ok: true };
    },

    async deleteMany(query: Record<string, unknown> = {}) {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${conditions(query).join("&")}`, { method: "DELETE", headers: H(), signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
      return { ok: true };
    },

    subscribe: () => () => { /* live aktualizacje zostają na warstwie frontendowej */ },
  };
}

// Współdzielony magazyn encji (jedna instancja na izolat, bez stanu między wywołaniami).
const ENTITIES = new Map<string, ReturnType<typeof makeEntity>>();
function entities() {
  return new Proxy({}, {
    get: (_t, name: string) => {
      if (!ENTITIES.has(name)) ENTITIES.set(name, makeEntity(name));
      return ENTITIES.get(name);
    },
  }) as Record<string, ReturnType<typeof makeEntity>>;
}

// Adres strony do linków plików w magazynie hostingu: zmienne środowiskowe, a gdy ich brak — ustawienie app.
let HOSTING_BASE = "";
let HOSTING_BASE_AT = 0;
async function hostingBase(): Promise<string> {
  if (HOSTING_BASE && Date.now() - HOSTING_BASE_AT < 300000) return HOSTING_BASE;
  let url = String(Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  if (!url || /preview--/i.test(url)) {
    const r = await fetch(`${SUPA_URL}/rest/v1/app_settings?key=eq.app&select=value&limit=1`, {
      headers: H(), signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    url = String(j?.[0]?.value?.url || "").replace(/\/+$/, "");
    if (/preview--/i.test(url)) url = "";
  }
  if (url) { HOSTING_BASE = url; HOSTING_BASE_AT = Date.now(); }
  return url;
}

// ---- integracje Core
const Core = {
  async SendEmail(opts: { to: string; subject?: string; html?: string; body?: string; text?: string; from_name?: string }) {
    const host = Deno.env.get("SMTP_HOST");
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    if (!host || !user || !pass) throw new Error("Wysyłka awaryjna: brak sekretów SMTP_HOST/SMTP_USER/SMTP_PASS");
    const port = Number(Deno.env.get("SMTP_PORT") || 587);
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transport.sendMail({
      from: `${opts.from_name || "Exmortis"} <${user}>`,
      to: opts.to, subject: opts.subject || "(bez tematu)",
      html: opts.html || opts.body || "", text: opts.text || "",
    });
    return { ok: true };
  },

  async CreateFileSignedUrl({ file_uri, expires_in = 300 }: { file_uri: string; expires_in?: number }) {
    if (/^https?:\/\//.test(file_uri)) return { signed_url: file_uri };
    // Pliki w magazynie hostingu (cyberfolks.pl, katalog ./media, server.js + multer): link podpisujemy tutaj
    // tym samym kluczem, którego używa serwer Node (MEDIA_SECRET, zapasowo BOOKING_HMAC_KEY).
    if (/^cf\//.test(String(file_uri))) {
      const name = String(file_uri).replace(/^cf\/(private|public)\//, "");
      if (!/^[A-Za-z0-9._-]{1,160}$/.test(name)) throw new Error("Podpis pliku: nieprawidłowa nazwa pliku");
      const key = Deno.env.get("MEDIA_SECRET") || Deno.env.get("BOOKING_HMAC_KEY");
      if (!key) throw new Error("Podpis pliku: brak sekretu MEDIA_SECRET");
      const base = await hostingBase();
      if (!base) throw new Error("Podpis pliku: brak adresu aplikacji (ustawienie app)");
      const exp = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(Number(expires_in) || 300, 604800));
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${name}.${exp}`)))]
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      return { signed_url: `${base}/media/private/${encodeURIComponent(name)}?e=${exp}&s=${mac}` };
    }
    let bucket = "", path = "";
    const m = file_uri.match(/^(?:supabase:\/\/)([^/]+)\/(.+)$/);
    if (m) { bucket = m[1]; path = m[2]; }
    else { const [head, ...rest] = String(file_uri).split("/"); bucket = /privat/i.test(head) ? PRIV_BUCKET : PUB_BUCKET; path = rest.join("/"); }
    const exp = Math.max(60, Math.min(Number(expires_in) || 300, 604800));
    // Pliki sprzed migracji leżą w starym magazynie (Base44) — podpisuje je funkcja legacySign.
    const legacy = async () => {
      const key = Deno.env.get("BOOKING_HMAC_KEY");
      if (!key) throw new Error("Podpis pliku: brak sekretu BOOKING_HMAC_KEY");
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`sign:${file_uri}`)))]
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      const res = await fetch(`${LEGACY_BASE44_URL()}/functions/legacySign`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: file_uri, sig: mac, expires_in: exp }), signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Podpis pliku (stare miejsce): ${res.status}`);
      const j = await res.json().catch(() => null);
      if (!j || !j.signed_url) throw new Error("Podpis pliku: brak linku");
      return { signed_url: j.signed_url };
    };
    try {
      const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
        method: "POST", headers: { ...H() }, body: JSON.stringify({ expiresIn: exp }), signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return await legacy();
      const j = await res.json();
      const rel = j.signedURL || j.token ? (j.signedURL || `/object/sign/${bucket}/${path}?token=${j.token}`) : null;
      if (!rel) return await legacy();
      return { signed_url: `${SUPA_URL}/storage/v1${rel}` };
    } catch {
      return await legacy();
    }
  },

  async UploadPrivateFile({ file }: { file: File | Blob }) {
    const name = `${Date.now()}-${((file as File).name || "plik").replace(/[^\w.\-]/g, "_")}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/${PRIV_BUCKET}/${name}`, {
      method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": (file as File).type || "application/octet-stream", "x-upsert": "true" },
      body: file, signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Storage upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { file_uri: `${PRIV_BUCKET}/${name}` };
  },

  async UploadPublicFile({ file }: { file: File | Blob }) {
    const name = `${Date.now()}-${((file as File).name || "plik").replace(/[^\w.\-]/g, "_")}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/${PUB_BUCKET}/${name}`, {
      method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": (file as File).type || "application/octet-stream", "x-upsert": "true" },
      body: file, signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Storage upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { file_url: `${SUPA_URL}/storage/v1/object/public/${PUB_BUCKET}/${name}` };
  },

  async GenerateImage({ prompt }: { prompt: string }) {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("Generowanie obrazów: brak sekretu OPENAI_API_KEY");
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }), signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const b64 = (await res.json()).data?.[0]?.b64_json;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { url } = await this.UploadPublicFile({ file: new Blob([bytes], { type: "image/png" }) });
    return { url };
  },
};

// ---- łączniki (po migracji tokeny trzymamy w sekretach, nie w łącznikach)
const connectors = {
  async getConnection(type: string) {
    if (type === "supabase") return { accessToken: SRK, connectionConfig: {} };
    throw new Error(`Łącznik "${type}" nie działa po migracji — przenieś token do sekretów i czytaj go w kodzie (Deno.env.get)`);
  },
};

// ---- użytkownicy i tożsamość
let CURRENT_REQ: Request | null = null;
const jwtOf = (req: Request | null) => {
  const h = (req?.headers.get("authorization") || "").match(/^Bearer (.+)$/i);
  return h ? h[1] : "";
};

async function me() {
  const token = jwtOf(CURRENT_REQ);
  if (!token) return null;
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const u = await res.json();
  let profile: Record<string, unknown> | null = null;
  try {
    const rows = await pgGet("exm_user", `${col("email")}=eq.${val(u.email)}&limit=1`);
    profile = rows[0] || null;
  } catch { /* kolumna email może istnieć zamiast data->email */ }
  const d = ((profile?.data as Record<string, unknown>) || {}) as Record<string, unknown>;
  return {
    id: String(u.id),
    email: u.email,
    full_name: d.full_name || u.user_metadata?.full_name || String(u.email || "").split("@")[0],
    role: d.role || u.user_metadata?.role || "user",
    created_date: profile?.created_date || u.created_at,
  };
}

async function updateMe(patch: Record<string, unknown>) {
  const user = await me();
  if (!user) throw new Error("Logowanie wymagane");
  const data = { full_name: patch.full_name, ...rec2row(patch) };
  const res = await fetch(`${SUPA_URL}/rest/v1/exm_user?${col("email")}=eq.${val(user.email)}`, {
    method: "PATCH", headers: { ...H(), Prefer: "return=representation" }, body: JSON.stringify({ data }), signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
  const rows = await res.json();
  return { ...user, ...(rows[0]?.data || {}), ...patch };
}

async function inviteUser(email: string, role = "user") {
  const res = await fetch(`${SUPA_URL}/auth/v1/invite`, {
    method: "POST", headers: { ...H() }, body: JSON.stringify({ email }), signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Supabase invite ${res.status}: ${(await res.text()).slice(0, 200)}`);
  try {
    const now = new Date().toISOString();
    await fetch(`${SUPA_URL}/rest/v1/exm_user`, {
      method: "POST", headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ email, role, data: { email, full_name: email.split("@")[0], role }, created_date: now, updated_date: now }), signal: AbortSignal.timeout(20000),
    });
  } catch { /* profil doszlifuje kolejny zapis */ }
  return { ok: true };
}

async function invoke(name: string, payload: unknown) {
  const res = await fetch(`${SUPA_URL}/functions/v1/${name}`, {
    method: "POST", headers: { Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(120000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Funkcja ${name}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return { data };
}

export function createClientFromRequest(req: Request) {
  CURRENT_REQ = req;
  const ents = entities();
  return {
    entities: ents,
    auth: {
      me,
      isAuthenticated: async () => (await me()) !== null,
      updateMe,
      logout: () => new Response(null, { status: 204 }),
    },
    users: { inviteUser },
    functions: { invoke },
    asServiceRole: {
      entities: ents,
      integrations: { Core },
      connectors,
      users: { inviteUser },
      aiGateway: {
        connection: async () => { throw new Error("aiGateway: po migracji używaj OpenAI (sekret OPENAI_API_KEY)"); },
      },
    },
  };
}