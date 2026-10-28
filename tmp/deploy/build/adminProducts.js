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
async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

// supabase/functions/_shared/productPrice.ts
var warsawToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(/* @__PURE__ */ new Date());
function readSteps(p) {
  let raw = p?.price_steps;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({ do: String(s?.do || "").slice(0, 10), cena: s?.cena === null || s?.cena === void 0 || s?.cena === "" ? NaN : Number(s.cena) })).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.do) && Number.isFinite(s.cena) && s.cena >= 0).sort((a, b) => a.do.localeCompare(b.do));
}
function activeStep(p, today = warsawToday()) {
  const steps = readSteps(p);
  const i = steps.findIndex((s) => s.do >= today);
  if (i < 0) return null;
  const regular = p.price_regular != null ? Number(p.price_regular) : Number(p.price);
  const next = steps[i + 1] ? { od: nextDay(steps[i].do), cena: steps[i + 1].cena } : { od: nextDay(steps[i].do), cena: regular };
  return { step: steps[i], next };
}
function nextDay(d) {
  const t = /* @__PURE__ */ new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}
function withSteps(p) {
  if (!readSteps(p).length) return p;
  const a = activeStep(p);
  if (!a) return { ...p, price_start: null, promo_end_date: null };
  return { ...p, price_start: a.step.cena, promo_end_date: a.step.do, next_price: a.next };
}
function unitPrice(p) {
  const q = withSteps(p);
  const end = q.promo_end_date ? String(q.promo_end_date).slice(0, 10) : "";
  if (end && q.price_start != null && end >= warsawToday()) return Number(q.price_start);
  return q.price_regular != null ? Number(q.price_regular) : Number(q.price);
}
var HISTORY_DDL = `CREATE TABLE IF NOT EXISTS public.product_price_daily (
  product_id text NOT NULL, day date NOT NULL, price numeric(10,2) NOT NULL,
  PRIMARY KEY (product_id, day))`;
var ddlDone = false;
async function ensureHistory(base44) {
  if (ddlDone) return;
  await runSql(base44, HISTORY_DDL);
  await runSql(base44, `ALTER TABLE public.product_price_daily ENABLE ROW LEVEL SECURITY`).catch(() => {
  });
  ddlDone = true;
}
var PRICE_COLS = `id, price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
  promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps, is_free`;
var lastRecord = "";
async function recordPrices(base44, force = false) {
  const stamp = `${warsawToday()}-${(/* @__PURE__ */ new Date()).getUTCHours()}`;
  if (!force && lastRecord === stamp) return 0;
  await ensureHistory(base44);
  await runSql(base44, `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_steps jsonb`);
  const rows = await runSql(base44, `SELECT ${PRICE_COLS} FROM public.products p WHERE active = TRUE AND COALESCE(is_free, FALSE) = FALSE AND COALESCE(status, 'dost\u0119pny') = 'dost\u0119pny'`, true);
  const day = warsawToday();
  const vals = (rows || []).map((r) => ({ id: String(r.id), price: unitPrice(r) })).filter((r) => Number.isFinite(r.price) && r.price > 0);
  if (vals.length) {
    await runSql(base44, `INSERT INTO public.product_price_daily (product_id, day, price) VALUES
      ${vals.map((v) => `(${escStr(v.id)}, ${escStr(day)}::date, ${v.price.toFixed(2)})`).join(",\n      ")}
      ON CONFLICT (product_id, day) DO UPDATE SET price = LEAST(public.product_price_daily.price, EXCLUDED.price)`);
  }
  lastRecord = stamp;
  return vals.length;
}

// supabase/functions/_shared/access.ts
var DIGITAL = ["pdf", "audio", "wideo", "kurs"];

// supabase/functions/_shared/smtp.ts
import nodemailer2 from "npm:nodemailer@6.9.13";

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
var APP_URL = DEFAULT_APP_URL;
var safeAppUrl = (u) => !u || /preview--/i.test(String(u)) ? DEFAULT_APP_URL : String(u).replace(/\/+$/, "");
var APP_URL_AT = 0;
async function loadAppUrl(base44) {
  if (Date.now() - APP_URL_AT < 3e5) return APP_URL;
  const s = await getSetting(base44, "app").catch(() => null);
  APP_URL = safeAppUrl(s?.url);
  APP_URL_AT = Date.now();
  return APP_URL;
}

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

// supabase/functions/_shared/waitlist.ts
var escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var zlTxt = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} z\u0142`;
function waitlistHtml(p, firstName, note, url) {
  const promo = p.price_start != null && p.promo_end_date;
  const price = p.is_free ? "bezp\u0142atnie" : promo ? `${zlTxt(p.price_start)} (do ${(/* @__PURE__ */ new Date(`${String(p.promo_end_date).slice(0, 10)}T12:00:00Z`)).toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "Europe/Warsaw" })}, potem ${zlTxt(p.next_price?.cena ?? p.price_regular ?? p.price)})` : zlTxt(unitPrice(p));
  const noteHtml = note ? `<p style="line-height:1.7;color:#E2E2E2;">${escHtml(note).replace(/\n/g, "<br>")}</p>` : "";
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    ${firstName ? `<p style="color:#8A8A8C;">${escHtml(firstName)},</p>` : ""}
    <h1 style="font-size:24px;letter-spacing:1px;">\u201E${escHtml(p.name)}\u201D jest ju\u017C dost\u0119pne</h1>
    ${p.subtitle ? `<p style="color:#8A8A8C;line-height:1.7;">${escHtml(p.subtitle)}</p>` : ""}
    ${noteHtml}
    <p style="color:#E2E2E2;">Cena: <span style="color:#C9A24A;">${escHtml(price)}</span></p>
    <p style="margin:28px 0;"><a href="${url}" style="background:#C9A24A;color:#0A0A0B;padding:14px 22px;text-decoration:none;letter-spacing:2px;font-size:13px;">ZOBACZ W SKARBCU</a></p>
    <p style="color:#5C5C5E;font-size:12px;line-height:1.6;">Ten adres by\u0142 na li\u015Bcie oczekuj\u0105cych na \u201E${escHtml(p.name)}\u201D na exmortis.pl. To jedyna wiadomo\u015B\u0107 w tej sprawie \u2014 nie zapisuj\u0119 tego adresu do newslettera.</p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>
  </div>`;
}
var cols = false;
async function ensureWaitlistCols(base44) {
  if (cols) return;
  await runSql(base44, `ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS notified_at timestamptz`);
  await runSql(base44, `CREATE INDEX IF NOT EXISTS waitlist_product_idx ON public.waitlist (product_id)`);
  await runSql(base44, `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS release_at timestamptz, ADD COLUMN IF NOT EXISTS release_note text, ADD COLUMN IF NOT EXISTS release_notify boolean DEFAULT false`);
  cols = true;
}
async function notifyBatch(base44, id, note, limit = 20) {
  await ensureWaitlistCols(base44);
  const [raw] = await runSql(base44, `SELECT id, name, slug, subtitle, active, is_free, COALESCE(status, 'dost\u0119pny') AS status,
      price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
      promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps
    FROM public.products p WHERE id = ${escStr(id)}`, true);
  if (!raw) throw new Error("Nie ma takiego produktu");
  if (!raw.active || raw.status !== "dost\u0119pny") throw new Error("Najpierw ustaw produkt jako aktywny i \u201EDost\u0119pny\u201D \u2014 lista dostaje link do strony, kt\xF3r\u0105 mo\u017Cna kupi\u0107.");
  const p = withSteps(raw);
  const url = `${await loadAppUrl(base44)}/skarbiec/${encodeURIComponent(p.slug)}`;
  const batch = await runSql(base44, `SELECT email, first_name FROM public.waitlist
    WHERE product_id = ${escStr(id)} AND notified_at IS NULL ORDER BY created_at ASC LIMIT ${Number(limit) || 20}`, true);
  let sent = 0, queued = 0, failed = 0;
  for (const r of batch) {
    try {
      const res = await sendMail(base44, { to: r.email, subject: `EXMORTIS \xB7 \u201E${p.name}\u201D jest ju\u017C dost\u0119pne`, html: waitlistHtml(p, r.first_name, note, url), kind: "lista_oczekujacych", ref: id });
      if (res === "wyslany") sent++;
      else queued++;
    } catch {
      failed++;
    }
    await runSql(base44, `UPDATE public.waitlist SET notified_at = now() WHERE product_id = ${escStr(id)} AND email = ${escStr(r.email)}`);
  }
  const [left] = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.waitlist WHERE product_id = ${escStr(id)} AND notified_at IS NULL`, true);
  return { sent, queued, failed, left: left?.n || 0 };
}

// supabase/functions/_shared/seats.ts
var PENDING_MIN = 15;
async function productSeats(base44, ids) {
  const list = [...new Set((ids || []).map((x) => String(x || "")).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
  if (!list.length) return /* @__PURE__ */ new Map();
  const inList = list.map(escStr).join(",");
  const items = `jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END)`;
  const rows = await runSql(
    base44,
    // capacity czytane przez to_jsonb — działa także, zanim kolumna powstała (jak invoice w zamówieniach).
    `SELECT p.id::text AS id, to_jsonb(p)->>'capacity' AS capacity,
        COALESCE(s.n, 0)::int AS sold,
        COALESCE(q.n, 0)::int AS pending
     FROM public.products p
     LEFT JOIN (
       SELECT i->>'product_id' AS pid, SUM(COALESCE((i->>'quantity')::int, 1))::int AS n
       FROM public.orders o, ${items} i
       WHERE o.status = 'COMPLETED' AND i->>'product_id' IN (${inList})
         -- Zam\xF3wienie zwr\xF3cone w ca\u0142o\u015Bci nie zajmuje miejsca (cz\u0119\u015Bciowy zwrot zostaje \u2014 nie sprzedajemy nadkompletu).
         -- Uwaga: zwrot musi by\u0107 wi\u0119kszy od zera \u2014 inaczej zam\xF3wienie darmowe (total 0) wypada\u0142oby z puli sprzedanych.
         AND NOT (COALESCE((to_jsonb(o)->>'refunded_total')::numeric, 0) > 0
                  AND COALESCE((to_jsonb(o)->>'refunded_total')::numeric, 0) >= COALESCE(o.total, 0))
       GROUP BY 1
     ) s ON s.pid = p.id::text
     LEFT JOIN (
       SELECT i->>'product_id' AS pid, SUM(COALESCE((i->>'quantity')::int, 1))::int AS n
       FROM public.orders o, ${items} i
       WHERE o.status IN ('NEW', 'PENDING', 'WAITING_FOR_CONFIRMATION')
         AND COALESCE(o.updated_date, o.created_date) > now() - interval '${PENDING_MIN} minutes'
         AND i->>'product_id' IN (${inList})
       GROUP BY 1
     ) q ON q.pid = p.id::text
     WHERE p.id::text IN (${inList}) AND to_jsonb(p)->>'capacity' IS NOT NULL`,
    true
  );
  const out = /* @__PURE__ */ new Map();
  for (const r of rows || []) {
    const capacity = Number(r.capacity) || 0;
    const sold = Number(r.sold) || 0;
    const pending = Number(r.pending) || 0;
    out.set(String(r.id), { capacity, sold, pending, left: Math.max(0, capacity - sold - pending) });
  }
  return out;
}

// supabase/functions/adminProducts/index.ts
var CATEGORIES = ["ebook", "warsztat", "mentoring", "mastermind", "retreat", "darmowe"];
var STAGES = ["\u015Amier\u0107", "Pr\xF3g", "Powr\xF3t", "Inny", "Wszystkie"];
var FORMS = ["Czytam", "S\u0142ucham", "Ogl\u0105dam", "Uczestnicz\u0119", "Id\u0119 g\u0142\u0119boko"];
var STATUSES = ["dost\u0119pny", "wkr\xF3tce", "ukryty"];
var TYPES = ["pdf", "audio", "wideo", "kurs", "usluga", "karta", "pakiet"];
var SEAT_TYPES = ["kurs", "wideo", "usluga"];
function textVal(v, max) {
  if (v === void 0 || v === null || String(v).trim() === "") return "NULL";
  return escStr(String(v).slice(0, max));
}
function arrVal(v) {
  if (!Array.isArray(v)) return "NULL";
  const items = v.filter((x) => typeof x === "string").slice(0, 50);
  return items.length ? `${escStr(JSON.stringify(items))}::jsonb` : "'[]'::jsonb";
}
function numVal(v) {
  if (v === "" || v === null || v === void 0) return "NULL";
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? String(n) : "NULL";
}
function intVal(v, min, max) {
  if (v === "" || v === null || v === void 0) return "NULL";
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? String(n) : "NULL";
}
function dateVal(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? escStr(v.trim()) : "NULL";
}
function stepsVal(v) {
  const steps = readSteps({ price_steps: v });
  const seen = /* @__PURE__ */ new Set();
  const clean = steps.filter((s) => !seen.has(s.do) && seen.add(s.do)).slice(0, 6);
  if (Array.isArray(v) && v.length && clean.length !== v.length) throw new Error("Drabinka cen: ka\u017Cdy pr\xF3g potrzebuje daty \u201Edo\u201D i ceny (bez powt\xF3rze\u0144 dat, najwy\u017Cej 6 prog\xF3w).");
  return clean.length ? `${escStr(JSON.stringify(clean))}::jsonb` : "NULL";
}
function releaseVal(v) {
  if (!v) return "NULL";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "NULL" : `${escStr(d.toISOString())}::timestamptz`;
}
function optionsVal(p) {
  if (p.product_type !== "karta") return "NULL";
  const raw = Array.isArray(p.price_options) ? p.price_options : String(p.price_options || "").split(/[,;\s]+/);
  const nums = [...new Set(raw.map((x) => Math.round(Number(String(x).replace(",", ".")) * 100) / 100).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
  if (nums.some((n) => n < 10 || n > 5e3)) throw new Error("Kwoty karty: ka\u017Cda od 10 do 5000 z\u0142.");
  if (nums.length > 6) throw new Error("Kwoty karty: najwy\u017Cej 6.");
  return nums.length ? `${escStr(JSON.stringify(nums))}::jsonb` : "NULL";
}
async function bundleVal(base44, p, selfId) {
  if (p.product_type !== "pakiet") return "'[]'::jsonb";
  const raw = Array.isArray(p.bundle_items) ? p.bundle_items : [];
  const ids = [...new Set(raw.map((x) => String(x || "").trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
  if (ids.length < 2) throw new Error("Pakiet: wybierz co najmniej 2 produkty.");
  if (ids.length > 10) throw new Error("Pakiet: sk\u0142adnik\xF3w mo\u017Ce by\u0107 najwy\u017Cej 10.");
  if (selfId && ids.includes(String(selfId))) throw new Error("Pakiet nie mo\u017Ce zawiera\u0107 samego siebie.");
  const rows = await runSql(base44, `SELECT id::text AS id, product_type FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")})`, true);
  if (!rows || rows.length !== ids.length) throw new Error("Pakiet: jeden ze sk\u0142adnik\xF3w nie istnieje.");
  if (rows.some((r) => !DIGITAL.includes(r.product_type))) throw new Error("Pakiet: sk\u0142adnikami mog\u0105 by\u0107 tylko produkty cyfrowe (PDF, audio, wideo, kurs).");
  return `${escStr(JSON.stringify(ids))}::jsonb`;
}
function pickVal(v, allowed) {
  return allowed.includes(v) ? escStr(v) : "NULL";
}
function capacityVal(p) {
  if (!SEAT_TYPES.includes(p.product_type)) return "NULL";
  const v = p.capacity;
  if (v === "" || v === null || v === void 0) return "NULL";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 1e3) throw new Error("Limit miejsc: liczba od 1 do 1000.");
  return String(n);
}
function buildValues(p, name, slug, price, oldPrice, category) {
  return {
    // Pola klasyczne (strona produktu, koszyk)
    name: escStr(name),
    slug: escStr(slug),
    subtitle: textVal(p.subtitle, 300),
    description: textVal(p.description, 3e3),
    long_description: textVal(p.long_description, 6e4),
    price,
    old_price: oldPrice === null ? "NULL" : oldPrice,
    category: escStr(category),
    image_url: textVal(p.image_url, 1e3),
    gallery: arrVal(p.gallery),
    featured: p.featured ? "TRUE" : "FALSE",
    active: p.active === false ? "FALSE" : "TRUE",
    details: arrVal(p.details),
    format: textVal(p.format, 200),
    duration: textVal(p.duration, 200),
    spots: textVal(p.spots, 200),
    // Pola Skarbca (drabina powrotu)
    level: intVal(p.level, 0, 5),
    stage: pickVal(p.stage, STAGES),
    form: pickVal(p.form, FORMS),
    audience_tags: arrVal(p.audience_tags),
    promise: textVal(p.promise, 500),
    for_whom: textVal(p.for_whom, 300),
    format_details: textVal(p.format_details, 200),
    price_start: numVal(p.price_start),
    price_regular: numVal(p.price_regular),
    is_free: p.is_free ? "TRUE" : "FALSE",
    status: p.status && STATUSES.includes(p.status) ? escStr(p.status) : "'dost\u0119pny'",
    promo_end_date: dateVal(p.promo_end_date),
    button_label: textVal(p.button_label, 200),
    checkout_url: textVal(p.checkout_url, 1e3),
    next_step: textVal(p.next_step, 300),
    is_featured: p.is_featured ? "TRUE" : "FALSE",
    sort_order: intVal(p.sort_order, 0, 9999),
    cover_image: textVal(p.cover_image, 1e3),
    file_url: textVal(p.file_url, 1e3),
    product_type: pickVal(p.product_type, TYPES) === "NULL" ? "'usluga'" : pickVal(p.product_type, TYPES),
    access_months: intVal(p.access_months, 1, 120),
    private_file_uri: textVal(p.private_file_uri, 1e3),
    private_file_name: textVal(p.private_file_name, 300),
    price_steps: stepsVal(p.price_steps),
    capacity: capacityVal(p)
  };
}
var SHOP_COLUMNS = `name, slug, subtitle, description, long_description, price, old_price, category, image_url,
  gallery, featured, active, details, format, duration, spots,
  level, stage, form, audience_tags, promise, for_whom, format_details,
  price_start, price_regular, is_free, status, promo_end_date,
  button_label, checkout_url, next_step, is_featured, sort_order, cover_image, file_url,
  product_type, access_months, private_file_uri, private_file_name, price_steps, bundle_items, capacity`;
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    if (body.action === "list") {
      const products = await runSql(
        base44,
        `SELECT p.id, p.name, p.slug, p.subtitle, p.description, p.long_description,
                p.price::float8 AS price, p.old_price::float8 AS old_price, p.category, p.image_url, p.gallery,
                p.featured, p.active, p.details, p.format, p.duration, p.spots,
                p.level, p.stage, p.form, p.audience_tags, p.promise, p.for_whom, p.format_details,
                p.price_start::float8 AS price_start, p.price_regular::float8 AS price_regular,
                p.is_free, p.status, p.promo_end_date::text AS promo_end_date,
                p.button_label, p.checkout_url, p.next_step, p.is_featured, p.sort_order, p.cover_image, p.file_url,
                p.product_type, p.access_months, p.private_file_uri, p.private_file_name, to_jsonb(p)->>'capacity' AS capacity,
                to_jsonb(p)->'price_steps' AS price_steps, to_jsonb(p)->'price_options' AS price_options,
                to_jsonb(p)->'bundle_items' AS bundle_items,
                p.created_date, p.updated_date,
                (SELECT COUNT(*)::int FROM public.waitlist w WHERE w.product_id = p.id) AS waitlist_count
         FROM public.products p
         ORDER BY p.level ASC NULLS LAST, p.sort_order ASC NULLS LAST, p.created_date DESC
         LIMIT 500`,
        true
      );
      const seats = await productSeats(base44, (products || []).map((p) => p.id)).catch(() => /* @__PURE__ */ new Map());
      for (const p of products || []) {
        const s = seats.get(String(p.id));
        if (s) p.seats = s;
      }
      return Response.json({ products });
    }
    if (body.action === "save") {
      const p = body.product || {};
      const name = String(p.name || "").trim().slice(0, 200);
      if (!name) throw new Error("Produkt musi mie\u0107 nazw\u0119");
      let slug = String(p.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
      if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
      if (!slug) slug = `produkt-${Date.now()}`;
      const price = Number(p.price);
      if (!Number.isFinite(price) || price < 0) throw new Error("Niepoprawna cena");
      const oldPrice = p.old_price === "" || p.old_price === null || p.old_price === void 0 ? null : Number(p.old_price);
      if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) throw new Error("Niepoprawna cena przekre\u015Blona");
      const category = CATEGORIES.includes(p.category) ? p.category : "ebook";
      const optionsSql = optionsVal(p);
      const bundleSql = await bundleVal(base44, p, p.id);
      const v = { ...buildValues(p, name, slug, price, oldPrice, category), bundle_items: bundleSql };
      await runSql(
        base44,
        `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS file_url text, ADD COLUMN IF NOT EXISTS price_steps jsonb, ADD COLUMN IF NOT EXISTS available_at timestamptz, ADD COLUMN IF NOT EXISTS bundle_items jsonb DEFAULT '[]', ADD COLUMN IF NOT EXISTS capacity int`
      );
      if (p.id) {
        await runSql(
          base44,
          `UPDATE public.products SET
             name = ${v.name}, slug = ${v.slug}, subtitle = ${v.subtitle}, description = ${v.description},
             long_description = ${v.long_description}, price = ${v.price}, old_price = ${v.old_price},
             category = ${v.category}, image_url = ${v.image_url}, gallery = ${v.gallery},
             featured = ${v.featured}, active = ${v.active}, details = ${v.details},
             format = ${v.format}, duration = ${v.duration}, spots = ${v.spots},
             level = ${v.level}, stage = ${v.stage}, form = ${v.form}, audience_tags = ${v.audience_tags},
             promise = ${v.promise}, for_whom = ${v.for_whom}, format_details = ${v.format_details},
             price_start = ${v.price_start}, price_regular = ${v.price_regular}, is_free = ${v.is_free},
             status = ${v.status}, promo_end_date = ${v.promo_end_date},
             button_label = ${v.button_label}, checkout_url = ${v.checkout_url}, next_step = ${v.next_step},
             is_featured = ${v.is_featured}, sort_order = ${v.sort_order}, cover_image = ${v.cover_image},
             file_url = ${v.file_url},
             product_type = ${v.product_type}, access_months = ${v.access_months},
             private_file_uri = ${v.private_file_uri}, private_file_name = ${v.private_file_name},
             price_steps = ${v.price_steps},
             bundle_items = ${v.bundle_items},
             capacity = ${v.capacity},
             -- chwila premiery (\u201Ewkr\xF3tce\u201D/ukryty \u2192 \u201Edost\u0119pny\u201D) \u2014 dla powiadomie\u0144 klient\xF3w o nowo\u015Bciach
             available_at = CASE WHEN ${v.status} = 'dost\u0119pny' AND COALESCE(status, 'dost\u0119pny') <> 'dost\u0119pny' THEN now() ELSE available_at END,
             updated_date = now()
           WHERE id = ${escStr(String(p.id))}`
        );
      } else {
        await runSql(
          base44,
          `INSERT INTO public.products
             (id, ${SHOP_COLUMNS}, created_by_id)
           VALUES (gen_random_uuid()::text, ${v.name}, ${v.slug}, ${v.subtitle}, ${v.description}, ${v.long_description}, ${v.price}, ${v.old_price},
                   ${v.category}, ${v.image_url}, ${v.gallery}, ${v.featured}, ${v.active}, ${v.details},
                   ${v.format}, ${v.duration}, ${v.spots},
                   ${v.level}, ${v.stage}, ${v.form}, ${v.audience_tags}, ${v.promise}, ${v.for_whom}, ${v.format_details},
                   ${v.price_start}, ${v.price_regular}, ${v.is_free}, ${v.status}, ${v.promo_end_date},
                   ${v.button_label}, ${v.checkout_url}, ${v.next_step}, ${v.is_featured}, ${v.sort_order}, ${v.cover_image},
                   ${v.file_url}, ${v.product_type}, ${v.access_months}, ${v.private_file_uri}, ${v.private_file_name},
                   ${v.price_steps}, ${v.bundle_items}, ${v.capacity}, ${escStr(user.id)})`
        );
        await runSql(
          base44,
          `UPDATE public.products SET available_at = now() WHERE slug = ${v.slug} AND available_at IS NULL AND COALESCE(status, 'dost\u0119pny') = 'dost\u0119pny' AND active = TRUE`
        );
      }
      await ensureWaitlistCols(base44);
      const rel = p.status === "wkr\xF3tce" ? releaseVal(p.release_at) : "NULL";
      await runSql(base44, `UPDATE public.products SET release_at = ${rel}, release_note = ${rel === "NULL" ? "NULL" : textVal(p.release_note, 1500)} WHERE slug = ${v.slug}`);
      await runSql(base44, `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_options jsonb`);
      await runSql(base44, `UPDATE public.products SET price_options = ${optionsSql} WHERE slug = ${v.slug}`);
      await recordPrices(base44, true).catch(() => {
      });
      await clearSnap(base44, "products:").catch(() => {
      });
      return Response.json({ ok: true });
    }
    if (body.action === "waitlist") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Brak produktu");
      await ensureWaitlistCols(base44);
      const rows = await runSql(base44, `SELECT email, first_name, created_at::text AS created_at, notified_at::text AS notified_at
        FROM public.waitlist WHERE product_id = ${escStr(id)} ORDER BY created_at ASC LIMIT 5000`, true);
      return Response.json({ rows });
    }
    if (body.action === "waitlist_notify") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Brak produktu");
      await requireMail(base44);
      return Response.json(await notifyBatch(base44, id, String(body.note || "").slice(0, 1500).trim()));
    }
    if (body.action === "cover_ai") {
      const name = String(body.name || "").slice(0, 200).trim();
      if (!name) throw new Error("Najpierw wpisz nazw\u0119 produktu");
      const about = String(body.about || "").slice(0, 600);
      const extra = String(body.hint || "").slice(0, 400);
      const prompt = `Square cover artwork for a product called "${name}" (${String(body.category || "").slice(0, 40)}). ${about} ${extra}
Style: brutalist sanctum \u2014 obsidian black, raw stone and concrete textures, dramatic chiaroscuro lighting, accents of aged gold (#C9A24A) and deep burgundy (#BC1E22). Symbolic, cinematic, minimal composition, theme of rebirth and returning to life. Absolutely no text, letters, logos or watermarks.`;
      const r = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
      return Response.json({ url: r.url });
    }
    if (body.action === "delete") {
      const id = String(body.id || "");
      if (!id) throw new Error("Brak id produktu");
      await runSql(base44, `DELETE FROM public.products WHERE id = ${escStr(id)}`);
      await clearSnap(base44, "products:").catch(() => {
      });
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
