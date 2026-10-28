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
      const num2 = (r, f) => Number(r[f]) || 0;
      const out = [...groups.entries()].map(([key, rs]) => {
        const row = { [groupBy || "okres"]: key === "null" ? null : key, count: rs.length };
        for (const f of body.sum || []) row[`sum_${f}`] = rs.reduce((a, r) => a + num2(r, f), 0);
        for (const f of body.avg || []) row[`avg_${f}`] = rs.length ? rs.reduce((a, r) => a + num2(r, f), 0) / rs.length : 0;
        for (const f of body.min || []) row[`min_${f}`] = rs.length ? Math.min(...rs.map((r) => num2(r, f))) : 0;
        for (const f of body.max || []) row[`max_${f}`] = rs.length ? Math.max(...rs.map((r) => num2(r, f))) : 0;
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

// supabase/functions/_shared/rozdrozaGraph.ts
var TYPES = ["narrative", "decision", "ending"];
var CATEGORIES = ["mentalna", "duchowa", "zyciowa"];
var KEY_RE = /^[\p{L}\p{N}_.:-]{1,80}$/u;
var str = (v, max) => (v === null || v === void 0 ? "" : String(v)).replace(/^\s+|\s+$/g, "").slice(0, max);
var num = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function normCategory(v) {
  const s = slugify(v);
  if (/mental/.test(s)) return "mentalna";
  if (/duchow/.test(s)) return "duchowa";
  if (/zyci/.test(s)) return "zyciowa";
  return CATEGORIES.includes(s) ? s : "";
}
function normType(v) {
  const s = String(v || "").toLowerCase().trim();
  if (["narrative", "narracja", "scena", "scene"].includes(s)) return "narrative";
  if (["decision", "decyzja", "choice", "wybor", "wyb\xF3r"].includes(s)) return "decision";
  if (["ending", "zakonczenie", "zako\u0144czenie", "end", "koniec"].includes(s)) return "ending";
  return s;
}
function readStory(raw) {
  const st = raw?.story && typeof raw.story === "object" ? raw.story : raw || {};
  const scenesIn = Array.isArray(raw?.scenes) ? raw.scenes : Array.isArray(st.scenes) ? st.scenes : [];
  const choicesIn = Array.isArray(raw?.choices) ? raw.choices : Array.isArray(st.choices) ? st.choices : [];
  const story = {
    slug: slugify(st.slug || st.title),
    title: str(st.title, 200),
    summary: str(st.summary ?? st.description, 2e3),
    category: normCategory(st.category),
    cover_portrait_url: str(st.cover_portrait_url, 1e3),
    cover_landscape_url: str(st.cover_landscape_url, 1e3),
    estimated_minutes: num(st.estimated_minutes),
    content_warning: str(st.content_warning, 1e3),
    start_scene_key: str(st.start_scene_key, 80),
    reading_time: str(st.reading_time, 40),
    cover_portrait_prompt: str(st.cover_portrait_prompt, 3e3),
    cover_landscape_prompt: str(st.cover_landscape_prompt, 3e3),
    visual_notes: str(st.visual_notes, 3e3),
    visual_notes_en: str(st.visual_notes_en, 3e3),
    cover_visual_notes_en: str(st.cover_visual_notes_en, 3e3),
    image_style: str(st.image_style ?? raw?.style, 2e3),
    sort_order: num(st.sort_order)
  };
  const scenes = scenesIn.map((s, i) => ({
    scene_key: str(s?.scene_key ?? s?.key, 80),
    title: str(s?.title, 300),
    body: str(s?.body ?? s?.text, 3e4),
    scene_type: normType(s?.scene_type ?? s?.type),
    image_url: str(s?.image_url ?? s?.image, 1e3),
    alt_text: str(s?.alt_text ?? s?.alt, 500),
    next_scene_key: str(s?.next_scene_key ?? s?.next, 80),
    reflection_question: str(s?.reflection_question, 1e3),
    image_prompt: str(s?.image_prompt ?? s?.kadr, 3e3),
    sort_order: num(s?.sort_order) ?? i
  }));
  const choices = [];
  choicesIn.forEach((c, i) => choices.push({
    source_scene_key: str(c?.source_scene_key ?? c?.from, 80),
    target_scene_key: str(c?.target_scene_key ?? c?.to, 80),
    label: str(c?.label ?? c?.text, 500),
    sort_order: num(c?.sort_order) ?? i
  }));
  scenesIn.forEach((s) => (Array.isArray(s?.choices) ? s.choices : []).forEach((c, i) => choices.push({
    source_scene_key: str(s?.scene_key ?? s?.key, 80),
    target_scene_key: str(c?.target_scene_key ?? c?.to, 80),
    label: str(c?.label ?? c?.text, 500),
    sort_order: num(c?.sort_order) ?? i
  })));
  if (!story.start_scene_key && scenes[0]) story.start_scene_key = scenes[0].scene_key;
  return { story, scenes, choices };
}
function validateGraph(story, scenes, choices) {
  const errors = [], warnings = [];
  if (!story.title) errors.push("Brak tytu\u0142u historii.");
  if (!story.slug) errors.push("Brak adresu (slug) historii.");
  if (!story.category) warnings.push("Brak kategorii (mentalna / duchowa / \u017Cyciowa).");
  const by = /* @__PURE__ */ new Map();
  for (const s of scenes) {
    if (!s.scene_key) {
      errors.push("Scena bez scene_key.");
      continue;
    }
    if (!KEY_RE.test(s.scene_key)) errors.push(`Nieprawid\u0142owy scene_key \u201E${s.scene_key}\u201D.`);
    if (by.has(s.scene_key)) errors.push(`Powt\xF3rzony scene_key \u201E${s.scene_key}\u201D.`);
    by.set(s.scene_key, s);
    if (!TYPES.includes(s.scene_type)) errors.push(`Scena \u201E${s.scene_key}\u201D: nieznany typ \u201E${s.scene_type}\u201D (narrative / decision / ending).`);
    if (!s.body && s.scene_type !== "decision") warnings.push(`Scena \u201E${s.scene_key}\u201D: brak tekstu.`);
  }
  const out = new Map(scenes.map((s) => [s.scene_key, []]));
  for (const c of choices) {
    if (!by.has(c.source_scene_key)) {
      errors.push(`Decyzja \u201E${c.label || "?"}\u201D: scena \u017Ar\xF3d\u0142owa \u201E${c.source_scene_key}\u201D nie istnieje.`);
      continue;
    }
    if (!c.label) errors.push(`Decyzja w scenie \u201E${c.source_scene_key}\u201D bez tekstu.`);
    if (!by.has(c.target_scene_key)) errors.push(`Decyzja \u201E${c.label}\u201D (${c.source_scene_key}) prowadzi do nieistniej\u0105cej sceny \u201E${c.target_scene_key}\u201D.`);
    out.get(c.source_scene_key).push(c);
  }
  if (!story.start_scene_key || !by.has(story.start_scene_key)) errors.push(`Scena startowa \u201E${story.start_scene_key || "\u2014"}\u201D nie istnieje.`);
  const edges = /* @__PURE__ */ new Map();
  for (const s of scenes) {
    const ch = (out.get(s.scene_key) || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    if (s.scene_type === "narrative") {
      if (!s.next_scene_key) errors.push(`Scena \u201E${s.scene_key}\u201D (narracja) nie ma next_scene_key.`);
      else if (!by.has(s.next_scene_key)) errors.push(`Scena \u201E${s.scene_key}\u201D: next_scene_key \u201E${s.next_scene_key}\u201D nie istnieje.`);
      if (ch.length) warnings.push(`Scena \u201E${s.scene_key}\u201D (narracja) ma decyzje \u2014 zostan\u0105 pomini\u0119te.`);
      edges.set(s.scene_key, s.next_scene_key && by.has(s.next_scene_key) ? [s.next_scene_key] : []);
    } else if (s.scene_type === "decision") {
      if (!ch.length) errors.push(`Scena \u201E${s.scene_key}\u201D (decyzja) nie ma \u017Cadnych wybor\xF3w.`);
      else if (ch.length !== 2) warnings.push(`Scena \u201E${s.scene_key}\u201D: ${ch.length} wybory (zwykle s\u0105 2).`);
      const t = ch.map((c) => c.target_scene_key);
      if (t.length > 1 && new Set(t).size === 1) warnings.push(`Scena \u201E${s.scene_key}\u201D: wszystkie wybory prowadz\u0105 do tej samej sceny \u201E${t[0]}\u201D.`);
      edges.set(s.scene_key, t.filter((k) => by.has(k)));
    } else if (s.scene_type === "ending") {
      if (s.next_scene_key || ch.length) warnings.push(`Zako\u0144czenie \u201E${s.scene_key}\u201D ma dalsze po\u0142\u0105czenia \u2014 zostan\u0105 pomini\u0119te.`);
      if (!s.reflection_question) warnings.push(`Zako\u0144czenie \u201E${s.scene_key}\u201D nie ma pytania refleksyjnego.`);
      edges.set(s.scene_key, []);
    }
    if (s.scene_type !== "ending" && s.reflection_question) warnings.push(`Scena \u201E${s.scene_key}\u201D: pytanie refleksyjne pokazuje si\u0119 tylko w zako\u0144czeniach.`);
    if (!s.image_url) warnings.push(`Scena \u201E${s.scene_key}\u201D: brak obrazu.`);
    else if (!s.alt_text) warnings.push(`Scena \u201E${s.scene_key}\u201D: obraz bez opisu (alt).`);
  }
  const reach = /* @__PURE__ */ new Set();
  if (by.has(story.start_scene_key)) {
    const q = [story.start_scene_key];
    while (q.length) {
      const k = q.pop();
      if (reach.has(k)) continue;
      reach.add(k);
      for (const t of edges.get(k) || []) q.push(t);
    }
  }
  const endings = scenes.filter((s) => s.scene_type === "ending").map((s) => s.scene_key);
  const reachEnd = endings.filter((k) => reach.has(k));
  if (!reachEnd.length && by.has(story.start_scene_key)) errors.push("Od sceny startowej nie da si\u0119 doj\u015B\u0107 do \u017Cadnego zako\u0144czenia.");
  const canEnd = new Set(endings);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, ts] of edges) if (!canEnd.has(k) && ts.some((t) => canEnd.has(t))) {
      canEnd.add(k);
      changed = true;
    }
  }
  for (const k of reach) if (!canEnd.has(k) && by.get(k)?.scene_type !== "ending" && TYPES.includes(by.get(k)?.scene_type)) errors.push(`Ze sceny \u201E${k}\u201D nie da si\u0119 doj\u015B\u0107 do zako\u0144czenia (p\u0119tla bez wyj\u015Bcia albo urwana \u015Bcie\u017Cka).`);
  const unreachable = scenes.filter((s) => s.scene_key && !reach.has(s.scene_key)).map((s) => s.scene_key);
  if (unreachable.length) warnings.push(`Sceny nieosi\u0105galne od startu: ${unreachable.join(", ")}.`);
  const color = /* @__PURE__ */ new Map();
  let cycle = null;
  const dfs = (k, path) => {
    if (cycle) return;
    color.set(k, 1);
    path.push(k);
    for (const t of edges.get(k) || []) {
      if (color.get(t) === 1) {
        cycle = path.slice(path.indexOf(t)).concat(t);
        return;
      }
      if (!color.get(t)) dfs(t, path);
    }
    path.pop();
    color.set(k, 2);
  };
  if (by.has(story.start_scene_key)) dfs(story.start_scene_key, []);
  if (cycle) warnings.push(`P\u0119tla w historii: ${cycle.join(" \u2192 ")}. Sprawd\u017A, czy jest zamierzona.`);
  const decisions = scenes.filter((s) => s.scene_type === "decision" && reach.has(s.scene_key)).length;
  return {
    ok: !errors.length,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    stats: { scenes: scenes.length, choices: choices.length, decisions, endings: endings.length, reachable_endings: reachEnd.length }
  };
}
function buildSnapshot(story, scenes, choices, version) {
  const out = /* @__PURE__ */ new Map();
  for (const c of choices) {
    if (!out.has(c.source_scene_key)) out.set(c.source_scene_key, []);
    out.get(c.source_scene_key).push(c);
  }
  const sc = {};
  const byKey = new Map(scenes.map((s) => [s.scene_key, s]));
  for (const s of scenes) {
    const e = { t: s.title || "", b: s.body || "", y: s.scene_type };
    const src = s.image_from ? byKey.get(s.image_from) : null;
    if (s.image_url) {
      e.i = s.image_url;
      e.a = (src && src.image_url === s.image_url ? src.alt_text : s.alt_text) || s.alt_text || "";
    }
    if (s.scene_type === "narrative") e.n = s.next_scene_key;
    if (s.scene_type === "decision") e.c = (out.get(s.scene_key) || []).slice().sort((a, b) => a.sort_order - b.sort_order).map((c) => ({ l: c.label, to: c.target_scene_key }));
    if (s.scene_type === "ending" && s.reflection_question) e.q = s.reflection_question;
    sc[s.scene_key] = e;
  }
  return { v: version, start: story.start_scene_key, scenes: sc };
}
function storyMeta(s) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    summary: s.summary || "",
    category: s.category || "",
    cover_portrait_url: s.cover_portrait_url || "",
    cover_landscape_url: s.cover_landscape_url || "",
    estimated_minutes: s.estimated_minutes || null,
    reading_time: s.reading_time || "",
    content_warning: s.content_warning || "",
    version: s.version || 0
  };
}
var DEFAULT_STYLE = "cinematic photorealism, contemporary Poland, sophisticated arthouse film still, 35mm lens, human imperfect realism, rich shadow detail, muted warm gold highlights, near-black palette, natural skin, authentic interiors, no fantasy, no religious symbols, no blood, no text, no logos, no watermarks, no AI-looking faces, 16:9, no cinematic black bars";
function characterNotes(kind, story) {
  const cover = kind !== "scene";
  if (cover && String(story?.cover_visual_notes_en || "").trim()) return String(story.cover_visual_notes_en).trim();
  return String(story?.visual_notes_en || story?.visual_notes || "").trim();
}
function composePrompt(kind, base, story) {
  const style = String(story?.image_style || DEFAULT_STYLE);
  const st = kind === "cover_portrait" ? style.replace(/\b16:9\b/g, "vertical 2:3").replace(/,?\s*no cinematic black bars/i, "") : style;
  const notes = characterNotes(kind, story);
  const people = notes ? ` Character reference (apply only to the people who actually appear in this shot; never change their age, clothing or facial features between shots): ${notes}.` : "";
  const only = kind === "scene" ? " Show only the people this shot describes; do not add anyone else." : " Promotional cover: show only the people this shot describes (or nobody, if none are described); no other characters.";
  const extra = " Nobody looks like a posing advertising model: natural, non-idealised frame, subtle film grain, no HDR, no stock-photo look, no text or letters anywhere in the image.";
  return `${String(base || "").trim()}${people}${only} Style: ${st}.${extra}`.replace(/\s+/g, " ").trim();
}
var START_SCENE_NUMBERS = [1, 2, 5, 7, 11, 15, 17];
var isStartScene = (key) => {
  const m = /(\d+)\s*$/.exec(String(key || ""));
  return !!m && START_SCENE_NUMBERS.includes(Number(m[1]));
};
var aspectOf = (kind) => kind === "cover_portrait" ? "2:3" : "16:9";

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

// supabase/functions/rozdrozaAdmin/index.ts
var MAX_SCENES = 300;
var MAX_CHOICES = 600;
var toEdit = (s) => ({
  scene_key: s.scene_key,
  title: s.title || "",
  body: s.body || "",
  scene_type: s.scene_type,
  image_url: s.image_url || "",
  alt_text: s.alt_text || "",
  next_scene_key: s.next_scene_key || "",
  reflection_question: s.reflection_question || "",
  image_prompt: s.image_prompt || "",
  sort_order: Number(s.sort_order) || 0
});
var toChoice = (c) => ({ source_scene_key: c.source_scene_key, target_scene_key: c.target_scene_key, label: c.label || "", sort_order: Number(c.sort_order) || 0 });
var AI_SETTING = "obrazy_ai";
var MASK = "********";
var QUALITY = ["low", "medium", "high"];
var cleanModel = (m) => /^[a-z0-9][a-z0-9._-]{1,60}$/i.test(String(m || "").trim()) ? String(m).trim() : "gpt-image-2";
var aiPublic = (c) => ({
  provider: c.provider === "openai" ? "openai" : "base44",
  model: cleanModel(c.model),
  quality: QUALITY.includes(c.quality) ? c.quality : "medium",
  has_key: !!c.openai_key,
  key_hint: c.openai_key ? `\u2026${String(c.openai_key).slice(-4)}` : ""
});
var b64Bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
async function pickImage(j) {
  const item = j?.data?.[0] || {};
  if (item.b64_json) return { bytes: b64Bytes(item.b64_json), type: "image/png" };
  if (item.url) {
    const im = await fetch(item.url, { signal: AbortSignal.timeout(6e4) });
    if (!im.ok) throw new Error("Nie uda\u0142o si\u0119 pobra\u0107 wygenerowanego obrazu.");
    return { bytes: new Uint8Array(await im.arrayBuffer()), type: im.headers.get("content-type") || "image/png" };
  }
  throw new Error("Us\u0142uga nie zwr\xF3ci\u0142a obrazu.");
}
async function genBase44(base44, prompt, aspect) {
  try {
    return await genBase44Once(base44, prompt, aspect);
  } catch (e) {
    if (!/\(400\)/.test(e.message) || prompt.length <= 1200) throw e;
    return await genBase44Once(base44, prompt.slice(0, 1200), aspect);
  }
}
async function genBase44Once(base44, prompt, aspect) {
  const { baseURL, token, headers } = base44.asServiceRole.aiGateway.connection();
  const r = await fetch(`${baseURL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify({ model: "automatic", prompt, n: 1, aspect_ratio: aspect }),
    signal: AbortSignal.timeout(17e4)
  });
  const txt = await r.text();
  if (!r.ok) {
    if (r.status === 402 || r.status === 429 || /credit|quota|limit/i.test(txt)) throw new Error("Brak kredyt\xF3w AI w aplikacji Base44 (albo limit chwilowo wyczerpany).");
    if (/policy|safety|moderat/i.test(txt)) throw new Error("Us\u0142uga odrzuci\u0142a opis kadru (zasady tre\u015Bci). Zmie\u0144 prompt i spr\xF3buj ponownie.");
    let why = "";
    try {
      const j2 = JSON.parse(txt);
      why = String(j2?.error?.message || j2?.detail || j2?.message || "").slice(0, 200);
    } catch {
      why = txt.slice(0, 200);
    }
    throw new Error(`Generowanie nie powiod\u0142o si\u0119 (${r.status})${why ? `: ${why}` : ""}.`);
  }
  let j;
  try {
    j = JSON.parse(txt);
  } catch {
    throw new Error("Nieczytelna odpowied\u017A us\u0142ugi generowania.");
  }
  return pickImage(j);
}
var OA = "https://api.openai.com/v1/images";
var OA_SIZES = { "2:3": ["1024x1536"], "16:9": ["2048x1152", "1536x1024"] };
function oaError(status, txt, model) {
  if (status === 401) return "OpenAI: klucz API jest nieprawid\u0142owy albo zosta\u0142 uniewa\u017Cniony \u2014 wklej nowy w ustawieniach generowania.";
  if (/insufficient_quota|billing|exceeded your current quota/i.test(txt)) return "OpenAI: brak \u015Brodk\xF3w na koncie API (platform.openai.com \u2192 Billing).";
  if (status === 429) return "OpenAI: chwilowy limit zapyta\u0144 \u2014 spr\xF3buj za minut\u0119.";
  if (/verif/i.test(txt) && status === 403) return "OpenAI: ten model wymaga weryfikacji organizacji na platform.openai.com (Settings \u2192 Organization \u2192 Verify).";
  if (/model_not_found|does not exist|invalid model|not have access to model/i.test(txt)) return `OpenAI: model \u201E${model}\u201D jest niedost\u0119pny dla tego klucza \u2014 zmie\u0144 model w ustawieniach (np. gpt-image-1).`;
  if (/safety|moderation|policy/i.test(txt)) return "OpenAI odrzuci\u0142o opis kadru (zasady tre\u015Bci). Zmie\u0144 prompt i spr\xF3buj ponownie.";
  return `OpenAI: generowanie nie powiod\u0142o si\u0119 (${status}).`;
}
async function genOpenAI(cfg, prompt, aspect, refs) {
  const model = cleanModel(cfg.model);
  const quality = QUALITY.includes(cfg.quality) ? cfg.quality : "medium";
  const auth = { Authorization: `Bearer ${cfg.openai_key}` };
  const refFiles = [];
  for (const [i, u] of refs.entries()) {
    const r = await fetch(u, { signal: AbortSignal.timeout(3e4) }).catch(() => null);
    if (!r?.ok) throw new Error("Nie uda\u0142o si\u0119 pobra\u0107 wzoru postaci \u2014 wgraj go ponownie.");
    const type = r.headers.get("content-type") || "image/png";
    if (!/^image\/(png|jpe?g|webp)/.test(type)) throw new Error("Wz\xF3r postaci musi by\u0107 obrazem PNG, JPG albo WEBP.");
    refFiles.push(new File([new Uint8Array(await r.arrayBuffer())], `wzor-${i + 1}.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`, { type }));
  }
  let fidelity = true;
  const sizes = [...OA_SIZES[aspect] || OA_SIZES["16:9"]];
  for (let attempt = 0; attempt < 4; attempt++) {
    const size = sizes[0];
    let r;
    if (refFiles.length) {
      const fd = new FormData();
      fd.append("model", model);
      fd.append("prompt", prompt);
      fd.append("n", "1");
      fd.append("size", size);
      fd.append("quality", quality);
      if (fidelity) fd.append("input_fidelity", "high");
      for (const f of refFiles) fd.append("image[]", f);
      r = await fetch(`${OA}/edits`, { method: "POST", headers: auth, body: fd, signal: AbortSignal.timeout(17e4) });
    } else {
      r = await fetch(`${OA}/generations`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, n: 1, size, quality }),
        signal: AbortSignal.timeout(17e4)
      });
    }
    const txt = await r.text();
    if (r.ok) {
      let j;
      try {
        j = JSON.parse(txt);
      } catch {
        throw new Error("Nieczytelna odpowied\u017A OpenAI.");
      }
      return pickImage(j);
    }
    if (r.status === 400 && /size/i.test(txt) && sizes.length > 1) {
      sizes.shift();
      continue;
    }
    if (r.status === 400 && /input_fidelity/i.test(txt) && fidelity) {
      fidelity = false;
      continue;
    }
    throw new Error(oaError(r.status, txt, model));
  }
  throw new Error("OpenAI: generowanie nie powiod\u0142o si\u0119.");
}
async function resolveRefs(base44, story) {
  const list = String(story?.reference_image_url || "").split(/\s+/).filter(Boolean).slice(0, 3);
  const out = [];
  for (const u of list) {
    const m = /^\/functions\/media\?id=([A-Za-z0-9_-]{6,64})/.exec(u);
    if (m) {
      const [a] = await base44.asServiceRole.entities.MediaAsset.filter({ pub_id: m[1] }, null, 1).catch(() => []);
      const w = a?.warianty || {};
      const uri = w[1600] || w["1600"] || w[960] || w["960"] || a?.oryginal_uri;
      if (!uri) throw new Error("Nie znaleziono wzoru postaci w bibliotece medi\xF3w \u2014 wgraj go ponownie.");
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 });
      out.push(signed_url);
    } else if (/^https:\/\/\S+$/.test(u)) out.push(u);
  }
  return out;
}
async function generateImage(base44, prompt, aspect, story) {
  const cfg = await getSetting(base44, AI_SETTING).catch(() => null) || {};
  const useOpenAI = cfg.provider === "openai";
  if (useOpenAI && !cfg.openai_key) throw new Error("Wybrano OpenAI, ale nie wklejono klucza API \u2014 uzupe\u0142nij ustawienia generowania.");
  const { bytes, type } = useOpenAI ? await genOpenAI(cfg, prompt, aspect, await resolveRefs(base44, story)) : await genBase44(base44, prompt, aspect);
  const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  const file = new File([bytes], `rozdroza-${Date.now()}.${ext}`, { type });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return file_url;
}
async function publishStory(sr, story, scenes, choices) {
  const report = validateGraph(story, scenes, choices);
  if (!report.ok) return { ok: false, report };
  const version = (Number(story.version) || 0) + 1;
  const snapshot = buildSnapshot(story, scenes, choices, version);
  const meta = { ...storyMeta(story), version };
  await sr.RozdrozaStory.update(story.id, { status: "published", version, published: { meta, snapshot }, published_at: (/* @__PURE__ */ new Date()).toISOString() });
  return { ok: true, version, report };
}
function cleanDate(v) {
  const t = Date.parse(String(v || ""));
  if (!Number.isFinite(t) || !/[zZ]|[+-]\d\d:?\d\d$/.test(String(v))) throw new Error("Nieprawid\u0142owa data publikacji.");
  if (t < Date.parse("2020-01-01") || t > Date.now() + 3 * 365 * 864e5) throw new Error("Data publikacji poza zakresem.");
  return new Date(t).toISOString();
}
function addDaysWarsaw(t, days) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day + days, +p.hour, +p.minute);
  const off = (u2) => {
    const q = Object.fromEntries(f.formatToParts(new Date(u2)).map((x) => [x.type, x.value]));
    return Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour, +q.minute) - u2;
  };
  let u = local - off(local);
  u = local - off(u);
  return u;
}
function previousWithImage(sc, scenes, choices) {
  const keys = /* @__PURE__ */ new Set([
    ...scenes.filter((x) => x.next_scene_key === sc.scene_key).map((x) => x.scene_key),
    ...choices.filter((c) => c.target_scene_key === sc.scene_key).map((c) => c.source_scene_key)
  ]);
  return scenes.filter((x) => keys.has(x.scene_key) && x.image_url).sort((x, y) => x.sort_order - y.sort_order)[0] || null;
}
var originOf = (prev) => prev.image_from || prev.scene_key;
async function load(sr, id) {
  const story = await sr.RozdrozaStory.get(String(id || "")).catch(() => null);
  if (!story) throw new Error("Nie ma takiej historii.");
  const [scenes, choices] = await Promise.all([
    sr.RozdrozaScene.filter({ story_id: story.id }, "sort_order", MAX_SCENES + 50),
    sr.RozdrozaChoice.filter({ story_id: story.id }, "sort_order", MAX_CHOICES + 50)
  ]);
  return { story, scenes, choices };
}
var listRow = (s) => ({
  id: s.id,
  slug: s.slug,
  title: s.title,
  category: s.category || "",
  status: s.status || "draft",
  version: s.version || 0,
  published_at: s.published_at || null,
  updated_date: s.updated_date,
  sort_order: s.sort_order ?? 0,
  cover_portrait_url: s.cover_portrait_url || "",
  visible_from: s.visible_from || "",
  // Szkic zmieniony po publikacji → klient widzi jeszcze poprzednią wersję.
  changed: !!(s.status === "published" && s.published_at && s.draft_changed_at && s.draft_changed_at > s.published_at)
});
async function replaceGraph(sr, storyId, scenes, choices) {
  await sr.RozdrozaScene.deleteMany({ story_id: storyId });
  await sr.RozdrozaChoice.deleteMany({ story_id: storyId });
  if (scenes.length) await sr.RozdrozaScene.bulkCreate(scenes.map((s) => ({ story_id: storyId, ...toEdit(s) })));
  if (choices.length) await sr.RozdrozaChoice.bulkCreate(choices.map((c) => ({ story_id: storyId, ...toChoice(c) })));
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me2 = await requireAdmin(base44);
    if (me2.role !== "admin") return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
    const sr = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    if (a === "list") {
      const rows = await sr.RozdrozaStory.list("sort_order", 300);
      return Response.json({ items: rows.map(listRow) });
    }
    if (a === "get" || a === "preview") {
      const { story, scenes, choices } = await load(sr, body.id);
      const report = validateGraph(story, scenes, choices);
      if (a === "preview") {
        if (!scenes.some((s) => s.scene_key === story.start_scene_key)) return Response.json({ error: "Szkic nie ma sceny startowej \u2014 podgl\u0105d niemo\u017Cliwy.", report }, { status: 400 });
        return Response.json({ meta: { ...storyMeta(story), version: 0 }, snapshot: buildSnapshot(story, scenes, choices, 0), report });
      }
      const extra = {};
      for (const k of ["cover_portrait_prompt", "cover_landscape_prompt", "cover_portrait_candidate", "cover_landscape_candidate", "visual_notes", "image_style", "visual_notes_en", "cover_visual_notes_en", "reference_image_url"]) extra[k] = story[k] || "";
      return Response.json({ story: { ...listRow(story), ...storyMeta(story), ...extra, start_scene_key: story.start_scene_key }, scenes, choices, report });
    }
    if (a === "import") {
      const data = body.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.stories) ? data.stories : [data];
      if (!list.length || list.length > 50) throw new Error("Plik nie zawiera historii (albo jest ich ponad 50).");
      const existing = await sr.RozdrozaStory.list("sort_order", 300);
      const bySlug = new Map(existing.map((s) => [s.slug, s]));
      const results = [];
      for (const raw of list) {
        const { story, scenes, choices } = readStory(raw && typeof raw === "object" && !raw.style && data?.style ? { ...raw, style: data.style } : raw);
        const report = validateGraph(story, scenes, choices);
        const res = { slug: story.slug, title: story.title, report, status: "" };
        results.push(res);
        if (!story.slug || !story.title) {
          res.status = "pomini\u0119ta (brak tytu\u0142u)";
          continue;
        }
        if (!scenes.length) {
          res.status = "pomini\u0119ta (brak scen)";
          continue;
        }
        if (scenes.length > MAX_SCENES || choices.length > MAX_CHOICES) {
          res.status = "pomini\u0119ta (za du\u017Co scen lub decyzji)";
          continue;
        }
        const old = bySlug.get(story.slug);
        if (old && body.replace !== true) {
          res.status = "istnieje \u2014 zaznacz \u201EZast\u0105p szkic\u201D, \u017Ceby wgra\u0107 ponownie";
          continue;
        }
        const fields = { ...story, category: story.category || void 0 };
        Object.keys(fields).forEach((k) => (fields[k] === "" || fields[k] === null || fields[k] === void 0) && delete fields[k]);
        if (old) {
          await sr.RozdrozaStory.update(old.id, { ...fields, draft_changed_at: (/* @__PURE__ */ new Date()).toISOString() });
          await replaceGraph(sr, old.id, scenes, choices);
          res.status = "zast\u0105piono szkic";
          res.id = old.id;
        } else {
          const created = await sr.RozdrozaStory.create({ ...fields, status: "draft", version: 0, sort_order: existing.length + results.length });
          await replaceGraph(sr, created.id, scenes, choices);
          res.status = "dodano jako szkic";
          res.id = created.id;
        }
      }
      return Response.json({ results });
    }
    if (a === "update_story") {
      const { story } = await load(sr, body.id);
      const f = body.fields || {};
      const patch = {};
      const s = (k, max) => {
        if (typeof f[k] === "string") patch[k] = f[k].trim().slice(0, max);
      };
      s("title", 200);
      s("summary", 2e3);
      s("content_warning", 1e3);
      s("cover_portrait_url", 1e3);
      s("cover_landscape_url", 1e3);
      s("start_scene_key", 80);
      s("reading_time", 40);
      s("cover_portrait_prompt", 3e3);
      s("cover_landscape_prompt", 3e3);
      s("visual_notes", 3e3);
      s("image_style", 2e3);
      s("visual_notes_en", 3e3);
      s("cover_visual_notes_en", 3e3);
      s("reference_image_url", 1500);
      if (typeof f.category === "string") patch.category = normCategory(f.category) || void 0;
      if (f.estimated_minutes !== void 0) patch.estimated_minutes = Math.max(0, Math.min(600, Number(f.estimated_minutes) || 0)) || null;
      if (f.sort_order !== void 0) patch.sort_order = Number(f.sort_order) || 0;
      if (typeof f.slug === "string") {
        const slug = slugify(f.slug);
        if (!slug) throw new Error("Adres historii nie mo\u017Ce by\u0107 pusty.");
        const dup = (await sr.RozdrozaStory.filter({ slug }, null, 2)).find((x) => x.id !== story.id);
        if (dup) throw new Error("Taki adres ma ju\u017C inna historia.");
        patch.slug = slug;
      }
      if (patch.title === "") throw new Error("Tytu\u0142 nie mo\u017Ce by\u0107 pusty.");
      await sr.RozdrozaStory.update(story.id, { ...patch, draft_changed_at: (/* @__PURE__ */ new Date()).toISOString() });
      return Response.json({ ok: true });
    }
    if (a === "update_scene") {
      const sc = await sr.RozdrozaScene.get(String(body.id || "")).catch(() => null);
      if (!sc) throw new Error("Nie ma takiej sceny.");
      const patch = {};
      if (body.image_url !== void 0) {
        patch.image_url = String(body.image_url || "").trim().slice(0, 1e3);
        if (patch.image_url !== (sc.image_url || "")) patch.image_from = "";
      }
      if (body.alt_text !== void 0) patch.alt_text = String(body.alt_text || "").trim().slice(0, 500);
      if (body.image_prompt !== void 0) patch.image_prompt = String(body.image_prompt || "").trim().slice(0, 3e3);
      await sr.RozdrozaScene.update(sc.id, patch);
      await sr.RozdrozaStory.update(sc.story_id, { draft_changed_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
      });
      return Response.json({ ok: true });
    }
    if (a === "publish") {
      const { story, scenes, choices } = await load(sr, body.id);
      const r = await publishStory(sr, story, scenes, choices);
      if (!r.ok) return Response.json({ error: "Historia ma b\u0142\u0119dy \u2014 popraw je przed publikacj\u0105.", report: r.report }, { status: 400 });
      return Response.json(r);
    }
    if (a === "schedule") {
      const { story } = await load(sr, body.id);
      const when = body.visible_from ? cleanDate(body.visible_from) : "";
      await sr.RozdrozaStory.update(story.id, { visible_from: when });
      return Response.json({ ok: true, visible_from: when });
    }
    if (a === "schedule_plan") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : [];
      if (!ids.length) throw new Error("Zaznacz historie do harmonogramu.");
      const start = Date.parse(cleanDate(body.start));
      const every = Math.round(Number(body.every_days));
      if (!(every >= 1 && every <= 90)) throw new Error("Odst\u0119p musi wynosi\u0107 od 1 do 90 dni.");
      const results = [];
      let n = 0;
      for (const id of ids) {
        const { story, scenes, choices } = await load(sr, id);
        const when = new Date(addDaysWarsaw(start, every * n)).toISOString();
        await sr.RozdrozaStory.update(story.id, { visible_from: when });
        if (story.status !== "published") {
          const r = await publishStory(sr, story, scenes, choices);
          if (!r.ok) {
            await sr.RozdrozaStory.update(story.id, { visible_from: story.visible_from || "" });
            results.push({ id, title: story.title, skipped: "ma b\u0142\u0119dy \u2014 pomini\u0119ta" });
            continue;
          }
        }
        results.push({ id, title: story.title, visible_from: when });
        n++;
      }
      return Response.json({ ok: true, results });
    }
    if (a === "unpublish") {
      const { story } = await load(sr, body.id);
      await sr.RozdrozaStory.update(story.id, { status: "draft" });
      return Response.json({ ok: true });
    }
    if (a === "delete") {
      const { story } = await load(sr, body.id);
      if (story.status === "published") throw new Error("Najpierw wycofaj publikacj\u0119.");
      await sr.RozdrozaScene.deleteMany({ story_id: story.id });
      await sr.RozdrozaChoice.deleteMany({ story_id: story.id });
      await sr.RozdrozaStory.delete(story.id);
      return Response.json({ ok: true });
    }
    if (a === "generate") {
      const kind = ["scene", "cover_portrait", "cover_landscape"].includes(body.kind) ? body.kind : "scene";
      let story, scene = null;
      if (kind === "scene") {
        scene = await sr.RozdrozaScene.get(String(body.id || "")).catch(() => null);
        if (!scene) throw new Error("Nie ma takiej sceny.");
        story = await sr.RozdrozaStory.get(scene.story_id);
      } else story = (await load(sr, body.id)).story;
      const base = kind === "scene" ? scene.image_prompt : kind === "cover_portrait" ? story.cover_portrait_prompt : story.cover_landscape_prompt;
      if (!String(base || "").trim()) throw new Error("Brak opisu kadru (promptu) \u2014 uzupe\u0142nij go przed generowaniem.");
      const url = await generateImage(base44, composePrompt(kind, base, story), aspectOf(kind), story);
      if (kind === "scene") await sr.RozdrozaScene.update(scene.id, { image_candidate_url: url });
      else await sr.RozdrozaStory.update(story.id, { [kind === "cover_portrait" ? "cover_portrait_candidate" : "cover_landscape_candidate"]: url });
      return Response.json({ ok: true, url });
    }
    if (a === "candidate") {
      const kind = ["scene", "cover_portrait", "cover_landscape"].includes(body.kind) ? body.kind : "scene";
      const accept = body.decision === "accept";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (kind === "scene") {
        const sc = await sr.RozdrozaScene.get(String(body.id || "")).catch(() => null);
        if (!sc?.image_candidate_url) throw new Error("Brak kadru do zatwierdzenia.");
        await sr.RozdrozaScene.update(sc.id, accept ? { image_url: sc.image_candidate_url, image_candidate_url: "", image_from: "" } : { image_candidate_url: "" });
        if (accept) await sr.RozdrozaStory.update(sc.story_id, { draft_changed_at: now }).catch(() => {
        });
      } else {
        const { story } = await load(sr, body.id);
        const c = kind === "cover_portrait" ? "cover_portrait_candidate" : "cover_landscape_candidate";
        const f = kind === "cover_portrait" ? "cover_portrait_url" : "cover_landscape_url";
        if (!story[c]) throw new Error("Brak ok\u0142adki do zatwierdzenia.");
        await sr.RozdrozaStory.update(story.id, accept ? { [f]: story[c], [c]: "", draft_changed_at: now } : { [c]: "" });
      }
      return Response.json({ ok: true });
    }
    if (a === "use_previous") {
      const sc = await sr.RozdrozaScene.get(String(body.id || "")).catch(() => null);
      if (!sc) throw new Error("Nie ma takiej sceny.");
      if (sc.image_url && body.replace !== true) return Response.json({ error: "Scena ma ju\u017C zatwierdzone zdj\u0119cie \u2014 potwierd\u017A zast\u0105pienie.", needs_confirm: true }, { status: 409 });
      const [scenes, choices] = await Promise.all([
        sr.RozdrozaScene.filter({ story_id: sc.story_id }, "sort_order", MAX_SCENES + 50),
        sr.RozdrozaChoice.filter({ story_id: sc.story_id }, "sort_order", MAX_CHOICES + 50)
      ]);
      const prev = previousWithImage(sc, scenes, choices);
      if (!prev) throw new Error("Poprzednia scena nie ma jeszcze obrazu.");
      await sr.RozdrozaScene.update(sc.id, { image_url: prev.image_url, image_from: originOf(prev) });
      await sr.RozdrozaStory.update(sc.story_id, { draft_changed_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
      });
      return Response.json({ ok: true, from: prev.scene_key });
    }
    if (a === "fill_previous") {
      const { story, scenes, choices } = await load(sr, body.id);
      const cur = new Map(scenes.map((s) => [s.scene_key, { ...s }]));
      const filled = [];
      for (let pass = 0, again = true; again && pass < 50; pass++) {
        again = false;
        for (const s of [...cur.values()].sort((x, y) => x.sort_order - y.sort_order)) {
          if (s.image_url || s.image_candidate_url || isStartScene(s.scene_key)) continue;
          const prev = previousWithImage(s, [...cur.values()], choices);
          if (!prev) continue;
          s.image_url = prev.image_url;
          s.image_from = originOf(prev);
          filled.push(s);
          again = true;
        }
      }
      for (const s of filled) await sr.RozdrozaScene.update(s.id, { image_url: s.image_url, image_from: s.image_from });
      if (filled.length) await sr.RozdrozaStory.update(story.id, { draft_changed_at: (/* @__PURE__ */ new Date()).toISOString() });
      const missing = [...cur.values()].filter((s) => !s.image_url).map((s) => s.scene_key);
      return Response.json({ ok: true, filled: filled.map((s) => ({ key: s.scene_key, from: s.image_from })), missing });
    }
    if (a === "ai_get") return Response.json(aiPublic(await getSetting(base44, AI_SETTING).catch(() => null) || {}));
    if (a === "ai_save") {
      const prev = await getSetting(base44, AI_SETTING).catch(() => null) || {};
      const next = { provider: body.provider === "openai" ? "openai" : "base44", model: cleanModel(body.model), quality: QUALITY.includes(body.quality) ? body.quality : "medium", openai_key: prev.openai_key || "" };
      const key = String(body.openai_key || "").trim();
      if (body.remove_key === true) next.openai_key = "";
      else if (key && key !== MASK) {
        if (!/^sk-[A-Za-z0-9_-]{20,250}$/.test(key)) throw new Error("To nie wygl\u0105da na klucz API OpenAI (zaczyna si\u0119 od sk-).");
        next.openai_key = key;
      }
      if (next.provider === "openai" && !next.openai_key) throw new Error("Aby u\u017Cywa\u0107 OpenAI, wklej klucz API.");
      await saveSetting(base44, AI_SETTING, next);
      return Response.json(aiPublic(next));
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error?.message === "FORBIDDEN") return Response.json({ error: "Brak dost\u0119pu" }, { status: 403 });
    return Response.json({ error: error?.message || "B\u0142\u0105d" }, { status: 500 });
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
