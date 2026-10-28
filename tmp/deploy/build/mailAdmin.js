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
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
function emailField(body, key = "email") {
  const v = textField(body, key, { max: 320 });
  if (!EMAIL_RE.test(v)) {
    const e = new Error("Niepoprawny adres e-mail");
    e.isValidation = true;
    throw e;
  }
  return v;
}
async function requireStaff(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin" && user.role !== "techniczna") throw new Error("FORBIDDEN");
  return user;
}
async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

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
var CFG_AT = 0;
var MCFG_AT = 0;
var resetMailConfig = () => {
  CFG_AT = 0;
  MCFG_AT = 0;
};
function htmlToText(html) {
  return String(html || "").replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
    const txt2 = t.replace(/<[^>]+>/g, "").trim();
    return !txt2 ? href : txt2 === href || href.startsWith("mailto:") || href.startsWith("tel:") ? txt2 : `${txt2} (${href})`;
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
async function mailBudgetLeft(base44) {
  return Math.max(0, MAIL_BUDGET - await sentLast2h(base44));
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
async function flushMailQueue(base44, { auto = false } = {}) {
  const smtp = await getSetting(base44, "smtp");
  if (!mailReady(smtp)) {
    if (auto) return { sent: 0, skipped: 0, failed: 0, more: false };
    throw new Error("Wysy\u0142ka e-mail nie dzia\u0142a \u2014 najpierw wy\u015Blij udany test.");
  }
  const Q = base44.asServiceRole.entities.MailQueue;
  SENT.at = 0;
  const budget = Math.min(auto ? 40 : 20, await mailBudgetLeft(base44));
  if (budget <= 0) return { sent: 0, skipped: 0, failed: 0, more: true, limit: true };
  const items = await Q.filter(auto ? { status: "kolejka", blad: LIMIT_MARK } : { status: "kolejka" }, "created_date", budget);
  let sent = 0, skipped = 0, failed = 0;
  for (const m of items) {
    if (m.wazny_do && new Date(m.wazny_do) < /* @__PURE__ */ new Date()) {
      await Q.update(m.id, { status: "pominiety", blad: "Termin min\u0105\u0142", html: "", attachments: [] });
      skipped++;
      continue;
    }
    try {
      await smtpSend(smtp, { to: m.to_email, subject: m.subject, html: m.html || "", attachments: m.attachments, headers: m.headers, kind: m.kind });
      SENT.n++;
      await Q.update(m.id, { status: "wyslany", sent_at: (/* @__PURE__ */ new Date()).toISOString(), html: "", attachments: [], blad: "" });
      await afterSent(base44, m.kind, m.to_email);
      sent++;
    } catch (e) {
      await Q.update(m.id, { status: "blad", blad: String(e?.message || e).slice(0, 500) });
      failed++;
    }
  }
  const left = await Q.filter(auto ? { status: "kolejka", blad: LIMIT_MARK } : { status: "kolejka" }, "created_date", 1);
  return { sent, skipped, failed, more: left.length > 0 };
}

// supabase/functions/_shared/onboarding.ts
var esc2 = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
async function onboardingOn(base44) {
  const s = await getSetting(base44, "prowadzenie").catch(() => null);
  return s?.wlaczone !== false;
}
async function setOnboarding(base44, on) {
  await saveSetting(base44, "prowadzenie", { wlaczone: !!on });
}
function vocab(type) {
  if (type === "audio") return { verb: "s\u0142ucha\u0107", noun: "s\u0142uchanie", unit: "jeden fragment dziennie", back: "WR\xD3\u0106 DO NAGRANIA", open: "OTW\xD3RZ NAGRANIE" };
  if (type === "kurs" || type === "wideo") return { verb: "przechodzi\u0107", noun: "lekcje", unit: "jedna lekcja dziennie", back: "WR\xD3\u0106 DO KURSU", open: "OTW\xD3RZ KURS" };
  if (type === "pakiet") return { verb: "korzysta\u0107", noun: "materia\u0142y", unit: "jeden materia\u0142 naraz, jeden fragment dziennie", back: "WR\xD3\u0106 DO MATERIA\u0141\xD3W", open: "OTW\xD3RZ MATERIA\u0141Y" };
  return { verb: "czyta\u0107", noun: "lektura", unit: "jeden rozdzia\u0142 dziennie", back: "WR\xD3\u0106 DO LEKTURY", open: "OTW\xD3RZ E-BOOKA" };
}
var P = (t) => `<p style="margin:0 0 18px;">${t}</p>`;
var QUOTE = (t) => `<p style="margin:26px 0;padding:6px 0 6px 20px;border-left:2px solid #C9A24A;font-size:20px;line-height:1.55;color:#F5EFE1;font-style:italic;">${t}</p>`;
var LABEL = (t) => `<p style="margin:0 0 10px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#C9A24A;">${t}</p>`;
var SIGN = `<p style="margin:30px 0 0;">Dawid</p><p style="margin:4px 0 0;font-size:13px;color:#A3A3A6;">Mo\u017Cesz po prostu odpowiedzie\u0107 na ten list.</p>`;
var optout = (url) => `<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #2A2A2C;font-size:12px;line-height:1.6;color:#7A7A7D;">To jeden z czterech kr\xF3tkich list\xF3w, kt\xF3re wysy\u0142am po zakupie. <a href="${esc2(url)}" style="color:#A3A3A6;">Nie chc\u0119 tych list\xF3w</a> \u2014 wy\u0142\u0105czysz je jednym klikni\u0119ciem (zam\xF3wienia i dost\u0119p do materia\u0142\xF3w dzia\u0142aj\u0105 dalej).</p>`;
function onboardingMail(step, ctx) {
  const v = vocab(ctx.type);
  const hi = ctx.name ? `${esc2(ctx.name)}, ` : "";
  const prod = `\u201E${esc2(ctx.product)}\u201D`;
  const materials = `${ctx.site}/konto`;
  let subject = "", body = "";
  if (step === 1) {
    subject = ctx.type === "kurs" || ctx.type === "wideo" ? `Zanim zaczniesz: jak przechodzi\u0107 ${prod}` : ctx.type === "audio" ? `Zanim zaczniesz: jak s\u0142ucha\u0107 ${prod}` : `Zanim zaczniesz: jak czyta\u0107 ${prod}`;
    body = [
      `<h1>Zanim zaczniesz</h1>`,
      P(`${hi}od wczoraj ${prod} jest w Twoich materia\u0142ach. Zanim p\xF3jdziesz dalej, kilka s\u0142\xF3w o tym, jak z tego korzysta\u0107 \u2014 tak, \u017Ceby to nie by\u0142a kolejna rzecz ${v.verb === "czyta\u0107" ? "przeczytana" : v.verb === "s\u0142ucha\u0107" ? "przes\u0142uchana" : "zaliczona"} i od\u0142o\u017Cona na p\xF3\u0142k\u0119.`),
      LABEL("CZTERY ZASADY"),
      P(`<b style="color:#F5EFE1;">Powoli.</b> Wystarczy ${v.unit}. Powr\xF3t nie lubi po\u015Bpiechu \u2014 to, co wa\u017Cne, potrzebuje czasu, \u017Ceby w Tobie osi\u0105\u015B\u0107.`),
      P(`<b style="color:#F5EFE1;">Z kartk\u0105 obok.</b> Zapisuj zdania, kt\xF3re Ci\u0119 zatrzymaj\u0105. Nie te najm\u0105drzejsze \u2014 te, kt\xF3re bol\u0105 albo co\u015B budz\u0105.`),
      P(`<b style="color:#F5EFE1;">Bez oceniania siebie.</b> Je\u015Bli co\u015B w Tobie si\u0119 opiera, to te\u017C jest informacja. Zapisz j\u0105 i id\u017A dalej.`),
      P(`<b style="color:#F5EFE1;">Wracaj.</b> Do tych samych miejsc po tygodniu. Spotkasz je jako kto\u015B odrobin\u0119 inny.`),
      emailButton(v.open, materials),
      P(`Za dwa dni napisz\u0119 z jednym pytaniem. Nie musisz odpowiada\u0107 mnie \u2014 wystarczy, \u017Ce odpowiesz sobie.`),
      SIGN
    ].join("");
  } else if (step === 3) {
    subject = "Jedno pytanie na dzi\u015B";
    body = [
      `<h1>Jedno pytanie</h1>`,
      P(`${hi}min\u0119\u0142o kilka dni z ${prod}. Nie pytam, ile jest ju\u017C za Tob\u0105. Pytam o jedno:`),
      QUOTE("Kt\xF3re zdanie zosta\u0142o ze mn\u0105 najd\u0142u\u017Cej \u2014 i co m\xF3wi o miejscu, w kt\xF3rym dzi\u015B stoj\u0119?"),
      P(`Zapisz odpowied\u017A. Jedno, dwa zdania wystarcz\u0105. Je\u015Bli jeszcze nic nie zosta\u0142o \u2014 to te\u017C jest odpowied\u017A. Wtedy wr\xF3\u0107 do ostatniego fragmentu i przejd\u017A go jeszcze raz, wolniej.`),
      P(`Je\u015Bli chcesz, odpowiedz na ten list. Czasem samo napisanie komu\u015B robi r\xF3\u017Cnic\u0119.`),
      emailButton(v.back, materials),
      SIGN
    ].join("");
  } else if (step === 7) {
    subject = "Co si\u0119 zmieni\u0142o?";
    body = [
      `<h1>Tydzie\u0144 p\xF3\u017Aniej</h1>`,
      P(`${hi}tydzie\u0144 temu ${prod} trafi\u0142o do Twoich r\u0105k. Chc\u0119 zapyta\u0107 wprost: co si\u0119 zmieni\u0142o?`),
      P(`Mo\u017Ce niewiele \u2014 i to jest w porz\u0105dku. Powr\xF3t rzadko wygl\u0105da jak prze\u0142om. Cz\u0119\u015Bciej jak jedno spokojniejsze rano. Jedna rozmowa, na kt\xF3r\u0105 wcze\u015Bniej zabrak\u0142oby odwagi. Jedno zdanie, kt\xF3re wraca w ciszy.`),
      P(`Je\u015Bli co\u015B si\u0119 poruszy\u0142o, podziel si\u0119 tym w kr\xF3tkiej opinii. Dwa, trzy zdania wystarcz\u0105. Pomagaj\u0105 osobom, kt\xF3re stoj\u0105 dzi\u015B na pocz\u0105tku tej drogi, zdecydowa\u0107, czy to dla nich.`),
      emailButton("NAPISZ OPINI\u0118", `${ctx.site}/konto?tab=zakupy`),
      P(`<span style="font-size:14px;color:#A3A3A6;">Publikuj\u0119 tak\u017Ce opinie krytyczne i za \u017Cadne nie p\u0142ac\u0119. Je\u015Bli co\u015B nie zadzia\u0142a\u0142o \u2014 tym bardziej chc\u0119 o tym wiedzie\u0107. Odpowiedz na ten list.</span>`),
      SIGN
    ].join("");
  } else {
    subject = "Co dalej?";
    const nx = ctx.next;
    body = [
      `<h1>Nast\u0119pny krok</h1>`,
      P(`${hi}dwa tygodnie z ${prod}. To dobry moment, \u017Ceby si\u0119 zatrzyma\u0107 i zobaczy\u0107, gdzie jeste\u015B.`),
      P(`Powr\xF3t ma cztery etapy: \u015Amier\u0107 \xB7 Pr\xF3g \xB7 Powr\xF3t \xB7 Inny. \u017Baden materia\u0142 nie przeprowadzi przez wszystkie naraz \u2014 i nie musi. Wa\u017Cne jest, \u017Ceby zrobi\u0107 kolejny krok, a nie wszystkie od razu.`),
      nx ? [
        `<div style="margin:28px 0 28px;padding:22px 22px 4px;border:1px solid #2A2A2C;">`,
        LABEL("NAST\u0118PNY KROK"),
        `<p style="margin:0 0 10px;font-size:21px;line-height:1.35;color:#F5EFE1;">${esc2(nx.name)}</p>`,
        nx.text ? P(`<span style="color:#C8C6C1;">${esc2(nx.text)}</span>`) : "",
        emailButton("ZOBACZ", `${ctx.site}/skarbiec/${encodeURIComponent(nx.slug)}`),
        `</div>`
      ].join("") : [
        P(`Je\u015Bli nie wiesz, gdzie dzi\u015B jeste\u015B, zr\xF3b kr\xF3tki test. Poka\u017Ce, ile jest w Tobie ka\u017Cdej z trzech \u015Bmierci \u2014 i od czego warto zacz\u0105\u0107 teraz.`),
        emailButton("ZR\xD3B TEST", `${ctx.site}/test`)
      ].join(""),
      P(`A je\u015Bli wolisz po prostu porozmawia\u0107 z innymi, kt\xF3rzy id\u0105 t\u0105 drog\u0105 \u2014 <a href="${esc2(ctx.site)}/spotkania">spotkania otwarte</a> s\u0105 bezp\u0142atne.`),
      P(`To ostatni list z tej kr\xF3tkiej serii. Dzi\u0119kuj\u0119, \u017Ce dajesz sobie ten czas.`),
      SIGN
    ].join("");
  }
  return { subject, html: body + (ctx.optoutUrl ? optout(ctx.optoutUrl) : "") };
}

// supabase/functions/_shared/followup.ts
var esc3 = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
var P2 = (t) => `<p style="margin:0 0 18px;">${t}</p>`;
var LABEL2 = (t) => `<p style="margin:0 0 10px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#C9A24A;">${t}</p>`;
var SIGN2 = `<p style="margin:30px 0 0;">Dawid</p><p style="margin:4px 0 0;font-size:13px;color:#A3A3A6;">Mo\u017Cesz po prostu odpowiedzie\u0107 na ten list.</p>`;
async function followupOn(base44) {
  const s = await getSetting(base44, "po_spotkaniu").catch(() => null);
  return s?.wlaczone !== false;
}
async function setFollowup(base44, on) {
  await saveSetting(base44, "po_spotkaniu", { wlaczone: !!on });
}
var plDay = (iso) => new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" });
var plHour = (iso) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
function nextBox(next, site) {
  if (!next) return "";
  return [
    `<div style="margin:28px 0;padding:22px 22px 4px;border:1px solid #2A2A2C;">`,
    LABEL2("NAST\u0118PNE SPOTKANIE"),
    `<p style="margin:0 0 6px;font-size:21px;line-height:1.35;color:#F5EFE1;">${esc3(next.title)}</p>`,
    `<p style="margin:0 0 4px;color:#C8C6C1;">${esc3(plDay(next.start_datetime))}, ${esc3(plHour(next.start_datetime))} (czasu polskiego)</p>`,
    emailButton("ZOBACZ I ZAPISZ SI\u0118", `${site}/spotkania/${encodeURIComponent(next.slug)}`),
    `</div>`
  ].join("");
}
function followupMail(variant, ctx) {
  const hi = ctx.name ? `${esc3(ctx.name)}, ` : "";
  const title = `\xAB${esc3(ctx.title)}\xBB`;
  if (variant === "obecny") {
    return {
      subject: "Dzi\u0119kuj\u0119 za wczorajszy wiecz\xF3r",
      html: [
        `<h1>Dzi\u0119kuj\u0119 za wczoraj</h1>`,
        P2(`${hi}dzi\u0119kuj\u0119 za wsp\xF3lny wiecz\xF3r ${title}. Za czas, uwag\u0119 i pytania \u2014 tak\u017Ce te, kt\xF3re zosta\u0142y niezadane.`),
        P2(`Po takim spotkaniu \u0142atwo wr\xF3ci\u0107 do codzienno\u015Bci i zostawi\u0107 wszystko tak, jak by\u0142o. Dlatego jedna pro\u015Bba: zanim minie ten tydzie\u0144, zr\xF3b jeden ma\u0142y krok. Nie wielki \u2014 jeden.`),
        LABEL2("PIERWSZY KROK"),
        P2(`Kr\xF3tki test \u2014 kilka minut, \u017Ceby zobaczy\u0107, ile jest w Tobie ka\u017Cdej z trzech \u015Bmierci i od kt\xF3rego etapu powrotu warto zacz\u0105\u0107.`),
        emailButton("ZR\xD3B TEST", `${ctx.site}/test`),
        nextBox(ctx.next, ctx.site),
        P2(`Je\u015Bli chcesz, odpowiedz na ten list jednym zdaniem: co z wczorajszego wieczoru zosta\u0142o z Tob\u0105 najbardziej?`),
        SIGN2
      ].join("")
    };
  }
  return {
    subject: "Wczoraj Ci\u0119 zabrak\u0142o \u2014 i to w porz\u0105dku",
    html: [
      `<h1>Mo\u017Ce nast\u0119pnym razem</h1>`,
      P2(`${hi}wczoraj by\u0142 wiecz\xF3r ${title}. Nie uda\u0142o Ci si\u0119 do\u0142\u0105czy\u0107 \u2014 i to w porz\u0105dku. \u017Bycie rzadko pyta o nasze plany.`),
      P2(`Spotka\u0144 nie nagrywam. To, co dzieje si\u0119 na \u017Cywo, zostaje mi\u0119dzy tymi, kt\xF3rzy byli obecni \u2014 i w\u0142a\u015Bnie dlatego mo\u017Ce by\u0107 prawdziwe.`),
      ctx.next ? nextBox(ctx.next, ctx.site) : [P2(`Kolejne terminy pojawiaj\u0105 si\u0119 na stronie spotka\u0144.`), emailButton("ZOBACZ SPOTKANIA", `${ctx.site}/spotkania`)].join(""),
      P2(`A je\u015Bli chcesz zacz\u0105\u0107 ju\u017C teraz \u2014 <a href="${esc3(ctx.site)}/test">kr\xF3tki test</a> poka\u017Ce, od czego zacz\u0105\u0107.`),
      SIGN2
    ].join("")
  };
}

// supabase/functions/mailAdmin/index.ts
var MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
var KEYS = ["host", "port", "user", "password", "from", "from_name", "reply_to"];
var mask = (e) => {
  const [u, d] = String(e || "").split("@");
  return d ? `${u.slice(0, 2)}***@${d}` : "***";
};
async function txt(name) {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`).then((x) => x.json()).catch(() => null);
  return (r?.Answer || []).map((a) => String(a.data || "").replace(/"\s*"/g, "").replace(/"/g, ""));
}
async function dnsCheck(domain) {
  if (!domain) return null;
  const [root, dmarc] = await Promise.all([txt(domain), txt(`_dmarc.${domain}`)]);
  const sels = ["simplycom1", "simplycom2", "default", "dkim", "mail", "google", "selector1", "selector2", "k1", "s1", "s2", "smtp", "resend", "brevo1", "mailjet", "pm", "zoho", "x"];
  const dk = await Promise.all(sels.map(async (s) => (await txt(`${s}._domainkey.${domain}`)).some((t) => /v=DKIM1|k=rsa|p=/.test(t)) ? s : null));
  return {
    domain,
    spf: root.find((t) => t.startsWith("v=spf1")) || null,
    dmarc: dmarc.find((t) => t.startsWith("v=DMARC1")) || null,
    dkim: dk.filter(Boolean)
  };
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me2 = await requireStaff(base44);
    const tech = me2.role !== "admin";
    const body = await req.json().catch(() => ({}));
    const Q = base44.asServiceRole.entities.MailQueue;
    const KEY = body.profile === "marketing" ? "smtp_marketing" : "smtp";
    const smtp = await getSetting(base44, KEY) || {};
    if (body.action === "status") {
      const queued = await Q.filter({ status: "kolejka" }, "created_date", 1e3);
      const byKind = {};
      for (const m of queued) byKind[m.kind] = (byKind[m.kind] || 0) + 1;
      const cfg = {};
      for (const k of KEYS) cfg[k] = k === "password" ? smtp.password ? MASK : "" : smtp[k] || "";
      return Response.json({ ready: mailReady(smtp), tested_at: smtp.tested_at || null, config: cfg, queue: { total: queued.length, byKind } });
    }
    if (body.action === "save") {
      if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
      const d = body.data || {};
      const next = { ...smtp };
      for (const k of KEYS) {
        const v = String(d[k] ?? "").trim().slice(0, 300);
        if (k === "password" && (v === "" || v === MASK)) continue;
        next[k] = v;
      }
      if (!next.port) next.port = "587";
      if (!next.from_name) next.from_name = "exmortis";
      next.status = "nieskonfigurowana";
      delete next.tested_at;
      await saveSetting(base44, KEY, next);
      resetMailConfig();
      return Response.json({ ok: true });
    }
    if (body.action === "test") {
      if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
      const to = emailField(body, "to");
      try {
        await smtpSend(smtp, { to, subject: `exmortis: test wysy\u0142ki e-mail${KEY === "smtp_marketing" ? " (newsletter)" : ""}`, html: "<h1>Wysy\u0142ka dzia\u0142a</h1><p>To test z panelu exmortis. Je\u015Bli widzisz t\u0119 wiadomo\u015B\u0107 w skrzynce odbiorczej (nie w spamie), konfiguracja jest poprawna.</p>" });
      } catch (e) {
        await saveSetting(base44, KEY, { ...smtp, status: "nieskonfigurowana" });
        resetMailConfig();
        await Q.create({ to_email: to, subject: "test", kind: "test", status: "blad", blad: String(e?.message || e).slice(0, 500) });
        return Response.json({ ok: false, error: String(e?.message || e) });
      }
      await saveSetting(base44, KEY, { ...smtp, status: "dziala", tested_at: (/* @__PURE__ */ new Date()).toISOString() });
      resetMailConfig();
      await Q.create({ to_email: to, subject: "test", kind: "test", status: "wyslany", sent_at: (/* @__PURE__ */ new Date()).toISOString() });
      return Response.json({ ok: true });
    }
    if (body.action === "dns") {
      const addr = String(smtp.from || "").match(/@([^\s>]+)/);
      return Response.json({ dns: await dnsCheck(addr ? addr[1].toLowerCase() : null) });
    }
    if (body.action === "log") {
      const rows = await Q.filter({}, "-created_date", 100);
      return Response.json({
        log: rows.map((m) => ({ id: m.id, to: mask(m.to_email), kind: m.kind, at: m.sent_at || m.created_date, status: m.status, blad: m.blad || null }))
      });
    }
    if (body.action === "onboarding") {
      if (typeof body.wlaczone === "boolean") {
        if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
        await setOnboarding(base44, body.wlaczone);
      }
      return Response.json({ wlaczone: await onboardingOn(base44) });
    }
    if (body.action === "followup") {
      if (typeof body.wlaczone === "boolean") {
        if (tech) return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
        await setFollowup(base44, body.wlaczone);
      }
      return Response.json({ wlaczone: await followupOn(base44) });
    }
    if (body.action === "followup_preview") {
      const variant = body.variant === "nieobecny" ? "nieobecny" : "obecny";
      const firma = await getSetting(base44, "firma").catch(() => null);
      const appUrl = await loadAppUrl(base44);
      const m = followupMail(variant, {
        name: "Anna",
        title: "Ze \u015Bmierci \u2014 o powrotach, o kt\xF3rych \u015Bwiat nie m\xF3wi",
        site: appUrl,
        next: { title: "Wiecz\xF3r powrotu", slug: "wieczor-powrotu", start_datetime: "2026-12-03T18:00:00Z" }
      });
      return Response.json({ subject: m.subject, html: emailLayout(m.html, { firma, kind: `po_spotkaniu_${variant}` }) });
    }
    if (body.action === "onboarding_preview") {
      const step = [1, 3, 7, 14].includes(Number(body.step)) ? Number(body.step) : 1;
      const type = ["pdf", "audio", "kurs", "pakiet"].includes(body.type) ? body.type : "pdf";
      const firma = await getSetting(base44, "firma").catch(() => null);
      const appUrl = await loadAppUrl(base44);
      const m = onboardingMail(step, {
        name: "Anna",
        product: type === "kurs" ? "Kurs: Cztery etapy powrotu" : type === "audio" ? "Wracam inny \u2014 audiobook" : "Wracam inny",
        type,
        site: appUrl,
        next: step === 14 ? { name: "Rozmowa na progu", slug: "rozmowa-na-progu", text: "Jedna sesja, jedna decyzja, pe\u0142na uwaga." } : null,
        optoutUrl: `${appUrl}/listy/wypis?d=podglad`
      });
      return Response.json({ subject: m.subject, html: emailLayout(m.html, { firma, kind: `prowadzenie_${step}` }) });
    }
    if (body.action === "flush") {
      await requireAdmin(base44);
      return Response.json(await flushMailQueue(base44));
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error?.message === "FORBIDDEN") return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
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
