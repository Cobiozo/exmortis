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

// supabase/functions/_shared/obok.ts
var DAY = 864e5;
function warsawParts(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return p;
}
function warsawAt(ymd, hm) {
  const guess = Date.parse(`${ymd}T${hm}:00Z`);
  const p = warsawParts(new Date(guess));
  const shown = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
  return guess - (shown - guess);
}
function nextAt(t, hm) {
  const p = warsawParts(new Date(t));
  let x = warsawAt(`${p.year}-${p.month}-${p.day}`, hm);
  while (x <= t) x += DAY;
  return x;
}
var playable = (r) => r.status !== "szkic" && !!r.plik_uri;
function unlockTimes(s, recs, joinedMs, planned = false) {
  const out = /* @__PURE__ */ new Map();
  const step = s.test_minuty > 0 ? s.test_minuty * 6e4 : DAY;
  const sorted = [...recs].sort((a, b) => (a.numer || 0) - (b.numer || 0));
  const n = sorted.length;
  const start = s.edycja_start ? Date.parse(s.edycja_start) : null;
  const edEnd = start != null ? start + (n - 1) * step : null;
  const useEd = start != null && (joinedMs == null || joinedMs <= edEnd || s.po_edycji === "zamknieta");
  sorted.forEach((r, i) => {
    let t;
    if (s.typ === "zbior") t = 0;
    else if (s.typ === "cotygodniowa") t = r.publikacja ? Date.parse(r.publikacja) : Date.parse(r.created_date);
    else if (useEd) t = start + i * step;
    else if (s.po_edycji === "wszystkie") t = joinedMs || 0;
    else {
      const j = joinedMs || Date.now();
      const first = s.test_minuty > 0 ? j + step : nextAt(j, s.godzina || "20:00");
      t = i === 0 ? j : first + (i - 1) * step;
    }
    out.set(r.id, planned || playable(r) ? t : null);
  });
  return out;
}
var canJoin = (s, now, recCount) => {
  if (s.status !== "aktywna") return false;
  if (s.po_edycji !== "zamknieta" || !s.edycja_start) return true;
  const step = s.test_minuty > 0 ? s.test_minuty * 6e4 : DAY;
  return now <= Date.parse(s.edycja_start) + Math.max(0, recCount - 1) * step;
};

// supabase/functions/obok/index.ts
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole.entities;
    const action = String(body.action || "");
    if (action === "unsub") {
      const t = String(body.token || "");
      if (!/^[a-f0-9-]{20,}$/.test(t)) return Response.json({ error: "Nieprawid\u0142owy link" }, { status: 400 });
      const [u] = await sr.ObokUczestnik.filter({ token: t }, "-created_date", 1);
      if (!u) return Response.json({ error: "Nieprawid\u0142owy link" }, { status: 404 });
      await sr.ObokUczestnik.update(u.id, { powiadomienia: false });
      return Response.json({ ok: true });
    }
    if (action === "public") {
      const [s2] = await sr.ObokSeria.filter({ slug: String(body.slug || ""), status: "aktywna" }, "-created_date", 1);
      if (!s2) return Response.json({ error: "Nie ma takiej serii" }, { status: 404 });
      return Response.json({ nazwa: s2.nazwa, opis_krotki: s2.opis_krotki || "", edycja_start: s2.edycja_start || null });
    }
    const me2 = await base44.auth.me().catch(() => null);
    if (!me2) return Response.json({ error: "Zaloguj si\u0119" }, { status: 401 });
    if (me2.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 });
    const email = String(me2.email).toLowerCase();
    const admin = me2.role === "admin";
    const now = admin && body.sim ? Date.parse(body.sim) : Date.now();
    const mine = await sr.ObokUczestnik.filter({ user_email: email }, "-created_date", 200);
    const memberOf = new Map(mine.map((u) => [u.seria_id, u]));
    const hasAccess = async (s2) => {
      if (admin) return true;
      if (s2.status !== "aktywna") return false;
      if (s2.dostep === "zalogowani") return true;
      if (memberOf.has(s2.id)) return true;
      if (s2.dostep === "produkt" && s2.produkt_id) {
        const a = await sr.Access.filter({ user_email: email, product_id: s2.produkt_id }, "-created_date", 1);
        return a.length > 0;
      }
      return false;
    };
    const joinedMs = (s2) => {
      const u = memberOf.get(s2.id);
      return u ? Date.parse(u.joined_at || u.created_date) : s2.dostep === "zalogowani" ? Date.parse(me2.created_date) : null;
    };
    const load = async (s2) => {
      const recs2 = await sr.ObokNagranie.filter({ seria_id: s2.id }, "numer", 200);
      const times2 = unlockTimes(s2, recs2, joinedMs(s2));
      const heard = await sr.ObokOdsluch.filter({ user_email: email, seria_id: s2.id }, "-updated_date", 300);
      const hm2 = new Map(heard.map((h) => [h.nagranie_id, h]));
      return { recs: recs2, times: times2, hm: hm2, plan: unlockTimes(s2, recs2, joinedMs(s2), true) };
    };
    const bySlug = async (slug) => (await sr.ObokSeria.filter({ slug: String(slug || "") }, "-created_date", 1))[0];
    if (action === "home") {
      const all = await sr.ObokSeria.filter(admin ? {} : { status: "aktywna" }, "kolejnosc", 100);
      const ok = [];
      for (const s2 of all) if (await hasAccess(s2)) ok.push(s2);
      const ids = ok.map((s2) => s2.id);
      const [recsAll, heardAll] = await Promise.all([
        ids.length ? sr.ObokNagranie.filter({ seria_id: { $in: ids } }, "numer", 500) : Promise.resolve([]),
        ids.length ? sr.ObokOdsluch.filter({ user_email: email, seria_id: { $in: ids } }, "-updated_date", 1e3) : Promise.resolve([])
      ]);
      const recsBy = new Map(ids.map((id) => [id, []]));
      recsAll.forEach((r2) => recsBy.get(r2.seria_id)?.push(r2));
      const heardBy = new Map(ids.map((id) => [id, /* @__PURE__ */ new Map()]));
      heardAll.forEach((h) => heardBy.get(h.seria_id)?.set(h.nagranie_id, h));
      const tiles = [];
      for (const s2 of ok) {
        const recs2 = recsBy.get(s2.id);
        if (!admin && recs2.length === 0) continue;
        const times2 = unlockTimes(s2, recs2, joinedMs(s2));
        const hm2 = heardBy.get(s2.id);
        const open = recs2.filter((r2) => times2.get(r2.id) != null && times2.get(r2.id) <= now);
        const next = recs2.filter((r2) => times2.get(r2.id) != null && times2.get(r2.id) > now).sort((a, b) => times2.get(a.id) - times2.get(b.id))[0];
        tiles.push({
          id: s2.id,
          nazwa: s2.nazwa,
          slug: s2.slug,
          opis_krotki: s2.opis_krotki || "",
          okladka: s2.okladka || "",
          typ: s2.typ,
          total: recs2.length,
          open: open.length,
          heard: open.filter((r2) => hm2.get(r2.id)?.ukonczone).length,
          next: next ? { tytul: next.tytul, at: new Date(times2.get(next.id)).toISOString() } : null,
          powiadomienia: !!memberOf.get(s2.id)?.powiadomienia,
          member: memberOf.has(s2.id)
        });
      }
      return Response.json({ tiles, imie: me2.full_name || "" });
    }
    if (action === "join") {
      const s2 = await bySlug(body.slug);
      if (!s2 || s2.status !== "aktywna") return Response.json({ error: "Nie ma takiej serii" }, { status: 404 });
      const exist = memberOf.get(s2.id);
      if (!exist) {
        const n = (await sr.ObokNagranie.filter({ seria_id: s2.id }, "numer", 200)).length;
        if (!canJoin(s2, now, n)) return Response.json({ error: "Ta edycja jest zamkni\u0119ta. Daj zna\u0107, a napisz\u0119 o kolejnej." }, { status: 409 });
        await sr.ObokUczestnik.create({
          seria_id: s2.id,
          user_email: email,
          imie: me2.full_name || "",
          joined_at: (/* @__PURE__ */ new Date()).toISOString(),
          powiadomienia: !!body.powiadomienia,
          zrodlo: String(body.zrodlo || "").slice(0, 80),
          token: crypto.randomUUID() + crypto.randomUUID().slice(0, 8),
          wyslane: []
        });
      }
      return Response.json({ ok: true, edycja_start: s2.edycja_start || null });
    }
    if (action === "notify" || action === "leave") {
      const u = mine.find((x) => x.seria_id === String(body.seria_id || ""));
      if (!u) return Response.json({ error: "Nie nale\u017Cysz do tej serii" }, { status: 404 });
      if (action === "leave") {
        await sr.ObokOdsluch.deleteMany({ user_email: email, seria_id: u.seria_id });
        await sr.ObokUczestnik.delete(u.id);
      } else await sr.ObokUczestnik.update(u.id, { powiadomienia: !!body.on });
      return Response.json({ ok: true });
    }
    const s = await bySlug(body.slug);
    if (!s || !await hasAccess(s)) return Response.json({ error: "Brak dost\u0119pu", seria: s && s.status === "aktywna" ? { nazwa: s.nazwa, landing: s.landing_slug || "" } : null }, { status: 403 });
    const { recs, times, hm, plan } = await load(s);
    const isOpen = (r2) => times.get(r2.id) != null && times.get(r2.id) <= now;
    if (action === "seria") {
      return Response.json({
        seria: { id: s.id, nazwa: s.nazwa, slug: s.slug, opis: s.opis || "", okladka: s.okladka || "", typ: s.typ },
        nagrania: recs.map((r2) => ({
          numer: r2.numer,
          tytul: r2.tytul,
          dlugosc_s: r2.dlugosc_s || 0,
          open: isOpen(r2),
          at: s.typ !== "zbior" ? new Date(plan.get(r2.id)).toISOString() : null,
          ukonczone: !!hm.get(r2.id)?.ukonczone,
          publikacja: r2.publikacja || null
        }))
      });
    }
    const r = recs.find((x) => x.numer === Number(body.numer));
    if (!r || !isOpen(r)) return Response.json({ error: "To nagranie jeszcze si\u0119 nie otworzy\u0142o" }, { status: 403 });
    if (action === "nagranie") {
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: r.plik_uri, expires_in: 10800 });
      return Response.json({
        seria: { nazwa: s.nazwa, slug: s.slug, okladka: s.okladka || "" },
        n: {
          id: r.id,
          numer: r.numer,
          tytul: r.tytul,
          opis: r.opis || "",
          format: r.format,
          obraz: r.obraz || "",
          dlugosc_s: r.dlugosc_s || 0,
          pytanie: r.pytanie || "",
          transkrypcja: r.transkrypcja || "",
          material_nazwa: r.material_nazwa || "",
          material_url: r.material_url || "",
          ostrzezenie: !!r.ostrzezenie,
          src: signed_url,
          pozycja_s: hm.get(r.id)?.pozycja_s || 0
        }
      });
    }
    if (action === "progress") {
      const pos = Math.max(0, Number(body.pozycja) || 0);
      const done = !!body.ukonczone || r.dlugosc_s > 0 && pos >= r.dlugosc_s * 0.9;
      const h = hm.get(r.id);
      if (h) await sr.ObokOdsluch.update(h.id, { pozycja_s: pos, ukonczone: h.ukonczone || done });
      else await sr.ObokOdsluch.create({ nagranie_id: r.id, seria_id: s.id, user_email: email, pozycja_s: pos, ukonczone: done });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    console.error("obok:", e);
    return Response.json({ error: "Nie uda\u0142o si\u0119 wczyta\u0107. Spr\xF3buj za chwil\u0119." }, { status: 500 });
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
