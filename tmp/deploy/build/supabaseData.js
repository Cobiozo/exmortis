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
async function restGet(_base44, path) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/${path}`, {
    headers: { apikey: SRK2, Authorization: `Bearer ${SRK2}` },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}
async function restCount(_base44, path) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/${path}`, {
    method: "HEAD",
    headers: { apikey: SRK2, Authorization: `Bearer ${SRK2}`, Prefer: "count=exact" },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
  const range = res.headers.get("content-range") || "/0";
  return Number(range.split("/")[1]) || 0;
}

// supabase/functions/_shared/settings.ts
var DEFAULT_APP_URL = globalThis.Deno?.env?.get?.("APP_URL") || "";

// supabase/functions/_shared/replicate.ts
var REPLICATE = [
  "PublishedPage",
  "SiteNav",
  "PageRedirect",
  "LegalDocVersion",
  "PodcastSettings",
  "PodcastEpisode",
  "PodcastPlaylist",
  "Utwor",
  "SilenceSettings",
  "Product",
  "DiscountCode",
  "PodcastGuest",
  "ObokSeria",
  "ObokNagranie",
  "Access",
  "Consent",
  "License",
  "Withdrawal",
  "CourseLesson",
  "PodcastApplication",
  "PowrotApplication",
  "ContactMessage",
  "Announcement",
  "AnnouncementSeen",
  "AnnouncementLog",
  "PageVersion",
  "CmsSection",
  "ContentLog",
  "MediaAsset",
  "PublicSnapshot",
  "NotificationState",
  "ObokUczestnik",
  "ObokOdsluch",
  "PlaybackLog",
  "LessonProgress",
  "ActiveStream",
  "EmailChange",
  "PendingRegistration",
  "SilenceBackground",
  "SilenceTrack",
  "SilenceSoundtrack",
  "SilenceSignal",
  "BackupFile",
  "ClientError",
  "DataAccessLog",
  "SecurityLog",
  "MailQueue",
  "RozdrozaChoice",
  "RozdrozaScene",
  "RozdrozaStory"
];
var TABLE = (entity) => `exm_${entity.toLowerCase()}`;

// supabase/functions/_shared/supaRead.ts
var SYSTEM = /* @__PURE__ */ new Set(["id", "created_date", "updated_date", "created_by_id"]);
var FETCH_CAP = 3e3;
var q = (v) => encodeURIComponent(String(v));
var inVal2 = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
var col2 = (f) => SYSTEM.has(f) ? f : `data->>${q(f)}`;
function forbidden() {
  const e = new Error("FORBIDDEN");
  e.forbidden = true;
  throw e;
}
var RULES = {
  open: ["PublishedPage", "SiteNav", "PageRedirect", "LegalDocVersion", "PodcastSettings", "Utwor", "SilenceSettings"],
  email: ["Access", "LessonProgress"],
  aktywne: ["SilenceBackground"],
  aktywny: ["SilenceSignal", "SilenceSoundtrack", "SilenceTrack"],
  opublikowany: ["PodcastEpisode"],
  widoczna: ["PodcastPlaylist"],
  staff: ["SitePage", "PageVersion", "CmsSection", "ContentLog", "MediaAsset"]
};
function readRule(entity) {
  for (const [k, list] of Object.entries(RULES)) if (list.includes(entity)) return k;
  return "admin";
}
function ruleWhere(user, entity) {
  const isStaff = user.role === "admin" || user.role === "techniczna";
  switch (readRule(entity)) {
    case "open":
      return "";
    case "staff":
      if (isStaff) return "";
      break;
    case "admin":
      if (user.role === "admin") return "";
      break;
    case "email":
      if (isStaff) return "";
      return `${col2("user_email")}=eq.${q(user.email)}`;
    case "aktywne":
      if (isStaff) return "";
      return `${col2("aktywne")}=eq.true`;
    case "aktywny":
      if (isStaff) return "";
      return `${col2("aktywny")}=eq.true`;
    case "opublikowany":
      if (user.role === "admin") return "";
      return `${col2("status")}=in.(${inVal2("opublikowany")},${inVal2("zaplanowany")})`;
    case "widoczna":
      if (user.role === "admin") return "";
      return `${col2("widoczna")}=eq.true`;
  }
  forbidden();
}
function atom2(field, cond) {
  if (cond === null) return `${col2(field)}=is.null`;
  if (typeof cond === "boolean") return `${col2(field)}=eq.${cond}`;
  if (Array.isArray(cond)) return `${col2(field)}=in.(${cond.map(inVal2).join(",")})`;
  if (typeof cond === "object") {
    const [op, v] = Object.entries(cond)[0];
    if (op === "$in" || op === "$nin") {
      const list = Array.isArray(v) ? v : [v];
      return `${col2(field)}=${op === "$in" ? "in" : "not.in"}.(${list.map(inVal2).join(",")})`;
    }
    if (op === "$exists") return `${col2(field)}=is.${v ? "not.null" : "null"}`;
    if (op === "$ne") return `${col2(field)}=neq.${q(v)}`;
    if (op === "$gt" || op === "$gte" || op === "$lt" || op === "$lte") {
      const map = { $gt: "gt", $gte: "gte", $lt: "lt", $lte: "lte" };
      return `${col2(field)}=${map[op]}.${q(v)}`;
    }
    if (op === "$regex") {
      const nocase = String(cond.$options || "").includes("i");
      const p = String(v);
      const like = nocase ? "ilike" : "like";
      if (p.startsWith("^") && p.endsWith("$")) return `${col2(field)}=${like}.${q(p.slice(1, -1))}`;
      return `${col2(field)}=${like}.*${q(p.replace(/\$$/, ""))}`;
    }
    throw new Error(`Nieobs\u0142ugiwany operator: ${op}`);
  }
  return `${col2(field)}=eq.${q(cond)}`;
}
function conditions2(query) {
  const parts = [];
  for (const [field, cond] of Object.entries(query || {})) {
    if (field === "$or" || field === "$and") {
      const subs = (cond || []).map((sub) => {
        const [f, c] = Object.entries(sub)[0];
        return atom2(f, c);
      });
      parts.push(`${field === "$or" ? "or" : "and"}=(${subs.join(",")})`);
    } else {
      parts.push(atom2(field, cond));
    }
  }
  return parts;
}
var row2rec2 = (r) => ({ ...r.data || {}, id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id });
var collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });
function cmpRows(a, b, field) {
  const ka = SYSTEM.has(field) ? a[field] : (a.data || {})[field];
  const kb = SYSTEM.has(field) ? b[field] : (b.data || {})[field];
  if (ka === kb) return 0;
  if (ka == null) return 1;
  if (kb == null) return -1;
  if (typeof ka === "number" && typeof kb === "number") return ka - kb;
  const c = collator.compare(String(ka), String(kb));
  return c !== 0 ? c : String(ka) < String(kb) ? -1 : 1;
}
async function fetchRows(base44, table, where) {
  return restGet(base44, `${table}?${where || "select=*"}&limit=${FETCH_CAP}`);
}
function sortRows(rows, sort) {
  if (!sort) return rows;
  const field = String(sort).replace(/^-/, "");
  const dir = String(sort).startsWith("-") ? -1 : 1;
  return [...rows].sort((a, b) => dir * cmpRows(a, b, field));
}
function aggregateRows(rows, args) {
  const num = (v) => typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : null;
  const sums = [].concat(args.sum || []);
  const avgs = [].concat(args.avg || []);
  const mins = [].concat(args.min || []);
  const maxs = [].concat(args.max || []);
  const groups = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const data = r.data || {};
    const key = args.groupBy ? data[args.groupBy] : "all";
    const g2 = groups.get(key) || { count: 0 };
    g2.count++;
    for (const f of sums) {
      const v = num(data[f]);
      if (v != null) g2[`sum_${f}`] = (g2[`sum_${f}`] || 0) + v;
    }
    for (const f of avgs) {
      const v = num(data[f]);
      if (v != null) {
        g2[`avg_${f}`] = ((g2[`avg_${f}`] || 0) * (g2[`n_avg_${f}`] || 0) + v) / ((g2[`n_avg_${f}`] || 0) + 1);
        g2[`n_avg_${f}`] = (g2[`n_avg_${f}`] || 0) + 1;
      }
    }
    for (const f of mins) {
      const v = num(data[f]);
      if (v != null && (g2[`min_${f}`] == null || v < g2[`min_${f}`])) g2[`min_${f}`] = v;
    }
    for (const f of maxs) {
      const v = num(data[f]);
      if (v != null && (g2[`max_${f}`] == null || v > g2[`max_${f}`])) g2[`max_${f}`] = v;
    }
    groups.set(key, g2);
  }
  return [...groups.entries()].map(([k, g2]) => {
    const out = args.groupBy ? { [args.groupBy]: k, count: g2.count } : { count: g2.count };
    for (const f of sums) if (g2[`sum_${f}`] != null) out[`sum_${f}`] = g2[`sum_${f}`];
    for (const f of avgs) {
      delete g2[`n_avg_${f}`];
      if (g2[`avg_${f}`] != null) out[`avg_${f}`] = g2[`avg_${f}`];
    }
    for (const f of mins) if (g2[`min_${f}`] != null) out[`min_${f}`] = g2[`min_${f}`];
    for (const f of maxs) if (g2[`max_${f}`] != null) out[`max_${f}`] = g2[`max_${f}`];
    return out;
  });
}
async function supaRead(base44, user, payload) {
  const { op, entity, args = {} } = payload || {};
  if (!REPLICATE.includes(entity)) forbidden();
  if (user.role === "techniczna" && readRule(entity) === "admin") forbidden();
  const table = TABLE(entity);
  const rule = ruleWhere(user, entity);
  const where = [rule, ...conditions2(args.query)].filter(Boolean).join("&");
  if (op === "get") {
    const rows = await restGet(base44, `${table}?id=eq.${q(args.id)}${where ? `&${where}` : ""}&limit=1`);
    return rows[0] ? row2rec2(rows[0]) : null;
  }
  if (op === "count") {
    return restCount(base44, `${table}?${where || "select=id"}`);
  }
  if (op === "list" && args.distinct) {
    const rows = await fetchRows(base44, table, where);
    const values = [...new Set(rows.map((r) => (r.data || {})[args.distinct]).filter((v) => v !== null && v !== void 0))];
    return { items: values };
  }
  if (op === "filter" || op === "list") {
    const noOptions = args.sort === void 0 && args.limit === void 0 && args.cursor === void 0;
    const sortField = args.sort ? String(args.sort).replace(/^-/, "") : null;
    if (sortField && SYSTEM.has(sortField)) {
      const dir = String(args.sort).startsWith("-") ? "desc" : "asc";
      const off2 = Number(args.cursor ?? 0) || 0;
      const lim2 = Math.max(1, Math.min(Number(args.limit) || 50, 2e3));
      const rows2 = await restGet(base44, `${table}?${where}&order=${sortField}.${dir}&limit=${lim2 + 1}&offset=${off2}`);
      const has_more2 = rows2.length > lim2;
      const items = has_more2 ? rows2.slice(0, lim2) : rows2;
      if (args.array) return items.map(row2rec2);
      return { items: items.map(row2rec2), next_cursor: has_more2 ? String(off2 + lim2) : null, has_more: has_more2 };
    }
    const rows = sortRows(await fetchRows(base44, table, where), args.sort);
    const recs = rows.map(row2rec2);
    if (noOptions) return recs;
    const off = Number(args.cursor ?? 0) || 0;
    const lim = Math.max(1, Math.min(Number(args.limit) || 50, 2e3));
    if (args.array) return recs.slice(off, off + lim);
    const has_more = recs.length > off + lim;
    return { items: recs.slice(off, off + lim), next_cursor: has_more ? String(off + lim) : null, has_more };
  }
  if (op === "aggregate") {
    const rows = await fetchRows(base44, table, where);
    return { rows: aggregateRows(rows, args) };
  }
  throw new Error(`Nieznana operacja: ${op}`);
}

// supabase/functions/_shared/supaWrite.ts
var STAFF = /* @__PURE__ */ new Set(["SitePage", "PageVersion", "CmsSection", "MediaAsset", "SiteNav", "PageRedirect", "PublishedPage"]);
var ADMIN = /* @__PURE__ */ new Set(["Utwor", "PodcastGuest", "ObokNagranie", "ObokSeria", "ObokUczestnik", "CourseLesson", "DiscountCode"]);
var SYSTEM2 = /* @__PURE__ */ new Set(["created_date", "updated_date", "created_by_id"]);
function forbidden2() {
  const e = new Error("FORBIDDEN");
  e.forbidden = true;
  throw e;
}
function allowed(entity, op, role) {
  const staff = role === "admin" || role === "techniczna";
  if (STAFF.has(entity)) return staff;
  if (ADMIN.has(entity)) return role === "admin";
  if (entity === "ContentLog") return op === "create" ? staff : role === "admin";
  if (entity === "DataAccessLog") return op === "create" ? role === "admin" : false;
  return false;
}
function strip(rec = {}) {
  const out = {};
  for (const [k, v] of Object.entries(rec)) if (!SYSTEM2.has(k)) out[k] = v;
  return out;
}
async function supaWrite(base44, user, payload) {
  const { op, entity, args = {} } = payload || {};
  if (!allowed(entity, op, user.role)) forbidden2();
  const e = base44.entities[entity];
  const me2 = { created_by_id: user.id };
  switch (op) {
    case "create":
      return e.create({ ...strip(args.rec), ...me2 });
    case "bulkCreate":
      return e.bulkCreate((args.recs || []).map((r) => ({ ...strip(r), ...me2 })));
    case "update":
      return e.update(args.id, strip(args.patch));
    case "bulkUpdate":
      return e.bulkUpdate((args.list || []).map((r) => ({ id: r.id, ...strip(r) })));
    case "delete":
      return e.delete(args.id);
    case "updateMany":
      return e.updateMany(args.query || {}, args.ops || {});
    case "deleteMany":
      return e.deleteMany(args.query || {});
    default:
      forbidden2();
  }
}

// supabase/functions/supabaseData/index.ts
var READ_OPS = /* @__PURE__ */ new Set(["get", "filter", "list", "count", "aggregate"]);
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Logowanie wymagane" }, { status: 401 });
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload.entity !== "string" || typeof payload.op !== "string") {
      return Response.json({ error: "B\u0142\u0119dne \u017C\u0105danie" }, { status: 400 });
    }
    const result = READ_OPS.has(payload.op) ? await supaRead(base44, user, payload) : await supaWrite(base44, user, payload);
    return Response.json({ ok: true, result });
  } catch (e) {
    const forbidden3 = e && e.forbidden === true;
    console.error("supabaseData:", String(e?.message || e).slice(0, 200));
    return Response.json(
      { error: forbidden3 ? "Brak dost\u0119pu" : "Operacja na kopii nie powiod\u0142a si\u0119" },
      { status: forbidden3 ? 403 : 500 }
    );
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
