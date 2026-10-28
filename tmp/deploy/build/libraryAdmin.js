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

// supabase/functions/_shared/librarySchema.ts
var SCHEMA_SQL = `
-- ============ 1. USTAWIENIA MODU\u0141U ============
-- Dwa niezale\u017Cne prze\u0142\u0105czniki tr\xF3jstanowe (domy\u015Blnie \u201Eoff"), pr\xF3g przestrzeni i adres WhatsApp.
CREATE TABLE IF NOT EXISTS public.mb_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  library_mode text NOT NULL DEFAULT 'off' CHECK (library_mode IN ('off','admin','on')),
  messages_mode text NOT NULL DEFAULT 'off' CHECK (messages_mode IN ('off','admin','on')),
  email_notify boolean NOT NULL DEFAULT false,
  whatsapp text CHECK (whatsapp IS NULL OR whatsapp ~ '^https://wa\\.me/[0-9]{6,20}$'),
  space_limit_mb int NOT NULL DEFAULT 5120 CHECK (space_limit_mb BETWEEN 64 AND 1048576),
  tick_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.mb_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ 2. MATERIA\u0141Y ============
-- Plik trzymany wy\u0142\u0105cznie w prywatnym magazynie; w bazie sam klucz (bez nazw i e-maili w \u015Bcie\u017Cce).
-- Adresy wideo zapisujemy jako dostawc\u0119 + znormalizowany identyfikator, nigdy jako surowy adres.
CREATE TABLE IF NOT EXISTS public.mb_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  kind text NOT NULL CHECK (kind IN ('AUDIO','WIDEO','PDF','LINK','TEKST')),
  file_key text CHECK (file_key IS NULL OR (length(file_key) <= 500 AND position('@' in file_key) = 0)),
  file_name text CHECK (file_name IS NULL OR length(file_name) <= 300),
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  file_version int NOT NULL DEFAULT 1 CHECK (file_version >= 1),
  prev_file_key text CHECK (prev_file_key IS NULL OR (length(prev_file_key) <= 500 AND position('@' in prev_file_key) = 0)),
  prev_file_name text CHECK (prev_file_name IS NULL OR length(prev_file_name) <= 300),
  prev_file_size bigint CHECK (prev_file_size IS NULL OR prev_file_size >= 0),
  pdf_js_warning boolean NOT NULL DEFAULT false,
  external_url text CHECK (external_url IS NULL OR external_url ~ '^https://'),
  video_provider text CHECK (video_provider IS NULL OR video_provider IN ('youtube','vimeo','bunny')),
  video_id text CHECK (video_id IS NULL OR length(video_id) <= 120),
  body_html text CHECK (body_html IS NULL OR length(body_html) <= 20000),
  stage text CHECK (stage IS NULL OR length(stage) <= 60),
  tags text[] NOT NULL DEFAULT '{}',
  duration_s int CHECK (duration_s IS NULL OR duration_s >= 0),
  pages int CHECK (pages IS NULL OR pages >= 0),
  allow_download boolean NOT NULL DEFAULT false,
  source text CHECK (source IS NULL OR length(source) <= 200),
  deleted_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Rodzaj decyduje, sk\u0105d pochodzi tre\u015B\u0107: plik, adres, odtwarzacz albo tekst \u2014 nigdy dwa naraz.
  CHECK (CASE kind
    WHEN 'AUDIO' THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'PDF'   THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'WIDEO' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NOT NULL AND video_id IS NOT NULL AND body_html IS NULL
    WHEN 'LINK'  THEN file_key IS NULL AND external_url IS NOT NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'TEKST' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NOT NULL
  END)
);
CREATE INDEX IF NOT EXISTS mb_materials_live ON public.mb_materials (kind, created_at DESC) WHERE deleted_at IS NULL;

-- ============ 3. KOLEKCJE ============
CREATE TABLE IF NOT EXISTS public.mb_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  sort int NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.mb_collection_items (
  collection_id uuid NOT NULL REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, material_id)
);
CREATE INDEX IF NOT EXISTS mb_collection_items_order ON public.mb_collection_items (collection_id, position);

-- ============ 4. GRUPY = ZNACZNIKI ============
CREATE TABLE IF NOT EXISTS public.mb_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  color text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  kind text NOT NULL DEFAULT 'RECZNA' CHECK (kind IN ('RECZNA','AUTOMATYCZNA')),
  rule jsonb,
  created_by text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'RECZNA' AND rule IS NULL)
      OR (kind = 'AUTOMATYCZNA' AND rule IS NOT NULL AND rule->>'typ' IN ('produkt','aktywny_pakiet')))
);
-- Dopisane w 1B-1: grupy startowe czekaj\u0105 na akceptacj\u0119 (NULL = \u201Edo akceptacji").
ALTER TABLE public.mb_groups ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
CREATE TABLE IF NOT EXISTS public.mb_group_members (
  group_id uuid NOT NULL REFERENCES public.mb_groups(id) ON DELETE CASCADE,
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  added_by text,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, client_email)
);
CREATE INDEX IF NOT EXISTS mb_group_members_email ON public.mb_group_members (client_email);

-- ============ 5. PRZYDZIA\u0141Y ============
-- Widoczno\u015B\u0107 liczona przy ka\u017Cdym otwarciu, bez kopiowania wierszy na osoby.
-- TYLKO_OBECNI zamra\u017Ca list\u0119 cz\u0142onk\xF3w na dzie\u0144 przydzia\u0142u (snapshot_emails).
CREATE TABLE IF NOT EXISTS public.mb_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('osoba','grupa')),
  target_email text CHECK (target_email IS NULL OR (target_email = lower(btrim(target_email)) AND length(target_email) <= 320)),
  group_id uuid REFERENCES public.mb_groups(id) ON DELETE CASCADE,
  group_mode text CHECK (group_mode IS NULL OR group_mode IN ('OBECNI_I_PRZYSZLI','TYLKO_OBECNI')),
  snapshot_emails text[] NOT NULL DEFAULT '{}',
  exceptions_add text[] NOT NULL DEFAULT '{}',
  exceptions_drop text[] NOT NULL DEFAULT '{}',
  note text CHECK (note IS NULL OR length(note) <= 2000),
  visible_from timestamptz,
  visible_to timestamptz,
  notified_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK ((material_id IS NOT NULL) <> (collection_id IS NOT NULL)),
  CHECK ((target_kind = 'osoba' AND target_email IS NOT NULL AND group_id IS NULL AND group_mode IS NULL)
      OR (target_kind = 'grupa' AND group_id IS NOT NULL AND target_email IS NULL AND group_mode IS NOT NULL)),
  CHECK (visible_to IS NULL OR visible_from IS NULL OR visible_to > visible_from)
);
CREATE INDEX IF NOT EXISTS mb_assign_email ON public.mb_assignments (target_email) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_group ON public.mb_assignments (group_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_material ON public.mb_assignments (material_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_collection ON public.mb_assignments (collection_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_pending ON public.mb_assignments (created_at) WHERE notified_at IS NULL AND revoked_at IS NULL;

-- ============ 6. STAN U KLIENTA ============
CREATE TABLE IF NOT EXISTS public.mb_material_state (
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  material_id uuid NOT NULL REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  opened_at timestamptz,
  completed_at timestamptz,
  PRIMARY KEY (client_email, material_id)
);
CREATE INDEX IF NOT EXISTS mb_state_material ON public.mb_material_state (material_id);

-- ============ 7. WIADOMO\u015ACI (jednostronne) ============
-- target = definicja odbiorc\xF3w; lista odbiorc\xF3w powstaje dopiero w chwili wysy\u0142ki.
-- WYSYLANIE = wiadomo\u015B\u0107 przej\u0119ta atomowo przez zadanie (blokada przed podw\xF3jn\u0105 wysy\u0142k\u0105).
CREATE TABLE IF NOT EXISTS public.mb_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text CHECK (title IS NULL OR length(title) <= 200),
  body_html text NOT NULL CHECK (length(body_html) <= 20000),
  status text NOT NULL DEFAULT 'SZKIC' CHECK (status IN ('SZKIC','ZAPLANOWANA','WYSYLANIE','WYSLANA','WYCOFANA')),
  send_at timestamptz,
  email_mode text NOT NULL DEFAULT 'BRAK' CHECK (email_mode IN ('BRAK','POWIADOMIENIE','PELNA')),
  attached_material_id uuid REFERENCES public.mb_materials(id) ON DELETE SET NULL,
  attached_collection_id uuid REFERENCES public.mb_collections(id) ON DELETE SET NULL,
  target jsonb,
  recipient_count int NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  idem_key text UNIQUE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  withdrawn_at timestamptz,
  CHECK (status <> 'ZAPLANOWANA' OR send_at IS NOT NULL),
  CHECK (attached_material_id IS NULL OR attached_collection_id IS NULL)
);
CREATE INDEX IF NOT EXISTS mb_messages_due ON public.mb_messages (send_at) WHERE status = 'ZAPLANOWANA';
CREATE INDEX IF NOT EXISTS mb_messages_status ON public.mb_messages (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mb_message_recipients (
  message_id uuid NOT NULL REFERENCES public.mb_messages(id) ON DELETE CASCADE,
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  hidden_at timestamptz,
  PRIMARY KEY (message_id, client_email)
);
CREATE INDEX IF NOT EXISTS mb_rcpt_email ON public.mb_message_recipients (client_email, delivered_at DESC);
CREATE INDEX IF NOT EXISTS mb_rcpt_read ON public.mb_message_recipients (message_id, read_at);

CREATE TABLE IF NOT EXISTS public.mb_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  title text CHECK (title IS NULL OR length(title) <= 200),
  body_html text NOT NULL CHECK (length(body_html) <= 20000),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 8. LIMIT WYDAWANIA LINK\xD3W ============
CREATE TABLE IF NOT EXISTS public.mb_rate (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL CHECK (bucket IN ('link')),
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mb_rate_key ON public.mb_rate (key_hash, at);

-- ============ 9. HISTORIA ZMIAN (tylko dopisywanie) ============
CREATE TABLE IF NOT EXISTS public.mb_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  object_type text,
  object_id text,
  summary text CHECK (summary IS NULL OR length(summary) <= 500),
  anonymized boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS mb_log_at ON public.mb_log (at DESC);

DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mb_log_maint') THEN
    CREATE ROLE mb_log_maint NOLOGIN;
  END IF;
END $r$;
-- mb_log ma w\u0142\u0105czone RLS bez polityk, wi\u0119c rola nieb\u0119d\u0105ca w\u0142a\u015Bcicielem tabeli nie widzi
-- ani jednego wiersza. Bez tej linii UPDATE w funkcji czyszcz\u0105cej i anonimizuj\u0105cej cicho nic nie robi.
ALTER ROLE mb_log_maint BYPASSRLS;
GRANT USAGE ON SCHEMA public TO mb_log_maint;
-- CREATE na schemacie jest potrzebne wy\u0142\u0105cznie po to, by przekaza\u0107 funkcj\u0119 czyszcz\u0105c\u0105 na w\u0142asno\u015B\u0107 tej roli.
GRANT CREATE ON SCHEMA public TO mb_log_maint;
GRANT SELECT, UPDATE, DELETE ON public.mb_log TO mb_log_maint;

CREATE OR REPLACE FUNCTION public.mb_log_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $g$
BEGIN
  IF current_user = 'mb_log_maint' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'mb_log: wpisy mozna tylko dopisywac';
END $g$;
DROP TRIGGER IF EXISTS mb_log_no_change ON public.mb_log;
CREATE TRIGGER mb_log_no_change BEFORE UPDATE OR DELETE ON public.mb_log FOR EACH ROW EXECUTE FUNCTION public.mb_log_guard();
DROP TRIGGER IF EXISTS mb_log_no_truncate ON public.mb_log;
CREATE TRIGGER mb_log_no_truncate BEFORE TRUNCATE ON public.mb_log FOR EACH STATEMENT EXECUTE FUNCTION public.mb_log_guard();

-- Historia zmian trzymana 12 miesi\u0119cy.
CREATE OR REPLACE FUNCTION public.mb_log_purge() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $p$
DECLARE n int;
BEGIN
  DELETE FROM public.mb_log WHERE at < now() - interval '12 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $p$;
ALTER FUNCTION public.mb_log_purge() OWNER TO mb_log_maint;

-- RODO: anonimizacja wpis\xF3w historii dotycz\u0105cych danej osoby (bez usuwania historii).
-- W\u0142a\u015Bcicielem jest mb_log_maint \u2014 tylko ta rola mo\u017Ce zmienia\u0107 wpisy (trigger mb_log_guard).
CREATE OR REPLACE FUNCTION public.mb_log_anonymize(p_email text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $an$
DECLARE n int;
BEGIN
  UPDATE public.mb_log SET
    actor = CASE WHEN lower(actor) = lower(btrim(COALESCE(p_email,''))) THEN '[usuniete]' ELSE actor END,
    summary = regexp_replace(COALESCE(summary,''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+.[A-Za-z]{2,}', '[usuniete]', 'g'),
    anonymized = true
  WHERE lower(actor) = lower(btrim(COALESCE(p_email,'')))
     OR COALESCE(summary,'') ILIKE '%' || lower(btrim(COALESCE(p_email,''))) || '%';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $an$;
ALTER FUNCTION public.mb_log_anonymize(text) OWNER TO mb_log_maint;
REVOKE CREATE ON SCHEMA public FROM mb_log_maint;

-- ============ 9b. GRUPY AUTOMATYCZNE (jedno miejsce prawdy) ============
-- Cz\u0142onkostwo grupy automatycznej liczone wy\u0142\u0105cznie ODCZYTEM istniej\u0105cych danych:
-- op\u0142acone zam\xF3wienia (orders) i aktywne pakiety (bk_packages). Zero zmian w zakupach i rezerwacjach.
-- Ta sama regu\u0142a obs\u0142uguje widoczno\u015B\u0107 materia\u0142\xF3w, list\u0119 odbiorc\xF3w wiadomo\u015Bci i podgl\u0105d w panelu.
CREATE OR REPLACE FUNCTION public.mb_auto_group_emails(p_rule jsonb)
RETURNS TABLE (email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $ae$
BEGIN
  IF p_rule->>'typ' = 'produkt' AND COALESCE(p_rule->>'id','') <> '' THEN
    RETURN QUERY
      SELECT DISTINCT lower(btrim(o.buyer_email))
        FROM public.orders o, jsonb_array_elements(o.items) e
       WHERE o.status = 'COMPLETED' AND e->>'product_id' = p_rule->>'id' AND o.buyer_email IS NOT NULL;
  ELSIF p_rule->>'typ' = 'aktywny_pakiet' THEN
    -- Opcjonalny type_id: bez niego regu\u0142a obejmuje KA\u017BDY aktywny pakiet, z nim tylko ten typ spotkania.
    RETURN QUERY
      SELECT DISTINCT lower(btrim(p.email_display))
        FROM public.bk_packages p
       WHERE p.payment_status = 'oplacony' AND p.valid_until > now()
         AND p.sessions_used < p.sessions_total AND p.email_display IS NOT NULL
         AND (COALESCE(p_rule->>'type_id','') = '' OR p.type_id::text = p_rule->>'type_id');
  END IF;
END $ae$;

-- Kto jest w grupie TERAZ: cz\u0142onkowie r\u0119czni plus, dla grupy automatycznej, aktualny wynik regu\u0142y.
CREATE OR REPLACE FUNCTION public.mb_group_members_now(p_group uuid)
RETURNS TABLE (email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $gm$
  SELECT DISTINCT lower(btrim(m.client_email)) AS email
    FROM public.mb_group_members m WHERE m.group_id = p_group
  UNION
  SELECT e.email FROM public.mb_groups g, public.mb_auto_group_emails(g.rule) e
   WHERE g.id = p_group AND g.kind = 'AUTOMATYCZNA'
$gm$;

-- ============ 10. REGU\u0141A WIDOCZNO\u015ACI (jedno miejsce prawdy) ============
-- Zwraca materia\u0142y widoczne dla danej osoby: przydzia\u0142 wprost, przez grup\u0119 wg trybu,
-- z wyj\u0105tkami (dodani / wykluczeni), w oknie dat, przy w\u0142\u0105czonym prze\u0142\u0105czniku modu\u0142u.
-- Materia\u0142 z dw\xF3ch \u017Ar\xF3de\u0142 wyst\u0119puje raz (pierwsze\u0144stwo ma przydzia\u0142 wprost).
CREATE OR REPLACE FUNCTION public.mb_visible_materials(p_email text, p_admin boolean DEFAULT false)
RETURNS TABLE (material_id uuid, collection_id uuid, assignment_id uuid, note text, visible_from timestamptz, visible_to timestamptz, pos int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $vm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
s AS (SELECT library_mode FROM public.mb_settings WHERE id = 1),
-- \u201Emoje grupy": r\u0119czne (z listy cz\u0142onk\xF3w) ORAZ automatyczne (aktualny wynik regu\u0142y zakupowej / pakietowej)
mine AS (
  SELECT m.group_id FROM public.mb_group_members m, me WHERE m.client_email = me.mail
  UNION
  SELECT g.id FROM public.mb_groups g, me
   WHERE g.kind = 'AUTOMATYCZNA' AND me.mail <> ''
     AND me.mail IN (SELECT e.email FROM public.mb_auto_group_emails(g.rule) e)
),
a AS (
  SELECT x.*, CASE WHEN x.target_kind = 'osoba' THEN 0 ELSE 1 END AS prio
  FROM public.mb_assignments x, me, s
  WHERE x.revoked_at IS NULL
    AND me.mail <> ''
    AND (s.library_mode = 'on' OR (s.library_mode = 'admin' AND p_admin))
    AND (x.visible_from IS NULL OR x.visible_from <= now())
    AND (x.visible_to IS NULL OR x.visible_to > now())
    AND (
      (x.target_kind = 'osoba' AND x.target_email = me.mail)
      OR (x.target_kind = 'grupa' AND NOT (me.mail = ANY(x.exceptions_drop)) AND (
           (x.group_mode = 'OBECNI_I_PRZYSZLI' AND (x.group_id IN (SELECT group_id FROM mine) OR me.mail = ANY(x.exceptions_add)))
        OR (x.group_mode = 'TYLKO_OBECNI' AND (
             (me.mail = ANY(x.snapshot_emails) AND me.mail IN (SELECT e.email FROM public.mb_group_members_now(x.group_id) e))
             OR me.mail = ANY(x.exceptions_add)))
      ))
    )
),
rows AS (
  SELECT m.id AS mid, a.collection_id, a.id AS aid, a.note, a.visible_from, a.visible_to,
         COALESCE(ci.position, 0) AS pos, a.prio
  FROM a
  JOIN public.mb_materials m ON m.id = a.material_id AND m.deleted_at IS NULL
  LEFT JOIN public.mb_collection_items ci ON ci.collection_id = a.collection_id AND ci.material_id = m.id
  WHERE a.material_id IS NOT NULL
  UNION ALL
  SELECT m.id, a.collection_id, a.id, a.note, a.visible_from, a.visible_to, ci.position, a.prio
  FROM a
  JOIN public.mb_collection_items ci ON ci.collection_id = a.collection_id
  JOIN public.mb_materials m ON m.id = ci.material_id AND m.deleted_at IS NULL
  WHERE a.collection_id IS NOT NULL
)
SELECT DISTINCT ON (mid) mid, collection_id, aid, note, visible_from, visible_to, pos
FROM rows ORDER BY mid, prio, pos
$vm$;

-- ============ 11. ODBIORCY (jedno miejsce prawdy) ============
-- Grupa wg trybu, minus wykluczeni, plus dodani, bez powt\xF3rze\u0144. U\u017Cywane i do podgl\u0105du, i do wysy\u0142ki.
CREATE OR REPLACE FUNCTION public.mb_resolve_recipients(p_target jsonb)
RETURNS TABLE (email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $rr$
WITH t AS (SELECT p_target AS p),
tg AS (
  SELECT (t.p->>'group_id')::uuid AS gid, COALESCE(t.p->>'group_mode','') AS mode, t.p
  FROM t
  WHERE t.p->>'kind' = 'grupa'
    AND (t.p->>'group_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
),
base AS (
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'emails','[]')) AS x(e)
  UNION
  -- grupa wg trybu: \u201Eobecni i przyszli" = wszyscy w grupie teraz (r\u0119czni i automatyczni)
  SELECT e.email FROM tg, public.mb_group_members_now(tg.gid) e WHERE tg.mode = 'OBECNI_I_PRZYSZLI'
  UNION
  -- \u201Etylko obecni": z listy z chwili przydzia\u0142u zostaj\u0105 wy\u0142\u0105cznie osoby, kt\xF3re nadal s\u0105 w grupie
  SELECT lower(btrim(x.e)) AS email FROM tg, jsonb_array_elements_text(COALESCE(tg.p->'snapshot_emails','[]')) AS x(e)
    WHERE tg.mode = 'TYLKO_OBECNI'
      AND lower(btrim(x.e)) IN (SELECT e.email FROM public.mb_group_members_now(tg.gid) e)
  UNION
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'exceptions_add','[]')) AS x(e)
),
drop_ AS (
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'exceptions_drop','[]')) AS x(e)
)
SELECT DISTINCT b.email FROM base b
WHERE b.email IS NOT NULL AND b.email <> ''
  AND NOT EXISTS (SELECT 1 FROM drop_ d WHERE d.email = b.email)
$rr$;

-- ============ 12. PRZENIESIENIE DANYCH PRZY ZMIANIE ADRESU ============
-- Jedna transakcja: wszystkie tabele mb_* oraz adresy wewn\u0105trz tablic wyj\u0105tk\xF3w i snapshot\xF3w.
-- Przygotowane w 1A; podpi\u0119cie do modu\u0142u zmiany adresu nast\u0105pi w 1C.
CREATE OR REPLACE FUNCTION public.mb_move_email(p_old text, p_new text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mv$
DECLARE
  o text := lower(btrim(COALESCE(p_old,'')));
  n text := lower(btrim(COALESCE(p_new,'')));
  c jsonb := '{}'::jsonb;
  k int;
BEGIN
  IF o = '' OR n = '' OR strpos(n, '@') = 0 OR length(n) > 320 THEN
    RETURN jsonb_build_object('error','bad');
  END IF;
  IF o = n THEN RETURN jsonb_build_object('ok', true, 'same', true); END IF;

  DELETE FROM public.mb_group_members a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_group_members b WHERE b.group_id = a.group_id AND b.client_email = n);
  UPDATE public.mb_group_members SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('grupy', k);

  UPDATE public.mb_assignments SET target_email = n WHERE target_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('przydzialy', k);

  UPDATE public.mb_assignments
    SET exceptions_add = array_replace(exceptions_add, o, n),
        exceptions_drop = array_replace(exceptions_drop, o, n),
        snapshot_emails = array_replace(snapshot_emails, o, n)
    WHERE o = ANY(exceptions_add) OR o = ANY(exceptions_drop) OR o = ANY(snapshot_emails);
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('wyjatki', k);

  DELETE FROM public.mb_material_state a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_material_state b WHERE b.material_id = a.material_id AND b.client_email = n);
  UPDATE public.mb_material_state SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('stany', k);

  DELETE FROM public.mb_message_recipients a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_message_recipients b WHERE b.message_id = a.message_id AND b.client_email = n);
  UPDATE public.mb_message_recipients SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('odbiorcy', k);

  INSERT INTO public.mb_log (actor, action, object_type, object_id, summary)
  VALUES ('system', 'zmiana_adresu', 'klient', NULL, 'dane biblioteki przeniesione');
  RETURN jsonb_build_object('ok', true, 'przeniesione', c);
END $mv$;

-- ============ 13. LIMIT WYDAWANIA LINK\xD3W ============
CREATE OR REPLACE FUNCTION public.mb_link_hit(p_key text, p_limit int DEFAULT 30) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $lh$
BEGIN
  DELETE FROM public.mb_rate WHERE at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.mb_rate WHERE key_hash = p_key AND at > now() - interval '1 hour') >= p_limit THEN
    RETURN 'rate';
  END IF;
  INSERT INTO public.mb_rate (bucket, key_hash) VALUES ('link', p_key);
  RETURN 'ok';
END $lh$;

-- ============ 14. DOST\u0118P: wy\u0142\u0105cznie serwer ============
-- RLS bez polityk = brak dost\u0119pu z zewn\u0105trz; uprawnienia odebrane anon/authenticated.
DO $x$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['mb_settings','mb_materials','mb_collections','mb_collection_items','mb_groups','mb_group_members',
    'mb_assignments','mb_material_state','mb_messages','mb_message_recipients','mb_templates','mb_rate','mb_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', r);
  END LOOP;
END $x$;
REVOKE ALL ON SEQUENCE public.mb_rate_id_seq, public.mb_log_id_seq FROM PUBLIC, anon, authenticated;

-- Wszystkie funkcje mb_*: jawnie odbieramy PUBLIC/anon/authenticated, zostaje tylko service_role.
-- (PostgreSQL nadaje EXECUTE dla PUBLIC domy\u015Blnie \u2014 dlatego ka\u017Cda funkcja jest wymieniona z nazwy.)
REVOKE ALL ON FUNCTION public.mb_log_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_log_purge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_auto_group_emails(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_group_members_now(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_visible_materials(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_resolve_recipients(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_move_email(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_link_hit(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_log_anonymize(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mb_log_purge() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_auto_group_emails(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_group_members_now(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_visible_materials(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_resolve_recipients(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_move_email(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_link_hit(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_log_anonymize(text) TO service_role;

NOTIFY pgrst, 'reload schema';
`;
var SEED_SQL = `
INSERT INTO public.mb_groups (name, color, description, kind) VALUES
 ('POWR\xD3T \u2014 wszyscy uczestnicy', '#C9A24A', 'Wszyscy, kt\xF3rzy przeszli przez POWR\xD3T.', 'RECZNA'),
 ('Kohorta 1', '#BC1E22', 'Pierwsza grupa startowa.', 'RECZNA'),
 ('Rozmowa na progu', '#8A8A8C', 'Osoby po rozmowie wst\u0119pnej.', 'RECZNA'),
 ('Alumni', '#3D3D3F', 'Po zako\u0144czeniu programu.', 'RECZNA')
ON CONFLICT (name) DO NOTHING;
`;
var CHECKPOINT_TABLES_SQL = `
SELECT c.relname AS tabela,
       c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS polityki,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname LIKE 'mb\\_%'
ORDER BY c.relname`;
var CHECKPOINT_FUNCS_SQL = `
SELECT p.proname AS funkcja,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       (p.prosecdef) AS security_definer,
       (p.proconfig IS NOT NULL) AS search_path_ustawiony
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'mb\\_%'
ORDER BY p.proname`;

// supabase/functions/_shared/libraryRpcSql.ts
var LIBRARY_RPC_SQL = `
-- ============ USTAWIENIA (jedno miejsce prawdy) ============
CREATE OR REPLACE FUNCTION public.mb_lib_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ls$
  SELECT COALESCE(
    (SELECT jsonb_build_object('library_mode', s.library_mode, 'messages_mode', s.messages_mode,
       'email_notify', s.email_notify, 'whatsapp', s.whatsapp, 'space_limit_mb', s.space_limit_mb)
       FROM public.mb_settings s WHERE s.id = 1),
    jsonb_build_object('library_mode','off','messages_mode','off','email_notify',false,'whatsapp',NULL,'space_limit_mb',5120))
$ls$;

-- ============ ZU\u017BYCIE PRZESTRZENI ============
CREATE OR REPLACE FUNCTION public.mb_admin_space() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $sp$
WITH u AS (
  SELECT COALESCE(sum(COALESCE(file_size,0) + COALESCE(prev_file_size,0)),0)::bigint AS bytes,
         count(*)::int AS files
    FROM public.mb_materials WHERE deleted_at IS NULL AND file_key IS NOT NULL
), lim AS (SELECT COALESCE((SELECT space_limit_mb FROM public.mb_settings WHERE id = 1), 5120)::bigint AS mb)
SELECT jsonb_build_object('bytes', u.bytes, 'files', u.files, 'limit_mb', lim.mb,
  'procent', LEAST(100, GREATEST(0, round(u.bytes * 100.0 / (lim.mb * 1048576)))))
FROM u, lim
$sp$;

-- ============ KLIENT: BIBLIOTEKA ============
-- Dok\u0142adnie te same pola co dot\u0105d w itemOf(): bez kluczy plik\xF3w, bez nazw grup, bez list odbiorc\xF3w.
-- Tre\u015B\u0107 i odtwarzacze (embed) sk\u0142ada warstwa JS \u2014 tu wracaj\u0105 tylko dane.
CREATE OR REPLACE FUNCTION public.mb_client_library(p_email text, p_admin boolean DEFAULT false, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cl$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
v AS (SELECT * FROM public.mb_visible_materials(p_email, p_admin)),
m AS (
  SELECT mm.id, mm.title, mm.kind, mm.description, mm.duration_s, mm.pages, mm.stage, mm.tags,
         mm.external_url, mm.video_provider, mm.video_id, mm.body_html, mm.allow_download,
         (mm.file_key IS NOT NULL) AS has_file
    FROM public.mb_materials mm JOIN v ON v.material_id = mm.id
   WHERE mm.deleted_at IS NULL
),
st AS (
  SELECT s.material_id, s.opened_at, s.completed_at
    FROM public.mb_material_state s, me
   WHERE s.client_email = me.mail AND NOT p_preview
),
it AS (
  SELECT jsonb_build_object(
    'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description,
    'duration_s', m.duration_s, 'pages', m.pages, 'stage', m.stage, 'tags', m.tags,
    'note', v.note, 'visible_from', v.visible_from, 'visible_to', v.visible_to,
    'collection_id', v.collection_id, 'position', v.pos,
    'opened_at', st.opened_at, 'completed_at', st.completed_at,
    'has_file', m.has_file, 'allow_download', m.allow_download,
    'external_url', m.external_url, 'video_provider', m.video_provider, 'video_id', m.video_id,
    'body_html', m.body_html) AS j,
    m.kind, v.collection_id, v.pos, m.title, st.opened_at
  FROM m JOIN v ON v.material_id = m.id LEFT JOIN st ON st.material_id = m.id
),
col AS (
  SELECT c.id, c.title, c.description,
    COALESCE((SELECT jsonb_agg(x.j ORDER BY x.pos, x.title) FROM it x WHERE x.collection_id = c.id), '[]'::jsonb) AS items
  FROM public.mb_collections c
  WHERE c.deleted_at IS NULL AND c.id IN (SELECT DISTINCT collection_id FROM it WHERE collection_id IS NOT NULL)
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(j ORDER BY kind, title) FROM it), '[]'::jsonb),
  'collections', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', col.id, 'title', col.title,
     'description', col.description, 'items', col.items) ORDER BY col.title) FROM col), '[]'::jsonb),
  'counts', jsonb_build_object(
    'AUDIO', (SELECT count(*) FROM it WHERE kind = 'AUDIO'),
    'WIDEO', (SELECT count(*) FROM it WHERE kind = 'WIDEO'),
    'PDF',   (SELECT count(*) FROM it WHERE kind = 'PDF'),
    'LINK',  (SELECT count(*) FROM it WHERE kind = 'LINK'),
    'TEKST', (SELECT count(*) FROM it WHERE kind = 'TEKST')),
  'unopened', (SELECT count(*) FROM it WHERE opened_at IS NULL))
$cl$;

-- ============ KLIENT: WIADOMO\u015ACI ============
CREATE OR REPLACE FUNCTION public.mb_client_messages(p_email text, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
r AS (
  SELECT m.id, m.title, m.body_html, m.sent_at, m.attached_material_id, m.attached_collection_id,
         rr.read_at, mt.title AS material_title, mt.kind AS material_kind, cl.title AS collection_title
    FROM public.mb_message_recipients rr
    JOIN public.mb_messages m ON m.id = rr.message_id
    LEFT JOIN public.mb_materials mt ON mt.id = m.attached_material_id AND mt.deleted_at IS NULL
    LEFT JOIN public.mb_collections cl ON cl.id = m.attached_collection_id AND cl.deleted_at IS NULL
   WHERE rr.client_email = (SELECT mail FROM me) AND m.status = 'WYSLANA' AND rr.hidden_at IS NULL
   ORDER BY m.sent_at DESC NULLS LAST LIMIT 100
),
it AS (
  SELECT jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'sent_at', r.sent_at,
    'read_at', r.read_at, 'material_id', r.attached_material_id, 'collection_id', r.attached_collection_id,
    'material_title', r.material_title, 'material_kind', r.material_kind, 'collection_title', r.collection_title) AS j,
    r.sent_at, r.read_at
  FROM r
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sent_at DESC NULLS LAST) FROM it), '[]'::jsonb),
  'unread', CASE WHEN p_preview THEN 0 ELSE (SELECT count(*) FROM it WHERE it.read_at IS NULL) END)
$cm$;

-- ============ KLIENT: JEDNO WEJ\u015ACIE ============
-- /konto dostaje prze\u0142\u0105czniki, bibliotek\u0119 i wiadomo\u015Bci jednym wywo\u0142aniem (zamiast 3\u20134).
CREATE OR REPLACE FUNCTION public.mb_client_bundle(p_email text, p_admin boolean DEFAULT false, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $cb$
DECLARE
  s jsonb;
  lm text;
  mm text;
BEGIN
  s := public.mb_lib_settings();
  lm := s->>'library_mode';
  mm := s->>'messages_mode';
  RETURN jsonb_build_object(
    'library_mode', lm,
    'messages_mode', mm,
    'whatsapp', s->'whatsapp',
    'library', CASE WHEN lm = 'on' OR (lm = 'admin' AND p_admin)
      THEN public.mb_client_library(p_email, p_admin, p_preview) ELSE NULL END,
    'messages', CASE WHEN mm = 'on' OR (mm = 'admin' AND p_admin)
      THEN public.mb_client_messages(p_email, p_preview) ELSE NULL END);
END $cb$;

-- ============ KLIENT: OTWARCIE MATERIA\u0141U ============
-- Sprawdzenie dost\u0119pu + dane materia\u0142u + limit link\xF3w + zapis \u201Eotwarte" w jednym wywo\u0142aniu.
-- Podpisany adres pliku nadal powstaje w warstwie funkcji \u2014 klucz pliku nigdy nie trafia do przegl\u0105darki.
CREATE OR REPLACE FUNCTION public.mb_client_open(p_email text, p_admin boolean, p_material_id uuid,
  p_mark_opened boolean DEFAULT true, p_rate_key text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $co$
DECLARE
  mail text := lower(btrim(COALESCE(p_email,'')));
  m record;
  r text;
BEGIN
  IF p_material_id IS NULL THEN RETURN jsonb_build_object('status','denied'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mb_visible_materials(p_email, p_admin) v WHERE v.material_id = p_material_id) THEN
    RETURN jsonb_build_object('status','denied');
  END IF;
  SELECT mm.id, mm.title, mm.kind, mm.file_key, mm.external_url, mm.video_provider, mm.video_id, mm.body_html, mm.allow_download
    INTO m FROM public.mb_materials mm WHERE mm.id = p_material_id AND mm.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','denied'); END IF;

  IF p_rate_key IS NOT NULL THEN
    r := public.mb_link_hit(p_rate_key, COALESCE(p_limit, 30));
    IF r <> 'ok' THEN RETURN jsonb_build_object('status','rate'); END IF;
  END IF;

  IF p_mark_opened THEN
    INSERT INTO public.mb_material_state (client_email, material_id, opened_at)
    VALUES (mail, p_material_id, now())
    ON CONFLICT (client_email, material_id)
    DO UPDATE SET opened_at = COALESCE(public.mb_material_state.opened_at, EXCLUDED.opened_at);
  END IF;

  RETURN jsonb_build_object('status','ok','material', jsonb_build_object(
    'id', m.id, 'title', m.title, 'kind', m.kind, 'file_key', m.file_key, 'external_url', m.external_url,
    'video_provider', m.video_provider, 'video_id', m.video_id, 'body_html', m.body_html, 'allow_download', m.allow_download));
END $co$;

-- ============ KLIENT: OZNACZENIE MATERIA\u0141U ============
CREATE OR REPLACE FUNCTION public.mb_material_complete(p_email text, p_admin boolean, p_material_id uuid, p_completed boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mc$
DECLARE mail text := lower(btrim(COALESCE(p_email,'')));
BEGIN
  IF p_material_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mb_visible_materials(p_email, p_admin) v WHERE v.material_id = p_material_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.mb_material_state (client_email, material_id, completed_at)
  VALUES (mail, p_material_id, CASE WHEN p_completed THEN now() ELSE NULL END)
  ON CONFLICT (client_email, material_id)
  DO UPDATE SET completed_at = CASE WHEN p_completed THEN now() ELSE NULL END;
  RETURN true;
END $mc$;

-- ============ KLIENT: PRZECZYTANE / UKRYTE ============
-- Brak wiersza odbiorcy = cudza wiadomo\u015B\u0107 = odmowa bez ujawniania czegokolwiek.
CREATE OR REPLACE FUNCTION public.mb_message_flag(p_email text, p_message_id uuid, p_hidden boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mf$
DECLARE
  mail text := lower(btrim(COALESCE(p_email,'')));
  k int;
BEGIN
  IF p_message_id IS NULL THEN RETURN false; END IF;
  IF p_hidden THEN
    UPDATE public.mb_message_recipients SET hidden_at = COALESCE(hidden_at, now())
     WHERE message_id = p_message_id AND client_email = mail;
  ELSE
    UPDATE public.mb_message_recipients SET read_at = COALESCE(read_at, now())
     WHERE message_id = p_message_id AND client_email = mail;
  END IF;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k > 0;
END $mf$;

-- ============ PANEL: ODCZYTY ============
CREATE OR REPLACE FUNCTION public.mb_admin_materials(p_kind text DEFAULT NULL, p_q text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $am$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description, 'stage', m.stage, 'tags', m.tags,
  'file_version', m.file_version, 'file_size', m.file_size, 'prev_file_size', m.prev_file_size,
  'prev_file_name', m.prev_file_name, 'pdf_js_warning', m.pdf_js_warning, 'external_url', m.external_url,
  'video_provider', m.video_provider, 'video_id', m.video_id, 'duration_s', m.duration_s, 'pages', m.pages,
  'allow_download', m.allow_download, 'body_html', m.body_html, 'created_at', m.created_at, 'source', m.source,
  'przydzialy', (SELECT count(*) FROM public.mb_assignments x WHERE x.revoked_at IS NULL
     AND (x.material_id = m.id OR x.collection_id IN
       (SELECT ci.collection_id FROM public.mb_collection_items ci WHERE ci.material_id = m.id))),
  'otwarte', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.opened_at IS NOT NULL),
  'ukonczone', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.completed_at IS NOT NULL)
) ORDER BY m.created_at DESC), '[]'::jsonb)
FROM (
  SELECT * FROM public.mb_materials mm
   WHERE mm.deleted_at IS NULL
     AND (p_kind IS NULL OR mm.kind = p_kind)
     AND (p_q IS NULL OR p_q = '' OR mm.title ILIKE '%' || p_q || '%' OR COALESCE(mm.description,'') ILIKE '%' || p_q || '%')
   ORDER BY mm.created_at DESC LIMIT 500
) m
$am$;

CREATE OR REPLACE FUNCTION public.mb_admin_collections() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acl$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', c.id, 'title', c.title, 'description', c.description, 'sort', c.sort, 'created_at', c.created_at,
  'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('material_id', ci.material_id, 'position', ci.position,
      'title', mm.title, 'kind', mm.kind) ORDER BY ci.position)
    FROM public.mb_collection_items ci
    LEFT JOIN public.mb_materials mm ON mm.id = ci.material_id AND mm.deleted_at IS NULL
    WHERE ci.collection_id = c.id), '[]'::jsonb)
) ORDER BY c.sort, c.created_at), '[]'::jsonb)
FROM public.mb_collections c WHERE c.deleted_at IS NULL
$acl$;

-- Grupy z cz\u0142onkami liczonymi od razu w bazie \u2014 tak\u017Ce automatycznymi (bez wywo\u0142ania na grup\u0119).
CREATE OR REPLACE FUNCTION public.mb_admin_groups() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ag$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', g.id, 'name', g.name, 'color', g.color, 'description', g.description, 'kind', g.kind, 'rule', g.rule,
  'accepted_at', g.accepted_at, 'created_at', g.created_at,
  'members', COALESCE((SELECT jsonb_agg(e.email ORDER BY e.email) FROM public.mb_group_members_now(g.id) e), '[]'::jsonb),
  'count', (SELECT count(*) FROM public.mb_group_members_now(g.id) e)
) ORDER BY g.kind, g.name), '[]'::jsonb)
FROM public.mb_groups g
$ag$;

CREATE OR REPLACE FUNCTION public.mb_admin_messages() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ams$
WITH src AS (
  SELECT m.*, g.name AS group_name
    FROM public.mb_messages m
    LEFT JOIN public.mb_groups g ON g.id = NULLIF(m.target->>'group_id','')::uuid
   ORDER BY COALESCE(m.sent_at, m.send_at, m.created_at) DESC LIMIT 200
),
it AS (
  SELECT jsonb_build_object(
    'id', s.id, 'title', s.title, 'body_html', s.body_html, 'status', s.status, 'send_at', s.send_at,
    'email_mode', s.email_mode, 'recipient_count', s.recipient_count, 'attached_material_id', s.attached_material_id,
    'attached_collection_id', s.attached_collection_id, 'target', s.target, 'created_at', s.created_at,
    'sent_at', s.sent_at, 'withdrawn_at', s.withdrawn_at, 'group_name', s.group_name,
    'dostarczone', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id),
    'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id AND r.read_at IS NOT NULL)
  ) AS j, COALESCE(s.sent_at, s.send_at, s.created_at) AS sort
  FROM src s
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sort DESC) FROM it), '[]'::jsonb),
  'liczniki', (SELECT jsonb_build_object(
    'wyslane', count(*) FILTER (WHERE status = 'WYSLANA'),
    'zaplanowane', count(*) FILTER (WHERE status = 'ZAPLANOWANA'),
    'szkice', count(*) FILTER (WHERE status = 'SZKIC'),
    'wycofane', count(*) FILTER (WHERE status = 'WYCOFANA')) FROM public.mb_messages))
$ams$;

CREATE OR REPLACE FUNCTION public.mb_admin_dashboard() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ad$
SELECT jsonb_build_object(
  'zaplanowane_dzis', (SELECT count(*) FROM public.mb_messages WHERE status = 'ZAPLANOWANA'
     AND (send_at AT TIME ZONE 'Europe/Warsaw')::date = (now() AT TIME ZONE 'Europe/Warsaw')::date),
  'odblokowuje_sie', (SELECT count(*) FROM public.mb_assignments WHERE revoked_at IS NULL
     AND visible_from IS NOT NULL AND visible_from > now() AND visible_from < now() + interval '7 days'),
  'przestrzen', public.mb_admin_space(),
  'tryby', public.mb_lib_settings(),
  'ostatnia', (SELECT jsonb_build_object('id', m.id, 'title', m.title, 'sent_at', m.sent_at,
     'dostarczone', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = m.id),
     'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = m.id AND r.read_at IS NOT NULL))
     FROM public.mb_messages m WHERE m.status = 'WYSLANA' ORDER BY m.sent_at DESC LIMIT 1))
$ad$;

-- Fakty o klientach z tabel mb_* (grupy r\u0119czne i automatyczne, aktywny pakiet) \u2014 bez listy kont Base44.
CREATE OR REPLACE FUNCTION public.mb_admin_clients_mb() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acm$
WITH g AS (SELECT gg.id, gg.name, gg.color, gg.kind, gg.rule FROM public.mb_groups gg),
members AS (
  SELECT lower(btrim(m.client_email)) AS email, m.group_id FROM public.mb_group_members m
  UNION
  SELECT lower(btrim(e.email)) AS email, g.id AS group_id
    FROM g, public.mb_auto_group_emails(g.rule) e WHERE g.kind = 'AUTOMATYCZNA'
),
pkg AS (
  SELECT DISTINCT lower(btrim(email_display)) AS email FROM public.bk_packages
   WHERE payment_status = 'oplacony' AND valid_until > now() AND sessions_used < sessions_total AND email_display IS NOT NULL
),
emails AS (SELECT email FROM members WHERE email <> '' UNION SELECT email FROM pkg WHERE email <> ''),
rows AS (
  SELECT jsonb_build_object('email', e.email,
    'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', gg.id, 'name', gg.name, 'color', gg.color, 'kind', gg.kind) ORDER BY gg.name)
      FROM g gg WHERE gg.id IN (SELECT mm.group_id FROM members mm WHERE mm.email = e.email)), '[]'::jsonb),
    'package', EXISTS (SELECT 1 FROM pkg p WHERE p.email = e.email)) AS j, e.email
  FROM emails e
)
SELECT COALESCE(jsonb_agg(j ORDER BY email), '[]'::jsonb) FROM rows
$acm$;

CREATE OR REPLACE FUNCTION public.mb_admin_client_mb(p_email text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acd$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
g AS (
  SELECT gg.id, gg.name, gg.color, gg.kind FROM public.mb_groups gg
   WHERE (gg.kind = 'RECZNA' AND EXISTS (SELECT 1 FROM public.mb_group_members m
            WHERE m.group_id = gg.id AND m.client_email = (SELECT mail FROM me)))
      OR (gg.kind = 'AUTOMATYCZNA' AND (SELECT mail FROM me) IN
            (SELECT e.email FROM public.mb_auto_group_emails(gg.rule) e))
)
SELECT jsonb_build_object(
  'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'kind', g.kind) ORDER BY g.name) FROM g), '[]'::jsonb),
  'packages', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', p.id, 'sessions_total', p.sessions_total, 'sessions_used', p.sessions_used,
       'valid_until', p.valid_until, 'payment_status', p.payment_status, 'source', p.source, 'created_at', p.created_at) AS j,
       p.created_at
     FROM public.bk_packages p WHERE lower(btrim(p.email_display)) = (SELECT mail FROM me)
     ORDER BY p.created_at DESC LIMIT 20) x), '[]'::jsonb),
  'sends', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.sent_at DESC NULLS LAST) FROM (
     SELECT jsonb_build_object('id', m.id, 'title', m.title, 'sent_at', m.sent_at, 'read_at', r.read_at, 'hidden_at', r.hidden_at) AS j,
       m.sent_at
     FROM public.mb_message_recipients r JOIN public.mb_messages m ON m.id = r.message_id
     WHERE r.client_email = (SELECT mail FROM me) ORDER BY m.sent_at DESC NULLS LAST LIMIT 50) x), '[]'::jsonb),
  'assignments', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', a.id, 'material_id', a.material_id, 'collection_id', a.collection_id, 'note', a.note,
       'visible_from', a.visible_from, 'visible_to', a.visible_to, 'target_kind', a.target_kind, 'group_id', a.group_id,
       'group_name', gg.name, 'material_title', mm.title, 'collection_title', cc.title) AS j, a.created_at
     FROM public.mb_assignments a
     LEFT JOIN public.mb_groups gg ON gg.id = a.group_id
     LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
     LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
     WHERE a.revoked_at IS NULL AND (
       a.target_email = (SELECT mail FROM me)
       OR a.group_id IN (SELECT m.group_id FROM public.mb_group_members m WHERE m.client_email = (SELECT mail FROM me))
       OR a.group_id IN (SELECT g2.id FROM public.mb_groups g2 WHERE g2.kind = 'AUTOMATYCZNA'
            AND (SELECT mail FROM me) IN (SELECT e.email FROM public.mb_auto_group_emails(g2.rule) e)))
     ORDER BY a.created_at DESC LIMIT 200) x), '[]'::jsonb))
$acd$;

CREATE OR REPLACE FUNCTION public.mb_admin_group_detail(p_group uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $agd$
SELECT jsonb_build_object(
  'group', (SELECT jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'description', g.description,
     'kind', g.kind, 'rule', g.rule, 'accepted_at', g.accepted_at) FROM public.mb_groups g WHERE g.id = p_group),
  'members', COALESCE((SELECT jsonb_agg(e.email ORDER BY e.email) FROM public.mb_group_members_now(p_group) e), '[]'::jsonb),
  'materials', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', a.id, 'material_id', a.material_id, 'collection_id', a.collection_id,
       'material_title', m.title, 'collection_title', c.title, 'visible_from', a.visible_from,
       'visible_to', a.visible_to, 'created_at', a.created_at) AS j, a.created_at
     FROM public.mb_assignments a
     LEFT JOIN public.mb_materials m ON m.id = a.material_id AND m.deleted_at IS NULL
     LEFT JOIN public.mb_collections c ON c.id = a.collection_id AND c.deleted_at IS NULL
     WHERE a.group_id = p_group AND a.revoked_at IS NULL ORDER BY a.created_at DESC LIMIT 200) x), '[]'::jsonb),
  'messages', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.sort DESC) FROM (
     SELECT jsonb_build_object('id', mm.id, 'title', mm.title, 'status', mm.status, 'sent_at', mm.sent_at,
       'send_at', mm.send_at, 'recipient_count', mm.recipient_count, 'created_at', mm.created_at,
       'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = mm.id AND r.read_at IS NOT NULL)) AS j,
       COALESCE(mm.sent_at, mm.send_at, mm.created_at) AS sort
     FROM public.mb_messages mm
     WHERE mm.target->>'kind' = 'grupa' AND mm.target->>'group_id' = p_group::text
     ORDER BY COALESCE(mm.sent_at, mm.send_at, mm.created_at) DESC LIMIT 50) x), '[]'::jsonb))
$agd$;

CREATE OR REPLACE FUNCTION public.mb_admin_history(p_action text DEFAULT NULL, p_days int DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ah$
WITH it AS (
  SELECT jsonb_build_object('at', l.at, 'actor', l.actor, 'action', l.action, 'object_type', l.object_type,
    'object_id', l.object_id, 'summary', l.summary, 'anonymized', l.anonymized) AS j, l.at
  FROM public.mb_log l
  WHERE (p_action IS NULL OR l.action = p_action)
    AND (p_days IS NULL OR l.at > now() - make_interval(days => p_days))
  ORDER BY l.at DESC LIMIT 300
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.at DESC) FROM it), '[]'::jsonb),
  'akcje', COALESCE((SELECT jsonb_agg(DISTINCT a.action ORDER BY a.action) FROM public.mb_log a), '[]'::jsonb))
$ah$;

-- Podgl\u0105d odbiorc\xF3w: same adresy \u2014 imiona dok\u0142ada warstwa funkcji (konta Base44).
CREATE OR REPLACE FUNCTION public.mb_admin_assignment_preview(p_target jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ap$
SELECT COALESCE(jsonb_agg(e.email ORDER BY e.email), '[]'::jsonb) FROM public.mb_resolve_recipients(p_target) e
$ap$;

-- ============ PANEL: ZAPISY ============
CREATE OR REPLACE FUNCTION public.mb_admin_assignment_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $asv$
DECLARE
  mat uuid := NULLIF(p->>'material_id','')::uuid;
  col uuid := NULLIF(p->>'collection_id','')::uuid;
  kind text := CASE WHEN p->>'target_kind' = 'grupa' THEN 'grupa' ELSE 'osoba' END;
  tgt text := NULLIF(lower(btrim(COALESCE(p->>'target_email',''))), '');
  gid uuid := NULLIF(p->>'group_id','')::uuid;
  gmode text := NULLIF(p->>'group_mode','');
  snap text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'snapshot_emails','[]')) x), '{}'::text[]);
  addx text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'exceptions_add','[]')) x), '{}'::text[]);
  dropx text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'exceptions_drop','[]')) x), '{}'::text[]);
  vf timestamptz := NULLIF(p->>'visible_from','')::timestamptz;
  vt timestamptz := NULLIF(p->>'visible_to','')::timestamptz;
  who text := COALESCE(NULLIF(p->>'actor',''), 'system');
  tgtjson jsonb;
  newid uuid;
  rec int;
BEGIN
  IF (mat IS NULL) = (col IS NULL) THEN RAISE EXCEPTION 'material albo kolekcja, nie oba'; END IF;
  IF kind = 'osoba' THEN
    IF tgt IS NULL OR position('@' in tgt) = 0 THEN RAISE EXCEPTION 'brak osoby'; END IF;
    gid := NULL; gmode := NULL; snap := '{}'; addx := '{}'; dropx := '{}';
    tgtjson := jsonb_build_object('kind','osoba','emails', jsonb_build_array(tgt));
  ELSE
    IF gid IS NULL THEN RAISE EXCEPTION 'brak grupy'; END IF;
    gmode := CASE WHEN gmode = 'TYLKO_OBECNI' THEN 'TYLKO_OBECNI' ELSE 'OBECNI_I_PRZYSZLI' END;
    tgt := NULL;
    IF gmode = 'TYLKO_OBECNI' THEN
      SELECT COALESCE(array_agg(DISTINCT lower(btrim(m.client_email))), '{}'::text[])
        INTO snap FROM public.mb_group_members m WHERE m.group_id = gid;
    ELSE
      snap := '{}';
    END IF;
    tgtjson := jsonb_build_object('kind','grupa','group_id', gid, 'group_mode', gmode,
      'snapshot_emails', to_jsonb(snap), 'exceptions_add', to_jsonb(addx), 'exceptions_drop', to_jsonb(dropx));
  END IF;

  INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, group_id, group_mode,
    snapshot_emails, exceptions_add, exceptions_drop, note, visible_from, visible_to, created_by)
  VALUES (mat, col, kind, tgt, gid, gmode, snap, addx, dropx,
    NULLIF(p->>'note',''), vf, vt, who)
  RETURNING id INTO newid;

  SELECT count(*) INTO rec FROM public.mb_resolve_recipients(tgtjson) r;
  RETURN jsonb_build_object('id', newid, 'count', rec);
END $asv$;

CREATE OR REPLACE FUNCTION public.mb_admin_assignment_bulk(p_material uuid, p_emails text[], p_note text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $ab$
WITH ins AS (
  INSERT INTO public.mb_assignments (material_id, target_kind, target_email, note, visible_from, visible_to, created_by)
  SELECT p_material, 'osoba', lower(btrim(e)), p_note, p_from, p_to, COALESCE(p_actor, 'system')
    FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
  RETURNING 1
)
SELECT count(*)::int FROM ins
$ab$;

CREATE OR REPLACE FUNCTION public.mb_admin_assignment_revoke(p_id uuid DEFAULT NULL, p_material uuid DEFAULT NULL,
  p_collection uuid DEFAULT NULL, p_group uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ar$
DECLARE k int;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE public.mb_assignments SET revoked_at = now() WHERE id = p_id AND revoked_at IS NULL;
    GET DIAGNOSTICS k = ROW_COUNT;
    RETURN k;
  END IF;
  IF p_group IS NULL OR (p_material IS NULL AND p_collection IS NULL) THEN RETURN 0; END IF;
  UPDATE public.mb_assignments SET revoked_at = now()
   WHERE revoked_at IS NULL AND group_id = p_group
     AND ((p_material IS NOT NULL AND material_id = p_material)
       OR (p_collection IS NOT NULL AND collection_id = p_collection));
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $ar$;

CREATE OR REPLACE FUNCTION public.mb_admin_group_members(p_group uuid, p_emails text[], p_add boolean, p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $agm$
DECLARE k int;
BEGIN
  IF p_group IS NULL THEN RETURN 0; END IF;
  IF p_add THEN
    INSERT INTO public.mb_group_members (group_id, client_email, added_by)
    SELECT p_group, lower(btrim(e)), COALESCE(p_actor, 'system') FROM unnest(p_emails) AS e
     WHERE lower(btrim(e)) <> ''
    ON CONFLICT (group_id, client_email) DO NOTHING;
  ELSE
    DELETE FROM public.mb_group_members m WHERE m.group_id = p_group
      AND m.client_email IN (SELECT lower(btrim(e)) FROM unnest(p_emails) AS e);
  END IF;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $agm$;

-- ============ PANEL: MATERIA\u0141Y (ZAPIS) ============
-- Dodanie albo zmiana materia\u0142u. Kolumny w\u0142a\u015Bciwe dla rodzaju ustawia baza, wi\u0119c warstwa
-- funkcji nie skleja SQL-a \u2014 wysy\u0142a tylko warto\u015Bci.
CREATE OR REPLACE FUNCTION public.mb_admin_material_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ms$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  k text := p->>'kind';
  vurl text := NULLIF(btrim(COALESCE(p->>'external_url','')), '');
  vprov text := NULLIF(p->>'video_provider','');
  vid text := NULLIF(p->>'video_id','');
  vhtml text := NULLIF(p->>'body_html','');
  vkeep boolean := COALESCE((p->>'keep_video')::boolean, false);
  out_id uuid;
BEGIN
  IF k IS NULL OR k NOT IN ('AUDIO','WIDEO','PDF','LINK','TEKST') THEN RAISE EXCEPTION 'nieznany rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;

  IF k = 'LINK' THEN
    IF vurl IS NULL OR vurl NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu'; END IF;
    vprov := NULL; vid := NULL; vhtml := NULL;
  ELSIF k = 'WIDEO' THEN
    vurl := NULL; vhtml := NULL;
    IF vkeep THEN vprov := NULL; vid := NULL; END IF;
  ELSIF k = 'TEKST' THEN
    IF vhtml IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
    vurl := NULL; vprov := NULL; vid := NULL;
  ELSE
    vurl := NULL; vprov := NULL; vid := NULL; vhtml := NULL;
  END IF;

  IF mid IS NULL THEN
    IF k IN ('PDF','AUDIO') THEN RAISE EXCEPTION 'najpierw plik'; END IF;
    INSERT INTO public.mb_materials (kind, title, description, stage, tags, duration_s, pages, allow_download,
      source, external_url, video_provider, video_id, body_html, created_by)
    VALUES (k, btrim(p->>'title'), NULLIF(p->>'description',''), NULLIF(p->>'stage',''),
      COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      NULLIF(p->>'duration_s','')::int, NULLIF(p->>'pages','')::int,
      COALESCE((p->>'allow_download')::boolean, false), NULLIF(p->>'source',''),
      vurl, vprov, vid, vhtml, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_materials SET
      kind = k, title = btrim(p->>'title'), description = NULLIF(p->>'description',''),
      stage = NULLIF(p->>'stage',''),
      tags = COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      duration_s = NULLIF(p->>'duration_s','')::int, pages = NULLIF(p->>'pages','')::int,
      allow_download = COALESCE((p->>'allow_download')::boolean, false), source = NULLIF(p->>'source',''),
      external_url = vurl,
      video_provider = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_provider ELSE vprov END,
      video_id = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_id ELSE vid END,
      body_html = vhtml, updated_at = now()
    WHERE id = mid AND deleted_at IS NULL
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $ms$;

-- Rejestracja pliku po sprawdzeniu sygnatury i rozmiaru (samo wgranie zostaje w warstwie funkcji).
CREATE OR REPLACE FUNCTION public.mb_admin_material_register(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mrg$
DECLARE out_id uuid;
BEGIN
  IF p->>'kind' IS NULL OR p->>'kind' NOT IN ('AUDIO','PDF') THEN RAISE EXCEPTION 'zly rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;
  INSERT INTO public.mb_materials (kind, title, file_key, file_name, file_size, pdf_js_warning, created_by)
  VALUES (p->>'kind', btrim(p->>'title'), p->>'file_key', p->>'file_name',
    NULLIF(p->>'file_size','')::bigint, COALESCE((p->>'pdf_js')::boolean, false), NULLIF(p->>'actor',''))
  RETURNING id INTO out_id;
  RETURN jsonb_build_object('id', out_id);
END $mrg$;

-- Ile os\xF3b straci dost\u0119p po usuni\u0119ciu materia\u0142u \u2014 liczone w bazie, bez p\u0119tli po przydzia\u0142ach.
CREATE OR REPLACE FUNCTION public.mb_admin_material_impact(p_material uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mi$
WITH a AS (SELECT * FROM public.mb_assignments WHERE material_id = p_material AND revoked_at IS NULL),
pp AS (SELECT DISTINCT e.email FROM a, LATERAL public.mb_resolve_recipients(
   CASE WHEN a.target_kind = 'osoba' THEN jsonb_build_object('kind','osoba','emails', jsonb_build_array(a.target_email))
   ELSE jsonb_build_object('kind','grupa','group_id', a.group_id, 'group_mode', a.group_mode,
     'snapshot_emails', to_jsonb(a.snapshot_emails), 'exceptions_add', to_jsonb(a.exceptions_add),
     'exceptions_drop', to_jsonb(a.exceptions_drop)) END) e)
SELECT jsonb_build_object('osoby', (SELECT count(*) FROM pp), 'przydzialy', (SELECT count(*) FROM a))
$mi$;

-- Przydzia\u0142y materia\u0142u/kolekcji: odbiorcy i grupy liczone od razu w bazie.
CREATE OR REPLACE FUNCTION public.mb_admin_assignments_of(p_material uuid DEFAULT NULL, p_collection uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ao$
WITH a AS (
  SELECT x.* FROM public.mb_assignments x
   WHERE (p_material IS NOT NULL AND x.material_id = p_material)
      OR (p_collection IS NOT NULL AND x.collection_id = p_collection)
   ORDER BY x.created_at DESC LIMIT 500
),
pp AS (
  SELECT a.id, e.email FROM a, LATERAL public.mb_resolve_recipients(
    CASE WHEN a.target_kind = 'osoba' THEN jsonb_build_object('kind','osoba','emails', jsonb_build_array(a.target_email))
    ELSE jsonb_build_object('kind','grupa','group_id', a.group_id, 'group_mode', a.group_mode,
      'snapshot_emails', to_jsonb(a.snapshot_emails), 'exceptions_add', to_jsonb(a.exceptions_add),
      'exceptions_drop', to_jsonb(a.exceptions_drop)) END) e
   WHERE a.revoked_at IS NULL
),
it AS (
  SELECT jsonb_build_object('id', a.id, 'target_kind', a.target_kind, 'target_email', a.target_email,
    'group_id', a.group_id, 'group_mode', a.group_mode, 'note', a.note,
    'visible_from', a.visible_from, 'visible_to', a.visible_to, 'created_at', a.created_at, 'revoked_at', a.revoked_at,
    'people', CASE WHEN a.revoked_at IS NULL THEN (SELECT count(*) FROM pp WHERE pp.id = a.id) ELSE 0 END,
    'sample', CASE WHEN a.revoked_at IS NULL THEN COALESCE((SELECT jsonb_agg(x.email ORDER BY x.email) FROM
       (SELECT DISTINCT email FROM pp WHERE pp.id = a.id ORDER BY email LIMIT 5) x), '[]'::jsonb) ELSE '[]'::jsonb END,
    'group', CASE WHEN a.group_id IS NULL THEN NULL ELSE
       (SELECT jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'kind', g.kind)
          FROM public.mb_groups g WHERE g.id = a.group_id) END) AS j,
    a.created_at
  FROM a
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.created_at DESC) FROM it), '[]'::jsonb),
  'odbiorcy', (SELECT count(DISTINCT email) FROM pp),
  'otwarte', CASE WHEN p_material IS NULL THEN NULL ELSE
    (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = p_material AND s.opened_at IS NOT NULL) END)
$ao$;

-- ============ PANEL: WIADOMO\u015ACI (ZAPIS) ============
CREATE OR REPLACE FUNCTION public.mb_admin_message_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mss$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  tgt jsonb := COALESCE(p->'target','{}'::jsonb);
  snap jsonb;
  cnt int;
  out_id uuid;
  st text := CASE WHEN p->>'status' = 'ZAPLANOWANA' THEN 'ZAPLANOWANA' ELSE 'SZKIC' END;
  snd timestamptz := NULLIF(p->>'send_at','')::timestamptz;
BEGIN
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF st = 'ZAPLANOWANA' AND snd IS NULL THEN RAISE EXCEPTION 'brak terminu'; END IF;

  -- Snapshot \u201Etylko obecni" powstaje tu, w tej samej transakcji co zapis.
  IF tgt->>'kind' = 'grupa' AND tgt->>'group_mode' = 'TYLKO_OBECNI' THEN
    SELECT COALESCE(to_jsonb(array_agg(DISTINCT lower(btrim(m.client_email)))), '[]'::jsonb) INTO snap
      FROM public.mb_group_members m WHERE m.group_id = NULLIF(tgt->>'group_id','')::uuid;
    tgt := jsonb_set(tgt, '{snapshot_emails}', COALESCE(snap, '[]'::jsonb));
  END IF;

  SELECT count(*) INTO cnt FROM public.mb_resolve_recipients(tgt) r;

  IF mid IS NULL THEN
    INSERT INTO public.mb_messages (title, body_html, email_mode, attached_material_id, attached_collection_id,
      target, recipient_count, status, send_at, created_by)
    VALUES (NULLIF(p->>'title',''), p->>'body_html', COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      NULLIF(p->>'attached_material_id','')::uuid, NULLIF(p->>'attached_collection_id','')::uuid,
      tgt, cnt, st, snd, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_messages SET title = NULLIF(p->>'title',''), body_html = p->>'body_html',
      email_mode = COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      attached_material_id = NULLIF(p->>'attached_material_id','')::uuid,
      attached_collection_id = NULLIF(p->>'attached_collection_id','')::uuid,
      target = tgt, recipient_count = cnt, status = st, send_at = snd, updated_at = now()
    WHERE id = mid AND status IN ('SZKIC','ZAPLANOWANA')
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id, 'count', cnt);
END $mss$;

-- Atomowe przej\u0119cie wiadomo\u015Bci (ZAPLANOWANA \u2192 WYSYLANIE). p_promote podnosi szkic na \u201Eteraz".
CREATE OR REPLACE FUNCTION public.mb_admin_message_claim(p_id uuid, p_promote boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mcl$
DECLARE r record;
BEGIN
  IF p_id IS NULL THEN RETURN NULL; END IF;
  IF p_promote THEN
    UPDATE public.mb_messages SET status = 'ZAPLANOWANA', send_at = now(), updated_at = now()
     WHERE id = p_id AND status = 'SZKIC';
  END IF;
  UPDATE public.mb_messages
     SET status = 'WYSYLANIE', idem_key = COALESCE(idem_key, 'send:' || id::text), updated_at = now()
   WHERE id = p_id AND status = 'ZAPLANOWANA'
  RETURNING id, title, body_html, email_mode, attached_material_id, attached_collection_id, target INTO r;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'email_mode', r.email_mode,
    'attached_material_id', r.attached_material_id, 'attached_collection_id', r.attached_collection_id, 'target', r.target);
END $mcl$;

-- Domkni\u0119cie wysy\u0142ki: odbiorcy, status i przydzia\u0142 do\u0142\u0105czonego materia\u0142u w jednym wywo\u0142aniu.
CREATE OR REPLACE FUNCTION public.mb_admin_message_finish(p_id uuid, p_emails text[], p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mfn$
DECLARE
  m record;
  n int := 0;
  who text := COALESCE(NULLIF(p_actor,''), 'system');
BEGIN
  IF p_id IS NULL THEN RETURN 0; END IF;
  SELECT target, attached_material_id, attached_collection_id INTO m FROM public.mb_messages WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  n := COALESCE(array_length(p_emails, 1), 0);

  IF n > 0 THEN
    INSERT INTO public.mb_message_recipients (message_id, client_email)
    SELECT p_id, lower(btrim(e)) FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
    ON CONFLICT (message_id, client_email) DO NOTHING;
  END IF;

  UPDATE public.mb_messages SET status = 'WYSLANA', sent_at = now(), recipient_count = n, updated_at = now()
   WHERE id = p_id AND status = 'WYSYLANIE';

  IF m.attached_material_id IS NOT NULL OR m.attached_collection_id IS NOT NULL THEN
    IF m.target->>'kind' = 'grupa' AND NULLIF(m.target->>'group_id','') IS NOT NULL THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, group_id, group_mode,
        snapshot_emails, exceptions_add, exceptions_drop, note, created_by)
      VALUES (m.attached_material_id, m.attached_collection_id, 'grupa', (m.target->>'group_id')::uuid,
        COALESCE(m.target->>'group_mode', 'OBECNI_I_PRZYSZLI'),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'snapshot_emails','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_add','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_drop','[]')) x), '{}'::text[]),
        'do\u0142\u0105czone do wiadomo\u015Bci', who);
    ELSIF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT m.attached_material_id, m.attached_collection_id, 'osoba', lower(btrim(e)), 'do\u0142\u0105czone do wiadomo\u015Bci', who
        FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> '';
    END IF;
  END IF;
  RETURN n;
END $mfn$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_edit(p_id uuid, p_title text, p_body_html text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $med$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET title = NULLIF(p_title,''), body_html = p_body_html, updated_at = now()
   WHERE id = p_id AND status = 'WYSLANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $med$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_cancel(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mca$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET status = 'SZKIC', send_at = NULL, updated_at = now()
   WHERE id = p_id AND status = 'ZAPLANOWANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mca$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_delete(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mdl$
DECLARE k int;
BEGIN
  DELETE FROM public.mb_messages WHERE id = p_id AND status IN ('SZKIC','WYCOFANA');
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mdl$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_withdraw(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mwd$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET status = 'WYCOFANA', withdrawn_at = now(), updated_at = now()
   WHERE id = p_id AND status = 'WYSLANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mwd$;

-- Limit 20 wysy\u0142ek na godzin\u0119 \u2014 jedno zapytanie zamiast osobnego odczytu.
CREATE OR REPLACE FUNCTION public.mb_admin_message_send_rate() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mrt$
SELECT count(*)::int FROM public.mb_messages WHERE sent_at > now() - interval '1 hour'
$mrt$;

-- Wiadomo\u015B\u0107 + adresy nieprzeczytanych (do ponownego powiadomienia) jednym wywo\u0142aniem.
CREATE OR REPLACE FUNCTION public.mb_admin_message_notify(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mnt$
SELECT jsonb_build_object(
  'message', (SELECT jsonb_build_object('id', m.id, 'title', m.title, 'body_html', m.body_html, 'email_mode', m.email_mode)
     FROM public.mb_messages m WHERE m.id = p_id AND m.status = 'WYSLANA'),
  'emails', COALESCE((SELECT jsonb_agg(x.email) FROM
     (SELECT r.client_email AS email FROM public.mb_message_recipients r
       WHERE r.message_id = p_id AND r.read_at IS NULL AND r.hidden_at IS NULL LIMIT 500) x), '[]'::jsonb),
  'niedawno', EXISTS (SELECT 1 FROM public.mb_log l WHERE l.action = 'powiadomienie_ponowne'
     AND l.object_id = p_id::text AND l.at > now() - interval '24 hours'))
$mnt$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_stats(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mst$
SELECT COALESCE(jsonb_agg(jsonb_build_object('client_email', x.client_email, 'delivered_at', x.delivered_at,
  'read_at', x.read_at, 'hidden_at', x.hidden_at) ORDER BY x.read_at DESC NULLS LAST), '[]'::jsonb)
FROM (SELECT * FROM public.mb_message_recipients WHERE message_id = p_id ORDER BY read_at DESC NULLS LAST LIMIT 500) x
$mst$;

-- ============ PANEL: SZABLONY ============
CREATE OR REPLACE FUNCTION public.mb_admin_templates() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mtl$
SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'title', t.title,
  'body_html', t.body_html, 'created_at', t.created_at) ORDER BY t.name), '[]'::jsonb)
FROM public.mb_templates t
$mtl$;

CREATE OR REPLACE FUNCTION public.mb_admin_template_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mts$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  out_id uuid;
BEGIN
  IF NULLIF(btrim(COALESCE(p->>'name','')), '') IS NULL THEN RAISE EXCEPTION 'brak nazwy'; END IF;
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF mid IS NULL THEN
    INSERT INTO public.mb_templates (name, title, body_html, created_by)
    VALUES (btrim(p->>'name'), NULLIF(p->>'title',''), p->>'body_html', NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_templates SET name = btrim(p->>'name'), title = NULLIF(p->>'title',''), body_html = p->>'body_html'
     WHERE id = mid RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $mts$;

CREATE OR REPLACE FUNCTION public.mb_admin_template_delete(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mtd$
DECLARE k int;
BEGIN
  DELETE FROM public.mb_templates WHERE id = p_id;
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mtd$;

-- ============ HISTORIA ZMIAN (ZAPIS) ============
CREATE OR REPLACE FUNCTION public.mb_log_add(p_actor text, p_action text, p_object_type text,
  p_object_id text, p_summary text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $lga$
INSERT INTO public.mb_log (actor, action, object_type, object_id, summary)
VALUES (left(COALESCE(p_actor, 'system'), 200), left(p_action, 60), p_object_type, p_object_id, left(p_summary, 500))
$lga$;

-- ============ USTAWIENIA APLIKACJI (wsp\xF3lne, nie mb_*) ============
-- Ten sam odczyt co getSettingsFast, ale przez PostgREST (Management API to ~1,5 s na zapytanie).
-- Korzystaj\u0105 z niego wszystkie funkcje czytaj\u0105ce Dane firmy i ustawienia SMTP.
CREATE OR REPLACE FUNCTION public.app_settings_get(p_keys text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $asg$
SELECT COALESCE(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
FROM public.app_settings s WHERE s.key = ANY(p_keys)
$asg$;

-- ============ DOST\u0118P: wy\u0142\u0105cznie serwer ============
REVOKE ALL ON FUNCTION public.app_settings_get(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_settings_get(text[]) TO service_role;
REVOKE ALL ON FUNCTION public.mb_lib_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_space() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_library(text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_messages(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_bundle(text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_material_complete(text, boolean, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_message_flag(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_materials(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_collections() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_groups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_dashboard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_clients_mb() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_client_mb(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_group_detail(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_history(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_preview(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_bulk(uuid, text[], text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_revoke(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_group_members(uuid, text[], boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_register(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_impact(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignments_of(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_claim(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_edit(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_cancel(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_withdraw(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_send_rate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_templates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_template_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_template_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_log_add(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mb_lib_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_space() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_library(text, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_messages(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_bundle(text, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_material_complete(text, boolean, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_message_flag(text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_materials(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_collections() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_groups() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_dashboard() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_clients_mb() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_client_mb(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_group_detail(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_history(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_preview(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_bulk(uuid, text[], text, timestamptz, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_revoke(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_group_members(uuid, text[], boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_register(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_impact(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignments_of(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_claim(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_edit(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_cancel(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_delete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_withdraw(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_send_rate() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_notify(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_stats(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_templates() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_template_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_template_delete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_log_add(text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
`;
var CHECKPOINT_RPC_SQL = `
SELECT p.proname AS funkcja,
       p.prosecdef AS security_definer,
       (p.proconfig IS NOT NULL) AS search_path_ustawiony,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'mb\\_%'
ORDER BY p.proname`;

// supabase/functions/_shared/library2bSql.ts
var SCHEMA_2B_SQL = `
-- ============ 1. USTAWIENIA: domeny w\u0142asnych plik\xF3w wideo ============
ALTER TABLE public.mb_settings ADD COLUMN IF NOT EXISTS video_domains text[] NOT NULL DEFAULT '{}';

-- ============ 2. MATERIA\u0141Y: trzecie \u017Ar\xF3d\u0142o wideo ============
-- server_url = adres pliku na serwerze w\u0142a\u015Bciciela (tylko z domen wpisanych w ustawieniach).
ALTER TABLE public.mb_materials ADD COLUMN IF NOT EXISTS server_url text
  CHECK (server_url IS NULL OR (server_url ~ '^https://' AND length(server_url) <= 500));

ALTER TABLE public.mb_materials DROP CONSTRAINT IF EXISTS mb_materials_video_provider_check;
ALTER TABLE public.mb_materials ADD CONSTRAINT mb_materials_video_provider_check
  CHECK (video_provider IS NULL OR video_provider IN ('youtube','vimeo','bunny','plik','serwer'));

-- Rodzaj decyduje o \u017Ar\xF3dle tre\u015Bci. WIDEO ma teraz TRZY wykluczaj\u0105ce si\u0119 \u017Ar\xF3d\u0142a.
ALTER TABLE public.mb_materials DROP CONSTRAINT IF EXISTS mb_materials_check;
ALTER TABLE public.mb_materials ADD CONSTRAINT mb_materials_zrodlo_check CHECK (CASE kind
  WHEN 'AUDIO' THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'PDF'   THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'WIDEO' THEN external_url IS NULL AND body_html IS NULL AND (
       (video_provider IN ('youtube','vimeo','bunny') AND video_id IS NOT NULL AND file_key IS NULL AND server_url IS NULL)
    OR (video_provider = 'plik'   AND file_key IS NOT NULL AND video_id IS NULL AND server_url IS NULL)
    OR (video_provider = 'serwer' AND server_url IS NOT NULL AND file_key IS NULL AND video_id IS NULL))
  WHEN 'LINK'  THEN file_key IS NULL AND external_url IS NOT NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'TEKST' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NOT NULL AND server_url IS NULL
END);

-- ============ 3. ZA\u0141\u0104CZNIKI WIADOMO\u015ACI ============
-- Dok\u0142adnie jedno z dw\xF3ch: materia\u0142 albo kolekcja. Do 10 pozycji na wiadomo\u015B\u0107 (pilnuje funkcja zapisu).
CREATE TABLE IF NOT EXISTS public.mb_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mb_messages(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0 CHECK (position >= 0),
  CHECK ((material_id IS NOT NULL) <> (collection_id IS NOT NULL)),
  UNIQUE (message_id, material_id),
  UNIQUE (message_id, collection_id),
  UNIQUE (message_id, position)
);
CREATE INDEX IF NOT EXISTS mb_msg_att_msg ON public.mb_message_attachments (message_id, position);

-- Stare kolumny attached_* zostaj\u0105. Istniej\u0105ce warto\u015Bci przepisujemy raz do nowej tabeli.
INSERT INTO public.mb_message_attachments (message_id, material_id, collection_id, position)
SELECT m.id, m.attached_material_id, m.attached_collection_id, 0
  FROM public.mb_messages m
 WHERE m.attached_material_id IS NOT NULL OR m.attached_collection_id IS NOT NULL
ON CONFLICT DO NOTHING;

DO $x$ BEGIN
  ALTER TABLE public.mb_message_attachments ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.mb_message_attachments FROM PUBLIC, anon, authenticated;
END $x$;
`;
var RPC_2B_SQL = `
-- ============ USTAWIENIA (z domenami wideo) ============
CREATE OR REPLACE FUNCTION public.mb_lib_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ls$
  SELECT COALESCE(
    (SELECT jsonb_build_object('library_mode', s.library_mode, 'messages_mode', s.messages_mode,
       'email_notify', s.email_notify, 'whatsapp', s.whatsapp, 'space_limit_mb', s.space_limit_mb,
       'video_domains', s.video_domains)
       FROM public.mb_settings s WHERE s.id = 1),
    jsonb_build_object('library_mode','off','messages_mode','off','email_notify',false,'whatsapp',NULL,
       'space_limit_mb',5120,'video_domains','[]'::jsonb))
$ls$;

-- Zapis ustawie\u0144 modu\u0142u (jedno miejsce, bez SQL-a w warstwie funkcji).
CREATE OR REPLACE FUNCTION public.mb_admin_settings_save(p jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ssv$
DECLARE
  lib text := CASE WHEN p->>'library_mode' IN ('off','admin','on') THEN p->>'library_mode' ELSE 'off' END;
  msg text := CASE WHEN p->>'messages_mode' IN ('off','admin','on') THEN p->>'messages_mode' ELSE 'off' END;
  wa text := NULLIF(btrim(COALESCE(p->>'whatsapp','')), '');
  lim int := LEAST(1048576, GREATEST(64, COALESCE(NULLIF(p->>'space_limit_mb','')::int, 5120)));
  dom text[] := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM jsonb_array_elements_text(COALESCE(p->'video_domains','[]')) x
     WHERE lower(btrim(x)) <> ''), '{}'::text[]);
BEGIN
  IF wa IS NOT NULL AND wa !~ '^https://wa\\.me/[0-9]{6,20}$' THEN RAISE EXCEPTION 'zly whatsapp'; END IF;
  UPDATE public.mb_settings SET library_mode = lib, messages_mode = msg,
    email_notify = COALESCE((p->>'email_notify')::boolean, false), whatsapp = wa,
    space_limit_mb = lim, video_domains = dom, updated_at = now() WHERE id = 1;
  RETURN true;
END $ssv$;

-- ============ KLIENT: OTWARCIE MATERIA\u0141U (dochodzi adres z serwera) ============
CREATE OR REPLACE FUNCTION public.mb_client_open(p_email text, p_admin boolean, p_material_id uuid,
  p_mark_opened boolean DEFAULT true, p_rate_key text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $co$
DECLARE
  mail text := lower(btrim(COALESCE(p_email,'')));
  m record;
  r text;
BEGIN
  IF p_material_id IS NULL THEN RETURN jsonb_build_object('status','denied'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mb_visible_materials(p_email, p_admin) v WHERE v.material_id = p_material_id) THEN
    RETURN jsonb_build_object('status','denied');
  END IF;
  SELECT mm.id, mm.title, mm.kind, mm.file_key, mm.external_url, mm.video_provider, mm.video_id,
         mm.server_url, mm.body_html, mm.allow_download
    INTO m FROM public.mb_materials mm WHERE mm.id = p_material_id AND mm.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','denied'); END IF;

  IF p_rate_key IS NOT NULL THEN
    r := public.mb_link_hit(p_rate_key, COALESCE(p_limit, 30));
    IF r <> 'ok' THEN RETURN jsonb_build_object('status','rate'); END IF;
  END IF;

  IF p_mark_opened THEN
    INSERT INTO public.mb_material_state (client_email, material_id, opened_at)
    VALUES (mail, p_material_id, now())
    ON CONFLICT (client_email, material_id)
    DO UPDATE SET opened_at = COALESCE(public.mb_material_state.opened_at, EXCLUDED.opened_at);
  END IF;

  RETURN jsonb_build_object('status','ok','material', jsonb_build_object(
    'id', m.id, 'title', m.title, 'kind', m.kind, 'file_key', m.file_key, 'external_url', m.external_url,
    'video_provider', m.video_provider, 'video_id', m.video_id, 'server_url', m.server_url,
    'body_html', m.body_html, 'allow_download', m.allow_download));
END $co$;

-- ============ KLIENT: WIADOMO\u015ACI (wszystkie za\u0142\u0105czniki) ============
CREATE OR REPLACE FUNCTION public.mb_client_messages(p_email text, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
r AS (
  SELECT m.id, m.title, m.body_html, m.sent_at, rr.read_at
    FROM public.mb_message_recipients rr
    JOIN public.mb_messages m ON m.id = rr.message_id
   WHERE rr.client_email = (SELECT mail FROM me) AND m.status = 'WYSLANA' AND rr.hidden_at IS NULL
   ORDER BY m.sent_at DESC NULLS LAST LIMIT 100
),
att AS (
  SELECT a.message_id,
         jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
           'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title,
           'position', a.position) ORDER BY a.position) AS j
    FROM public.mb_message_attachments a
    LEFT JOIN public.mb_materials mm ON mm.id = a.material_id AND mm.deleted_at IS NULL
    LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id AND cc.deleted_at IS NULL
   GROUP BY a.message_id
),
it AS (
  SELECT jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'sent_at', r.sent_at,
    'read_at', r.read_at, 'attachments', COALESCE(att.j, '[]'::jsonb)) AS j, r.sent_at, r.read_at
  FROM r LEFT JOIN att ON att.message_id = r.id
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sent_at DESC NULLS LAST) FROM it), '[]'::jsonb),
  'unread', CASE WHEN p_preview THEN 0 ELSE (SELECT count(*) FROM it WHERE it.read_at IS NULL) END)
$cm$;

-- ============ PANEL: MATERIA\u0141Y (trzy \u017Ar\xF3d\u0142a wideo) ============
CREATE OR REPLACE FUNCTION public.mb_admin_material_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ms$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  k text := p->>'kind';
  vsrc text := NULLIF(p->>'video_source','');
  vurl text := NULLIF(btrim(COALESCE(p->>'external_url','')), '');
  vsrv text := NULLIF(btrim(COALESCE(p->>'server_url','')), '');
  vprov text := NULLIF(p->>'video_provider','');
  vid text := NULLIF(p->>'video_id','');
  vhtml text := NULLIF(p->>'body_html','');
  vkeep boolean := COALESCE((p->>'keep_video')::boolean, false);
  -- Zmiana \u017Ar\xF3d\u0142a wideo z pliku na adres/link: kolumny pliku musz\u0105 zosta\u0107 puste (regu\u0142a sp\xF3jno\u015Bci).
  clearfile boolean := false;
  out_id uuid;
BEGIN
  IF k IS NULL OR k NOT IN ('AUDIO','WIDEO','PDF','LINK','TEKST') THEN RAISE EXCEPTION 'nieznany rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;

  IF k = 'LINK' THEN
    IF vurl IS NULL OR vurl NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu'; END IF;
    vprov := NULL; vid := NULL; vhtml := NULL; vsrv := NULL;
  ELSIF k = 'WIDEO' THEN
    vurl := NULL; vhtml := NULL;
    IF vkeep THEN
      vprov := NULL; vid := NULL; vsrv := NULL;
    ELSIF vsrc = 'serwer' THEN
      clearfile := true;
      IF vsrv IS NULL OR vsrv NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu pliku'; END IF;
      vprov := 'serwer'; vid := NULL;
    ELSIF vsrc = 'plik' THEN
      vprov := 'plik'; vid := NULL; vsrv := NULL;
    ELSE
      vsrv := NULL; clearfile := true;
      IF vprov IS NULL OR vid IS NULL THEN RAISE EXCEPTION 'brak zrodla wideo'; END IF;
    END IF;
  ELSIF k = 'TEKST' THEN
    IF vhtml IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
    vurl := NULL; vprov := NULL; vid := NULL; vsrv := NULL;
  ELSE
    vurl := NULL; vprov := NULL; vid := NULL; vhtml := NULL; vsrv := NULL;
  END IF;

  IF mid IS NULL THEN
    IF k IN ('PDF','AUDIO') THEN RAISE EXCEPTION 'najpierw plik'; END IF;
    INSERT INTO public.mb_materials (kind, title, description, stage, tags, duration_s, pages, allow_download,
      source, external_url, video_provider, video_id, server_url, body_html, created_by)
    VALUES (k, btrim(p->>'title'), NULLIF(p->>'description',''), NULLIF(p->>'stage',''),
      COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      NULLIF(p->>'duration_s','')::int, NULLIF(p->>'pages','')::int,
      COALESCE((p->>'allow_download')::boolean, false), NULLIF(p->>'source',''),
      vurl, vprov, vid, vsrv, vhtml, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_materials SET
      kind = k, title = btrim(p->>'title'), description = NULLIF(p->>'description',''),
      stage = NULLIF(p->>'stage',''),
      tags = COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      duration_s = NULLIF(p->>'duration_s','')::int, pages = NULLIF(p->>'pages','')::int,
      allow_download = COALESCE((p->>'allow_download')::boolean, false), source = NULLIF(p->>'source',''),
      external_url = vurl,
      video_provider = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_provider ELSE vprov END,
      video_id = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_id ELSE vid END,
      server_url = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.server_url ELSE vsrv END,
      file_key = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_key END,
      file_name = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_name END,
      file_size = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_size END,
      prev_file_key = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_key END,
      prev_file_name = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_name END,
      prev_file_size = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_size END,
      body_html = vhtml, updated_at = now()
    WHERE id = mid AND deleted_at IS NULL
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $ms$;

-- Rejestracja pliku: PDF, AUDIO albo WIDEO (plik wideo).
CREATE OR REPLACE FUNCTION public.mb_admin_material_register(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mrg$
DECLARE out_id uuid;
BEGIN
  IF p->>'kind' IS NULL OR p->>'kind' NOT IN ('AUDIO','PDF','WIDEO') THEN RAISE EXCEPTION 'zly rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;
  INSERT INTO public.mb_materials (kind, title, file_key, file_name, file_size, pdf_js_warning, video_provider, created_by)
  VALUES (p->>'kind', btrim(p->>'title'), p->>'file_key', p->>'file_name',
    NULLIF(p->>'file_size','')::bigint, COALESCE((p->>'pdf_js')::boolean, false),
    CASE WHEN p->>'kind' = 'WIDEO' THEN 'plik' ELSE NULL END, NULLIF(p->>'actor',''))
  RETURNING id INTO out_id;
  RETURN jsonb_build_object('id', out_id);
END $mrg$;

-- Lista materia\u0142\xF3w: dok\u0142adamy \u017Ar\xF3d\u0142o wideo i obecno\u015B\u0107 pliku.
CREATE OR REPLACE FUNCTION public.mb_admin_materials(p_kind text DEFAULT NULL, p_q text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $am$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description, 'stage', m.stage, 'tags', m.tags,
  'file_version', m.file_version, 'file_size', m.file_size, 'prev_file_size', m.prev_file_size,
  'prev_file_name', m.prev_file_name, 'pdf_js_warning', m.pdf_js_warning, 'external_url', m.external_url,
  'video_provider', m.video_provider, 'video_id', m.video_id, 'server_url', m.server_url,
  'file_name', m.file_name, 'has_file', (m.file_key IS NOT NULL),
  'duration_s', m.duration_s, 'pages', m.pages,
  'allow_download', m.allow_download, 'body_html', m.body_html, 'created_at', m.created_at, 'source', m.source,
  'przydzialy', (SELECT count(*) FROM public.mb_assignments x WHERE x.revoked_at IS NULL
     AND (x.material_id = m.id OR x.collection_id IN
       (SELECT ci.collection_id FROM public.mb_collection_items ci WHERE ci.material_id = m.id))),
  'otwarte', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.opened_at IS NOT NULL),
  'ukonczone', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.completed_at IS NOT NULL)
) ORDER BY m.created_at DESC), '[]'::jsonb)
FROM (
  SELECT * FROM public.mb_materials mm
   WHERE mm.deleted_at IS NULL
     AND (p_kind IS NULL OR mm.kind = p_kind)
     AND (p_q IS NULL OR p_q = '' OR mm.title ILIKE '%' || p_q || '%' OR COALESCE(mm.description,'') ILIKE '%' || p_q || '%')
   ORDER BY mm.created_at DESC LIMIT 500
) m
$am$;

-- ============ PANEL: WIADOMO\u015A\u0106 Z WIELOMA ZA\u0141\u0104CZNIKAMI ============
CREATE OR REPLACE FUNCTION public.mb_admin_message_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mss$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  tgt jsonb := COALESCE(p->'target','{}'::jsonb);
  snap jsonb;
  cnt int;
  out_id uuid;
  st text := CASE WHEN p->>'status' = 'ZAPLANOWANA' THEN 'ZAPLANOWANA' ELSE 'SZKIC' END;
  snd timestamptz := NULLIF(p->>'send_at','')::timestamptz;
  att jsonb := COALESCE(p->'attachments','[]'::jsonb);
  natt int;
BEGIN
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF st = 'ZAPLANOWANA' AND snd IS NULL THEN RAISE EXCEPTION 'brak terminu'; END IF;
  natt := jsonb_array_length(att);
  IF natt > 10 THEN RAISE EXCEPTION 'za duzo zalacznikow'; END IF;

  IF tgt->>'kind' = 'grupa' AND tgt->>'group_mode' = 'TYLKO_OBECNI' THEN
    SELECT COALESCE(to_jsonb(array_agg(DISTINCT lower(btrim(m.client_email)))), '[]'::jsonb) INTO snap
      FROM public.mb_group_members m WHERE m.group_id = NULLIF(tgt->>'group_id','')::uuid;
    tgt := jsonb_set(tgt, '{snapshot_emails}', COALESCE(snap, '[]'::jsonb));
  END IF;

  SELECT count(*) INTO cnt FROM public.mb_resolve_recipients(tgt) r;

  IF mid IS NULL THEN
    INSERT INTO public.mb_messages (title, body_html, email_mode, attached_material_id, attached_collection_id,
      target, recipient_count, status, send_at, created_by)
    VALUES (NULLIF(p->>'title',''), p->>'body_html', COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      NULLIF(p->>'attached_material_id','')::uuid, NULLIF(p->>'attached_collection_id','')::uuid,
      tgt, cnt, st, snd, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_messages SET title = NULLIF(p->>'title',''), body_html = p->>'body_html',
      email_mode = COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      attached_material_id = NULLIF(p->>'attached_material_id','')::uuid,
      attached_collection_id = NULLIF(p->>'attached_collection_id','')::uuid,
      target = tgt, recipient_count = cnt, status = st, send_at = snd, updated_at = now()
    WHERE id = mid AND status IN ('SZKIC','ZAPLANOWANA')
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
    DELETE FROM public.mb_message_attachments WHERE message_id = out_id;
  END IF;

  IF natt > 0 THEN
    INSERT INTO public.mb_message_attachments (message_id, material_id, collection_id, position)
    SELECT out_id,
      NULLIF(x->>'material_id','')::uuid, NULLIF(x->>'collection_id','')::uuid, (ord - 1)
      FROM jsonb_array_elements(att) WITH ORDINALITY AS t(x, ord)
     WHERE (NULLIF(x->>'material_id','') IS NULL) <> (NULLIF(x->>'collection_id','') IS NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', out_id, 'count', cnt, 'zalaczniki', natt);
END $mss$;

-- Domkni\u0119cie wysy\u0142ki: przej\u015Bcie statusu jest bramk\u0105 \u2014 ponowne wywo\u0142anie nic nie dubluje.
-- Ka\u017Cdy za\u0142\u0105cznik (materia\u0142 albo kolekcja) trafia do tych samych odbiorc\xF3w.
CREATE OR REPLACE FUNCTION public.mb_admin_message_finish(p_id uuid, p_emails text[], p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mfn$
DECLARE
  m record;
  n int := 0;
  k int := 0;
  who text := COALESCE(NULLIF(p_actor,''), 'system');
BEGIN
  IF p_id IS NULL THEN RETURN 0; END IF;
  SELECT target INTO m FROM public.mb_messages WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  UPDATE public.mb_messages SET status = 'WYSLANA', sent_at = now(),
    recipient_count = COALESCE(array_length(p_emails, 1), 0), updated_at = now()
   WHERE id = p_id AND status = 'WYSYLANIE';
  GET DIAGNOSTICS k = ROW_COUNT;
  IF k = 0 THEN RETURN 0; END IF;

  n := COALESCE(array_length(p_emails, 1), 0);

  IF n > 0 THEN
    INSERT INTO public.mb_message_recipients (message_id, client_email)
    SELECT p_id, lower(btrim(e)) FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
    ON CONFLICT (message_id, client_email) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM public.mb_message_attachments a WHERE a.message_id = p_id) THEN
    IF m.target->>'kind' = 'grupa' AND NULLIF(m.target->>'group_id','') IS NOT NULL THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, group_id, group_mode,
        snapshot_emails, exceptions_add, exceptions_drop, note, created_by)
      SELECT a.material_id, a.collection_id, 'grupa', (m.target->>'group_id')::uuid,
        COALESCE(m.target->>'group_mode', 'OBECNI_I_PRZYSZLI'),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'snapshot_emails','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_add','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_drop','[]')) x), '{}'::text[]),
        'do\u0142\u0105czone do wiadomo\u015Bci', who
        FROM public.mb_message_attachments a WHERE a.message_id = p_id;
    ELSIF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT a.material_id, a.collection_id, 'osoba', lower(btrim(e)), 'do\u0142\u0105czone do wiadomo\u015Bci', who
        FROM public.mb_message_attachments a, unnest(p_emails) AS e
       WHERE a.message_id = p_id AND lower(btrim(e)) <> '';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.mb_messages x WHERE x.id = p_id AND (x.attached_material_id IS NOT NULL OR x.attached_collection_id IS NOT NULL)) THEN
    -- Zgodno\u015B\u0107 ze star\u0105 kolumn\u0105: wiadomo\u015B\u0107 sprzed migracji.
    SELECT attached_material_id, attached_collection_id INTO m FROM public.mb_messages WHERE id = p_id;
    IF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT m.attached_material_id, m.attached_collection_id, 'osoba', lower(btrim(e)), 'do\u0142\u0105czone do wiadomo\u015Bci', who
        FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> '';
    END IF;
  END IF;
  RETURN n;
END $mfn$;

-- ============ PANEL: PRZYDZIA\u0141 KILKU MATERIA\u0141\xD3W NARAZ ============
-- Jedno wywo\u0142anie: ka\u017Cdy materia\u0142 z listy trafia do tych samych odbiorc\xF3w (albo do grupy wg trybu).
CREATE OR REPLACE FUNCTION public.mb_admin_assign_many(p_materials uuid[], p_target jsonb,
  p_note text DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_actor text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $amany$
DECLARE
  kind text := CASE WHEN p_target->>'kind' = 'grupa' THEN 'grupa' ELSE 'osoba' END;
  gid uuid := NULLIF(p_target->>'group_id','')::uuid;
  gmode text;
  snap text[];
  addx text[];
  dropx text[];
  tgtjson jsonb;
  em text[];
  who text := COALESCE(NULLIF(p_actor,''), 'system');
  mats uuid[];
  nmat int;
  nppl int;
  nass int;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::uuid[]) INTO mats FROM unnest(COALESCE(p_materials,'{}'::uuid[])) x WHERE x IS NOT NULL;
  nmat := COALESCE(array_length(mats, 1), 0);
  IF nmat = 0 THEN RAISE EXCEPTION 'brak materialow'; END IF;
  IF nmat > 100 THEN RAISE EXCEPTION 'za duzo materialow'; END IF;

  IF kind = 'grupa' THEN
    IF gid IS NULL THEN RAISE EXCEPTION 'brak grupy'; END IF;
    gmode := CASE WHEN p_target->>'group_mode' = 'TYLKO_OBECNI' THEN 'TYLKO_OBECNI' ELSE 'OBECNI_I_PRZYSZLI' END;
    addx := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_target->'exceptions_add','[]')) x), '{}'::text[]);
    dropx := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_target->'exceptions_drop','[]')) x), '{}'::text[]);
    IF gmode = 'TYLKO_OBECNI' THEN
      SELECT COALESCE(array_agg(DISTINCT lower(btrim(m.client_email))), '{}'::text[])
        INTO snap FROM public.mb_group_members m WHERE m.group_id = gid;
    ELSE
      snap := '{}';
    END IF;
    tgtjson := jsonb_build_object('kind','grupa','group_id', gid, 'group_mode', gmode,
      'snapshot_emails', to_jsonb(snap), 'exceptions_add', to_jsonb(addx), 'exceptions_drop', to_jsonb(dropx));

    INSERT INTO public.mb_assignments (material_id, target_kind, group_id, group_mode,
      snapshot_emails, exceptions_add, exceptions_drop, note, visible_from, visible_to, created_by)
    SELECT m, 'grupa', gid, gmode, snap, addx, dropx, NULLIF(p_note,''), p_from, p_to, who
      FROM unnest(mats) AS m;
  ELSE
    em := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM jsonb_array_elements_text(COALESCE(p_target->'emails','[]')) x
       WHERE lower(btrim(x)) <> ''), '{}'::text[]);
    IF COALESCE(array_length(em, 1), 0) = 0 THEN RAISE EXCEPTION 'brak osob'; END IF;
    tgtjson := jsonb_build_object('kind','osoba','emails', to_jsonb(em));

    INSERT INTO public.mb_assignments (material_id, target_kind, target_email, note, visible_from, visible_to, created_by)
    SELECT m, 'osoba', e, NULLIF(p_note,''), p_from, p_to, who
      FROM unnest(mats) AS m, unnest(em) AS e;
  END IF;

  SELECT count(*) INTO nass FROM public.mb_assignments a
   WHERE a.created_by = who AND a.created_at > now() - interval '5 seconds' AND a.material_id = ANY(mats) AND a.revoked_at IS NULL;
  SELECT count(DISTINCT e.email) INTO nppl FROM public.mb_resolve_recipients(tgtjson) e;

  RETURN jsonb_build_object('materialy', nmat, 'osoby', COALESCE(nppl,0), 'przydzialy', COALESCE(nass,0));
END $amany$;

-- Lista wiadomo\u015Bci w panelu: liczba i tytu\u0142y za\u0142\u0105cznik\xF3w z nowej tabeli.
CREATE OR REPLACE FUNCTION public.mb_admin_messages() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ams$
WITH src AS (
  SELECT m.*, g.name AS group_name
    FROM public.mb_messages m
    LEFT JOIN public.mb_groups g ON g.id = NULLIF(m.target->>'group_id','')::uuid
   ORDER BY COALESCE(m.sent_at, m.send_at, m.created_at) DESC LIMIT 200
),
it AS (
  SELECT jsonb_build_object(
    'id', s.id, 'title', s.title, 'body_html', s.body_html, 'status', s.status, 'send_at', s.send_at,
    'email_mode', s.email_mode, 'recipient_count', s.recipient_count, 'target', s.target, 'created_at', s.created_at,
    'sent_at', s.sent_at, 'withdrawn_at', s.withdrawn_at, 'group_name', s.group_name,
    'zalaczniki', (SELECT count(*) FROM public.mb_message_attachments a WHERE a.message_id = s.id),
    'attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
        'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title, 'position', a.position)
        ORDER BY a.position)
       FROM public.mb_message_attachments a
       LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
       LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
      WHERE a.message_id = s.id), '[]'::jsonb),
    'dostarczone', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id),
    'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id AND r.read_at IS NOT NULL)
  ) AS j, COALESCE(s.sent_at, s.send_at, s.created_at) AS sort
  FROM src s
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sort DESC) FROM it), '[]'::jsonb),
  'liczniki', (SELECT jsonb_build_object(
    'wyslane', count(*) FILTER (WHERE status = 'WYSLANA'),
    'zaplanowane', count(*) FILTER (WHERE status = 'ZAPLANOWANA'),
    'szkice', count(*) FILTER (WHERE status = 'SZKIC'),
    'wycofane', count(*) FILTER (WHERE status = 'WYCOFANA')) FROM public.mb_messages))
$ams$;

-- Za\u0142\u0105czniki do podgl\u0105du formularza i ponownego otwarcia wiadomo\u015Bci.
CREATE OR REPLACE FUNCTION public.mb_admin_message_attachments(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $matt$
SELECT COALESCE(jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
  'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title, 'position', a.position)
  ORDER BY a.position), '[]'::jsonb)
FROM public.mb_message_attachments a
LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
WHERE a.message_id = p_id
$matt$;

-- ============ DOST\u0118P: wy\u0142\u0105cznie serwer ============
REVOKE ALL ON FUNCTION public.mb_admin_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_attachments(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mb_admin_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_attachments(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mb_lib_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_settings_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_messages(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_register(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_materials(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assign_many(uuid[], jsonb, text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mb_lib_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_settings_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_messages(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_register(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_materials(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assign_many(uuid[], jsonb, text, timestamptz, timestamptz, text) TO service_role;

NOTIFY pgrst, 'reload schema';
`;

// supabase/functions/_shared/libraryAccess.ts
var MODES = ["off", "admin", "on"];
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
var resetLibSettings = () => {
  CFG_AT = 0;
};
function firstName(me2) {
  const a = String(me2 && me2.imie || "").trim();
  if (a) return a;
  const b = String(me2 && me2.full_name || "").trim();
  return b ? b.split(/\s+/)[0] : "";
}
var resolveRecipients = (base44, target) => rpc(base44, "mb_resolve_recipients", { p_target: target || {} });
async function inBatches(list, size, fn) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(...await Promise.all(list.slice(i, i + size).map(fn)));
  }
  return out;
}
function randomToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
function plainText(html, max = 160) {
  const t = String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}\u2026` : t;
}

// supabase/functions/_shared/libraryMedia.ts
var YT_ID = /^[A-Za-z0-9_-]{11}$/;
var VIMEO_ID = /^\d{6,12}$/;
var VIMEO_HASH = /^[0-9a-f]{6,20}$/;
var BUNNY_ID = /^\d{3,12}\/[A-Za-z0-9_-]{1,40}$/;
var MAX_BYTES = { PDF: 100 * 1024 * 1024, AUDIO: 500 * 1024 * 1024, WIDEO: 500 * 1024 * 1024 };
var ALLOWED_EXT = { PDF: ["pdf"], AUDIO: ["mp3", "m4a"], WIDEO: ["mp4", "m4v", "webm"] };
var SNIFF_BYTES = 262144;
var MAX_MB = { PDF: 100, AUDIO: 500, WIDEO: 500 };
function sniffVideo(b) {
  if (!b || b.length < 16) return false;
  if (b[0] === 26 && b[1] === 69 && b[2] === 223 && b[3] === 163) return true;
  let s = "";
  for (let i = 4; i < 8; i++) s += String.fromCharCode(b[i]);
  return s === "ftyp";
}
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
function normalizeVideo(raw) {
  const s = String(raw || "").trim();
  if (!/^https:\/\//i.test(s)) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  if (["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"].includes(host)) {
    let id = "";
    if (host.endsWith("youtu.be")) id = path.slice(1).split("/")[0];
    else if (path === "/watch") id = u.searchParams.get("v") || "";
    else {
      const m = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(path);
      id = m ? m[1] : "";
    }
    if (!YT_ID.test(id)) return null;
    return { provider: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0` };
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const m = /^\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?$/.exec(path);
    if (!m || !VIMEO_ID.test(m[1])) return null;
    const h = m[2] || u.searchParams.get("h") || "";
    if (h && !VIMEO_HASH.test(h)) return null;
    const id = h ? `${m[1]}:${h}` : m[1];
    return { provider: "vimeo", id, embed: embedUrl("vimeo", id) };
  }
  if (["iframe.mediadelivery.net", "player.mediadelivery.net"].includes(host)) {
    const m = /^\/embed\/(\d{3,12}\/[A-Za-z0-9_-]{1,40})$/.exec(path);
    if (!m || !BUNNY_ID.test(m[1])) return null;
    return { provider: "bunny", id: m[1], embed: `https://iframe.mediadelivery.net/embed/${m[1]}` };
  }
  return null;
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
function sniff(kind, b) {
  if (!b || b.length < 12) return false;
  const ascii = (o, n) => {
    let s = "";
    for (let i = o; i < o + n && i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  };
  if (kind === "PDF") return ascii(0, 5) === "%PDF-";
  if (kind === "AUDIO") {
    if (ascii(0, 3) === "ID3") return true;
    if (b[0] === 255 && (b[1] & 224) === 224) return true;
    if (ascii(4, 4) === "ftyp") return true;
    return false;
  }
  if (kind === "WIDEO") return sniffVideo(b);
  return false;
}
function pdfHasJs(b) {
  try {
    const s = new TextDecoder("latin1").decode(b);
    return /\/JavaScript|\/JS[\s/<>[\]]/.test(s);
  } catch {
    return false;
  }
}
var mb = (bytes) => Math.round((Number(bytes) || 0) / 1048576 * 10) / 10;

// supabase/functions/_shared/smtp.ts
import nodemailer2 from "npm:nodemailer@6.9.13";

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
var CFG2 = null;
var CFG_AT2 = 0;
async function mailConfig(base44) {
  if (CFG_AT2 && Date.now() - CFG_AT2 < 3e4) return CFG2;
  CFG2 = await getSetting(base44, "smtp").catch(() => null);
  CFG_AT2 = Date.now();
  return CFG2;
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

// supabase/functions/_shared/libraryNotify.ts
var FOOTER_REPLY = "Na t\u0119 wiadomo\u015B\u0107 odpowiesz e-mailem lub na WhatsAppie.";
var FOOTER_CRISIS = "Je\u015Bli jeste\u015B w kryzysie: 116 123 \xB7 800 70 2222 (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 112.";
var SEND_BATCH = 6;
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
var wrap = (title, inner, appUrl) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#E3E3E3;background:#0A0A0B;padding:24px">
  <p style="font-size:12px;letter-spacing:.18em;color:#C9A24A;margin:0 0 12px">EXMORTIS</p>
  <h1 style="font-size:20px;color:#F5EFE1;margin:0 0 16px">${title}</h1>
  ${inner}
  <p style="font-size:13px;color:#8A8A8C;margin:24px 0 0">${FOOTER_REPLY}<br>${FOOTER_CRISIS}</p>
  <p style="font-size:12px;color:#8A8A8C;margin:16px 0 0"><a href="${appUrl}/konto" style="color:#C9A24A">exmortis.pl \xB7 Moje konto</a></p>
</div>`;
async function sendMessageEmail(base44, message, emails) {
  if (!message || message.email_mode === "BRAK" || !emails || !emails.length) return { sent: 0 };
  const appUrl = await loadAppUrl(base44);
  const title = message.title ? String(message.title) : "Nowa wiadomo\u015B\u0107";
  const html = message.email_mode === "PELNA" ? wrap(title, `<div style="font-size:15px;line-height:1.7">${sanitizeHtml(message.body_html)}</div>`, appUrl) : wrap("Masz now\u0105 wiadomo\u015B\u0107 na exmortis.pl", `<p style="font-size:15px;line-height:1.7">Zaloguj si\u0119, aby j\u0105 przeczyta\u0107.</p>`, appUrl);
  const subject = message.email_mode === "PELNA" ? title : "Masz now\u0105 wiadomo\u015B\u0107 na exmortis.pl";
  const results = await inBatches(emails.slice(0, 500), SEND_BATCH, (to) => sendMail(base44, {
    to,
    subject,
    html,
    kind: "biblioteka_wiadomosc",
    ref: String(message.id || "")
  }).catch(() => null));
  return { sent: results.filter(Boolean).length };
}
async function deliverMessage(base44, messageId, actor) {
  const m = await rpc(base44, "mb_admin_message_claim", { p_id: messageId, p_promote: true }).catch(() => null);
  if (!m || !m.id) return { ok: false, reason: "nie_przejeta" };
  const people = await resolveRecipients(base44, m.target || {}).catch(() => []) || [];
  const emails = [...new Set(people.map((p) => String(p.email || "").toLowerCase()).filter(Boolean))];
  await rpc(base44, "mb_admin_message_finish", {
    p_id: m.id,
    p_emails: emails,
    p_actor: String(actor || "system").slice(0, 200)
  }).catch(() => 0);
  await sendMessageEmail(base44, m, emails).catch(() => {
  });
  await libLog(base44, actor, "wiadomosc_wyslana", "message", m.id, `odbiorcy: ${emails.length}`);
  return { ok: true, id: m.id, odbiorcy: emails.length };
}
var libLog = (base44, actor, action, objectType, objectId, summary) => rpc(base44, "mb_log_add", {
  p_actor: String(actor || "system").slice(0, 200),
  p_action: String(action || "").slice(0, 60),
  p_object_type: objectType || null,
  p_object_id: objectId ? String(objectId) : null,
  p_summary: summary ? String(summary).slice(0, 500) : null
});

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

// supabase/functions/libraryAdmin/index.ts
var NOT_FOUND = () => Response.json({ error: "Nie znaleziono" }, { status: 404 });
var bad = (m, s = 400) => Response.json({ error: m }, { status: s });
var int = (v, min, max, def = null) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== "" && v !== null && v !== void 0 ? Math.min(max, Math.max(min, n)) : def;
};
var uuidOrNull = (v) => /^[0-9a-fA-F-]{36}$/.test(String(v || "").trim()) ? String(v).trim() : null;
var iso = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new Error("Niepoprawna data");
  return d.toISOString();
};
var emailsOf = (v, max = 2e3) => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x || "").trim().toLowerCase()).filter((x) => x.includes("@") && x.length <= 320))].slice(0, max);
var lower = (v) => String(v || "").trim().toLowerCase();
async function verifyUpload(base44, kind, fileUri, fileName, declaredSize, pdfJsHint) {
  const allowed = ALLOWED_EXT[kind];
  if (!allowed) throw new Error("Ten rodzaj materia\u0142u nie przyjmuje pliku.");
  const ext = extOf(fileName);
  if (!allowed.includes(ext)) throw new Error(`Dozwolone rozszerzenia: ${allowed.map((x) => "." + x).join(", ")}.`);
  if (String(fileUri).includes("@")) throw new Error("Klucz pliku nie mo\u017Ce zawiera\u0107 adresu e-mail.");
  if (/^cf\/private\//.test(String(fileUri))) {
    const size2 = Number(declaredSize) || 0;
    if (!size2) throw new Error("Nie uda\u0142o si\u0119 odczyta\u0107 wgranego pliku.");
    if (size2 > MAX_BYTES[kind]) throw new Error(`Plik jest za du\u017Cy: ${mb(size2)} MB, a limit to ${MAX_MB[kind]} MB.`);
    return { size: size2, pdfJs: kind === "PDF" && pdfJsHint === true };
  }
  const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 60 });
  if (!signed || !signed.signed_url) throw new Error("Nie uda\u0142o si\u0119 odczyta\u0107 wgranego pliku.");
  const res = await fetch(signed.signed_url, {
    headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` },
    signal: AbortSignal.timeout(25e3)
  }).catch(() => null);
  if (!res || !res.ok && res.status !== 206) throw new Error("Nie uda\u0142o si\u0119 odczyta\u0107 wgranego pliku.");
  const buf = new Uint8Array(await res.arrayBuffer());
  let size = Number(declaredSize) || 0;
  const cr = res.headers.get("content-range") || "";
  const m = /\/(\d+)\s*$/.exec(cr);
  if (m) size = Number(m[1]);
  else if (res.status === 200) size = buf.length;
  if (size > MAX_BYTES[kind]) throw new Error(`Plik jest za du\u017Cy: ${mb(size)} MB, a limit to ${MAX_MB[kind]} MB.`);
  if (!sniff(kind, buf)) throw new Error("Sygnatura pliku nie zgadza si\u0119 z rozszerzeniem \u2014 plik odrzucony.");
  return { size, pdfJs: kind === "PDF" ? pdfHasJs(buf) : false };
}
function cleanTarget(body) {
  const kind = body && body.kind === "grupa" ? "grupa" : "osoba";
  const t = { kind };
  if (kind === "osoba") {
    t.emails = emailsOf(body.emails);
    if (!t.emails.length) throw new Error("Wybierz osob\u0119.");
  } else {
    t.group_id = uuidOrNull(body.group_id);
    if (!t.group_id) throw new Error("Wybierz grup\u0119.");
    t.group_mode = body.group_mode === "TYLKO_OBECNI" ? "TYLKO_OBECNI" : "OBECNI_I_PRZYSZLI";
    t.snapshot_emails = t.group_mode === "TYLKO_OBECNI" ? emailsOf(body.snapshot_emails) : [];
    t.exceptions_add = emailsOf(body.exceptions_add);
    t.exceptions_drop = emailsOf(body.exceptions_drop);
  }
  return t;
}
async function namesOf(base44, emails) {
  const list = (emails || []).slice(0, 2e3);
  if (!list.length) return {};
  const users = await base44.asServiceRole.entities.User.list("-created_date", 2e3).catch(() => []);
  const out = {};
  for (const u of users || []) {
    const e = lower(u.email);
    if (list.includes(e)) out[e] = String(u.imie || u.full_name || "").trim();
  }
  return out;
}
async function imionaOf(base44, emails) {
  const list = (emails || []).slice(0, 200);
  if (!list.length) return {};
  const users = list.length <= 5 ? (await Promise.all(list.map((e) => base44.asServiceRole.entities.User.filter({ email: e }).catch(() => [])))).flat() : await base44.asServiceRole.entities.User.list("-created_date", 2e3).catch(() => []);
  const out = {};
  for (const u of users || []) {
    const e = lower(u.email);
    if (!list.includes(e)) continue;
    const a = String(u.imie || "").trim();
    const b = String(u.full_name || "").trim();
    out[e] = a || (b ? b.split(/\s+/)[0] : "");
  }
  return out;
}
function maskEmail(v) {
  const s = String(v || "").trim();
  const at = s.indexOf("@");
  if (at < 1) return s;
  return `${s.slice(0, Math.min(2, at))}***@${s.slice(at + 1)}`;
}
var maskEmailsIn = (v) => v ? String(v).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => maskEmail(m)) : v;
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me2 = await requireAdmin(base44).catch(() => null);
    if (!me2) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    const sr = base44.asServiceRole.entities;
    if (a === "migrate") {
      await runSql(base44, SCHEMA_SQL);
      await runSql(base44, LIBRARY_RPC_SQL);
      await runSql(base44, SCHEMA_2B_SQL);
      await runSql(base44, RPC_2B_SQL);
      await runSql(base44, SEED_SQL);
      const t = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true);
      if (!t || !t[0] || !t[0].tick_token) {
        await runSql(base44, `UPDATE public.mb_settings SET tick_token = ${escStr(randomToken())} WHERE id = 1`);
      }
      await libLog(base44, me2.email, "migracja", "baza", "mb", "tabele mb_* i regu\u0142y dost\u0119pu");
      resetLibSettings();
      return Response.json({ ok: true });
    }
    if (a === "checkpoint") {
      const [tables, funcs, rpcs] = await Promise.all([
        runSql(base44, CHECKPOINT_TABLES_SQL, true),
        runSql(base44, CHECKPOINT_FUNCS_SQL, true),
        runSql(base44, CHECKPOINT_RPC_SQL, true)
      ]);
      const space = await rpc(base44, "mb_admin_space", {});
      return Response.json({ tabele: tables || [], funkcje: funcs || [], rpc: rpcs || [], przestrzen: space });
    }
    if (a === "settings") {
      const [s, sp] = await Promise.all([
        libSettings(base44, true),
        rpc(base44, "mb_admin_space", {})
      ]);
      return Response.json({ settings: s, przestrzen: sp });
    }
    if (a === "save_settings") {
      const lib = MODES.includes(body.library_mode) ? body.library_mode : "off";
      const msg = MODES.includes(body.messages_mode) ? body.messages_mode : "off";
      const wa = String(body.whatsapp || "").trim();
      if (wa && !/^https:\/\/wa\.me\/[0-9]{6,20}$/.test(wa)) throw new Error("Adres WhatsApp: wy\u0142\u0105cznie format https://wa.me/cyfry");
      const limit = int(body.space_limit_mb, 64, 1048576, 5120);
      const podane = Array.isArray(body.video_domains) ? body.video_domains : (await libSettings(base44, true).catch(() => null) || {}).video_domains || [];
      const dom = videoDomains(podane);
      const odrzucone = podane.map((x) => String(x || "").trim()).filter((x) => x && !dom.includes(x.toLowerCase()));
      await rpc(base44, "mb_admin_settings_save", { p: {
        library_mode: lib,
        messages_mode: msg,
        email_notify: body.email_notify === true,
        whatsapp: wa,
        space_limit_mb: limit,
        video_domains: dom
      } });
      await libLog(
        base44,
        me2.email,
        "ustawienia",
        "settings",
        "1",
        `biblioteka=${lib} wiadomosci=${msg} mail=${body.email_notify === true ? "wl" : "wyl"} domeny=${dom.length}`
      );
      resetLibSettings();
      return Response.json({ ok: true, video_domains: dom, odrzucone });
    }
    if (a === "add_video_domain") {
      const host = videoDomains([body.domain])[0];
      if (!host) throw new Error("Podaj sam\u0105 nazw\u0119 domeny, np. wideo.exmortis.pl");
      const cur = await libSettings(base44, true);
      const dom = videoDomains([...cur.video_domains || [], host]);
      await rpc(base44, "mb_admin_settings_save", { p: {
        library_mode: cur.library_mode,
        messages_mode: cur.messages_mode,
        email_notify: cur.email_notify === true,
        whatsapp: cur.whatsapp || "",
        space_limit_mb: cur.space_limit_mb || 5120,
        video_domains: dom
      } });
      await libLog(base44, me2.email, "ustawienia", "settings", "1", `dodana domena wideo: ${host}`);
      resetLibSettings();
      return Response.json({ ok: true, video_domains: dom });
    }
    if (a === "tick_token") {
      const t = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true);
      let token = t && t[0] ? t[0].tick_token : null;
      if (body.rotate === true || !token) {
        token = randomToken();
        await runSql(base44, `UPDATE public.mb_settings SET tick_token = ${escStr(token)} WHERE id = 1`);
        await libLog(base44, me2.email, "token_zadania", "settings", "1", body.rotate === true ? "obrot" : "utworzenie");
      }
      return Response.json({ token, fresh: body.rotate === true || !t || !t[0] || !t[0].tick_token });
    }
    if (a === "materials_list") {
      const kind = ["AUDIO", "WIDEO", "PDF", "LINK", "TEKST"].includes(body.kind) ? body.kind : null;
      const q = String(body.q || "").trim().slice(0, 100) || null;
      const [rows, sp] = await Promise.all([
        rpc(base44, "mb_admin_materials", { p_kind: kind, p_q: q }),
        rpc(base44, "mb_admin_space", {})
      ]);
      return Response.json({ items: (rows || []).map((r) => ({ ...r, preview: plainText(r.body_html) })), przestrzen: sp });
    }
    if (a === "material_register") {
      const kind = ["AUDIO", "PDF", "WIDEO"].includes(body.kind) ? body.kind : null;
      if (!kind) return bad("Wybierz rodzaj pliku.");
      const fileUri = textField(body, "file_uri", { max: 500 });
      const fileName = textField(body, "file_name", { max: 300 });
      const title = String(body.title || fileName.replace(/\.[a-z0-9]{1,8}$/i, "")).trim().slice(0, 200);
      if (!title) return bad("Wpisz tytu\u0142 materia\u0142u.");
      const v = await verifyUpload(base44, kind, fileUri, fileName, body.file_size, body.pdf_js).catch((e) => ({ err: e.message }));
      if (v.err) {
        await libLog(base44, me2.email, "plik_odrzucony", "material", null, `${kind}: ${v.err}`);
        return bad(v.err);
      }
      const reg = await rpc(base44, "mb_admin_material_register", { p: {
        kind,
        title,
        file_key: fileUri,
        file_name: fileName,
        file_size: v.size,
        pdf_js: v.pdfJs,
        actor: me2.email
      } });
      const id = reg.id;
      await libLog(base44, me2.email, "plik_wgrany", "material", id, `${kind} ${mb(v.size)} MB${v.pdfJs ? " \xB7 ostrzezenie: PDF z aktywna trescia" : ""}`);
      return Response.json({ ok: true, id, file_size: v.size, pdf_js_warning: v.pdfJs });
    }
    if (a === "material_save") {
      const id = uuidOrNull(body.id);
      const kind = ["AUDIO", "WIDEO", "PDF", "LINK", "TEKST"].includes(body.kind) ? body.kind : null;
      if (!kind) return bad("Nieznany rodzaj materia\u0142u.");
      const title = textField(body, "title", { max: 200 });
      const desc = body.description ? String(body.description).trim().slice(0, 2e3) : null;
      const stage = body.stage ? String(body.stage).trim().slice(0, 60) : null;
      const tags = (Array.isArray(body.tags) ? body.tags : []).map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20);
      const allowDownload = body.allow_download === true;
      const payload = { id: id || null, kind, title, actor: me2.email };
      if (kind === "LINK") {
        const url = String(body.external_url || "").trim();
        if (!/^https:\/\/\S+$/.test(url)) return bad("Adres musi zaczyna\u0107 si\u0119 od https://");
        payload.external_url = url;
      } else if (kind === "WIDEO") {
        const src = ["link", "plik", "serwer"].includes(body.video_source) ? body.video_source : "link";
        payload.video_source = src;
        if (src === "serwer") {
          const s = await libSettings(base44);
          const ok = normalizeServerVideo(body.server_url, s.video_domains);
          if (!ok) return bad("Adres musi by\u0107 https, ko\u0144czy\u0107 si\u0119 .mp4, .m4v albo .webm i pochodzi\u0107 z domeny wpisanej w ustawieniach.");
          payload.server_url = ok;
        } else if (src === "plik") {
          if (!id) return bad("Najpierw wgraj plik wideo.");
          payload.keep_video = true;
        } else {
          const v = normalizeVideo(body.external_url);
          if (!v && !id) return bad("Dozwolone s\u0105 tylko filmy z YouTube, Vimeo i Bunny \u2014 wklej poprawny adres https.");
          if (v) {
            payload.video_provider = v.provider;
            payload.video_id = v.id;
          } else payload.keep_video = true;
        }
      } else if (kind === "TEKST") {
        const html = sanitizeHtml(body.body_html);
        if (!html) return bad("Wpisz tre\u015B\u0107 materia\u0142u.");
        payload.body_html = html;
      } else if (!id) {
        return bad("Najpierw wgraj plik (PDF albo audio).");
      }
      const saved = await rpc(base44, "mb_admin_material_save", { p: {
        ...payload,
        description: desc,
        stage,
        tags,
        duration_s: int(body.duration_s, 0, 1e5, null),
        pages: int(body.pages, 0, 1e5, null),
        allow_download: allowDownload,
        source: body.source ? String(body.source).slice(0, 200) : null
      } });
      if (!saved || !saved.ok) return NOT_FOUND();
      await libLog(base44, me2.email, id ? "material_zmiana" : "material_dodany", "material", saved.id, id ? title : `${kind} ${title}`);
      return Response.json({ ok: true, id: saved.id });
    }
    if (a === "material_replace") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const [m] = await runSql(base44, `SELECT id, kind, title FROM public.mb_materials WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL`, true);
      if (!m) return NOT_FOUND();
      if (m.kind !== "PDF" && m.kind !== "AUDIO" && m.kind !== "WIDEO") return bad("Plik mo\u017Cna zamieni\u0107 tylko w materiale PDF, audio albo wideo.");
      const fileUri = textField(body, "file_uri", { max: 500 });
      const fileName = textField(body, "file_name", { max: 300 });
      const v = await verifyUpload(base44, m.kind, fileUri, fileName, body.file_size, body.pdf_js).catch((e) => ({ err: e.message }));
      if (v.err) {
        await libLog(base44, me2.email, "plik_odrzucony", "material", id, `${m.kind}: ${v.err}`);
        return bad(v.err);
      }
      await runSql(base44, `UPDATE public.mb_materials SET
        prev_file_key = file_key, prev_file_name = file_name, prev_file_size = file_size,
        file_key = ${escStr(fileUri)}, file_name = ${escStr(fileName)}, file_size = ${v.size},
        file_version = file_version + 1, pdf_js_warning = ${v.pdfJs ? "TRUE" : "FALSE"},
        video_provider = CASE WHEN kind = 'WIDEO' THEN 'plik' ELSE video_provider END,
        server_url = CASE WHEN kind = 'WIDEO' THEN NULL ELSE server_url END,
        updated_at = now()
        WHERE id = ${escStr(id)}::uuid`);
      await libLog(base44, me2.email, "plik_zamieniony", "material", id, `${m.kind} ${mb(v.size)} MB`);
      return Response.json({ ok: true, id, file_size: v.size, pdf_js_warning: v.pdfJs });
    }
    if (a === "material_impact") {
      const materialId = uuidOrNull(body.material_id);
      if (!materialId) return NOT_FOUND();
      const r = await rpc(base44, "mb_admin_material_impact", { p_material: materialId });
      return Response.json({ osoby: r && r.osoby || 0, przydzialy: r && r.przydzialy || 0 });
    }
    if (a === "material_restore_prev") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_materials SET
        file_key = prev_file_key, file_name = prev_file_name, file_size = prev_file_size,
        prev_file_key = file_key, prev_file_name = file_name, prev_file_size = file_size,
        file_version = file_version + 1, updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL AND prev_file_key IS NOT NULL RETURNING id`);
      if (!r || !r.length) return bad("Nie ma poprzedniej wersji pliku do przywr\xF3cenia.");
      await libLog(base44, me2.email, "plik_przywrocony", "material", id, "przywrocono poprzednia wersje");
      return Response.json({ ok: true, id });
    }
    if (a === "material_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_materials SET deleted_at = now(), updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL RETURNING title`);
      if (!r || !r.length) return NOT_FOUND();
      await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE material_id = ${escStr(id)}::uuid AND revoked_at IS NULL`);
      await libLog(base44, me2.email, "material_usuniety", "material", id, r[0].title);
      return Response.json({ ok: true });
    }
    if (a === "material_preview") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const [m] = await runSql(base44, `SELECT kind, file_key, file_name, external_url, video_provider, video_id, body_html
        FROM public.mb_materials WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL`, true);
      if (!m) return NOT_FOUND();
      let url = null;
      let problem = null;
      if (m.file_key && (m.kind === "PDF" || m.kind === "AUDIO" || m.kind === "WIDEO")) {
        const s = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: m.file_key, expires_in: 900 }).catch((e) => ({ problem: String(e && e.message || e) }));
        url = s && s.signed_url ? s.signed_url : null;
        problem = url ? null : s && s.problem || "Nie uda\u0142o si\u0119 przygotowa\u0107 pliku.";
      }
      return Response.json({
        kind: m.kind,
        url,
        problem,
        file_name: m.file_name,
        external: m.external_url || null,
        video_provider: m.video_provider,
        video_id: m.video_id,
        text: m.kind === "TEKST" ? sanitizeHtml(m.body_html) : null
      });
    }
    if (a === "collections_list") {
      const items = await rpc(base44, "mb_admin_collections", {});
      return Response.json({ items: items || [] });
    }
    if (a === "collection_save") {
      const id = uuidOrNull(body.id);
      const title = textField(body, "title", { max: 200 });
      const desc = body.description ? String(body.description).trim().slice(0, 2e3) : null;
      const items = Array.isArray(body.items) ? body.items.map((x) => ({ id: uuidOrNull(x && x.material_id), position: int(x && x.position, 0, 1e4, 0) })).filter((x) => x.id) : [];
      let colId = id;
      if (colId) {
        const r = await runSql(base44, `UPDATE public.mb_collections SET title = ${escStr(title)}, description = ${esc(desc)}, updated_at = now()
          WHERE id = ${escStr(colId)}::uuid AND deleted_at IS NULL RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
      } else {
        const r = await runSql(base44, `INSERT INTO public.mb_collections (title, description, sort, created_by)
          VALUES (${escStr(title)}, ${esc(desc)}, ${int(body.sort, 0, 1e4, 0)}, ${escStr(me2.email)}) RETURNING id`);
        colId = r[0].id;
      }
      await runSql(base44, `DELETE FROM public.mb_collection_items WHERE collection_id = ${escStr(colId)}::uuid`);
      if (items.length) {
        await runSql(base44, `INSERT INTO public.mb_collection_items (collection_id, material_id, position) VALUES
          ${items.map((x, i) => `(${escStr(colId)}::uuid, ${escStr(x.id)}::uuid, ${x.position || i})`).join(", ")}`);
      }
      await libLog(base44, me2.email, id ? "kolekcja_zmiana" : "kolekcja_dodana", "collection", colId, `${title} (${items.length})`);
      return Response.json({ ok: true, id: colId });
    }
    if (a === "collection_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_collections SET deleted_at = now() WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL RETURNING title`);
      if (!r || !r.length) return NOT_FOUND();
      await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE collection_id = ${escStr(id)}::uuid AND revoked_at IS NULL`);
      await libLog(base44, me2.email, "kolekcja_usunieta", "collection", id, r[0].title);
      return Response.json({ ok: true });
    }
    if (a === "groups_list") {
      const items = await rpc(base44, "mb_admin_groups", {});
      return Response.json({ items: items || [] });
    }
    if (a === "group_save") {
      const id = uuidOrNull(body.id);
      const name = textField(body, "name", { max: 120 });
      const color = body.color ? String(body.color).trim() : null;
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return bad("Kolor w formacie #RRGGBB.");
      const desc = body.description ? String(body.description).trim().slice(0, 1e3) : null;
      const kind = body.kind === "AUTOMATYCZNA" ? "AUTOMATYCZNA" : "RECZNA";
      let rule = null;
      if (kind === "AUTOMATYCZNA") {
        const typ = body.rule && body.rule.typ === "aktywny_pakiet" ? "aktywny_pakiet" : "produkt";
        if (typ === "produkt" && !uuidOrNull(body.rule && body.rule.id)) return bad("Wybierz produkt.");
        const tid = uuidOrNull(body.rule && body.rule.type_id);
        rule = typ === "produkt" ? { typ, id: uuidOrNull(body.rule.id) } : { typ, ...tid ? { type_id: tid } : {} };
      }
      if (id) {
        const r = await runSql(base44, `UPDATE public.mb_groups SET name = ${escStr(name)}, color = ${esc(color)},
          description = ${esc(desc)}, kind = ${escStr(kind)}, rule = ${rule ? escStr(JSON.stringify(rule)) + "::jsonb" : "NULL"}, updated_at = now()
          WHERE id = ${escStr(id)}::uuid RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
        await libLog(base44, me2.email, "grupa_zmiana", "group", id, name);
        return Response.json({ ok: true, id });
      }
      const created = await runSql(base44, `INSERT INTO public.mb_groups (name, color, description, kind, rule, accepted_at, created_by)
        VALUES (${escStr(name)}, ${esc(color)}, ${esc(desc)}, ${escStr(kind)}, ${rule ? escStr(JSON.stringify(rule)) + "::jsonb" : "NULL"}, now(), ${escStr(me2.email)}) RETURNING id`);
      await libLog(base44, me2.email, "grupa_dodana", "group", created[0].id, name);
      return Response.json({ ok: true, id: created[0].id });
    }
    if (a === "group_accept") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_groups SET accepted_at = now(), updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND accepted_at IS NULL RETURNING name`);
      if (!r || !r.length) return NOT_FOUND();
      await libLog(base44, me2.email, "grupa_zatwierdzona", "group", id, r[0].name);
      return Response.json({ ok: true });
    }
    if (a === "group_detail") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_group_detail", { p_group: id });
      if (!d || !d.group) return NOT_FOUND();
      const members = (d.members || []).map((x) => lower(x)).filter(Boolean);
      const names = await namesOf(base44, members);
      return Response.json({
        group: d.group,
        members: members.map((e) => ({ email: e, name: names[e] || "" })),
        materials: d.materials || [],
        messages: d.messages || []
      });
    }
    if (a === "rule_options") {
      const [produkty, typy] = await Promise.all([
        runSql(base44, `SELECT id, name FROM public.products ORDER BY sort_order NULLS LAST, name LIMIT 500`, true).catch(() => []),
        runSql(base44, `SELECT id, name FROM public.bk_types ORDER BY name LIMIT 200`, true).catch(() => [])
      ]);
      return Response.json({ produkty: produkty || [], typy: typy || [] });
    }
    if (a === "group_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const take = body.materials === "odbierz";
      const [g3] = await runSql(base44, `SELECT id, name, kind FROM public.mb_groups WHERE id = ${escStr(id)}::uuid`, true);
      if (!g3) return NOT_FOUND();
      const members = (await rpc(base44, "mb_group_members_now", { p_group: id }).catch(() => []) || []).map((m) => lower(m.email));
      let assigned = 0;
      if (take) {
        const r = await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now()
          WHERE group_id = ${escStr(id)}::uuid AND revoked_at IS NULL RETURNING 1`);
        assigned = (r || []).length;
      } else {
        const rows = await runSql(base44, `SELECT id, target_kind, group_mode, snapshot_emails, exceptions_add, exceptions_drop FROM public.mb_assignments
          WHERE group_id = ${escStr(id)}::uuid AND revoked_at IS NULL`, true);
        for (const a2 of rows || []) {
          const list = a2.group_mode === "TYLKO_OBECNI" ? emailsOf(a2.snapshot_emails).filter((e) => !emailsOf(a2.exceptions_drop).includes(e)).concat(emailsOf(a2.exceptions_add)) : members.filter((e) => !emailsOf(a2.exceptions_drop).includes(e)).concat(emailsOf(a2.exceptions_add));
          for (const e of [...new Set(list)]) {
            await runSql(base44, `INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, visible_from, visible_to, created_by)
              SELECT material_id, collection_id, 'osoba', ${escStr(e)}, note, visible_from, visible_to, ${escStr(me2.email)}
              FROM public.mb_assignments WHERE id = ${escStr(a2.id)}::uuid`);
          }
          await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE id = ${escStr(a2.id)}::uuid`);
        }
        assigned = (rows || []).length;
      }
      await runSql(base44, `DELETE FROM public.mb_groups WHERE id = ${escStr(id)}::uuid`);
      await libLog(base44, me2.email, "grupa_usunieta", "group", id, `${g3.name} \xB7 materialy: ${take ? "odebrane" : "zostawione indywidualnie"} (${assigned})`);
      return Response.json({ ok: true, materials: take ? "odebrane" : "zostawione", przydzialy: assigned });
    }
    if (a === "group_members_add" || a === "group_members_remove") {
      const id = uuidOrNull(body.group_id);
      if (!id) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_group_detail", { p_group: id });
      const g3 = d && d.group;
      if (!g3) return NOT_FOUND();
      if (g3.kind === "AUTOMATYCZNA") return bad("Ta grupa jest automatyczna \u2014 cz\u0142onk\xF3w wyznaczaj\u0105 zakupy i pakiety.");
      const list = emailsOf(body.emails);
      if (!list.length) return bad("Wybierz osoby.");
      const n = Number(await rpc(base44, "mb_admin_group_members", {
        p_group: id,
        p_emails: list,
        p_add: a === "group_members_add",
        p_actor: me2.email
      }));
      await libLog(base44, me2.email, a === "group_members_add" ? "grupa_dodanie" : "grupa_usuniecie", "group", id, `${g3.name} \xB7 ${list.length}`);
      return Response.json({ ok: true, count: list.length, zmienione: n });
    }
    if (a === "clients_list") {
      const [users, mb2, groups] = await Promise.all([
        sr.User.list("-created_date", 2e3).catch(() => []),
        rpc(base44, "mb_admin_clients_mb", {}),
        rpc(base44, "mb_admin_groups", {})
      ]);
      const facts = new Map((mb2 || []).map((r) => [lower(r.email), r]));
      const rows = [];
      for (const u of users || []) {
        const e = lower(u.email);
        if (!e || u.role === "zablokowane") continue;
        const f = facts.get(e) || { groups: [], package: false };
        rows.push({
          email: e,
          name: String(u.imie || u.full_name || "").trim(),
          joined: u.created_date || null,
          groups: f.groups || [],
          package: !!f.package,
          blocked: u.role === "zablokowane"
        });
      }
      const q = lower(body.q);
      const gids = [...new Set((Array.isArray(body.group_ids) ? body.group_ids : [body.group_id]).map(uuidOrNull).filter(Boolean))];
      const mode = body.group_mode === "any" ? "any" : "all";
      let out = rows;
      if (q) out = out.filter((r) => r.email.includes(q) || lower(r.name).includes(q));
      if (gids.length) out = out.filter((r) => mode === "any" ? gids.some((g3) => r.groups.some((x) => x.id === g3)) : gids.every((g3) => r.groups.some((x) => x.id === g3)));
      if (body.no_group === true) out = out.filter((r) => !r.groups.length);
      if (body.has_package === true) out = out.filter((r) => r.package);
      const grupy = (groups || []).map((g3) => ({ id: g3.id, name: g3.name, color: g3.color || null, kind: g3.kind, rule: g3.rule || null }));
      return Response.json({ items: out, total: out.length, grupy });
    }
    if (a === "client_detail") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const [users, mb2, lib] = await Promise.all([
        sr.User.filter({ email }).catch(() => []),
        rpc(base44, "mb_admin_client_mb", { p_email: email }),
        libraryData(base44, email, true, true)
      ]);
      const u = (users || [])[0] || null;
      const msgs = await messagesData(base44, email, u || { email }, true);
      const d = mb2 || {};
      return Response.json({
        client: { email, name: u ? String(u.imie || u.full_name || "").trim() : "", joined: u ? u.created_date : null, role: u ? u.role : null },
        groups: d.groups || [],
        materials: lib.items,
        messages: msgs.items,
        sends: d.sends || [],
        packages: d.packages || [],
        assignments: d.assignments || []
      });
    }
    if (a === "assignment_preview") {
      const t = cleanTarget(body.target || {});
      const emails = [...new Set((await rpc(base44, "mb_admin_assignment_preview", { p_target: t }) || []).map(lower).filter(Boolean))];
      const names = await namesOf(base44, emails);
      return Response.json({ count: emails.length, emails, names });
    }
    if (a === "assignment_bulk") {
      const materialId = uuidOrNull(body.material_id);
      if (!materialId) return bad("Wybierz materia\u0142.");
      const emails = emailsOf(body.emails, 500);
      if (!emails.length) return bad("Wybierz osoby.");
      const note = body.note ? String(body.note).slice(0, 2e3) : null;
      const n = await rpc(base44, "mb_admin_assignment_bulk", {
        p_material: materialId,
        p_emails: emails,
        p_note: note,
        p_from: iso(body.visible_from),
        p_to: iso(body.visible_to),
        p_actor: me2.email
      });
      await libLog(base44, me2.email, "przydzial_zbiorczy", "material", materialId, `osoby: ${emails.length}`);
      return Response.json({ ok: true, count: Number(n) || 0 });
    }
    if (a === "assign_many") {
      const ids = [...new Set((Array.isArray(body.material_ids) ? body.material_ids : []).map(uuidOrNull).filter(Boolean))].slice(0, 100);
      if (!ids.length) return bad("Zaznacz materia\u0142y.");
      const t = cleanTarget(body.target || {});
      const r = await rpc(base44, "mb_admin_assign_many", {
        p_materials: ids,
        p_target: t,
        p_note: body.note ? String(body.note).slice(0, 2e3) : null,
        p_from: iso(body.visible_from),
        p_to: iso(body.visible_to),
        p_actor: me2.email
      });
      await libLog(
        base44,
        me2.email,
        "przydzial_zbiorczy",
        "material",
        null,
        `materialy: ${ids.length} \xB7 odbiorcy: ${r && r.osoby || 0}`
      );
      return Response.json({ ok: true, ...r || {} });
    }
    if (a === "assignment_save") {
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      if (!materialId && !collectionId) return bad("Wybierz materia\u0142 albo kolekcj\u0119.");
      if (materialId && collectionId) return bad("Wybierz materia\u0142 albo kolekcj\u0119 \u2014 nie oba.");
      const t = cleanTarget(body.target || {});
      if (t.kind === "osoba" && t.emails.length > 1) {
        const note = body.note ? String(body.note).slice(0, 2e3) : null;
        let count2 = 0;
        if (materialId) {
          const rm = await rpc(base44, "mb_admin_assign_many", {
            p_materials: [materialId],
            p_target: t,
            p_note: note,
            p_from: iso(body.visible_from),
            p_to: iso(body.visible_to),
            p_actor: me2.email
          });
          count2 = Number(rm && rm.osoby || 0);
        } else {
          const from = iso(body.visible_from), to = iso(body.visible_to);
          const done = await inBatches(t.emails.slice(0, 500), 8, (e) => rpc(base44, "mb_admin_assignment_save", { p: {
            material_id: null,
            collection_id: collectionId,
            target_kind: "osoba",
            target_email: e,
            group_id: null,
            group_mode: null,
            snapshot_emails: [],
            exceptions_add: [],
            exceptions_drop: [],
            note,
            visible_from: from,
            visible_to: to,
            actor: me2.email
          } }));
          count2 = done.length;
        }
        await libLog(
          base44,
          me2.email,
          "przydzial",
          materialId ? "material" : "collection",
          materialId || collectionId,
          `osoby \xB7 odbiorcy: ${count2}`
        );
        return Response.json({ ok: true, count: count2 });
      }
      const r = await rpc(base44, "mb_admin_assignment_save", { p: {
        material_id: materialId,
        collection_id: collectionId,
        target_kind: t.kind,
        target_email: t.kind === "osoba" ? t.emails[0] : null,
        group_id: t.kind === "grupa" ? t.group_id : null,
        group_mode: t.kind === "grupa" ? t.group_mode : null,
        snapshot_emails: t.kind === "grupa" ? t.snapshot_emails : [],
        exceptions_add: t.kind === "grupa" ? t.exceptions_add : [],
        exceptions_drop: t.kind === "grupa" ? t.exceptions_drop : [],
        note: body.note ? String(body.note).slice(0, 2e3) : null,
        visible_from: iso(body.visible_from),
        visible_to: iso(body.visible_to),
        actor: me2.email
      } });
      const count = Number(r && r.count || 0);
      await libLog(
        base44,
        me2.email,
        "przydzial",
        materialId ? "material" : "collection",
        materialId || collectionId,
        `${t.kind === "grupa" ? "grupa" : "osoba"} \xB7 odbiorcy: ${count}`
      );
      return Response.json({ ok: true, id: r && r.id, count });
    }
    if (a === "assignment_revoke") {
      const id = uuidOrNull(body.id);
      if (id) {
        const n2 = Number(await rpc(base44, "mb_admin_assignment_revoke", { p_id: id }));
        if (!n2) return NOT_FOUND();
        await libLog(base44, me2.email, "przydzial_odebrany", "przydzial", id, "pojedynczy");
        return Response.json({ ok: true, count: n2 });
      }
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      const groupId = uuidOrNull(body.group_id);
      if (!materialId && !collectionId || !groupId) return bad("Wska\u017C materia\u0142 i grup\u0119.");
      const n = Number(await rpc(base44, "mb_admin_assignment_revoke", {
        p_material: materialId,
        p_collection: collectionId,
        p_group: groupId
      }));
      await libLog(base44, me2.email, "przydzial_odebrany", materialId ? "material" : "collection", materialId || collectionId, `grupa \xB7 ${n}`);
      return Response.json({ ok: true, count: n });
    }
    if (a === "assignments_of_material") {
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      if (!materialId && !collectionId) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_assignments_of", { p_material: materialId, p_collection: collectionId }) || {};
      return Response.json({ items: d.items || [], odbiorcy: d.odbiorcy || 0, otwarte: d.otwarte === void 0 ? null : d.otwarte });
    }
    if (a === "assignments_of_client") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const lib = await libraryData(base44, email, true, true);
      return Response.json(lib);
    }
    if (a === "messages_list") {
      const d = await rpc(base44, "mb_admin_messages", {}) || { items: [], liczniki: null };
      const items = (d.items || []).map((m) => ({
        ...m,
        preview: plainText(m.body_html),
        target_label: m.target && m.target.kind === "grupa" ? `Grupa: ${m.group_name || "\u2014"}${m.target.group_mode === "TYLKO_OBECNI" ? " (tylko obecni)" : ""}` : m.target && m.target.emails && m.target.emails.length ? `Osoby: ${m.target.emails.length}` : "\u2014"
      }));
      return Response.json({ items, liczniki: d.liczniki || { wyslane: 0, zaplanowane: 0, szkice: 0, wycofane: 0 } });
    }
    if (a === "message_preview") {
      const html = sanitizeHtml(body.body_html);
      const t = cleanTarget(body.target || {});
      const people = await resolveRecipients(base44, t).catch(() => []) || [];
      const emails = [...new Set(people.map((p) => lower(p.email)).filter(Boolean))];
      const want = lower(body.email);
      const pick = want && emails.includes(want) ? want : emails[0] || null;
      const imiona = pick ? await imionaOf(base44, [pick]) : {};
      const imie = pick ? imiona[pick] || "" : "";
      const s = await libSettings(base44);
      return Response.json({
        count: emails.length,
        emails: emails.slice(0, 500),
        email: pick,
        imie: imie || null,
        html: pick ? sanitizeHtml(renderBody(html, imie)) : null,
        stopka: footerData(s, (await getSettingsFast(base44, ["firma"]).catch(() => ({}))).firma)
      });
    }
    if (a === "message_save") {
      const id = uuidOrNull(body.id);
      const status = body.status === "ZAPLANOWANA" ? "ZAPLANOWANA" : "SZKIC";
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz tre\u015B\u0107 wiadomo\u015Bci.");
      const emailMode = ["BRAK", "POWIADOMIENIE", "PELNA"].includes(body.email_mode) ? body.email_mode : "BRAK";
      const sendAt = status === "ZAPLANOWANA" ? iso(body.send_at) : null;
      if (status === "ZAPLANOWANA" && !sendAt) return bad("Podaj termin wysy\u0142ki.");
      const t = cleanTarget(body.target || {});
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      let attIn = body.attachments;
      if (!Array.isArray(attIn)) {
        attIn = id && !body.attached_material_id && !body.attached_collection_id ? await rpc(base44, "mb_admin_message_attachments", { p_id: id }).catch(() => []) || [] : [];
      }
      const att = attIn.slice(0, 10).map((x) => ({ material_id: uuidOrNull(x && x.material_id), collection_id: uuidOrNull(x && x.collection_id) })).filter((x) => (x.material_id ? 1 : 0) + (x.collection_id ? 1 : 0) === 1);
      const matId = uuidOrNull(body.attached_material_id);
      const colId = uuidOrNull(body.attached_collection_id);
      if (matId && colId) return bad("Do\u0142\u0105cz materia\u0142 albo kolekcj\u0119 \u2014 nie oba.");
      const saved = await rpc(base44, "mb_admin_message_save", { p: {
        id: id || null,
        title,
        body_html: html,
        email_mode: emailMode,
        target: t,
        attachments: att,
        attached_material_id: matId,
        attached_collection_id: colId,
        status,
        send_at: sendAt,
        actor: me2.email
      } });
      if (!saved || !saved.ok) return NOT_FOUND();
      await libLog(
        base44,
        me2.email,
        id ? "wiadomosc_zmiana" : "wiadomosc_szkic",
        "message",
        saved.id,
        `${status} \xB7 odbiorcy: ${saved.count} \xB7 zalaczniki: ${att.length}`
      );
      return Response.json({ ok: true, id: saved.id, count: saved.count });
    }
    if (a === "message_send") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const used = Number(await rpc(base44, "mb_admin_message_send_rate", {}).catch(() => 0)) || 0;
      if (used >= 20) {
        return bad("Wykorzystany limit 20 wys\u0142anych wiadomo\u015Bci na godzin\u0119. Kolejn\u0105 wy\u015Blesz po godzinie.", 429);
      }
      if (body.confirm !== true && body.count > 10) return bad("Potwierd\u017A wysy\u0142k\u0119 do ponad 10 os\xF3b.");
      const r = await deliverMessage(base44, id, me2.email);
      if (!r.ok) return bad("Ta wiadomo\u015B\u0107 nie jest ju\u017C do wys\u0142ania.", 409);
      return Response.json(r);
    }
    if (a === "message_edit_sent") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz tre\u015B\u0107 wiadomo\u015Bci.");
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      const ok = await rpc(base44, "mb_admin_message_edit", { p_id: id, p_title: title, p_body_html: html });
      if (!ok) return NOT_FOUND();
      await libLog(base44, me2.email, "wiadomosc_poprawiona", "message", id, "poprawka tresci po wyslaniu, bez ponownego e-maila");
      return Response.json({ ok: true });
    }
    if (a === "message_cancel") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_cancel", { p_id: id });
      if (!ok) return bad("Tej wiadomo\u015Bci nie mo\u017Cna ju\u017C anulowa\u0107 \u2014 zadanie j\u0105 przej\u0119\u0142o.", 409);
      await libLog(base44, me2.email, "wiadomosc_anulowana", "message", id, "zaplanowana wrocila do szkicow");
      return Response.json({ ok: true });
    }
    if (a === "message_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_delete", { p_id: id });
      if (!ok) return bad("Usun\u0105\u0107 mo\u017Cna tylko szkic albo wiadomo\u015B\u0107 wycofan\u0105.", 409);
      await libLog(base44, me2.email, "wiadomosc_usunieta", "message", id, null);
      return Response.json({ ok: true });
    }
    if (a === "message_withdraw") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_withdraw", { p_id: id });
      if (!ok) return NOT_FOUND();
      await libLog(base44, me2.email, "wiadomosc_wycofana", "message", id, null);
      return Response.json({ ok: true, uwaga: "Wys\u0142anego e-maila nie da si\u0119 cofn\u0105\u0107." });
    }
    if (a === "message_notify_unread") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_message_notify", { p_id: id });
      if (!d || !d.message) return NOT_FOUND();
      if (d.message.email_mode === "BRAK") return bad("Ta wiadomo\u015B\u0107 nie ma w\u0142\u0105czonej kopii e-mail.");
      if (d.niedawno) return bad("Powiadomienie do nieprzeczytanych zosta\u0142o ju\u017C wys\u0142ane w ci\u0105gu ostatnich 24 godzin.", 429);
      const emails = (d.emails || []).map(lower);
      const sent = await sendMessageEmail(base44, d.message, emails);
      await libLog(base44, me2.email, "powiadomienie_ponowne", "message", id, `nieprzeczytane: ${emails.length}`);
      return Response.json({ ok: true, ...sent, nieprzeczytane: emails.length });
    }
    if (a === "message_stats") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const rows = await rpc(base44, "mb_admin_message_stats", { p_id: id });
      const users = await sr.User.list("-created_date", 2e3).catch(() => []);
      const names = {};
      for (const u of users || []) names[lower(u.email)] = String(u.imie || u.full_name || "").trim();
      return Response.json({ items: (rows || []).map((r) => ({ ...r, name: names[lower(r.client_email)] || "" })), total: (rows || []).length });
    }
    if (a === "templates_list") {
      const rows = await rpc(base44, "mb_admin_templates", {});
      return Response.json({ items: (rows || []).map((t) => ({ ...t, preview: plainText(t.body_html) })) });
    }
    if (a === "template_save") {
      const name = textField(body, "name", { max: 120 });
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz tre\u015B\u0107 szablonu.");
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      const id = uuidOrNull(body.id);
      const saved = await rpc(base44, "mb_admin_template_save", { p: { id: id || null, name, title, body_html: html, actor: me2.email } });
      if (!saved || !saved.ok) return NOT_FOUND();
      return Response.json({ ok: true, id: saved.id });
    }
    if (a === "template_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      await rpc(base44, "mb_admin_template_delete", { p_id: id });
      return Response.json({ ok: true });
    }
    if (a === "dashboard") {
      const d = await rpc(base44, "mb_admin_dashboard", {}) || {};
      return Response.json({
        zaplanowane_dzis: d.zaplanowane_dzis || 0,
        ostatnia: d.ostatnia || null,
        odblokowuje_sie: d.odblokowuje_sie || 0,
        przestrzen: d.przestrzen || null,
        tryby: d.tryby || null
      });
    }
    if (a === "history") {
      const filterAction = body.action_filter ? String(body.action_filter).slice(0, 60) : null;
      const days = int(body.days, 1, 3650, null);
      const d = await rpc(base44, "mb_admin_history", { p_action: filterAction, p_days: days }) || {};
      return Response.json({
        items: (d.items || []).map((r) => ({ ...r, actor: maskEmail(r.actor), summary: maskEmailsIn(r.summary) })),
        akcje: d.akcje || []
      });
    }
    if (a === "preview_client") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const users = await sr.User.filter({ email }).catch(() => []);
      const u = (users || [])[0] || { email };
      const [lib, msgs] = await Promise.all([
        libraryData(base44, email, true, true),
        messagesData(base44, email, u, true)
      ]);
      await libLog(base44, me2.email, "podglad_klienta", "klient", null, "podglad oczami klienta");
      return Response.json({ library: lib, messages: msgs });
    }
    return NOT_FOUND();
  } catch (e) {
    if (e && e.message === "FORBIDDEN") return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
    const msg = String(e && e.message || e);
    console.error("libraryAdmin:", msg.slice(0, 300));
    const known = /^(Niepoprawn|Wybierz|Wpisz|Podaj|Dozwolone|Sygnatura|Plik|Adres|Klucz|Ten rodzaj|Kolor|Ta grupa|Grupy|Dołącz|Potwierdź|Wskaż|Nieznany)/.test(msg);
    return Response.json({ error: known ? msg : "Nie uda\u0142o si\u0119 zapisa\u0107." }, { status: 400 });
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
