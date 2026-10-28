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
function clientIp(req) {
  const ok = (v2) => /^[0-9a-fA-F:.]{3,45}$/.test(v2);
  const t = (req.headers.get("true-client-ip") || "").trim();
  if (ok(t)) return t;
  const xff = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ok(xff)) return xff;
  const v = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "").trim();
  return ok(v) ? v : "brak";
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

// supabase/functions/_shared/rateLimit.ts
async function ipAllowed(base44, ip, type, max, windowMs, details = "") {
  if (!ip || ip === "brak") return true;
  try {
    const L = base44.asServiceRole.entities.SecurityLog;
    const since = new Date(Date.now() - windowMs).toISOString();
    const recent = await L.filter({ type, ip, created_date: { $gte: since } }, "-created_date", max + 1);
    if (recent.length >= max) return false;
    await L.create({ type, ip, details: String(details).slice(0, 80) });
  } catch {
    return true;
  }
  return true;
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

// supabase/functions/_shared/tickets.ts
var TICKET_SCHEMA_SQL = `
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
var schemaReady = false;
async function ensureTicketSchema(base44) {
  if (schemaReady) return;
  await runSql(base44, TICKET_SCHEMA_SQL);
  schemaReady = true;
}
var showCode = (c) => c && c.length === 7 ? `${c.slice(0, 3)}-${c.slice(3)}` : String(c || "");
var normCode = (s) => {
  const v = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9]{4}$/.test(v) ? v : null;
};
var validToken = (t) => typeof t === "string" && /^[A-Za-z0-9]{24,64}$/.test(t);
var ticketUrl = (token) => `${APP_URL}/bilet#t=${token}`;
var ticketPdfUrl = (token) => `${APP_URL}/functions/tickets?pdf=${token}`;
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
var SCANNERS_KEY = "bilety_skanerzy";
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
var canScan = (scope, eventId) => !!scope && (scope.all || scope.events.includes(String(eventId)));
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

// supabase/functions/_shared/ticketPdf.ts
import { PDFDocument, rgb } from "npm:@cantoo/pdf-lib@2.4.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import QRCode from "npm:qrcode@1.5.4";
var FONTS = { cinzel: "Cinzel-SemiBold.ttf", garamond: "EBGaramond-Medium.ttf", inter: "Inter-SemiBold.ttf", mono: "SpaceMono-Bold.ttf" };
var DEFAULT_LAYOUT = {
  name: { x: 0.36, y: 0.62, size: 0.042, color: "#F5EFE1", font: "cinzel", align: "center" },
  qr: { x: 0.74, y: 0.22, size: 0.2, dark: "#0A0A0B", light: "#FFFFFF" },
  code: { x: 0.84, y: 0.84, size: 0.024, color: "#C9A24A", font: "mono", align: "center" }
};
var cache = /* @__PURE__ */ new Map();
var fontLoader = async (file) => {
  const url = `${APP_URL}/fonts/ticket/${file}`;
  if (cache.has(url)) return cache.get(url);
  const r = await fetch(url, { signal: AbortSignal.timeout(2e4) });
  if (!r.ok) throw new Error(`Czcionka biletu niedost\u0119pna (${r.status})`);
  const b = new Uint8Array(await r.arrayBuffer());
  cache.set(url, b);
  return b;
};
async function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  if (!/^https:\/\//.test(src)) throw new Error("Wz\xF3r biletu: niepoprawny adres obrazu");
  const r = await fetch(src, { signal: AbortSignal.timeout(2e4) });
  if (!r.ok) throw new Error("Wz\xF3r biletu: nie uda\u0142o si\u0119 pobra\u0107 obrazu");
  const b = new Uint8Array(await r.arrayBuffer());
  if (b.length > 15 * 1024 * 1024) throw new Error("Wz\xF3r biletu jest za du\u017Cy");
  if (cache.size > 30) cache.clear();
  cache.set(src, b);
  return b;
}
var hex = (h, fb = "#000000") => {
  const m = String(h || fb).match(/^#?([0-9a-f]{6})$/i) || String(fb).match(/^#?([0-9a-f]{6})$/i);
  const n = parseInt(m[1], 16);
  return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
};
var clamp = (v, a, b, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d;
};
function cleanLayout(t) {
  const L = DEFAULT_LAYOUT;
  const txt = (o, d) => ({
    x: clamp(o?.x, 0, 1, d.x),
    y: clamp(o?.y, 0, 1, d.y),
    size: clamp(o?.size, 8e-3, 0.2, d.size),
    color: /^#[0-9a-f]{6}$/i.test(o?.color) ? o.color : d.color,
    font: FONTS[o?.font] ? o.font : d.font,
    align: ["left", "center", "right"].includes(o?.align) ? o.align : d.align,
    upper: o?.upper === true
  });
  return {
    src: typeof t?.src === "string" && /^https:\/\//.test(t.src) ? t.src.slice(0, 1e3) : null,
    w: clamp(t?.w, 1, 2e4, 0),
    h: clamp(t?.h, 1, 2e4, 0),
    name: txt(t?.name, L.name),
    code: txt(t?.code, L.code),
    qr: {
      x: clamp(t?.qr?.x, 0, 1, L.qr.x),
      y: clamp(t?.qr?.y, 0, 1, L.qr.y),
      size: clamp(t?.qr?.size, 0.06, 0.6, L.qr.size),
      dark: /^#[0-9a-f]{6}$/i.test(t?.qr?.dark) ? t.qr.dark : L.qr.dark,
      light: /^#[0-9a-f]{6}$/i.test(t?.qr?.light) ? t.qr.light : L.qr.light
    }
  };
}
function drawQr(page, text, x, yTop, size, dark, light) {
  const q = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = q.modules.size, quiet = 2;
  const cell = size / (n + quiet * 2);
  page.drawRectangle({ x, y: yTop - size, width: size, height: size, color: hex(light, "#FFFFFF") });
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!q.modules.get(r, c)) {
        c++;
        continue;
      }
      let e = c;
      while (e < n && q.modules.get(r, e)) e++;
      page.drawRectangle({ x: x + (quiet + c) * cell, y: yTop - (quiet + r + 1) * cell, width: (e - c) * cell + 0.02, height: cell + 0.02, color: hex(dark, "#000000") });
      c = e;
    }
  }
}
function drawFit(page, text, font, o, W, H2, maxW) {
  const s = o.upper ? text.toUpperCase() : text;
  let size = o.size * W;
  while (size > 6 && font.widthOfTextAtSize(s, size) > maxW) size -= 0.5;
  const w = font.widthOfTextAtSize(s, size);
  const x0 = o.x * W, yc = H2 - o.y * H2;
  const x = o.align === "center" ? x0 - w / 2 : o.align === "right" ? x0 - w : x0;
  page.drawText(s, { x, y: yc - size * 0.35, size, font, color: hex(o.color) });
}
var plWhen = (iso) => {
  const f = (o) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", ...o }).format(new Date(iso));
  return `${f({ weekday: "long", day: "numeric", month: "long", year: "numeric" })} \xB7 ${f({ hour: "2-digit", minute: "2-digit" })}`;
};
function wrap(font, text, size, maxW, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "\u2026";
  }
  return lines;
}
async function renderTicketsPdf(ev, template, tickets) {
  const t = cleanLayout(template);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {};
  const font = async (k) => fonts[k] ||= await doc.embedFont(await fontLoader(FONTS[k]), { subset: true });
  doc.setTitle(`Bilet \u2014 ${ev.title || "exmortis"}`);
  doc.setAuthor("exmortis");
  doc.setProducer("exmortis");
  let bg = null, W = 842, H2 = 340;
  if (t.src) {
    const bytes = await loadImage(t.src);
    const png = bytes[0] === 137 && bytes[1] === 80;
    bg = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const r = bg.height / bg.width;
    if (r <= 1) {
      W = 842;
      H2 = 842 * r;
    } else {
      H2 = 842;
      W = 842 / r;
    }
  }
  for (const k of tickets) {
    const page = doc.addPage([W, H2]);
    if (bg) {
      page.drawImage(bg, { x: 0, y: 0, width: W, height: H2 });
      const q = t.qr, qs2 = q.size * W;
      drawQr(page, k.qr, q.x * W, H2 - q.y * H2, qs2, q.dark, q.light);
      const maxW = (o) => Math.max(40, ((o.align === "center" ? Math.min(o.x, 1 - o.x) * 2 : o.align === "right" ? o.x : 1 - o.x) - 0.04) * W);
      drawFit(page, k.holder_name, await font(t.name.font), t.name, W, H2, maxW(t.name));
      drawFit(page, k.code, await font(t.code.font), t.code, W, H2, maxW(t.code));
      continue;
    }
    const gold = hex("#C9A24A"), cream = hex("#F5EFE1"), grey = hex("#8A8A8C");
    const [fc, fi, fm] = [await font("cinzel"), await font("inter"), await font("mono")];
    page.drawRectangle({ x: 0, y: 0, width: W, height: H2, color: hex("#0A0A0B") });
    page.drawRectangle({ x: 14, y: 14, width: W - 28, height: H2 - 28, borderColor: gold, borderWidth: 1, opacity: 0 });
    page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H2 - 40, borderColor: gold, borderWidth: 0.4, borderOpacity: 0.4, opacity: 0 });
    const stubX = W - 250;
    for (let y2 = 30; y2 < H2 - 30; y2 += 10) page.drawLine({ start: { x: stubX, y: y2 }, end: { x: stubX, y: y2 + 5 }, thickness: 0.8, color: gold, opacity: 0.6 });
    page.drawText("EXMORTIS \xB7 BILET", { x: 48, y: H2 - 62, size: 10, font: fm, color: gold });
    const tl = wrap(fc, ev.title || "", 24, stubX - 96);
    tl.forEach((l, i) => page.drawText(l, { x: 48, y: H2 - 102 - i * 30, size: 24, font: fc, color: cream }));
    let y = H2 - 102 - tl.length * 30 - 6;
    if (ev.start_datetime) {
      page.drawText(`${plWhen(ev.start_datetime)} (czas polski)`, { x: 48, y, size: 11, font: fi, color: grey });
      y -= 18;
    }
    page.drawText(ev.format === "Online" ? "Online \u2014 link w e-mailu i w Moim koncie" : String(ev.location || "Miejsce podam w e-mailu").slice(0, 90), { x: 48, y, size: 11, font: fi, color: grey });
    page.drawText("UCZESTNIK", { x: 48, y: 92, size: 9, font: fm, color: gold });
    let ns = 26;
    while (ns > 10 && fc.widthOfTextAtSize(k.holder_name, ns) > stubX - 96) ns -= 1;
    page.drawText(k.holder_name, { x: 48, y: 60, size: ns, font: fc, color: cream });
    const qs = 150, qx = stubX + (W - 20 - stubX - qs) / 2;
    drawQr(page, k.qr, qx, H2 - 52, qs, "#0A0A0B", "#FFFFFF");
    const cw = fm.widthOfTextAtSize(k.code, 18);
    page.drawText(k.code, { x: qx + (qs - cw) / 2, y: H2 - 52 - qs - 30, size: 18, font: fm, color: gold });
    const note = "Poka\u017C przy wej\u015Bciu";
    page.drawText(note, { x: qx + (qs - fi.widthOfTextAtSize(note, 9)) / 2, y: H2 - 52 - qs - 48, size: 9, font: fi, color: grey });
    page.drawText("Bilet imienny \xB7 jedno wej\u015Bcie \xB7 exmortis.pl", { x: 48, y: 30, size: 8, font: fi, color: grey, opacity: 0.8 });
  }
  return await doc.save();
}

// supabase/functions/tickets/index.ts
var bad = (error, status = 400) => Response.json({ error }, { status });
async function ticketByToken(base44, token) {
  const rows = await runSql(base44, `SELECT t.id, t.code, t.token, t.holder_name, t.status, t.checked_at, t.event_id,
      e.title, e.slug, e.start_datetime, e.duration_minutes, e.format, e.location, e.ticket_template, e.short_path
    FROM public.event_tickets t JOIN public.events e ON e.id = t.event_id WHERE t.token = ${escStr(token)}`, true);
  return rows?.[0] || null;
}
var HITS = /* @__PURE__ */ new Map();
function tooFast(key) {
  const now = Date.now(), h = (HITS.get(key) || []).filter((t) => now - t < 6e4);
  h.push(now);
  HITS.set(key, h);
  if (HITS.size > 500) {
    for (const [k, v] of HITS) if (!v.some((t) => now - t < 6e4)) HITS.delete(k);
  }
  return h.length > 240;
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    const url = new URL(req.url);
    const pdfToken = url.searchParams.get("pdf");
    if (pdfToken !== null) {
      if (!validToken(pdfToken)) return new Response("Nieprawid\u0142owy link do biletu.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      if (!await ipAllowed(base44, clientIp(req), "bilet_pdf", 60, 36e5)) {
        return new Response("Zbyt wiele pobra\u0144 z tego po\u0142\u0105czenia. Spr\xF3buj ponownie p\xF3\u017Aniej.", { status: 429, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      await ensureTicketSchema(base44);
      const t = await ticketByToken(base44, pdfToken);
      if (!t || t.status === "anulowany") return new Response("Ten bilet nie istnieje albo zosta\u0142 anulowany.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      const bytes = await renderTicketsPdf(t, t.ticket_template, [{ holder_name: t.holder_name, code: showCode(t.code), qr: ticketUrl(t.token) }]);
      return new Response(bytes, { headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="bilet-${showCode(t.code)}.pdf"`,
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex"
      } });
    }
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    await ensureTicketSchema(base44);
    if (a === "view") {
      if (!validToken(body.token)) return bad("Nie ma takiego biletu", 404);
      const t = await ticketByToken(base44, body.token);
      if (!t) return bad("Nie ma takiego biletu", 404);
      return Response.json({ ticket: {
        code: showCode(t.code),
        holder_name: t.holder_name,
        status: t.status,
        checked_at: t.checked_at,
        qr: ticketUrl(t.token),
        pdf: ticketPdfUrl(t.token),
        event: {
          title: t.title,
          slug: t.slug,
          start_datetime: t.start_datetime,
          duration_minutes: t.duration_minutes,
          format: t.format,
          location: t.format === "Online" ? null : t.location
        }
      } });
    }
    if (a === "availability") {
      const slug = textField(body, "slug", { max: 200 });
      const [ev] = await runSql(base44, `SELECT id, status, format, price::float8 AS price, capacity, start_datetime, registration_deadline, COALESCE(tickets, false) AS tickets
        FROM public.events WHERE slug = ${escStr(slug)}`, true);
      if (!ev) return bad("Nie znaleziono wydarzenia", 404);
      const closed = salesClosed(ev);
      if (ev.status !== "Opublikowane") return Response.json({ on_sale: false, reason: closed, price: null, left: null, max: 0 });
      let left = null;
      if (Number(ev.capacity) > 0) {
        const s = await seatsTaken(base44, ev.id);
        left = Math.max(0, Number(ev.capacity) - s.sold - s.pending);
      }
      return Response.json({
        on_sale: !closed && left !== 0,
        reason: closed || (left === 0 ? "Wszystkie bilety s\u0105 wyprzedane." : null),
        price: ev.price,
        left,
        max: Math.min(10, left ?? 10)
      });
    }
    const me2 = await base44.auth.me().catch(() => null);
    if (!me2) return bad("Zaloguj si\u0119", 401);
    if (me2.role === "zablokowane") return bad("To konto jest zablokowane.", 403);
    if (a === "mine") {
      const rows = await runSql(base44, `SELECT t.code, t.token, t.holder_name, t.status, t.checked_at, e.title, e.slug, e.start_datetime, e.format
        FROM public.event_tickets t JOIN public.events e ON e.id = t.event_id
        WHERE lower(t.buyer_email) = ${escStr(String(me2.email || "").toLowerCase())} AND t.status <> 'anulowany'
        ORDER BY e.start_datetime DESC NULLS LAST, t.code LIMIT 200`, true);
      return Response.json({ tickets: rows.map((r) => ({
        code: showCode(r.code),
        holder_name: r.holder_name,
        status: r.status,
        checked_at: r.checked_at,
        title: r.title,
        slug: r.slug,
        start_datetime: r.start_datetime,
        format: r.format,
        pdf: ticketPdfUrl(r.token),
        link: `/bilet#t=${r.token}`
      })) });
    }
    const scope = await scannerScope(base44, me2);
    if (a === "scanner") {
      if (!scope) return Response.json({ allowed: false });
      const rows = await runSql(base44, `SELECT id, title, slug, start_datetime, duration_minutes, format, capacity FROM public.events
        WHERE COALESCE(tickets, false) = TRUE AND COALESCE(format, '') <> 'Online' AND status IN ('Opublikowane','Odwo\u0142ane') AND start_datetime IS NOT NULL
          AND start_datetime > now() - interval '2 days' AND start_datetime < now() + interval '60 days'
        ORDER BY start_datetime LIMIT 50`, true);
      const events = rows.filter((e) => canScan(scope, e.id));
      return Response.json({ allowed: true, admin: !!scope.admin, events });
    }
    if (!scope) return bad("Nie masz uprawnienia do sprawdzania bilet\xF3w.", 403);
    if (a === "check") {
      if (tooFast(String(me2.email))) return bad("Za szybko \u2014 poczekaj chwil\u0119.", 429);
      const scan = body.token ? validToken(body.token) ? { token: body.token } : null : parseScan(body.raw || body.code);
      if (!scan) return Response.json({ result: "nieczytelny" });
      const eventId = body.event_id ? String(body.event_id).slice(0, 64) : null;
      if (eventId && !canScan(scope, eventId)) return bad("Nie masz uprawnienia do tego wydarzenia.", 403);
      const r = await checkTicket(base44, { scan, eventId, by: String(me2.email || me2.full_name || "skaner").slice(0, 120), scope, undo: body.undo === true });
      if (eventId) Object.assign(r, { counts: await eventCounts(base44, eventId) });
      return Response.json(r);
    }
    if (a === "stats") {
      const eventId = String(body.event_id || "").slice(0, 64);
      if (!canScan(scope, eventId)) return bad("Nie masz uprawnienia do tego wydarzenia.", 403);
      const recent = await runSql(base44, `SELECT code, holder_name, checked_at, checked_by FROM public.event_tickets
        WHERE event_id = ${escStr(eventId)} AND status = 'wykorzystany' ORDER BY checked_at DESC LIMIT 15`, true);
      return Response.json({
        counts: await eventCounts(base44, eventId),
        recent: recent.map((r) => ({ code: showCode(r.code), name: r.holder_name, at: r.checked_at, by: r.checked_by }))
      });
    }
    return bad("Nieznana akcja");
  } catch (e) {
    console.error("tickets:", e?.message);
    return Response.json({ error: /^(Brak pola|Pole )/.test(String(e?.message)) ? e.message : "Co\u015B posz\u0142o nie tak. Spr\xF3buj ponownie." }, { status: 500 });
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
