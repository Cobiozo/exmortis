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
    const b642 = (await res.json()).data?.[0]?.b64_json;
    const bytes = Uint8Array.from(atob(b642), (c) => c.charCodeAt(0));
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
var LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
var rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
function newCode() {
  const b = rnd(7);
  return [...b.slice(0, 3)].map((x) => LETTERS[x % LETTERS.length]).join("") + [...b.slice(3)].map((x) => String(x % 10)).join("");
}
var showCode = (c) => c && c.length === 7 ? `${c.slice(0, 3)}-${c.slice(3)}` : String(c || "");
var TOKEN_ABC = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var newToken = () => [...rnd(32)].map((x) => TOKEN_ABC[x % TOKEN_ABC.length]).join("");
var ticketUrl = (token) => `${APP_URL}/bilet#t=${token}`;
var ticketPdfUrl = (token) => `${APP_URL}/functions/tickets?pdf=${token}`;
var cleanName = (v) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
async function loadEvent(base44, id) {
  const rows = await runSql(base44, `SELECT id, title, slug, subtitle, format, location, start_datetime, duration_minutes, status, price::float8 AS price,
      capacity, registration_deadline, COALESCE(tickets, false) AS tickets, ticket_template, short_path FROM public.events WHERE id = ${escStr(id)}`, true);
  return rows?.[0] || null;
}
var SCANNERS_KEY = "bilety_skanerzy";
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
var esc2 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var when = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
function ticketsHtml(tickets, events) {
  if (!tickets.length) return "";
  const byEv = /* @__PURE__ */ new Map();
  for (const t of tickets) byEv.set(t.event_id, [...byEv.get(t.event_id) || [], t]);
  const blocks = [...byEv.entries()].map(([id, list]) => {
    const ev = events.get(id) || {};
    return `<div style="margin:0 0 18px;border:1px solid #C9A24A;padding:22px;">
      <p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 10px;">BILET${list.length > 1 ? "Y" : ""}</p>
      <p style="margin:0 0 6px;color:#F5EFE1;font-size:20px;">${esc2(ev.title || "")}</p>
      ${ev.start_datetime ? `<p style="margin:0 0 14px;color:#8A8A8C;">${esc2(when(ev.start_datetime))} (czas polski)${ev.format === "Online" ? " \xB7 online" : ""}</p>` : ""}
      ${list.map((t) => `<p style="margin:0 0 10px;color:#E2E2E2;">${esc2(t.holder_name)} \xB7 <b style="color:#C9A24A;letter-spacing:2px;">${esc2(showCode(t.code))}</b><br>
        <a href="${esc2(ticketPdfUrl(t.token))}" style="color:#C9A24A;">Pobierz bilet (PDF)</a> \xB7 <a href="${esc2(ticketUrl(t.token))}" style="color:#8A8A8C;">otw\xF3rz na telefonie</a></p>`).join("")}
    </div>`;
  }).join("");
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">${blocks}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Bilet jest imienny i wa\u017Cny na jedno wej\u015Bcie. Przy wej\u015Bciu poka\u017C kod QR \u2014 na telefonie albo wydrukowany. Ka\u017Cd\u0105 osob\u0119 wpuszczam na jej bilet, wi\u0119c bilety dla innych przeka\u017C im wcze\u015Bniej (PDF albo link). Wszystkie bilety s\u0105 te\u017C w Moim koncie \u2192 Spotkania, po zalogowaniu tym adresem e-mail.</p></div>`;
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

// supabase/functions/ticketsAdmin/index.ts
var b64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
};
var uuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || "")) ? String(v) : null;
async function mailTickets(base44, ev, list, to) {
  const html = `<div style="background:#0A0A0B;padding:32px 32px 8px;font-family:Georgia,serif;color:#E2E2E2;">
      <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
      <h1 style="font-size:24px;">Tw\xF3j bilet</h1></div>${ticketsHtml(list, /* @__PURE__ */ new Map([[ev.id, ev]]))}`;
  return sendMail(base44, { kind: "bilet", ref: String(list[0].id), to, subject: `EXMORTIS \xB7 Bilet \u2014 ${ev.title}`, html, waznyDo: ev.start_datetime || void 0 });
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me2 = await requireAdmin(base44);
    await loadAppUrl(base44);
    await ensureTicketSchema(base44);
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    if (a === "get") {
      const ev = await loadEvent(base44, String(body.event_id || ""));
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      const rows = await runSql(base44, `SELECT id, code, token, holder_name, buyer_email, price::float8 AS price, source, status, checked_at, checked_by, order_id, created_at
        FROM public.event_tickets WHERE event_id = ${escStr(ev.id)} ORDER BY created_at, line_no`, true);
      const scanners = (await getSetting(base44, SCANNERS_KEY).catch(() => null) || []).filter((s) => !s.event_id || s.event_id === ev.id);
      return Response.json({
        event: { ...ev, ticket_template: ev.ticket_template ? cleanLayout(ev.ticket_template) : null },
        counts: await eventCounts(base44, ev.id),
        tickets: rows.map((r) => ({ ...r, code: showCode(r.code), link: ticketUrl(r.token), pdf: ticketPdfUrl(r.token), token: void 0 })),
        scanners
      });
    }
    if (a === "save") {
      const ev = await loadEvent(base44, String(body.event_id || ""));
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      const sets = [];
      if (body.tickets === true && ev.format === "Online") return Response.json({ error: "Bilety s\u0105 tylko na spotkania stacjonarne." }, { status: 400 });
      if (typeof body.tickets === "boolean") sets.push(`tickets = ${body.tickets ? "TRUE" : "FALSE"}`);
      if (body.template !== void 0) sets.push(`ticket_template = ${body.template ? `${escStr(JSON.stringify(cleanLayout(body.template)))}::jsonb` : "NULL"}`);
      if (sets.length) await runSql(base44, `UPDATE public.events SET ${sets.join(", ")} WHERE id = ${escStr(ev.id)}`);
      await clearSnap(base44, "events:").catch(() => {
      });
      return Response.json({ ok: true });
    }
    if (a === "test_pdf") {
      const ev = await loadEvent(base44, String(body.event_id || "")) || { title: "Przyk\u0142adowe wydarzenie" };
      const bytes = await renderTicketsPdf(ev, body.template ?? ev.ticket_template, [{ holder_name: String(body.sample_name || "Anna Kowalska-Wi\u015Bniewska").slice(0, 80), code: "KRT-4821", qr: ticketUrl("PrzykladowyKluczBiletuDoPodgladu12") }]);
      return Response.json({ pdf: b64(bytes) });
    }
    if (a === "add") {
      const ev = await loadEvent(base44, String(body.event_id || ""));
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      const name = cleanName(body.name);
      if (name.length < 3) return Response.json({ error: "Podaj imi\u0119 i nazwisko" }, { status: 400 });
      const email = body.email ? emailField(body).toLowerCase() : null;
      let row = null;
      for (let i = 0; i < 6 && !row; i++) {
        row = (await runSql(base44, `INSERT INTO public.event_tickets (code, token, event_id, holder_name, buyer_email, price, source)
          VALUES (${escStr(newCode())}, ${escStr(newToken())}, ${escStr(ev.id)}, ${escStr(name)}, ${email ? escStr(email) : "NULL"}, 0, 'recznie')
          ON CONFLICT DO NOTHING RETURNING *`))?.[0] || null;
      }
      if (!row) throw new Error("Nie uda\u0142o si\u0119 nada\u0107 numeru biletu");
      let mailed = false;
      if (email && body.send === true) {
        await mailTickets(base44, ev, [row], email);
        mailed = true;
      }
      return Response.json({ ok: true, code: showCode(row.code), mailed });
    }
    if (a === "resend") {
      const id = uuid(body.ticket_id);
      const [t] = id ? await runSql(base44, `SELECT * FROM public.event_tickets WHERE id = ${escStr(id)}`, true) : [];
      if (!t) return Response.json({ error: "Nie znaleziono biletu" }, { status: 404 });
      const to = body.email ? emailField(body).toLowerCase() : t.buyer_email;
      if (!to) return Response.json({ error: "Brak adresu e-mail \u2014 wpisz go" }, { status: 400 });
      const ev = await loadEvent(base44, t.event_id);
      await mailTickets(base44, ev, [t], to);
      return Response.json({ ok: true, to });
    }
    if (a === "cancel" || a === "restore") {
      const id = uuid(body.ticket_id);
      if (!id) return Response.json({ error: "Nie znaleziono biletu" }, { status: 404 });
      const r = await runSql(base44, a === "cancel" ? `UPDATE public.event_tickets SET status = 'anulowany' WHERE id = ${escStr(id)} AND status <> 'anulowany' RETURNING id` : `UPDATE public.event_tickets SET status = CASE WHEN checked_at IS NULL THEN 'wazny' ELSE 'wykorzystany' END WHERE id = ${escStr(id)} AND status = 'anulowany' RETURNING id`);
      return Response.json({ ok: !!r?.length });
    }
    if (a === "checkin") {
      const id = uuid(body.ticket_id);
      const [t] = id ? await runSql(base44, `SELECT token FROM public.event_tickets WHERE id = ${escStr(id)}`, true) : [];
      if (!t) return Response.json({ error: "Nie znaleziono biletu" }, { status: 404 });
      return Response.json(await checkTicket(base44, { scan: { token: t.token }, eventId: null, by: me2.email, scope: { all: true, admin: true }, undo: body.undo === true }));
    }
    if (a === "scanners_get") {
      const list = await getSetting(base44, SCANNERS_KEY).catch(() => null) || [];
      return Response.json({ scanners: list });
    }
    if (a === "scanners_save") {
      const seen = /* @__PURE__ */ new Set();
      const list = (Array.isArray(body.scanners) ? body.scanners : []).slice(0, 100).map((s) => {
        const email = String(s?.email || "").trim().toLowerCase().slice(0, 200);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Niepoprawny adres e-mail: ${email || "(pusty)"}`);
        const event_id = s?.event_id ? String(s.event_id).slice(0, 64) : null;
        const until = s?.until ? new Date(s.until) : null;
        if (until && isNaN(until.getTime())) throw new Error("Niepoprawna data wa\u017Cno\u015Bci uprawnienia");
        return { email, event_id, until: until ? until.toISOString() : null, note: String(s?.note || "").slice(0, 120), added_at: s?.added_at || (/* @__PURE__ */ new Date()).toISOString() };
      }).filter((s) => {
        const k = `${s.email}|${s.event_id || ""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      await saveSetting(base44, SCANNERS_KEY, list);
      return Response.json({ ok: true, scanners: list });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    if (e?.message === "FORBIDDEN") return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
    console.error("ticketsAdmin:", e?.message);
    return Response.json({ error: e?.message || "B\u0142\u0105d" }, { status: 400 });
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
