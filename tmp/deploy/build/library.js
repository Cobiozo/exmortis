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

// supabase/functions/_shared/libraryAccess.ts
var DEFAULT_SETTINGS = { library_mode: "off", messages_mode: "off", email_notify: false, whatsapp: null, space_limit_mb: 5120, video_domains: [] };
var CFG = null;
var CFG_AT = 0;
async function libSettings(base44, fresh = false) {
  if (!fresh && CFG && Date.now() - CFG_AT < 3e4) return CFG;
  const s = await rpc(base44, "mb_lib_settings", {});
  CFG = s && s.library_mode ? s : { ...DEFAULT_SETTINGS };
  CFG_AT = Date.now();
  return CFG;
}
function modeVisible(mode, me2) {
  if (mode === "on") return true;
  if (mode === "admin") return me2 && me2.role === "admin";
  return false;
}
var clientEmail = (me2) => String(me2 && me2.email || "").trim().toLowerCase();
function firstName(me2) {
  const a = String(me2 && me2.imie || "").trim();
  if (a) return a;
  const b = String(me2 && me2.full_name || "").trim();
  return b ? b.split(/\s+/)[0] : "";
}
var CONTACT_FALLBACK = "kontakt@exmortis.pl";
var footerData = (s, firma) => ({
  mailto: `mailto:${String(firma && firma.email || "").trim() || CONTACT_FALLBACK}`,
  whatsapp: s && s.whatsapp ? s.whatsapp : null,
  crisis: "Je\u015Bli jeste\u015B w kryzysie: 116 123 \xB7 800 70 2222 (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 112.",
  reply: "Na t\u0119 wiadomo\u015B\u0107 odpowiesz e-mailem lub na WhatsAppie."
});

// supabase/functions/_shared/librarySanitize.ts
var ALLOWED = /* @__PURE__ */ new Set(["p", "br", "strong", "em", "ul", "ol", "li", "h2", "h3", "blockquote", "a"]);
var VOID = /* @__PURE__ */ new Set(["br"]);
var DROP = [
  "script",
  "style",
  "iframe",
  "svg",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "link",
  "meta",
  "noscript",
  "template",
  "math",
  "video",
  "audio",
  "source",
  "img",
  "base",
  "applet",
  "frame",
  "frameset"
];
var NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", colon: ":", tab: "	", newline: "\n", sol: "/" };
function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    const key = String(e);
    if (key[0] === "#") {
      const hex = key[1] === "x" || key[1] === "X";
      const n = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(n) && n > 0 && n < 1114112 ? String.fromCodePoint(n) : m;
    }
    const v = NAMED[key.toLowerCase()];
    return v === void 0 ? m : v;
  });
}
function safeHref(raw) {
  const s = decodeEntities(String(raw || "")).replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u2000-\u200f\u2028\u2029]/g, "").trim();
  if (/^https:\/\/[^\s]+$/i.test(s)) return s;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s]+$/i.test(s)) return s;
  return null;
}
function fixQuillLists(s) {
  const TOKEN = /<\/?ol\b[^>]*>|<li\b[^>]*>/gi;
  const parts = [];
  const open = [];
  let last = 0;
  let m;
  while ((m = TOKEN.exec(s)) !== null) {
    parts.push(s.slice(last, m.index));
    last = TOKEN.lastIndex;
    const t = m[0];
    if (/^<li\b/i.test(t)) {
      if (/data-list\s*=\s*["']?bullet/i.test(t)) {
        const top = open[open.length - 1];
        if (top) parts[top.idx] = "<ul>";
      }
      parts.push(t);
    } else if (/^<\/ol/i.test(t)) {
      const top = open.pop();
      parts.push(top && parts[top.idx] === "<ul>" ? "</ul>" : "</ol>");
    } else {
      open.push({ idx: parts.length });
      parts.push("<ol>");
    }
  }
  parts.push(s.slice(last));
  return parts.join("");
}
function sanitizeHtml(input) {
  let s = String(input == null ? "" : input);
  s = fixQuillLists(s);
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  for (const t of DROP) {
    s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, "gi"), "");
    s = s.replace(new RegExp(`<\\/?${t}\\b[^>]*>`, "gi"), "");
  }
  const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const escText = (t) => t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rebuild = (m, name, attrs) => {
    const tag = String(name).toLowerCase();
    if (!ALLOWED.has(tag)) return "";
    const closing = m.slice(0, 2) === "</";
    if (tag === "a") {
      if (closing) return "</a>";
      const h = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || "");
      const raw = h ? h[2] !== void 0 ? h[2] : h[3] !== void 0 ? h[3] : h[4] || "" : "";
      const href = safeHref(raw);
      if (!href) return "<a>";
      return `<a href="${href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" target="_blank" rel="noopener noreferrer">`;
    }
    if (VOID.has(tag)) return closing ? "" : `<${tag}>`;
    return closing ? `</${tag}>` : `<${tag}>`;
  };
  let out = "";
  let last = 0;
  let mt;
  while ((mt = TAG.exec(s)) !== null) {
    out += escText(s.slice(last, mt.index)) + rebuild(mt[0], mt[1], mt[2]);
    last = TAG.lastIndex;
  }
  out += escText(s.slice(last));
  s = out;
  return s.trim();
}

// supabase/functions/_shared/libraryMedia.ts
var VIMEO_ID = /^\d{6,12}$/;
var VIMEO_HASH = /^[0-9a-f]{6,20}$/;
var MAX_BYTES = { PDF: 100 * 1024 * 1024, AUDIO: 500 * 1024 * 1024, WIDEO: 500 * 1024 * 1024 };
var ALLOWED_EXT = { PDF: ["pdf"], AUDIO: ["mp3", "m4a"], WIDEO: ["mp4", "m4v", "webm"] };
var VIDEO_FILE_EXT = ALLOWED_EXT.WIDEO;
function validHost(value) {
  const h = String(value || "").trim().toLowerCase();
  if (!h || h.length > 253) return null;
  if (/[\/\\:@?#\s]/.test(h)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;
  if (h === "localhost" || h.endsWith(".localhost")) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h)) return null;
  return h;
}
var videoDomains = (list) => [...new Set((Array.isArray(list) ? list : []).map(validHost).filter(Boolean))];
function normalizeServerVideo(raw, domains) {
  const s = String(raw || "").trim();
  if (!/^https:\/\//i.test(s) || s.length > 500) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.username || u.password || u.port) return null;
  const host = validHost(u.hostname);
  if (!host) return null;
  const allowed = videoDomains(domains);
  if (!allowed.includes(host)) return null;
  const ext = extOf(u.pathname);
  if (!VIDEO_FILE_EXT.includes(ext)) return null;
  return u.toString();
}
function embedUrl(provider, id) {
  if (provider === "youtube") return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`;
  if (provider === "vimeo") {
    const [vid, h] = String(id || "").split(":");
    if (!VIMEO_ID.test(vid) || h && !VIMEO_HASH.test(h)) return null;
    return `https://player.vimeo.com/video/${vid}${h ? `?h=${h}` : ""}`;
  }
  if (provider === "bunny") return `https://iframe.mediadelivery.net/embed/${id}`;
  return null;
}
function extOf(name) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || "").trim());
  return m ? m[1].toLowerCase() : "";
}
async function sha256hex(input) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(input)));
  let out = "";
  for (const x of new Uint8Array(buf)) out += x.toString(16).padStart(2, "0");
  return out;
}

// supabase/functions/_shared/settings.ts
var DEFAULT_APP_URL = globalThis.Deno?.env?.get?.("APP_URL") || "";
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
import { setImmediate as nodeSetImmediate2, clearImmediate as nodeClearImmediate2 } from "node:timers";
var g2 = globalThis;
if (typeof g2.setImmediate !== "function") g2.setImmediate = nodeSetImmediate2;
if (typeof g2.clearImmediate !== "function") g2.clearImmediate = nodeClearImmediate2;

// supabase/functions/_shared/libraryNotify.ts
function renderBody(html, name) {
  const n = String(name || "").trim();
  const token = /\{\s*imi[ęe]\s*\}/gi;
  let out = String(html == null ? "" : html);
  if (n) {
    out = out.replace(token, n);
  } else {
    out = out.replace(
      new RegExp(`(^|>)(\\s*)${token.source}\\s*([,.!?;:]+\\s*)?([a-z\u0105\u0107\u0119\u0142\u0144\xF3\u015B\u017A\u017C])?`, "gi"),
      (m, lead, sp, punct, ch) => lead + (lead === ">" ? "" : sp) + String(ch || "").toUpperCase()
    ).replace(token, "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").replace(/\s+(<)/g, "$1");
}

// supabase/functions/_shared/libraryView.ts
function itemOf(m) {
  const base = {
    id: m.id,
    title: m.title,
    kind: m.kind,
    description: m.description || null,
    duration_s: m.duration_s || null,
    pages: m.pages || null,
    stage: m.stage || null,
    tags: m.tags || [],
    note: m.note || null,
    visible_from: m.visible_from || null,
    visible_to: m.visible_to || null,
    collection_id: m.collection_id || null,
    position: m.position || 0,
    opened_at: m.opened_at || null,
    completed_at: m.completed_at || null,
    has_file: !!m.has_file,
    allow_download: !!m.allow_download
  };
  if (m.kind === "WIDEO") base.embed = embedUrl(m.video_provider, m.video_id);
  if (m.kind === "LINK") base.url = m.external_url || null;
  if (m.kind === "TEKST") base.text = sanitizeHtml(m.body_html);
  return base;
}
var EMPTY_COUNTS = { AUDIO: 0, WIDEO: 0, PDF: 0, LINK: 0, TEKST: 0 };
function libraryFromRpc(raw) {
  const items = ((raw || {}).items || []).map(itemOf);
  const byId = new Map(items.map((i) => [i.id, i]));
  const collections = ((raw || {}).collections || []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description || null,
    items: (c.items || []).map((x) => byId.get(x.id)).filter(Boolean).sort((a, b) => a.position - b.position)
  }));
  return {
    items,
    collections,
    counts: Object.assign({ ...EMPTY_COUNTS }, (raw || {}).counts || {}),
    unopened: (raw || {}).unopened || 0
  };
}
function messagesFromRpc(raw, me2) {
  const name = firstName(me2);
  const items = ((raw || {}).items || []).map((m) => ({
    id: m.id,
    title: m.title || null,
    text: sanitizeHtml(renderBody(m.body_html, name)),
    sent_at: m.sent_at || null,
    read_at: m.read_at || null,
    attachments: (m.attachments || []).map((a) => ({
      material_id: a.material_id || null,
      collection_id: a.collection_id || null,
      material_title: a.material_title || null,
      material_kind: a.material_kind || null,
      collection_title: a.collection_title || null,
      position: a.position || 0
    }))
  }));
  return { items, unread: (raw || {}).unread || 0 };
}
async function libraryData(base44, email, admin, preview) {
  const raw = await rpc(base44, "mb_client_library", { p_email: String(email || ""), p_admin: !!admin, p_preview: !!preview });
  return libraryFromRpc(raw);
}
async function messagesData(base44, email, me2, preview) {
  const raw = await rpc(base44, "mb_client_messages", { p_email: String(email || ""), p_preview: !!preview });
  return messagesFromRpc(raw, me2);
}
async function bundleData(base44, email, me2, admin, preview) {
  const raw = await rpc(base44, "mb_client_bundle", { p_email: String(email || ""), p_admin: !!admin, p_preview: !!preview });
  const r = raw || {};
  return {
    library_mode: r.library_mode || "off",
    messages_mode: r.messages_mode || "off",
    whatsapp: r.whatsapp || null,
    library: r.library ? libraryFromRpc(r.library) : null,
    messages: r.messages ? messagesFromRpc(r.messages, me2) : null
  };
}

// supabase/functions/library/index.ts
var NOT_FOUND = () => Response.json({ error: "Nie znaleziono" }, { status: 404 });
var uuid = (v) => /^[0-9a-fA-F-]{36}$/.test(String(v || "")) ? String(v) : null;
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const [me2, s, body] = await Promise.all([
      base44.auth.me().catch(() => null),
      libSettings(base44).catch(() => null),
      req.json().catch(() => ({}))
    ]);
    if (!me2) return Response.json({ error: "Zaloguj si\u0119" }, { status: 401 });
    if (me2.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 });
    if (!s) return Response.json({ error: "Co\u015B posz\u0142o nie tak. Spr\xF3buj ponownie." }, { status: 503 });
    const a = body.action;
    const admin = me2.role === "admin";
    const lib = modeVisible(s.library_mode, me2);
    const msg = modeVisible(s.messages_mode, me2);
    const email = clientEmail(me2);
    const preview = body.preview === true && admin;
    if (a === "bundle" || a === "config") {
      if (!lib && !msg) return Response.json({ library: false, messages: false });
      const [d, f] = await Promise.all([
        bundleData(base44, email, me2, admin, preview).catch(() => null),
        getSettingsFast(base44, ["firma"]).catch(() => ({}))
      ]);
      const out = {
        library: lib,
        messages: msg,
        email,
        library_mode: d && d.library_mode || s.library_mode,
        messages_mode: d && d.messages_mode || s.messages_mode,
        footer: footerData(s, f && f.firma)
      };
      if (a === "bundle") {
        out.library_data = d ? d.library : null;
        out.messages_data = d ? d.messages : null;
      }
      return Response.json(out);
    }
    if (!lib && !msg) return NOT_FOUND();
    if (a === "my_library") {
      if (!lib) return NOT_FOUND();
      return Response.json(await libraryData(base44, email, admin, preview));
    }
    if (a === "my_messages" || a === "unread") {
      if (!msg) return NOT_FOUND();
      const d = await messagesData(base44, email, me2, preview);
      if (a === "unread") return Response.json({ unread: d.unread, latest: d.items.find((m) => !m.read_at) || null });
      return Response.json(d);
    }
    if (a === "open_material" || a === "refresh_link") {
      if (!lib) return NOT_FOUND();
      const id = uuid(body.material_id);
      if (!id) return NOT_FOUND();
      const refreshing = a === "refresh_link";
      const rateKey = refreshing ? await sha256hex(`${email}|${id}`) : null;
      const r = await rpc(base44, "mb_client_open", {
        p_email: email,
        p_admin: admin,
        p_material_id: id,
        p_mark_opened: !refreshing && !preview,
        p_rate_key: rateKey,
        p_limit: 30
      });
      const status = r && r.status || "denied";
      if (status === "denied") return NOT_FOUND();
      if (status === "rate") {
        return Response.json({ error: "Zbyt wiele od\u015Bwie\u017Ce\u0144. Spr\xF3buj ponownie za chwil\u0119." }, { status: 429 });
      }
      const m = r.material || {};
      let url = null;
      let ttl = null;
      const videoFile = m.kind === "WIDEO" && m.video_provider === "plik";
      if (m.kind === "PDF" || m.kind === "AUDIO" || videoFile) {
        ttl = m.kind === "PDF" ? 600 : 3600;
        const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: m.file_key, expires_in: ttl });
        url = signed && signed.signed_url ? signed.signed_url : null;
        if (!url) return Response.json({ error: "Nie uda\u0142o si\u0119 przygotowa\u0107 pliku." }, { status: 502 });
      }
      const out = { id: m.id, title: m.title, kind: m.kind, url, expires_in: ttl, allow_download: !!m.allow_download };
      if (m.kind === "WIDEO") out.embed = embedUrl(m.video_provider, m.video_id);
      if (m.kind === "WIDEO" && m.video_provider === "serwer") {
        const ok = normalizeServerVideo(m.server_url, s.video_domains);
        if (!ok) return Response.json({ error: "Adres tego pliku nie jest ju\u017C dozwolony." }, { status: 502 });
        out.url = ok;
        out.server = true;
      }
      if (m.kind === "WIDEO" && videoFile) out.file = true;
      if (m.kind === "TEKST") out.text = sanitizeHtml(m.body_html);
      if (m.kind === "LINK") out.external = m.external_url || null;
      return Response.json(out);
    }
    if (a === "mark_completed") {
      if (!lib) return NOT_FOUND();
      const id = uuid(body.material_id);
      if (!id) return NOT_FOUND();
      const done = body.completed === true;
      const ok = await rpc(base44, "mb_material_complete", { p_email: email, p_admin: admin, p_material_id: id, p_completed: done });
      if (!ok) return NOT_FOUND();
      return Response.json({ ok: true, completed_at: done ? (/* @__PURE__ */ new Date()).toISOString() : null });
    }
    if (a === "read_message" || a === "hide_message") {
      if (!msg) return NOT_FOUND();
      const id = uuid(body.message_id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_message_flag", { p_email: email, p_message_id: id, p_hidden: a === "hide_message" });
      if (!ok) return NOT_FOUND();
      return Response.json({ ok: true });
    }
    return NOT_FOUND();
  } catch (e) {
    console.error("library:", String(e && e.message ? e.message : e).slice(0, 300));
    return Response.json({ error: "Co\u015B posz\u0142o nie tak. Spr\xF3buj ponownie." }, { status: 500 });
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
