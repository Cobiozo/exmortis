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
function esc(value) {
  if (value === null || value === void 0) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return escStr(value);
}
async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

// supabase/functions/_shared/orders.ts
var INVOICE_COL = false;
async function ensureInvoiceColumn(base44) {
  if (INVOICE_COL) return true;
  const has = await runSql(base44, `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'invoice'`, true);
  if (!(Array.isArray(has) && has.length)) await runSql(base44, `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice jsonb`);
  INVOICE_COL = true;
  return true;
}

// supabase/functions/_shared/shim.ts
var secrets = {
  get: (k) => Deno.env.get(k) ?? null
};

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
var APP_URL = DEFAULT_APP_URL;
var CACHE = /* @__PURE__ */ new Map();
async function getSettingsFast(base44, keys) {
  const ck = keys.join(",");
  const hit = CACHE.get(ck);
  if (hit && Date.now() - hit.at < 6e4) return hit.v;
  let out = await rpc(base44, "app_settings_get", { p_keys: keys }).catch(() => null);
  if (!out || typeof out !== "object" || Array.isArray(out)) {
    const rows = await runSql(
      base44,
      `SELECT key, value FROM public.app_settings WHERE key IN (${keys.map(escStr).join(",")})`,
      true
    ).catch(() => []);
    out = {};
    for (const r of rows || []) out[r.key] = r.value;
  }
  CACHE.set(ck, { v: out, at: Date.now() });
  return out;
}

// supabase/functions/_shared/smtp.ts
import nodemailer2 from "npm:nodemailer@6.9.13";

// supabase/functions/_shared/emailLayout.ts
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
var esc2 = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function emailButton(label, url, { secondary = false } = {}) {
  const bg = secondary ? "transparent" : BRAND.gold;
  const fg = secondary ? BRAND.gold : BRAND.bg;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr>
<td style="border-radius:2px;background:${bg};border:1px solid ${BRAND.gold};">
<a href="${esc2(url)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${BRAND.sans};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${fg};text-decoration:none;">${esc2(label)}</a>
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
  const firmLine = [firma?.nazwa || firma?.osoba, firma?.adres, firma?.nip && `NIP ${firma.nip}`, firma?.regon && `REGON ${firma.regon}`].filter(Boolean).map(esc2).join(" \xB7 ");
  const link = (href, label) => `<a href="${esc2(href)}" target="_blank" style="color:${BRAND.muted};text-decoration:underline;">${esc2(label)}</a>`;
  const small = `font-family:${BRAND.sans};font-size:12px;line-height:1.7;color:${BRAND.faint};margin:0 0 10px;`;
  const footer = [
    `<p style="font-family:${BRAND.sans};font-size:11px;letter-spacing:3px;color:${BRAND.gold};margin:0 0 14px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>`,
    `<p style="${small}">${SOCIAL.map(([l, u]) => link(u, l)).join(" &nbsp;\xB7&nbsp; ")}</p>`,
    `<p style="${small}">${link(`mailto:${contact}`, contact)} &nbsp;\xB7&nbsp; ${link(site, site.replace(/^https?:\/\//, ""))}</p>`,
    hasCrisis ? "" : `<p style="${small}">exmortis to mentoring, nie terapia. Je\u015Bli jest Ci bardzo ci\u0119\u017Cko: <span style="color:${BRAND.muted};">116 123</span> \xB7 <span style="color:${BRAND.muted};">800 70 2222</span> (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 w zagro\u017Ceniu \u017Cycia <span style="color:${BRAND.muted};">112</span>.</p>`,
    firmLine ? `<p style="${small}">${firmLine}</p>` : "",
    `<p style="${small}">${link(`${site}/regulamin`, "Regulamin")} &nbsp;\xB7&nbsp; ${link(`${site}/polityka-prywatnosci`, "Polityka prywatno\u015Bci")}</p>`,
    marketing ? `<p style="${small}">Dostajesz Listy powrotu, bo zapisano ten adres na ${esc2(site.replace(/^https?:\/\//, ""))} i potwierdzono zapis.${unsubUrl ? ` ${link(unsubUrl, "Wypisz si\u0119 jednym klikni\u0119ciem")}.` : " Aby si\u0119 wypisa\u0107, odpowiedz na ten list s\u0142owem STOP."}</p>` : `<p style="${small}">To wiadomo\u015B\u0107 dotycz\u0105ca Twojego konta, zam\xF3wienia lub zapisu na ${esc2(site.replace(/^https?:\/\//, ""))}. Mo\u017Cesz na ni\u0105 po prostu odpowiedzie\u0107.</p>`
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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.bg};font-size:1px;line-height:1px;">${esc2(pre)}${"&#8203;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};">
<tr><td align="center" class="exm-wrap" style="padding:32px 16px;">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
    <tr><td align="center" style="padding:8px 0 26px;">
      <a href="${esc2(site)}" target="_blank" style="text-decoration:none;">
        <img src="${esc2(site)}/exmortis-logo-500.png" width="64" height="64" alt="exmortis" style="display:block;width:64px;height:64px;margin:0 auto 12px;font-family:${BRAND.serif};font-size:18px;color:${BRAND.gold};">
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

// supabase/functions/_shared/invoices.ts
var CYFROWE = ["pdf", "audio", "wideo", "kurs"];
var STAWKI = ["23", "22", "8", "7", "5", "4", "3", "0", "zw"];
var FAKTURY_DEFAULT = {
  wlaczona: false,
  subdomena: "",
  dokument_osoba: "vat",
  // vat | zw | nie
  dokument_firma: "vat",
  // vat | zw
  stawka: "23",
  stawka_cyfrowe: "",
  // puste = jak stawka domyślna
  wyslij_email: true
};
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
async function loadFaktury(base44) {
  const s = await getSettingsFast(base44, ["faktury"]).catch(() => null);
  let cfg;
  try {
    cfg = cleanFaktury(s?.faktury);
  } catch {
    cfg = { ...FAKTURY_DEFAULT };
  }
  const token = fakturyToken();
  const url = cfg.subdomena ? `https://${cfg.subdomena}.fakturownia.pl` : "";
  return { cfg, token, url, on: !!(cfg.wlaczona && token && url) };
}
var ORDER_COLS = ["invoice_id text", "invoice_number text", "invoice_url text", "invoice_at timestamptz", "invoice_error text"];
var REFUND_COLS = ["correction_id text", "correction_number text", "correction_url text", "correction_error text"];
var COLS_OK = false;
async function ensureInvoiceColumns(base44) {
  if (COLS_OK) return;
  const add = async (table, cols) => {
    const have = await runSql(
      base44,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}'`,
      true
    ).catch(() => []);
    const names = new Set((Array.isArray(have) ? have : []).map((r) => String(r.column_name)));
    for (const c of cols) {
      const name = c.split(" ")[0];
      if (names.has(name)) continue;
      await runSql(base44, `ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${c}`).catch(() => {
      });
    }
  };
  await add("orders", ORDER_COLS);
  await add("order_refunds", REFUND_COLS);
  COLS_OK = true;
}
var shortNo = (id) => String(id || "").slice(0, 8).toUpperCase();
var zl2 = (n) => Number(n).toFixed(2);
var today = () => (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
var clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
var safeErr = (e) => String(e?.message || e).replace(/api_token=[^\s&"'<>]*/gi, "api_token=***").replace(/https?:\/\/[^\s"']*fakturownia\.pl[^\s"']*/gi, "Fakturownia").replace(/\s+/g, " ").trim().slice(0, 300);
async function api(url, path, token, { method = "GET", body } = {}) {
  const sep = path.includes("?") ? "&" : "?";
  let res;
  try {
    res = await fetch(`${url}${path}${sep}api_token=${encodeURIComponent(token)}`, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify({ api_token: token, ...body }) : void 0,
      signal: AbortSignal.timeout(15e3)
    });
  } catch (e) {
    throw new Error(`Fakturownia: brak po\u0142\u0105czenia (${String(e?.name || "b\u0142\u0105d")})`);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const raw = data?.error?.message || data?.error || data?.message || text;
    const msg = safeErr(String(raw || "brak odpowiedzi").replace(/<[^>]*>/g, " "));
    throw new Error(`Fakturownia (${res.status}): ${msg}`);
  }
  return data;
}
function splitAddress(raw) {
  const s = clean(raw, 200);
  if (!s) return {};
  const m = s.match(/^(.*?)[,\s]\s*(\d{2}-\d{3})[\s,]+(.+)$/);
  if (m) return { buyer_street: clean(m[1], 150), buyer_post_code: m[2], buyer_city: clean(m[3], 100), buyer_country: "PL" };
  const m2 = s.match(/^(.*?)[,\s]\s*(\d{2}-\d{3})$/);
  if (m2) return { buyer_street: clean(m2[1], 150), buyer_post_code: m2[2], buyer_country: "PL" };
  return { buyer_street: s, buyer_country: "PL" };
}
function buyerFields(order, company) {
  const inv = order.invoice && typeof order.invoice === "object" ? order.invoice : {};
  const email = clean(order.buyer_email, 120);
  if (company) {
    const out2 = { buyer_name: clean(inv.company || order.buyer_name, 150) || "Klient", buyer_email: email };
    const nip = String(inv.nip || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 20);
    if (nip) out2.buyer_tax_no = nip;
    return { ...out2, ...splitAddress(inv.address) };
  }
  const name = clean(order.buyer_name, 100);
  const [first, ...rest] = name.split(" ");
  const out = { buyer_name: name || email || "Klient", buyer_email: email };
  if (first) out.buyer_first_name = first;
  if (rest.length) out.buyer_last_name = clean(rest.join(" "), 80);
  return out;
}
async function buildPositions(base44, order, cfg, rate) {
  const items = Array.isArray(order.items) ? order.items : [];
  const ids = [...new Set(items.map((i) => String(i?.product_id || "")).filter((id) => id && !id.startsWith("bilet:")))];
  const types = /* @__PURE__ */ new Map();
  if (ids.length) {
    const rows = await runSql(
      base44,
      `SELECT id::text AS id, product_type FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")})`,
      true
    ).catch(() => []);
    for (const r of Array.isArray(rows) ? rows : []) types.set(String(r.id), String(r.product_type || ""));
  }
  const positions = [];
  let sum = 0;
  for (const it of items) {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(it?.quantity) || 1)));
    const unit = Math.round(Number(it?.unitPrice) || 0);
    const gross = unit * qty;
    if (gross <= 0) continue;
    sum += gross;
    const type = types.get(String(it?.product_id || "")) || "";
    const bon = type === "karta";
    const tax = bon ? "np" : CYFROWE.includes(type) && cfg.stawka_cyfrowe && rate !== "zw" ? cfg.stawka_cyfrowe : rate;
    const name = bon ? `${clean(it?.name, 140) || "Karta podarunkowa"} (bon)` : clean(it?.name, 150) || "Pozycja";
    positions.push({ name, quantity: qty, tax, gross });
  }
  return { positions, sum };
}
function applyDiscount(positions, discountGrosze) {
  const total = positions.reduce((s, p) => s + p.gross, 0);
  const cut = Math.min(Math.max(0, Math.round(discountGrosze)), total);
  if (!cut || total <= cut) return positions;
  let left = cut;
  const out = positions.map((p, i) => {
    const share = i === positions.length - 1 ? left : Math.min(left, Math.round(p.gross * cut / total));
    left -= share;
    return { ...p, gross: p.gross - share };
  });
  return out.filter((p) => p.gross > 0);
}
async function issueInvoice(base44, order) {
  const { cfg, token, url, on } = await loadFaktury(base44);
  if (!cfg.wlaczona) return { ok: false, skipped: "wylaczone" };
  if (!on) return { ok: false, skipped: "brak_konfiguracji" };
  if (!order?.id) return { ok: false, skipped: "brak_zamowienia" };
  await ensureInvoiceColumns(base44);
  const fresh = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(String(order.id))} LIMIT 1`, true).catch(() => []);
  const o = (Array.isArray(fresh) ? fresh[0] : null) || order;
  if (o.invoice_id) return { ok: true, already: true, number: o.invoice_number || "", url: o.invoice_url || "" };
  const total = Number(o.total || 0);
  if (!(total > 0)) return { ok: false, skipped: "zero" };
  const inv = o.invoice && typeof o.invoice === "object" ? o.invoice : {};
  const company = !!String(inv.nip || "").trim();
  const doc = company ? cfg.dokument_firma : cfg.dokument_osoba;
  if (doc === "nie") return { ok: false, skipped: "osoba_bez_faktury" };
  const rate = doc === "zw" ? "zw" : cfg.stawka;
  const { positions, sum } = await buildPositions(base44, o, cfg, rate);
  if (!positions.length) return { ok: false, skipped: "brak_pozycji" };
  const lines = applyDiscount(positions, sum - Math.round(total * 100));
  const payuId = String(o.payu_order_id || "");
  const day = today();
  const payload = {
    invoice: {
      kind: "vat",
      number: null,
      issue_date: day,
      sell_date: day,
      status: "paid",
      paid: zl2(total),
      payment_type: payuId && !payuId.startsWith("FREE-") ? "payu" : "karta podarunkowa",
      payment_to_kind: "off",
      oid: String(o.id),
      oid_unique: "yes",
      ...buyerFields(o, company),
      positions: lines.map((p) => ({ name: p.name, quantity: p.quantity, tax: p.tax, total_price_gross: zl2(p.gross / 100) }))
    }
  };
  try {
    const created = await api(url, "/invoices.json", token, { method: "POST", body: payload });
    const id = created?.id;
    if (!id) throw new Error("Fakturownia nie zwr\xF3ci\u0142a identyfikatora dokumentu");
    const full = await api(url, `/invoices/${encodeURIComponent(String(id))}.json`, token).catch(() => created);
    const number = clean(full?.number || created?.number || "", 60);
    const pdf = full?.token ? `${url}/invoice/${full.token}.pdf` : `${url}/invoices/${id}`;
    await runSql(
      base44,
      `UPDATE public.orders SET invoice_id = ${escStr(String(id))}, invoice_number = ${escStr(number)},
         invoice_url = ${escStr(pdf)}, invoice_at = now(), invoice_error = NULL
       WHERE id = ${escStr(String(o.id))}`
    );
    if (cfg.wyslij_email) {
      await api(url, `/invoices/${encodeURIComponent(String(id))}/send_by_email.json?email_pdf=true`, token, { method: "POST", body: {} }).catch(() => {
      });
    }
    return { ok: true, id: String(id), number, url: pdf };
  } catch (e) {
    const msg = safeErr(e);
    await runSql(
      base44,
      `UPDATE public.orders SET invoice_error = ${escStr(msg)}, invoice_at = now() WHERE id = ${escStr(String(o.id))}`
    ).catch(() => {
    });
    return { ok: false, error: msg };
  }
}
async function issueCorrection(base44, refund) {
  const { cfg, token, url, on } = await loadFaktury(base44);
  if (!cfg.wlaczona || !on) return { ok: false, skipped: "wylaczone" };
  const refundId = String(refund?.id || "");
  const orderId = String(refund?.order_id || "");
  const amount = Math.round(Number(refund?.amount || 0) * 100) / 100;
  if (!refundId || !orderId || !(amount > 0)) return { ok: false, skipped: "brak_danych" };
  await ensureInvoiceColumns(base44);
  const rows = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(orderId)} LIMIT 1`, true).catch(() => []);
  const o = Array.isArray(rows) ? rows[0] : null;
  if (!o) return { ok: false, skipped: "brak_zamowienia" };
  if (!o.invoice_id) return { ok: false, skipped: "brak_faktury" };
  if (refund.correction_id) return { ok: true, already: true };
  const inv = o.invoice && typeof o.invoice === "object" ? o.invoice : {};
  const doc = String(inv.nip || "").trim() ? cfg.dokument_firma : cfg.dokument_osoba;
  const rate = doc === "zw" ? "zw" : cfg.stawka;
  const total = Number(o.total || 0);
  const name = `Zam\xF3wienie ${shortNo(orderId)}`;
  const day = today();
  try {
    const created = await api(url, "/invoices.json", token, {
      method: "POST",
      body: {
        invoice: {
          kind: "correction",
          from_invoice_id: String(o.invoice_id),
          correction_reason: `Zwrot ${zl2(amount)} z\u0142 \u2014 zam\xF3wienie ${shortNo(orderId)}`,
          issue_date: day,
          sell_date: day,
          oid: `${String(o.id)}-K${refundId.slice(0, 8).toUpperCase()}`,
          oid_unique: "yes",
          positions: [
            {
              name: `Korekta \u2014 zwrot ${zl2(amount)} z\u0142`,
              quantity: -1,
              tax: rate,
              total_price_gross: zl2(-amount),
              kind: "correction",
              correction_before_attributes: { name, quantity: 1, tax: rate, total_price_gross: zl2(total), kind: "correction_before" },
              correction_after_attributes: { name, quantity: 1, tax: rate, total_price_gross: zl2(total - amount), kind: "correction_after" }
            }
          ]
        }
      }
    });
    const id = created?.id;
    if (!id) throw new Error("Fakturownia nie zwr\xF3ci\u0142a identyfikatora korekty");
    const full = await api(url, `/invoices/${encodeURIComponent(String(id))}.json`, token).catch(() => created);
    const number = clean(full?.number || created?.number || "", 60);
    const pdf = full?.token ? `${url}/invoice/${full.token}.pdf` : `${url}/invoices/${id}`;
    await runSql(
      base44,
      `UPDATE public.order_refunds SET correction_id = ${escStr(String(id))}, correction_number = ${escStr(number)},
         correction_url = ${escStr(pdf)}, correction_error = NULL, updated_at = now() WHERE id = ${escStr(refundId)}`
    );
    if (cfg.wyslij_email) {
      await api(url, `/invoices/${encodeURIComponent(String(id))}/send_by_email.json?email_pdf=true`, token, { method: "POST", body: {} }).catch(() => {
      });
    }
    return { ok: true, id: String(id), number, url: pdf };
  } catch (e) {
    const msg = safeErr(e);
    await runSql(
      base44,
      `UPDATE public.order_refunds SET correction_error = ${escStr(msg)}, updated_at = now() WHERE id = ${escStr(refundId)}`
    ).catch(() => {
    });
    return { ok: false, error: msg };
  }
}

// supabase/functions/_shared/refunds.ts
var BASE_URLS = { secure: "https://secure.payu.com", sandbox: "https://merch-prod.snd.payu.com" };
var ACCEPTED = ["SUCCESS", "SUCCESSFUL", "FINALIZED", "COMPLETED"];
var FAILED = ["CANCELED", "CANCELLED", "ERROR", "REJECTED", "DECLINED", "FAILED"];
var mapStatus = (s) => {
  const v = String(s || "").toUpperCase();
  if (ACCEPTED.includes(v)) return "przyjety";
  if (FAILED.includes(v)) return "blad";
  return "w_toku";
};
var REFUND_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS public.order_refunds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id text NOT NULL,
      amount numeric(10,2) NOT NULL,
      reason text,
      status text NOT NULL DEFAULT 'nowy',
      payu_refund_id text,
      ext_refund_id text,
      revoke_access boolean NOT NULL DEFAULT false,
      cancel_tickets boolean NOT NULL DEFAULT false,
      void_cards boolean NOT NULL DEFAULT false,
      effects_done boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      created_by text
    );
    CREATE UNIQUE INDEX IF NOT EXISTS order_refunds_ext_idx ON public.order_refunds (ext_refund_id);
    CREATE INDEX IF NOT EXISTS order_refunds_order_idx ON public.order_refunds (order_id);
    ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.order_refunds FROM PUBLIC, anon, authenticated;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_total numeric(10,2) DEFAULT 0;`;
var schemaReady = false;
async function ensureRefundSchema(base44) {
  if (schemaReady) return;
  await runSql(base44, REFUND_SCHEMA_SQL);
  schemaReady = true;
  tableKnown = true;
}
var tableKnown = null;
async function hasRefundsTable(base44) {
  if (tableKnown !== null) return tableKnown;
  const rows = await runSql(
    base44,
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_refunds'`,
    true
  ).catch(() => []);
  tableKnown = Array.isArray(rows) && rows.length > 0;
  return tableKnown;
}
var shortNo2 = (id) => String(id || "").slice(0, 8).toUpperCase();
var zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} z\u0142`;
async function refundedTotal(base44, orderId) {
  if (!await hasRefundsTable(base44)) return 0;
  const rows = await runSql(
    base44,
    `SELECT COALESCE(SUM(amount) FILTER (WHERE status <> 'blad'), 0)::float8 AS sum
     FROM public.order_refunds WHERE order_id = ${escStr(orderId)}`,
    true
  ).catch(() => []);
  return Number(rows?.[0]?.sum || 0);
}
async function listRefunds(base44, orderIds) {
  const ids = (orderIds || []).filter(Boolean);
  if (!ids.length || !await hasRefundsTable(base44)) return [];
  const rows = await runSql(
    base44,
    `SELECT id, order_id, amount::float8 AS amount, reason, status, payu_refund_id, created_at, created_by
     FROM public.order_refunds WHERE order_id IN (${ids.map(escStr).join(",")}) ORDER BY created_at DESC`,
    true
  ).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}
async function payuToken(payu, base) {
  const res = await fetch(`${base}/pl/standard/user/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: payu.clientId,
      client_secret: payu.clientSecret
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error("PayU: b\u0142\u0105d autoryzacji (sprawd\u017A Client ID / Client Secret)");
  return data.access_token;
}
async function applyEffects(base44, row) {
  const sr = base44.asServiceRole.entities;
  const out = {};
  if (row.revoke_access) {
    const rows = await sr.Access.filter({ order_id: String(row.order_id) }, "-created_date", 500).catch(() => []);
    const live = (Array.isArray(rows) ? rows : rows?.items || []).filter((a) => !a.revoked);
    if (live.length) {
      await sr.Access.bulkUpdate(live.map((a) => ({ id: a.id, revoked: true })));
      out.access = live.length;
    }
  }
  if (row.cancel_tickets) {
    const r = await runSql(
      base44,
      `UPDATE public.event_tickets SET status = 'anulowany'
       WHERE order_id = ${escStr(String(row.order_id))} AND status = 'wazny' RETURNING 1`
    ).catch(() => []);
    if (r.length) out.bilety = r.length;
  }
  if (row.void_cards) {
    const tag = `zam\xF3wienie ${shortNo2(row.order_id)}`;
    const cards = await sr.DiscountCode.filter({ opis: { $regex: tag } }, "created_date", 500).catch(() => []);
    const unused = (Array.isArray(cards) ? cards : cards?.items || []).filter((c) => c.active !== false && !(Number(c.uses) > 0));
    if (unused.length) {
      await sr.DiscountCode.bulkUpdate(unused.map((c) => ({ id: c.id, active: false })));
      out.karty = unused.length;
    }
  }
  return out;
}
async function syncRefundedTotal(base44, orderId) {
  await runSql(
    base44,
    `UPDATE public.orders SET refunded_total = COALESCE(
       (SELECT SUM(amount) FROM public.order_refunds WHERE order_id = ${escStr(orderId)} AND status = 'przyjety'), 0)
     WHERE id = ${escStr(orderId)}`
  ).catch(() => {
  });
}
var escHtml = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function refundEmailHtml(buyerName, amount, orderId) {
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    <h1 style="font-size:26px;letter-spacing:1px;">Zwrot przyj\u0119ty</h1>
    <p style="color:#8A8A8C;line-height:1.7;">${escHtml(buyerName || "")}, przyj\u0105\u0142em zwrot za zam\xF3wienie <span style="color:#E2E2E2;">${shortNo2(orderId)}</span>.</p>
    <p style="color:#C9A24A;font-size:22px;margin:20px 0;">${zl(amount)}</p>
    <p style="color:#8A8A8C;font-size:14px;line-height:1.7;">Pieni\u0105dze wr\xF3c\u0105 na rachunek, z kt\xF3rego zap\u0142acono. Ksi\u0119gowanie zwrotu trwa zwykle 3\u20135 dni roboczych \u2014 termin zale\u017Cy od Twojego banku.</p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:24px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>
  </div>`;
}
async function sendRefundMail(base44, row) {
  const rows = await runSql(
    base44,
    `SELECT buyer_email, buyer_name FROM public.orders WHERE id = ${escStr(String(row.order_id))} LIMIT 1`,
    true
  ).catch(() => []);
  const o = rows?.[0];
  if (!o?.buyer_email) return "brak";
  return sendMail(base44, {
    to: o.buyer_email,
    subject: `Zwrot przyj\u0119ty \u2014 zam\xF3wienie ${shortNo2(row.order_id)}`,
    html: refundEmailHtml(o.buyer_name, row.amount, row.order_id),
    kind: "zwrot",
    ref: String(row.order_id)
  }).catch(() => "blad");
}
async function finishRefund(base44, row, status, payuRefundId) {
  const mapped = mapStatus(status);
  await runSql(
    base44,
    `UPDATE public.order_refunds
     SET status = ${escStr(mapped)}, updated_at = now()${payuRefundId ? `, payu_refund_id = ${escStr(payuRefundId)}` : ""}
     WHERE id = ${escStr(row.id)}`
  );
  if (mapped !== "przyjety") return mapped;
  const claimed = await runSql(
    base44,
    `UPDATE public.order_refunds SET effects_done = true WHERE id = ${escStr(row.id)} AND effects_done = false RETURNING *`
  );
  const claim = Array.isArray(claimed) ? claimed[0] : null;
  if (!claim) return mapped;
  await applyEffects(base44, claim);
  await syncRefundedTotal(base44, String(claim.order_id));
  await sendRefundMail(base44, claim);
  await issueCorrection(base44, claim).catch(() => {
  });
  return mapped;
}
async function createRefund(base44, { order, amount, reason, by, opts }) {
  await ensureRefundSchema(base44);
  const paid = Number(order.total || 0);
  const already = await refundedTotal(base44, order.id);
  const left = Math.round((paid - already) * 100) / 100;
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(amt) || amt <= 0) return { error: "Kwota zwrotu musi by\u0107 wi\u0119ksza od zera." };
  if (amt > left) return { error: `Za du\u017Co \u2014 do zwrotu zosta\u0142o ${zl(left)}.` };
  const payu = await getSetting(base44, "payu").catch(() => null);
  if (!payu || !payu.posId || !payu.clientId || !payu.clientSecret) return { error: "PAYU_NOT_CONFIGURED" };
  const base = BASE_URLS[payu.env === "sandbox" ? "sandbox" : "secure"];
  const cnt = await runSql(
    base44,
    `SELECT COUNT(*)::int AS n FROM public.order_refunds WHERE order_id = ${escStr(order.id)}`,
    true
  ).catch(() => [{ n: 0 }]);
  const extRefundId = `${order.id}-R${(Number(cnt?.[0]?.n) || 0) + 1}`;
  const ins = await runSql(
    base44,
    `INSERT INTO public.order_refunds
       (order_id, amount, reason, status, ext_refund_id, revoke_access, cancel_tickets, void_cards, created_by)
     VALUES (${escStr(order.id)}, ${esc(amt)}, ${escStr(String(reason || "").slice(0, 1e3))}, 'nowy',
             ${escStr(extRefundId)}, ${esc(!!opts?.revoke_access)}, ${esc(!!opts?.cancel_tickets)}, ${esc(!!opts?.void_cards)},
             ${escStr(String(by || ""))})
     ON CONFLICT (ext_refund_id) DO NOTHING
     RETURNING *`
  );
  const row = Array.isArray(ins) ? ins[0] : null;
  if (!row) return { error: "Ten zwrot ju\u017C zosta\u0142 zarejestrowany \u2014 od\u015Bwie\u017C list\u0119." };
  let data = {};
  try {
    const token = await payuToken(payu, base);
    const res = await fetch(`${base}/api/v2_1/orders/${encodeURIComponent(String(order.payu_order_id))}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        refund: {
          description: String(reason || "Zwrot").slice(0, 100),
          amount: String(Math.round(amt * 100)),
          extRefundId
        }
      })
    });
    data = await res.json().catch(() => ({}));
    const refund = data.refund || {};
    if (!res.ok || !refund.refundId && !refund.status) {
      const msg = data?.status?.statusDesc || data?.error?.message || "PayU: nie uda\u0142o si\u0119 zleci\u0107 zwrotu";
      await runSql(base44, `UPDATE public.order_refunds SET status = 'blad', updated_at = now() WHERE id = ${escStr(row.id)}`);
      return { error: msg };
    }
    const status = await finishRefund(base44, row, refund.status, refund.refundId);
    return { ok: true, status, refundId: refund.refundId || null, amount: amt };
  } catch (e) {
    await runSql(base44, `UPDATE public.order_refunds SET status = 'blad', updated_at = now() WHERE id = ${escStr(row.id)}`).catch(() => {
    });
    return { error: String(e?.message || e) };
  }
}

// supabase/functions/adminOrders/index.ts
var LIST_SQL = (where) => `SELECT o.id, o.payu_order_id, o.created_date, o.updated_date, o.buyer_name, o.buyer_email,
    o.note, o.items, o.total::float8 AS total, o.status, to_jsonb(o)->'invoice' AS invoice,
    to_jsonb(o)->>'invoice_number' AS invoice_number, to_jsonb(o)->>'invoice_url' AS invoice_url,
    to_jsonb(o)->>'invoice_error' AS invoice_error,
    COALESCE((to_jsonb(o)->>'refunded_total')::numeric, 0)::float8 AS refunded_total
  FROM public.orders o WHERE ${where} ORDER BY o.created_date DESC LIMIT 500`;
var SUMMARY_SQL = `SELECT
  COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED' AND created_date >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw'), 0)::float8 AS revenue_month,
  COUNT(*) FILTER (WHERE status = 'COMPLETED' AND created_date >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw')::int AS paid_month,
  COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'), 0)::float8 AS revenue_all,
  COUNT(*) FILTER (WHERE status IN ('PENDING', 'WAITING_FOR_CONFIRMATION', 'NEW') AND created_date > now() - interval '2 days')::int AS pending,
  COUNT(*) FILTER (WHERE status = 'COMPLETED' AND to_jsonb(o)->'invoice' IS NOT NULL AND jsonb_typeof(to_jsonb(o)->'invoice') = 'object'
    AND COALESCE((to_jsonb(o)->'invoice'->>'wystawiona')::boolean, false) = false)::int AS invoices_todo
  FROM public.orders o WHERE COALESCE(total, 0) > 0`;
var STATS_SQL = (days, withRefunds) => `WITH win AS (SELECT now() - interval '${days} days' AS a, now() - interval '${days * 2} days' AS b),
o AS (SELECT o.* FROM public.orders o, win WHERE o.status = 'COMPLETED' AND o.created_date::timestamptz >= win.a),
prev AS (SELECT o.* FROM public.orders o, win WHERE o.status = 'COMPLETED' AND o.created_date::timestamptz >= win.b AND o.created_date::timestamptz < win.a)
SELECT
  (SELECT json_build_object(
    'revenue', COALESCE(SUM(total) FILTER (WHERE total > 0), 0)::float8,
    'orders', COUNT(*) FILTER (WHERE total > 0)::int,
    'buyers', COUNT(DISTINCT lower(buyer_email)) FILTER (WHERE total > 0)::int,
    'downloads', COUNT(*) FILTER (WHERE COALESCE(total, 0) = 0)::int${withRefunds ? RF_CUR : ""}) FROM o) AS cur,
  (SELECT json_build_object(
    'revenue', COALESCE(SUM(total) FILTER (WHERE total > 0), 0)::float8,
    'orders', COUNT(*) FILTER (WHERE total > 0)::int,
    'buyers', COUNT(DISTINCT lower(buyer_email)) FILTER (WHERE total > 0)::int,
    'downloads', COUNT(*) FILTER (WHERE COALESCE(total, 0) = 0)::int${withRefunds ? RF_PREV : ""}) FROM prev) AS prev,
  (SELECT COALESCE(json_agg(d ORDER BY d.day), '[]'::json) FROM (
    SELECT (created_date::timestamptz AT TIME ZONE 'Europe/Warsaw')::date::text AS day, SUM(total)::float8 AS revenue, COUNT(*)::int AS orders
    FROM o WHERE total > 0 GROUP BY 1) d) AS daily,
  (SELECT COALESCE(json_agg(x ORDER BY x.value DESC, x.units DESC), '[]'::json) FROM (
    SELECT COALESCE(it->>'product_id', it->>'name') AS id, MAX(it->>'name') AS name,
      SUM(COALESCE((it->>'quantity')::int, 1))::int AS units,
      (SUM(COALESCE((it->>'unitPrice')::numeric, 0) * COALESCE((it->>'quantity')::int, 1)) / 100)::float8 AS value,
      COUNT(DISTINCT lower(o.buyer_email))::int AS buyers
    FROM o, jsonb_array_elements(CASE WHEN jsonb_typeof(o.items::jsonb) = 'array' THEN o.items::jsonb ELSE '[]'::jsonb END) it
    GROUP BY 1) x) AS products,
  (SELECT COALESCE(json_agg(c ORDER BY c.uses DESC), '[]'::json) FROM (
    SELECT COALESCE(to_jsonb(o)->>'discount_code', '') AS code, COUNT(*)::int AS uses,
      COALESCE(SUM((SELECT COALESCE(SUM(COALESCE((it->>'unitPrice')::numeric, 0) * COALESCE((it->>'quantity')::int, 1)), 0)
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items::jsonb) = 'array' THEN o.items::jsonb ELSE '[]'::jsonb END) it)
        - COALESCE(o.total, 0) * 100), 0)::float8 / 100 AS discount
    FROM o WHERE COALESCE(to_jsonb(o)->>'discount_code', '') <> '' GROUP BY 1) c) AS codes,
  (SELECT COALESCE(json_agg(w ORDER BY w.total DESC), '[]'::json) FROM (
    SELECT w.product_id::text AS id, MAX(p.name) AS name, COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE to_jsonb(w)->>'notified_at' IS NOT NULL)::int AS notified,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.orders o2, jsonb_array_elements(CASE WHEN jsonb_typeof(o2.items::jsonb) = 'array' THEN o2.items::jsonb ELSE '[]'::jsonb END) it2
        WHERE o2.status = 'COMPLETED' AND lower(o2.buyer_email) = lower(w.email) AND it2->>'product_id' = w.product_id::text))::int AS bought
    FROM public.waitlist w LEFT JOIN public.products p ON p.id::text = w.product_id::text GROUP BY 1) w) AS waitlist`;
var RF_CUR = `, 'refunds', (SELECT COALESCE(SUM(r.amount), 0)::float8 FROM public.order_refunds r, win WHERE r.status = 'przyjety' AND r.created_at >= win.a),
    'refunds_n', (SELECT COUNT(*)::int FROM public.order_refunds r, win WHERE r.status = 'przyjety' AND r.created_at >= win.a)`;
var RF_PREV = `, 'refunds', (SELECT COALESCE(SUM(r.amount), 0)::float8 FROM public.order_refunds r, win WHERE r.status = 'przyjety' AND r.created_at >= win.b AND r.created_at < win.a),
    'refunds_n', (SELECT COUNT(*)::int FROM public.order_refunds r, win WHERE r.status = 'przyjety' AND r.created_at >= win.b AND r.created_at < win.a)`;
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    if (body.action === "list") {
      const parts = ["COALESCE(o.total, 0) > 0"];
      const st = String(body.status || "");
      if (st === "paid") parts.push("o.status = 'COMPLETED'");
      else if (st === "pending") parts.push("o.status IN ('PENDING', 'WAITING_FOR_CONFIRMATION', 'NEW')");
      else if (st === "canceled") parts.push("o.status = 'CANCELED'");
      if (body.invoice === "todo") {
        parts.push("o.status = 'COMPLETED'", "jsonb_typeof(to_jsonb(o)->'invoice') = 'object'", "COALESCE((to_jsonb(o)->'invoice'->>'wystawiona')::boolean, false) = false");
      }
      const q = String(body.q || "").trim().slice(0, 100);
      if (q) {
        const like = escStr(`%${q.replace(/[%_\\]/g, "")}%`);
        parts.push(`(o.buyer_email ILIKE ${like} OR o.buyer_name ILIKE ${like} OR o.id ILIKE ${like} OR o.items::text ILIKE ${like})`);
      }
      const [orders, summary] = await Promise.all([
        runSql(base44, LIST_SQL(parts.join(" AND ")), true),
        runSql(base44, SUMMARY_SQL, true)
      ]);
      const refunds = await listRefunds(base44, orders.map((o) => o.id));
      return Response.json({ orders, summary: summary[0] || {}, refunds });
    }
    if (body.action === "stats") {
      const days = [7, 30, 90, 365].includes(Number(body.days)) ? Number(body.days) : 30;
      const [row] = await runSql(base44, STATS_SQL(days, await hasRefundsTable(base44)), true);
      return Response.json({ days, ...row || {} });
    }
    if (body.action === "refund") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Brak zam\xF3wienia" }, { status: 400 });
      const [o] = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(id)} LIMIT 1`, true);
      if (!o) return Response.json({ error: "Nie ma takiego zam\xF3wienia" }, { status: 400 });
      if (o.status !== "COMPLETED") return Response.json({ error: "Zwrot dotyczy tylko op\u0142aconych zam\xF3wie\u0144." }, { status: 400 });
      const payuId = String(o.payu_order_id || "");
      if (!payuId || payuId.startsWith("FREE-")) {
        return Response.json({ error: "To zam\xF3wienie nie przesz\u0142o przez PayU \u2014 zwrot rozlicz poza systemem." }, { status: 400 });
      }
      const me2 = await requireAdmin(base44);
      const r = await createRefund(base44, {
        order: o,
        amount: body.amount,
        reason: body.reason,
        by: me2.email,
        opts: body.opts || {}
      });
      if (r.error === "PAYU_NOT_CONFIGURED") return Response.json({ error: "PAYU_NOT_CONFIGURED" }, { status: 400 });
      if (r.error) return Response.json({ error: r.error }, { status: 400 });
      return Response.json(r);
    }
    if (body.action === "invoice_retry") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Brak zam\xF3wienia" }, { status: 400 });
      const [o] = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(id)} LIMIT 1`, true);
      if (!o) return Response.json({ error: "Nie ma takiego zam\xF3wienia" }, { status: 400 });
      if (o.status !== "COMPLETED") return Response.json({ error: "Faktur\u0119 wystawiamy tylko do op\u0142aconego zam\xF3wienia." }, { status: 400 });
      const r = await issueInvoice(base44, o);
      if (r.error) return Response.json({ error: r.error });
      if (r.skipped) {
        const why = r.skipped === "wylaczone" ? "Automatyczne faktury s\u0105 wy\u0142\u0105czone w ustawieniach." : r.skipped === "brak_konfiguracji" ? "Brak tokenu API albo nazwy konta Fakturowni." : r.skipped === "osoba_bez_faktury" ? "Ustawienie: osobie prywatnej nie wystawiamy faktury automatycznie." : "Nie ma czego wystawi\u0107 (kwota 0 albo brak pozycji).";
        return Response.json({ skipped: r.skipped, error: why });
      }
      return Response.json(r);
    }
    if (body.action === "invoice_issued") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Brak zam\xF3wienia" }, { status: 400 });
      await ensureInvoiceColumn(base44);
      const issued = body.issued === true;
      const number = String(body.number || "").trim().slice(0, 60);
      const patch = { wystawiona: issued, numer: issued ? number : "", data: issued ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) : "" };
      const rows = await runSql(
        base44,
        `UPDATE public.orders SET invoice = COALESCE(invoice, '{}'::jsonb) || ${escStr(JSON.stringify(patch))}::jsonb, updated_date = now()
         WHERE id = ${escStr(id)} AND jsonb_typeof(invoice) = 'object' RETURNING invoice`
      );
      if (!rows.length) return Response.json({ error: "To zam\xF3wienie nie ma danych do faktury" }, { status: 400 });
      return Response.json({ invoice: rows[0].invoice });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error?.message === "FORBIDDEN") return Response.json({ error: "Brak uprawnie\u0144" }, { status: 403 });
    console.error(error);
    return Response.json({ error: "Nie uda\u0142o si\u0119 wczyta\u0107 zam\xF3wie\u0144" }, { status: 500 });
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
