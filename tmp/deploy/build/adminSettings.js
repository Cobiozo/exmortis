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
        let g2 = groupBy ? r[groupBy] ?? null : "";
        if (g2 && bucketUnit && groupBy) {
          const d = new Date(g2);
          g2 = bucketUnit === "month" ? d.toISOString().slice(0, 7) : bucketUnit === "week" ? String(d.getUTCFullYear()) + "-W" + Math.ceil(((+d - +new Date(d.getUTCFullYear(), 0, 1)) / 864e5 + new Date(d.getUTCFullYear(), 0, 1).getUTCDay() + 1) / 7) : d.toISOString().slice(0, 10);
        }
        const key = String(g2);
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

// supabase/functions/_shared/supabase.ts
var SUPA_URL2 = Deno.env.get("SUPABASE_URL") || "";
var SRK2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
var PROJECT_REF = SUPA_URL2.replace(/^https:\/\//, "").split(".")[0] || "fqhvxhnbeyvwubpnuzxe";
var READ_RE = /^\s*(select|with|values|show|explain)\b/i;
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
async function requireStaff(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin" && user.role !== "techniczna") throw new Error("FORBIDDEN");
  return user;
}

// supabase/functions/_shared/shim.ts
var secrets = {
  get: (k) => Deno.env.get(k) ?? null
};

// supabase/functions/_shared/snapshot.ts
var MEM = /* @__PURE__ */ new Map();
async function clearSnap(base44, prefix) {
  for (const k of MEM.keys()) if (k.startsWith(prefix)) MEM.delete(k);
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const rows = await ent.filter({ key: { $regex: `^${prefix}` } }).catch(() => []);
  await Promise.all(rows.map((r) => ent.update(r.id, { refreshed_at: "2000-01-01T00:00:00.000Z" }).catch(() => {
  })));
}

// supabase/functions/_shared/settings.ts
var TABLE_OK = true;
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
var FIRMA = null;
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
var DEFAULT_APP_URL = globalThis.Deno?.env?.get?.("APP_URL") || "";
function cleanAppUrl(v) {
  const s = String(v || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s/]+\.[^\s/]+$/.test(s)) throw new Error("Podaj adres w formie https://twojadomena.pl (bez \u015Bcie\u017Cki)");
  if (/preview--/i.test(s)) throw new Error("To adres podgl\u0105du \u2014 wpisz adres opublikowanej strony.");
  return s;
}
var APP_URL_AT = 0;
var CACHE = /* @__PURE__ */ new Map();
async function saveSetting(base44, key, value) {
  CACHE.clear();
  APP_URL_AT = 0;
  await clearSnap(base44, "settings");
  await ensureSettingsTable(base44);
  const json = JSON.stringify(value);
  await runSql(
    base44,
    `INSERT INTO public.app_settings (key, value)
     VALUES (${escStr(key)}, ${escStr(json)}::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = ${escStr(json)}::jsonb, updated_date = now()`
  );
}
async function deleteSetting(base44, key) {
  await ensureSettingsTable(base44);
  await runSql(base44, `DELETE FROM public.app_settings WHERE key = ${escStr(key)}`);
}

// supabase/functions/_shared/firma.ts
var FIRMA_KEYS = ["nazwa", "osoba", "adres", "korespondencja", "nip", "regon", "email", "telefon"];
var PREMIERA_DEFAULT = { do: "2026-11-01T20:30:00.000Z", wylaczony: false };
function cleanFirma(data) {
  const out = {};
  for (const k of FIRMA_KEYS) out[k] = String(data?.[k] ?? "").trim().slice(0, 300);
  return out;
}
function cleanPremiera(data) {
  const d = new Date(data?.do);
  if (isNaN(d.getTime())) throw new Error("Podaj poprawn\u0105 dat\u0119 i godzin\u0119");
  const dostep = (Array.isArray(data?.dostep) ? data.dostep : []).slice(0, 50).map((x) => ({ email: String(x?.email || "").trim().toLowerCase().slice(0, 200), do: new Date(x?.do).toISOString() })).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email));
  return { do: d.toISOString(), wylaczony: !!data?.wylaczony, dostep };
}

// supabase/functions/_shared/appOffline.ts
function cleanAplikacja(data) {
  return { offline: data?.offline !== false };
}

// supabase/functions/_shared/tracking.ts
var POMIAR_DEFAULT = { wlaczony: false, pixel_id: "", ga4_id: "" };
function cleanPomiar(data) {
  const pixel = String(data?.pixel_id ?? "").trim();
  const ga4 = String(data?.ga4_id ?? "").trim().toUpperCase();
  return {
    wlaczony: !!data?.wlaczony,
    pixel_id: /^\d{6,20}$/.test(pixel) ? pixel : "",
    ga4_id: /^G-[A-Z0-9]{4,12}$/.test(ga4) ? ga4 : ""
  };
}
function validatePomiar(data) {
  const out = cleanPomiar(data);
  const pixel = String(data?.pixel_id ?? "").trim();
  const ga4 = String(data?.ga4_id ?? "").trim();
  if (pixel && !out.pixel_id) throw new Error("Meta Pixel ID to same cyfry (np. 123456789012345).");
  if (ga4 && !out.ga4_id) throw new Error("GA4 Measurement ID ma posta\u0107 G-XXXXXXXXXX.");
  return out;
}

// supabase/functions/_shared/invoices.ts
var STAWKI = ["23", "22", "8", "7", "5", "4", "3", "0", "zw"];
function cleanFaktury(v) {
  const s = v && typeof v === "object" ? v : {};
  const sub = String(s.subdomena || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\.fakturownia\.pl.*$/, "").replace(/[^a-z0-9-]/g, "").slice(0, 40);
  if (sub && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(sub)) {
    throw new Error("Nazwa konta w Fakturowni: litery, cyfry i my\u015Blniki (np. exmortis \u2014 z adresu exmortis.fakturownia.pl)");
  }
  const stawka = (x, fallback) => STAWKI.includes(String(x)) ? String(x) : fallback;
  return {
    wlaczona: s.wlaczona === true,
    subdomena: sub,
    dokument_osoba: ["vat", "zw", "nie"].includes(s.dokument_osoba) ? s.dokument_osoba : "vat",
    dokument_firma: ["vat", "zw"].includes(s.dokument_firma) ? s.dokument_firma : "vat",
    stawka: stawka(s.stawka, "23"),
    stawka_cyfrowe: s.stawka_cyfrowe ? stawka(s.stawka_cyfrowe, "23") : "",
    wyslij_email: s.wyslij_email !== false
  };
}
function fakturyToken() {
  try {
    const v = secrets.get("FAKTUROWNIA_API_TOKEN");
    if (v) return String(v).trim();
  } catch {
  }
  try {
    const v = globalThis?.process?.env?.FAKTUROWNIA_API_TOKEN;
    if (v) return String(v).trim();
  } catch {
  }
  return "";
}

// supabase/functions/_shared/legalDocs.ts
var DOC_KEYS = ["operator_nazwa", "operator_adres", "metody", "przelozenie_h", "data_od", "poczta", "newsletter", "biuro"];
var DOCS = ["regulamin", "prywatnosc", "cookies"];
var BASE = { regulamin: "1.0", prywatnosc: "1.1", cookies: "1.0" };
var warsawToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(/* @__PURE__ */ new Date());
var bump = (v) => (Math.round(parseFloat(v || "1.0") * 10 + 1) / 10).toFixed(1);
var sha = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
function cleanPola(data) {
  const out = {};
  for (const k of DOC_KEYS) out[k] = String(data?.[k] ?? "").trim().slice(0, 300);
  if (out.przelozenie_h && !/^\d{1,3}$/.test(out.przelozenie_h)) throw new Error("Termin prze\u0142o\u017Cenia podaj w pe\u0142nych godzinach (np. 24).");
  return out;
}
function publicDocs(s) {
  const docs = {};
  for (const d of DOCS) docs[d] = { version: s?.docs?.[d]?.version || BASE[d], date: s?.docs?.[d]?.date || null };
  return { pola: cleanPola(s?.pola || {}), docs };
}
function cleanSnap(x) {
  const str = (v, n) => String(v ?? "").slice(0, n);
  return {
    title: str(x?.title, 300),
    sections: (Array.isArray(x?.sections) ? x.sections : []).slice(0, 80).map((s) => ({
      id: str(s.id, 80),
      title: str(s.title, 300),
      body: (Array.isArray(s.body) ? s.body : []).slice(0, 200).map((p) => str(p, 5e3)),
      ...Array.isArray(s.table) ? { table: s.table.slice(0, 50).map((r) => (Array.isArray(r) ? r : []).slice(0, 8).map((c) => str(c, 500))) } : {}
    }))
  };
}
async function syncDocs(base44, data, snapshots, kto) {
  const prev = publicDocs(await getSetting(base44, "dokumenty"));
  const E = base44.asServiceRole.entities.LegalDocVersion;
  const docs = { ...prev.docs };
  const created = [];
  for (const d of DOCS) {
    if (!snapshots?.[d]) continue;
    const snap = cleanSnap(snapshots[d]);
    const hash = await sha(JSON.stringify(snap));
    const last = (await E.filter({ doc: d }, "-created_date", 1))[0];
    if (last?.hash === hash) {
      docs[d] = { version: last.version, date: last.date };
      continue;
    }
    const version = last ? bump(last.version) : prev.docs[d].version;
    const date = warsawToday();
    await E.create({ doc: d, version, date, ...snap, hash, kto });
    docs[d] = { version, date };
    created.push(`${d} ${version}`);
  }
  return { value: { pola: cleanPola(data), docs }, created };
}

// supabase/functions/_shared/videoSign.ts
var VIDEO_SETTING = "wideo_ochrona";
async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}
var ttlHours = (s) => Math.max(1, Math.min(24, Math.round(Number(s?.ttl_h) || 4)));
async function signServerVideo(base44, rawUrl, settings = null, maxTtl = null) {
  const s = settings || await getSetting(base44, VIDEO_SETTING).catch(() => null);
  if (!s?.enabled || !s?.key) return null;
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!u.pathname.startsWith("/v/")) return null;
  const f = decodeURIComponent(u.pathname.slice(3));
  const ttl = Math.max(60, Math.min(ttlHours(s) * 3600, maxTtl ?? Infinity));
  const e = Math.floor(Date.now() / 1e3) + ttl;
  u.search = "";
  u.searchParams.set("e", String(e));
  u.searchParams.set("t", await hmacHex(s.key, `${f}|${e}`));
  return { url: u.toString(), expires_in: ttl };
}
function newVideoKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}

// supabase/functions/adminSettings/index.ts
var MASK = "********";
var PAYU_KEYS = ["posId", "clientId", "clientSecret", "secondKey", "env"];
var SMTP_KEYS = ["host", "port", "user", "password", "from"];
function maskSecrets(obj, keys) {
  const out = { ...obj || {} };
  for (const k of keys) if (out[k]) out[k] = MASK;
  return out;
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me2 = await requireStaff(base44);
    const tech = me2.role !== "admin";
    const body = await req.json().catch(() => ({}));
    if (body.action === "get") {
      const payu = await getSetting(base44, "payu");
      const smtp = await getSetting(base44, "smtp");
      const app = await getSetting(base44, "app");
      const firma = await getSetting(base44, "firma");
      const premiera = await getSetting(base44, "premiera");
      const pomiar = await getSetting(base44, "pomiar");
      const faktury = await getSetting(base44, "faktury");
      const aplikacja = await getSetting(base44, "aplikacja");
      return Response.json({
        aplikacja: cleanAplikacja(aplikacja),
        pomiar: { ...POMIAR_DEFAULT, ...cleanPomiar(pomiar) },
        // Token API faktur siedzi w sekretach aplikacji — panel dostaje tylko informację, czy jest ustawiony.
        faktury: { ...cleanFaktury(faktury), token_set: !!fakturyToken() },
        firma: cleanFirma(firma),
        dokumenty: publicDocs(await getSetting(base44, "dokumenty")),
        // Rola techniczna nie widzi listy adresów z dostępem przedpremierowym.
        premiera: { ...PREMIERA_DEFAULT, ...premiera || {}, ...tech ? { dostep: [], dostep_ukryty: true } : {} },
        app: { url: app?.url || DEFAULT_APP_URL },
        payu: payu ? maskSecrets(payu, ["clientSecret", "secondKey"]) : {},
        smtp: smtp ? maskSecrets(smtp, ["password"]) : {}
      });
    }
    if (body.action === "save" && body.target === "firma") {
      await saveSetting(base44, "firma", cleanFirma(body.data));
      return Response.json({ ok: true });
    }
    if (body.action === "save" && body.target === "dokumenty") {
      const { value, created } = await syncDocs(base44, body.data, body.snapshots, me2?.email || "admin");
      await saveSetting(base44, "dokumenty", value);
      return Response.json({ ok: true, dokumenty: value, created });
    }
    if (body.action === "save" && body.target === "premiera") {
      const data = tech ? { ...body.data, dostep: (await getSetting(base44, "premiera"))?.dostep || [] } : body.data;
      await saveSetting(base44, "premiera", cleanPremiera(data));
      return Response.json({ ok: true });
    }
    if (body.action === "save" && body.target === "pomiar") {
      if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
      const value = validatePomiar(body.data);
      if (!value.pixel_id && !value.ga4_id) value.wlaczony = false;
      await saveSetting(base44, "pomiar", value);
      return Response.json({ ok: true });
    }
    if (body.action === "save" && body.target === "faktury") {
      if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
      await saveSetting(base44, "faktury", cleanFaktury(body.data));
      return Response.json({ ok: true });
    }
    if (body.action === "save" && body.target === "aplikacja") {
      await saveSetting(base44, "aplikacja", cleanAplikacja(body.data));
      return Response.json({ ok: true });
    }
    if (body.action === "save" && body.target === "app") {
      await saveSetting(base44, "app", { url: cleanAppUrl(body.data?.url) });
      return Response.json({ ok: true });
    }
    if (body.action === "save") {
      const target = body.target;
      if (target !== "payu" && target !== "smtp") {
        throw new Error("Nieznana integracja");
      }
      if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
      const keys = target === "payu" ? PAYU_KEYS : SMTP_KEYS;
      const prev = await getSetting(base44, target) || {};
      const data = body.data && typeof body.data === "object" ? body.data : {};
      const next = {};
      for (const k of keys) {
        const raw = data[k];
        const v = raw === void 0 || raw === null ? "" : String(raw).trim();
        if (v === "" || v === MASK) {
          if (prev[k] !== void 0 && prev[k] !== "") next[k] = prev[k];
        } else {
          next[k] = v.slice(0, 300);
        }
      }
      if (target === "payu") {
        if (!next.posId) throw new Error("Podaj POS ID");
        if (!next.clientId) throw new Error("Podaj Client ID");
        if (!next.clientSecret) throw new Error("Podaj Client Secret");
        if (!next.secondKey) throw new Error("Podaj drugi klucz");
        next.env = next.env === "sandbox" ? "sandbox" : "secure";
      } else {
        if (!next.host) throw new Error("Podaj adres serwera SMTP");
        if (!next.user) throw new Error("Podaj login SMTP");
        if (!next.password) throw new Error("Podaj has\u0142o SMTP");
        if (!next.port) next.port = "587";
      }
      await saveSetting(base44, target, next);
      return Response.json({ ok: true });
    }
    if ((body.action === "zoom_get" || body.action === "zoom_save") && tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
    if (body.action === "zoom_get") {
      const z = await getSetting(base44, "zoom_staly") || {};
      return Response.json({ link: z.link || "", haslo: z.haslo || "" });
    }
    if (body.action === "zoom_save") {
      const link = String(body.link || "").trim().slice(0, 500);
      if (link && !/^https:\/\/\S+$/.test(link)) throw new Error("Link musi zaczyna\u0107 si\u0119 od https:// i nie mie\u0107 spacji.");
      const value = { link, haslo: String(body.haslo || "").trim().slice(0, 50) };
      if (!link) await deleteSetting(base44, "zoom_staly");
      else await saveSetting(base44, "zoom_staly", value);
      return Response.json({ ok: true, ...value });
    }
    if (String(body.action || "").startsWith("video_")) {
      if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
      const cur = await getSetting(base44, VIDEO_SETTING) || {};
      if (body.action === "video_get") {
        return Response.json({ enabled: !!cur.enabled, ttl_h: ttlHours(cur), has_key: !!cur.key, key_created: cur.key_created || null });
      }
      if (body.action === "video_save") {
        if (body.enabled === true && !cur.key) throw new Error("Najpierw wygeneruj klucz i wgraj skrypt na serwer.");
        await saveSetting(base44, VIDEO_SETTING, { ...cur, enabled: body.enabled === true, ttl_h: ttlHours({ ttl_h: body.ttl_h }) });
        return Response.json({ ok: true });
      }
      if (body.action === "video_new_key") {
        const key = newVideoKey();
        await saveSetting(base44, VIDEO_SETTING, { ...cur, key, key_created: (/* @__PURE__ */ new Date()).toISOString(), enabled: false });
        return Response.json({ key });
      }
      if (body.action === "video_sign_preview") {
        const r = await signServerVideo(base44, String(body.url || ""), { ...cur, enabled: !!cur.key });
        return Response.json({ url: r?.url || null });
      }
      return Response.json({ error: "Nieznana akcja" }, { status: 400 });
    }
    if (body.action === "delete") {
      const target = body.target;
      if (target !== "payu" && target !== "smtp") {
        throw new Error("Nieznana integracja");
      }
      if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
      await deleteSetting(base44, target);
      return Response.json({ ok: true });
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
