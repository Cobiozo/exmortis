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
function atom(field, cond2) {
  if (cond2 === null) return `${col(field)}=is.null`;
  if (cond2 === true || cond2 === false) return `${col(field)}=eq.${cond2}`;
  if (typeof cond2 !== "object" || Array.isArray(cond2)) {
    return Array.isArray(cond2) ? `${col(field)}=in.(${cond2.map(inVal).join(",")})` : `${col(field)}=eq.${val(cond2)}`;
  }
  const [op, v] = Object.entries(cond2)[0];
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
  for (const [field, cond2] of Object.entries(query || {})) {
    if (field === "$or" || field === "$and") {
      const sep = field === "$or" ? "or" : "and";
      const inner = cond2.map((sub) => {
        const [f, c] = Object.entries(sub)[0];
        return atom(f, c).replace("=", ".");
      });
      parts.push(`${sep}=(${inner.join(",")})`);
    } else {
      parts.push(atom(field, cond2));
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
async function pgGet(table, qs2) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs2}`, { headers: H(), signal: AbortSignal.timeout(2e4) });
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
    const qs2 = `${parts.join("&")}${order}&limit=${lim + 1}&offset=${off}`;
    const rows = await pgGet(table, qs2);
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
      const enc2 = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc2.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc2.encode(`${name}.${exp2}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
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
      const enc2 = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc2.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc2.encode(`sign:${file_uri}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
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
async function restGet(_base44, path) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/${path}`, {
    headers: { apikey: SRK2, Authorization: `Bearer ${SRK2}` },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
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
function activeStep(p, today2 = warsawToday()) {
  const steps = readSteps(p);
  const i = steps.findIndex((s) => s.do >= today2);
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

// supabase/functions/_shared/smtp.ts
import nodemailer2 from "npm:nodemailer@6.9.13";

// supabase/functions/_shared/shim.ts
var secrets = {
  get: (k) => Deno.env.get(k) ?? null
};

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
async function adminTo(base44) {
  const s = await mailConfig(base44);
  return FIRMA?.email || s?.reply_to || s?.from || null;
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
var escHtml = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
var zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} z\u0142`;
function orderEmailHtml(buyerName, items, total, orderId = "", invoice = null) {
  const rows = items.map(
    (p) => `<tr><td style="padding:8px 0;color:#E2E2E2;">${escHtml(p.name)} \xD7 ${Number(p.quantity) || 1}</td><td style="padding:8px 0;text-align:right;color:#C9A24A;">${zl((Number(p.quantity) || 1) * Number(p.unitPrice) / 100)}</td></tr>`
  ).join("");
  const nr = orderId ? String(orderId).slice(0, 8).toUpperCase() : "";
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    <h1 style="font-size:26px;letter-spacing:1px;">Pr\xF3g przekroczony</h1>
    <p style="color:#8A8A8C;line-height:1.7;">${escHtml(buyerName)}, Twoja p\u0142atno\u015B\u0107 zosta\u0142a przyj\u0119ta. Szczeg\xF3\u0142y poni\u017Cej \u2014 pierwszy ruch jest ju\u017C za Tob\u0105.</p>
    ${nr ? `<p style="color:#8A8A8C;font-size:13px;">Numer zam\xF3wienia: <span style="color:#E2E2E2;">${nr}</span> (pe\u0142ny: ${escHtml(orderId)})</p>` : ""}
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${rows}
      <tr><td style="padding-top:12px;border-top:1px solid #3D3D3F;color:#8A8A8C;">RAZEM</td>
      <td style="padding-top:12px;border-top:1px solid #3D3D3F;text-align:right;color:#C9A24A;font-size:18px;">${zl(total)}</td></tr>
    </table>
    ${invoice && invoice.nip ? `<p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Dane do faktury: <span style="color:#E2E2E2;">${escHtml(invoice.company)}, NIP ${escHtml(invoice.nip)}, ${escHtml(invoice.address)}</span><br>Faktur\u0119 wy\u015Bl\u0119 osobno na ten adres e-mail.</p>` : ""}
    <p style="color:#8A8A8C;font-size:13px;line-height:1.6;"><a href="${APP_URL}/regulamin" style="color:#C9A24A;">Regulamin</a> \xB7 <a href="${APP_URL}/odstapienie" style="color:#C9A24A;">Odst\u0105pienie od umowy (formularz)</a></p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>
  </div>`;
}

// supabase/functions/_shared/waitlist.ts
var escHtml2 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var zlTxt = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} z\u0142`;
function waitlistHtml(p, firstName, note, url) {
  const promo = p.price_start != null && p.promo_end_date;
  const price = p.is_free ? "bezp\u0142atnie" : promo ? `${zlTxt(p.price_start)} (do ${(/* @__PURE__ */ new Date(`${String(p.promo_end_date).slice(0, 10)}T12:00:00Z`)).toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "Europe/Warsaw" })}, potem ${zlTxt(p.next_price?.cena ?? p.price_regular ?? p.price)})` : zlTxt(unitPrice(p));
  const noteHtml = note ? `<p style="line-height:1.7;color:#E2E2E2;">${escHtml2(note).replace(/\n/g, "<br>")}</p>` : "";
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    ${firstName ? `<p style="color:#8A8A8C;">${escHtml2(firstName)},</p>` : ""}
    <h1 style="font-size:24px;letter-spacing:1px;">\u201E${escHtml2(p.name)}\u201D jest ju\u017C dost\u0119pne</h1>
    ${p.subtitle ? `<p style="color:#8A8A8C;line-height:1.7;">${escHtml2(p.subtitle)}</p>` : ""}
    ${noteHtml}
    <p style="color:#E2E2E2;">Cena: <span style="color:#C9A24A;">${escHtml2(price)}</span></p>
    <p style="margin:28px 0;"><a href="${url}" style="background:#C9A24A;color:#0A0A0B;padding:14px 22px;text-decoration:none;letter-spacing:2px;font-size:13px;">ZOBACZ W SKARBCU</a></p>
    <p style="color:#5C5C5E;font-size:12px;line-height:1.6;">Ten adres by\u0142 na li\u015Bcie oczekuj\u0105cych na \u201E${escHtml2(p.name)}\u201D na exmortis.pl. To jedyna wiadomo\u015B\u0107 w tej sprawie \u2014 nie zapisuj\u0119 tego adresu do newslettera.</p>
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

// supabase/functions/_shared/unpaidReminder.ts
var esc2 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function unpaidReminders(base44, limit = 20) {
  await runSql(base44, `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminded_at timestamptz`);
  const rows = await runSql(base44, `SELECT o.id, o.buyer_name, o.buyer_email, o.items FROM public.orders o
    WHERE o.status IN ('NEW','PENDING') AND o.reminded_at IS NULL AND o.buyer_email IS NOT NULL
      AND COALESCE(o.payu_order_id, '') NOT LIKE 'FREE-%'
      AND o.created_date < now() - interval '3 hours' AND o.created_date > now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM public.orders x WHERE lower(x.buyer_email) = lower(o.buyer_email)
        AND x.status = 'COMPLETED' AND x.created_date >= o.created_date)
    ORDER BY o.created_date LIMIT ${Number(limit) || 20}`, true);
  if (!rows.length) return 0;
  const url = await loadAppUrl(base44);
  let n = 0;
  for (const o of rows) {
    const took = await runSql(base44, `UPDATE public.orders SET reminded_at = now() WHERE id = ${escStr(o.id)} AND reminded_at IS NULL RETURNING id`);
    if (!took.length) continue;
    const items = Array.isArray(o.items) ? o.items : [];
    const list = items.map((i) => `<li style="margin-bottom:6px;">${esc2(i.name || i.title || "")}</li>`).join("");
    const first = String(o.buyer_name || "").trim().split(/\s+/)[0];
    const html = `<div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
      <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
      ${first ? `<p style="color:#8A8A8C;">${esc2(first)},</p>` : ""}
      <h1 style="font-size:22px;">P\u0142atno\u015B\u0107 nie zosta\u0142a doko\u0144czona</h1>
      <p style="line-height:1.7;">Zam\xF3wienie czeka, ale nie dosta\u0142em potwierdzenia p\u0142atno\u015Bci:</p>
      <ul style="line-height:1.6;">${list}</ul>
      <p style="line-height:1.7;color:#8A8A8C;">Je\u015Bli co\u015B przerwa\u0142o p\u0142atno\u015B\u0107, mo\u017Cesz z\u0142o\u017Cy\u0107 zam\xF3wienie jeszcze raz. Je\u015Bli zrezygnowa\u0142e\u015B, zignoruj t\u0119 wiadomo\u015B\u0107 \u2014 to jedyne przypomnienie.</p>
      <p style="margin:28px 0;"><a href="${url}/skarbiec" style="background:#C9A24A;color:#0A0A0B;padding:14px 22px;text-decoration:none;letter-spacing:2px;font-size:13px;">WR\xD3\u0106 DO SKARBCA</a></p>
    </div>`;
    try {
      await sendMail(base44, { to: o.buyer_email, subject: "EXMORTIS \xB7 p\u0142atno\u015B\u0107 nie zosta\u0142a doko\u0144czona", html, kind: "przypomnienie_platnosci", ref: o.id });
      n++;
    } catch {
    }
  }
  return n;
}

// supabase/functions/_shared/libraryAccess.ts
function safeEqual(a, b) {
  const x = String(a == null ? "" : a);
  const y = String(b == null ? "" : b);
  if (!x.length || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// supabase/functions/_shared/bookingSchema.ts
var BK_BOOK_PACKAGE_SQL = `CREATE OR REPLACE FUNCTION public.bk_book_package(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $bp$
DECLARE
  v_pk public.bk_packages; v_t public.bk_types; v_id uuid; v_en timestamptz; v_last timestamptz;
  v_token boolean := false;
  v_st timestamptz := (p->>'starts_at')::timestamptz;
  v_admin boolean := COALESCE((p->>'viewer_admin')::boolean, false);
  v_uid text := NULLIF(p->>'user_id','');
  v_email text := lower(btrim(COALESCE(p->>'email','')));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bk_calendar'));
  SELECT * INTO v_pk FROM public.bk_packages WHERE id = (p->>'package_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  SELECT EXISTS (SELECT 1 FROM public.bk_tokens x WHERE x.token_hash = NULLIF(p->>'token_hash','')
    AND x.purpose = 'zamowienie' AND x.package_id = v_pk.id AND x.used_at IS NULL AND x.expires_at > now()) INTO v_token;
  IF NOT v_admin AND NOT v_token THEN
    IF (v_uid IS NULL OR v_pk.user_id IS DISTINCT FROM v_uid)
      AND (v_email = '' OR lower(btrim(COALESCE(v_pk.email_display,''))) IS DISTINCT FROM v_email) THEN
      RETURN jsonb_build_object('error','forbidden');
    END IF;
  END IF;
  IF v_pk.payment_status <> 'oplacony' THEN RETURN jsonb_build_object('error','unpaid'); END IF;
  IF v_pk.valid_until < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  IF v_pk.sessions_used >= v_pk.sessions_total THEN RETURN jsonb_build_object('error','used_up'); END IF;
  SELECT * INTO v_t FROM public.bk_types WHERE id = v_pk.type_id;
  IF NOT FOUND OR (NOT v_t.active AND NOT v_admin) THEN RETURN jsonb_build_object('error','not_found'); END IF;
  -- Odst\u0119p liczony w obie strony: \u017Cadna inna sesja z pakietu nie mo\u017Ce by\u0107 bli\u017Cej ni\u017C min_gap_days
  -- (wcze\u015Bniej tylko \u201Epo ostatniej\u201D, co przy przenoszeniu dawa\u0142o si\u0119 obej\u015B\u0107).
  IF v_pk.min_gap_days > 0 AND EXISTS (SELECT 1 FROM public.bk_bookings k
      WHERE k.package_id = v_pk.id AND k.status IN ('POTWIERDZONA','ODBYLA_SIE')
        AND abs(extract(epoch FROM (k.starts_at - v_st))) < v_pk.min_gap_days * 86400) THEN
    RETURN jsonb_build_object('error','gap', 'min_days', v_pk.min_gap_days);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bk_free_slots(v_t.id, v_st, v_st + interval '1 minute', v_admin) f WHERE f.slot_start = v_st) THEN
    RETURN jsonb_build_object('error','taken');
  END IF;
  -- Zgoda o wykonaniu us\u0142ugi przed up\u0142ywem 14 dni \u2014 wymagana tylko, gdy termin wypada w tym oknie.
  IF v_st < v_pk.created_at + interval '14 days'
     AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(COALESCE(p->'consents','[]')) AS x(kind text) WHERE x.kind = 'odstapienie') THEN
    RETURN jsonb_build_object('error','consent');
  END IF;
  v_en := v_st + v_t.duration_min * interval '1 minute';
  BEGIN
    INSERT INTO public.bk_bookings (type_id, package_id, user_id, email, first_name, is_public, starts_at, ends_at, busy, client_tz, source)
    VALUES (v_t.id, v_pk.id, COALESCE(v_uid, v_pk.user_id), v_pk.email_display, p->>'first_name', false, v_st, v_en,
      tstzrange(v_st - v_t.buffer_before * interval '1 minute', v_en + v_t.buffer_after * interval '1 minute', '[)'),
      p->>'tz', COALESCE(p->>'source','klient'))
    RETURNING id INTO v_id;
  EXCEPTION WHEN exclusion_violation THEN RETURN jsonb_build_object('error','taken');
  END;
  UPDATE public.bk_packages SET sessions_used = sessions_used + 1 WHERE id = v_pk.id;
  IF NULLIF(p->>'token_hash','') IS NOT NULL THEN
    UPDATE public.bk_tokens SET used_at = now() WHERE token_hash = p->>'token_hash' AND used_at IS NULL;
  END IF;
  INSERT INTO public.bk_consents (booking_id, kind, text_version, text, email_hmac, ip_hmac)
  SELECT v_id, x.kind, x.text_version, x.text, x.email_hmac, x.ip_hmac
  FROM jsonb_to_recordset(COALESCE(p->'consents','[]')) AS x(kind text, text_version text, text text, email_hmac text, ip_hmac text);
  INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
  VALUES (COALESCE(p->>'actor','klient'), 'rezerwacja_z_pakietu', 'booking', v_id::text,
    v_t.slug || ' ' || to_char(v_st AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI'));
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'starts_at', v_st, 'ends_at', v_en);
END $bp$;`;
var BK_RESCHEDULE_SQL = `CREATE OR REPLACE FUNCTION public.bk_reschedule(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $r$
DECLARE
  v_k public.bk_bookings; v_t public.bk_types; v_pk public.bk_packages; v_en timestamptz;
  v_new timestamptz := (p->>'starts_at')::timestamptz;
  v_admin boolean := COALESCE((p->>'viewer_admin')::boolean, false);
  v_uid text := NULLIF(p->>'user_id','');
  v_email text := lower(btrim(COALESCE(p->>'email','')));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bk_calendar'));
  SELECT * INTO v_k FROM public.bk_bookings WHERE id = (p->>'booking_id')::uuid FOR UPDATE;
  IF NOT FOUND OR v_k.status <> 'POTWIERDZONA' THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF NOT v_admin THEN
    IF (v_uid IS NULL OR v_k.user_id IS DISTINCT FROM v_uid)
      AND (v_email = '' OR lower(btrim(COALESCE(v_k.email,''))) IS DISTINCT FROM v_email) THEN
      RETURN jsonb_build_object('error','forbidden');
    END IF;
  END IF;
  SELECT * INTO v_t FROM public.bk_types WHERE id = v_k.type_id;
  IF NOT v_admin AND v_k.starts_at < now() + v_t.change_window_h * interval '1 hour' THEN
    RETURN jsonb_build_object('error','too_late');
  END IF;
  IF v_k.package_id IS NOT NULL THEN
    SELECT * INTO v_pk FROM public.bk_packages WHERE id = v_k.package_id;
    IF NOT v_admin AND v_pk.reschedule_limit IS NOT NULL AND v_k.reschedule_count >= v_pk.reschedule_limit THEN
      RETURN jsonb_build_object('error','limit', 'max', v_pk.reschedule_limit);
    END IF;
    IF v_pk.valid_until < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
    -- Ten sam odst\u0119p co przy rezerwacji (przeniesienie nie mo\u017Ce go obej\u015B\u0107); administrator mo\u017Ce.
    IF NOT v_admin AND v_pk.min_gap_days > 0 AND EXISTS (SELECT 1 FROM public.bk_bookings k
        WHERE k.package_id = v_pk.id AND k.id <> v_k.id AND k.status IN ('POTWIERDZONA','ODBYLA_SIE')
          AND abs(extract(epoch FROM (k.starts_at - v_new))) < v_pk.min_gap_days * 86400) THEN
      RETURN jsonb_build_object('error','gap', 'min_days', v_pk.min_gap_days);
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bk_free_slots(v_t.id, v_new, v_new + interval '1 minute', v_admin, v_k.id) f WHERE f.slot_start = v_new) THEN
    RETURN jsonb_build_object('error','taken');
  END IF;
  v_en := v_new + v_t.duration_min * interval '1 minute';
  BEGIN
    UPDATE public.bk_bookings SET starts_at = v_new, ends_at = v_en,
      busy = tstzrange(v_new - v_t.buffer_before * interval '1 minute', v_en + v_t.buffer_after * interval '1 minute', '[)'),
      reschedule_count = reschedule_count + 1, version = version + 1, updated_at = now()
    WHERE id = v_k.id;
  EXCEPTION WHEN exclusion_violation THEN RETURN jsonb_build_object('error','taken');
  END;
  INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
  VALUES (COALESCE(p->>'actor','klient'), 'przeniesienie', 'booking', v_k.id::text,
    to_char(v_k.starts_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') || ' -> ' || to_char(v_new AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI'));
  RETURN jsonb_build_object('ok', true, 'starts_at', v_new, 'ends_at', v_en);
END $r$;`;
var SCHEMA_SQL = `
-- ============ KROK 1B: utwardzenie bezpiecze\u0144stwa ============

-- 1) Kopie zapasowe poza schematem public (nie s\u0105 wystawione w API), z RLS i odebranymi uprawnieniami.
CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA backup TO service_role;

DO $m$ BEGIN
  IF to_regclass('public.bk_backup_20261011_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bk_backup_20261011_events SET SCHEMA backup';
  END IF;
  IF to_regclass('public.bk_backup_20261011_registrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bk_backup_20261011_registrations SET SCHEMA backup';
  END IF;
END $m$;

DO $m$ DECLARE r text; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'backup' AND tablename LIKE 'bk_backup_%' LOOP
    EXECUTE format('ALTER TABLE backup.%I ENABLE ROW LEVEL SECURITY', r);
    EXECUTE format('REVOKE ALL ON backup.%I FROM PUBLIC, anon, authenticated, service_role', r);
  END LOOP;
END $m$;

-- Rejestr kopii + automatyczne usuni\u0119cie po 30 dniach.
CREATE TABLE IF NOT EXISTS backup.bk_registry (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  drop_after timestamptz NOT NULL DEFAULT now() + interval '30 days',
  dropped_at timestamptz,
  note text
);
ALTER TABLE backup.bk_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup.bk_registry FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO backup.bk_registry (table_name)
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'backup' AND c.relname LIKE 'bk_backup_%'
ON CONFLICT (table_name) DO NOTHING;

CREATE OR REPLACE FUNCTION backup.purge_expired() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $p$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT table_name FROM backup.bk_registry WHERE dropped_at IS NULL AND drop_after < now() LOOP
    IF to_regclass('backup.' || quote_ident(r.table_name)) IS NOT NULL THEN
      EXECUTE format('DROP TABLE backup.%I', r.table_name);
    END IF;
    UPDATE backup.bk_registry SET dropped_at = now(), note = 'usunieto po 30 dniach' WHERE table_name = r.table_name;
    INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
      VALUES ('system', 'backup_usuniety', 'backup', r.table_name, 'kopia starsza niz 30 dni');
    n := n + 1;
  END LOOP;
  RETURN n;
END $p$;
REVOKE ALL ON FUNCTION backup.purge_expired() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION backup.purge_expired() TO service_role;

-- 2) Role i tabele modu\u0142u
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.bk_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'off' CHECK (mode IN ('off','admin','on')),
  min_notice_h int NOT NULL DEFAULT 24 CHECK (min_notice_h >= 24),
  daily_limit int NOT NULL DEFAULT 3 CHECK (daily_limit BETWEEN 1 AND 20),
  weekly_limit int CHECK (weekly_limit IS NULL OR weekly_limit BETWEEN 1 AND 100),
  tick_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.bk_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.bk_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  description text CHECK (length(description) <= 2000),
  duration_min int NOT NULL CHECK (duration_min BETWEEN 10 AND 480),
  buffer_before int NOT NULL DEFAULT 0 CHECK (buffer_before BETWEEN 0 AND 240),
  buffer_after int NOT NULL DEFAULT 0 CHECK (buffer_after BETWEEN 0 AND 240),
  step_min int NOT NULL DEFAULT 30 CHECK (step_min BETWEEN 5 AND 240),
  horizon_days int NOT NULL DEFAULT 60 CHECK (horizon_days BETWEEN 1 AND 365),
  access text NOT NULL CHECK (access IN ('PUBLICZNY','PO_ZAKUPIE','PAKIET')),
  zoom_link text CHECK (zoom_link IS NULL OR zoom_link ~ '^https://'),
  questions jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(questions) = 'array'),
  change_window_h int NOT NULL DEFAULT 24 CHECK (change_window_h BETWEEN 0 AND 720),
  monthly_limit int CHECK (monthly_limit IS NULL OR monthly_limit BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT false,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bk_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.bk_types(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_local time NOT NULL,
  end_local time NOT NULL,
  CHECK (end_local > start_local)
);

CREATE TABLE IF NOT EXISTS public.bk_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('jednorazowa','calodniowa','powtarzalna')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  rep_weekday int CHECK (rep_weekday BETWEEN 1 AND 7),
  rep_from time,
  rep_to time,
  note text CHECK (length(note) <= 500),
  disabled boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (kind <> 'powtarzalna' OR (rep_weekday IS NOT NULL AND rep_from IS NOT NULL AND rep_to > rep_from))
);

CREATE TABLE IF NOT EXISTS public.bk_holidays (
  d date PRIMARY KEY,
  name text NOT NULL,
  blocked boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.bk_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  email_display text,
  type_id uuid NOT NULL REFERENCES public.bk_types(id),
  sessions_total int NOT NULL CHECK (sessions_total BETWEEN 1 AND 100),
  sessions_used int NOT NULL DEFAULT 0 CHECK (sessions_used >= 0),
  valid_until timestamptz NOT NULL,
  zoom_link text CHECK (zoom_link IS NULL OR zoom_link ~ '^https://'),
  min_gap_days int NOT NULL DEFAULT 0 CHECK (min_gap_days BETWEEN 0 AND 90),
  reschedule_limit int NOT NULL DEFAULT 2 CHECK (reschedule_limit BETWEEN 0 AND 20),
  payment_status text NOT NULL DEFAULT 'oplacony' CHECK (payment_status IN ('oplacony','oczekuje','zwrot')),
  source text NOT NULL CHECK (source IN ('reczny','zamowienie')),
  order_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sessions_used <= sessions_total)
);

CREATE TABLE IF NOT EXISTS public.bk_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.bk_types(id),
  package_id uuid REFERENCES public.bk_packages(id),
  user_id text,
  email text CHECK (length(email) <= 320),
  email_norm text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  first_name text CHECK (length(first_name) <= 120),
  is_public boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  busy tstzrange NOT NULL,
  client_tz text CHECK (length(client_tz) <= 64),
  status text NOT NULL DEFAULT 'POTWIERDZONA' CHECK (status IN ('POTWIERDZONA','ANULOWANA_KLIENT','ANULOWANA_ADMIN','PRZENIESIONA','ODBYLA_SIE','NIEOBECNOSC')),
  source text NOT NULL DEFAULT 'klient' CHECK (source IN ('klient','admin')),
  reschedule_count int NOT NULL DEFAULT 0 CHECK (reschedule_count >= 0),
  version int NOT NULL DEFAULT 0 CHECK (version >= 0),
  ics_uid text NOT NULL UNIQUE DEFAULT (gen_random_uuid()::text || '@exmortis'),
  idem_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (user_id IS NOT NULL OR email IS NOT NULL),
  CHECK (NOT isempty(busy) AND lower_inc(busy) AND NOT upper_inc(busy)),
  CHECK (lower(busy) <= starts_at AND upper(busy) >= ends_at),
  CONSTRAINT bk_no_overlap EXCLUDE USING gist (busy WITH &&) WHERE (status = 'POTWIERDZONA')
);
CREATE UNIQUE INDEX IF NOT EXISTS bk_one_public_per_email ON public.bk_bookings (type_id, email_norm)
  WHERE is_public AND status = 'POTWIERDZONA';
CREATE INDEX IF NOT EXISTS bk_bookings_starts ON public.bk_bookings (starts_at) WHERE status = 'POTWIERDZONA';

CREATE TABLE IF NOT EXISTS public.bk_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  answers jsonb,
  health_enc bytea,
  health_consent boolean NOT NULL DEFAULT false,
  keep boolean NOT NULL DEFAULT false,
  delete_after timestamptz NOT NULL,
  deleted_at timestamptz,
  CHECK (health_enc IS NULL OR health_consent)
);

CREATE TABLE IF NOT EXISTS public.bk_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bk_bookings(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('regulamin','odstapienie','zdrowie')),
  text_version text NOT NULL,
  text text NOT NULL,
  email_hmac text NOT NULL CHECK (email_hmac ~ '^[0-9a-f]{64}$'),
  ip_hmac text CHECK (ip_hmac ~ '^[0-9a-f]{64}$'),
  given_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bk_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose IN ('zarzadzaj','zamowienie','zaproszenie','ical')),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  owner_user_id text,
  owner_email text,
  booking_id uuid REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.bk_packages(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bk_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  send_at timestamptz NOT NULL,
  idem_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'zaplanowane' CHECK (status IN ('zaplanowane','wyslane','pominiete','blad'))
);

CREATE TABLE IF NOT EXISTS public.bk_rate (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL CHECK (bucket IN ('ip','email')),
  key_hmac text NOT NULL CHECK (key_hmac ~ '^[0-9a-f]{64}$'),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bk_rate_key ON public.bk_rate (key_hmac, at);

CREATE TABLE IF NOT EXISTS public.bk_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  object_type text,
  object_id text,
  summary text CHECK (length(summary) <= 500),
  anonymized boolean NOT NULL DEFAULT false
);

-- 3) Rejestr dzia\u0142a\u0144: dopisywanie dozwolone dla wszystkich; zmiana/usuni\u0119cie wy\u0142\u0105cznie przez rol\u0119
--    bk_log_maint (NOLOGIN, w\u0142a\u015Bciciel funkcji anonimizuj\u0105cej i czyszcz\u0105cej). Flagi sesji ju\u017C nie ma \u2014
--    nie da si\u0119 jej ustawi\u0107 z dowolnej sesji SQL.
DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bk_log_maint') THEN
    CREATE ROLE bk_log_maint NOLOGIN;
  END IF;
END $r$;
GRANT USAGE ON SCHEMA public TO bk_log_maint;
GRANT SELECT, UPDATE, DELETE ON public.bk_log TO bk_log_maint;

CREATE OR REPLACE FUNCTION public.bk_log_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $g$
BEGIN
  IF current_user = 'bk_log_maint' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'bk_log: wpisy mozna tylko dopisywac';
END $g$;
DROP TRIGGER IF EXISTS bk_log_no_change ON public.bk_log;
CREATE TRIGGER bk_log_no_change BEFORE UPDATE OR DELETE ON public.bk_log FOR EACH ROW EXECUTE FUNCTION public.bk_log_guard();
DROP TRIGGER IF EXISTS bk_log_no_truncate ON public.bk_log;
CREATE TRIGGER bk_log_no_truncate BEFORE TRUNCATE ON public.bk_log FOR EACH STATEMENT EXECUTE FUNCTION public.bk_log_guard();

CREATE OR REPLACE FUNCTION public.bk_log_anonymize(p_actor text, p_object_ids text[]) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $a$
DECLARE n int;
BEGIN
  UPDATE public.bk_log SET actor = CASE WHEN actor = p_actor THEN 'usunieto' ELSE actor END,
    summary = '[zanonimizowano]', anonymized = true
  WHERE (p_actor IS NOT NULL AND actor = p_actor) OR object_id = ANY(COALESCE(p_object_ids, '{}'));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $a$;
ALTER FUNCTION public.bk_log_anonymize(text, text[]) OWNER TO bk_log_maint;

CREATE OR REPLACE FUNCTION public.bk_log_purge() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $p$
DECLARE n int;
BEGIN
  DELETE FROM public.bk_log WHERE at < now() - interval '12 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $p$;
ALTER FUNCTION public.bk_log_purge() OWNER TO bk_log_maint;

-- 4) \u015Awi\u0119ta: Wielkanoc (Meeus/Jones/Butcher) + sta\u0142e i ruchome dni wolne, 2 lata do przodu.
CREATE OR REPLACE FUNCTION public.bk_easter(y int) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $e$
DECLARE a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
BEGIN
  a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  RETURN make_date(y, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
END $e$;

CREATE OR REPLACE FUNCTION public.bk_fill_holidays(p_years int DEFAULT 2) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $h$
DECLARE y int; ea date; n int := 0; c int;
BEGIN
  FOR y IN extract(year FROM now())::int .. extract(year FROM now())::int + p_years LOOP
    ea := public.bk_easter(y);
    INSERT INTO public.bk_holidays (d, name) VALUES
      (make_date(y,1,1), 'Nowy Rok'), (make_date(y,1,6), 'Trzech Kr\xF3li'),
      (ea, 'Wielkanoc'), (ea + 1, 'Poniedzia\u0142ek Wielkanocny'),
      (make_date(y,5,1), '\u015Awi\u0119to Pracy'), (make_date(y,5,3), '\u015Awi\u0119to Konstytucji 3 Maja'),
      (ea + 49, 'Zielone \u015Awi\u0105tki'), (ea + 60, 'Bo\u017Ce Cia\u0142o'),
      (make_date(y,8,15), 'Wniebowzi\u0119cie NMP'), (make_date(y,11,1), 'Wszystkich \u015Awi\u0119tych'),
      (make_date(y,11,11), '\u015Awi\u0119to Niepodleg\u0142o\u015Bci'), (make_date(y,12,24), 'Wigilia'),
      (make_date(y,12,25), 'Bo\u017Ce Narodzenie'), (make_date(y,12,26), 'Drugi dzie\u0144 Bo\u017Cego Narodzenia')
    ON CONFLICT (d) DO NOTHING;
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  END LOOP;
  RETURN n;
END $h$;

-- 5) Wolne sloty jednego rodzaju (zakresy p\xF3\u0142otwarte [od, do)).
CREATE OR REPLACE FUNCTION public.bk_free_slots(p_type uuid, p_from timestamptz, p_to timestamptz,
  p_admin boolean DEFAULT false, p_ignore uuid DEFAULT NULL)
RETURNS TABLE (slot_start timestamptz, slot_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $f$
WITH s AS (SELECT * FROM public.bk_settings WHERE id = 1),
t AS (SELECT * FROM public.bk_types WHERE id = p_type),
days AS (
  SELECT g::date AS d FROM generate_series((p_from AT TIME ZONE 'Europe/Warsaw')::date,
    (p_to AT TIME ZONE 'Europe/Warsaw')::date, interval '1 day') g
),
cand AS (
  SELECT ((dy.d + h.start_local) AT TIME ZONE 'Europe/Warsaw') + (n * t.step_min) * interval '1 minute' AS st,
    ((dy.d + h.end_local) AT TIME ZONE 'Europe/Warsaw') AS win_end,
    t.duration_min, t.buffer_before, t.buffer_after, t.horizon_days, t.monthly_limit
  FROM days dy
  JOIN public.bk_hours h ON h.type_id = p_type AND h.weekday = extract(isodow FROM dy.d)::int
  CROSS JOIN t
  CROSS JOIN LATERAL generate_series(0, (extract(epoch FROM (h.end_local - h.start_local)) / 60 / t.step_min)::int) n
),
c AS (
  SELECT st, st + duration_min * interval '1 minute' AS en,
    tstzrange(st - buffer_before * interval '1 minute', st + (duration_min + buffer_after) * interval '1 minute', '[)') AS b,
    (st AT TIME ZONE 'Europe/Warsaw')::date AS ld, monthly_limit
  FROM cand, s
  WHERE st + duration_min * interval '1 minute' <= win_end
    AND st >= p_from AND st < p_to
    AND st >= now()
    AND st <= now() + horizon_days * interval '1 day'
    AND (p_admin OR st >= now() + s.min_notice_h * interval '1 hour')
)
SELECT c.st, c.en FROM c, s
WHERE NOT EXISTS (SELECT 1 FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.busy && c.b AND k.id IS DISTINCT FROM p_ignore)
  AND NOT EXISTS (SELECT 1 FROM public.bk_blocks x WHERE NOT x.disabled AND x.kind IN ('jednorazowa','calodniowa')
    AND tstzrange(x.starts_at, x.ends_at, '[)') && c.b)
  AND NOT EXISTS (SELECT 1 FROM public.bk_blocks x WHERE NOT x.disabled AND x.kind = 'powtarzalna'
    AND x.rep_weekday = extract(isodow FROM c.ld)::int
    AND c.ld BETWEEN (x.starts_at AT TIME ZONE 'Europe/Warsaw')::date AND (x.ends_at AT TIME ZONE 'Europe/Warsaw')::date
    AND tstzrange((c.ld + x.rep_from) AT TIME ZONE 'Europe/Warsaw', (c.ld + x.rep_to) AT TIME ZONE 'Europe/Warsaw', '[)') && c.b)
  AND NOT EXISTS (SELECT 1 FROM public.bk_holidays hd WHERE hd.blocked
    AND tstzrange(hd.d::timestamp AT TIME ZONE 'Europe/Warsaw', (hd.d + 1)::timestamp AT TIME ZONE 'Europe/Warsaw', '[)') && c.b)
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.status = 'Opublikowane' AND e.start_datetime IS NOT NULL
    AND tstzrange(e.start_datetime, e.start_datetime + COALESCE(e.duration_minutes, 60) * interval '1 minute', '[)') && c.b)
  AND (SELECT count(*) FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.id IS DISTINCT FROM p_ignore
    AND (k.starts_at AT TIME ZONE 'Europe/Warsaw')::date = c.ld) < s.daily_limit
  AND (s.weekly_limit IS NULL OR (SELECT count(*) FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.id IS DISTINCT FROM p_ignore
    AND date_trunc('week', k.starts_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('week', c.st AT TIME ZONE 'Europe/Warsaw')) < s.weekly_limit)
  AND (c.monthly_limit IS NULL OR (SELECT count(*) FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.type_id = p_type
    AND k.id IS DISTINCT FROM p_ignore
    AND date_trunc('month', k.starts_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('month', c.st AT TIME ZONE 'Europe/Warsaw')) < c.monthly_limit)
ORDER BY c.st
$f$;

-- 6) Limit pr\xF3b: 5 na IP / 10 min, 3 na e-mail / godzin\u0119. Klucze to HMAC liczony na serwerze funkcji.
CREATE OR REPLACE FUNCTION public.bk_rate_hit(p_ip text, p_email text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $r$
BEGIN
  DELETE FROM public.bk_rate WHERE at < now() - interval '1 day';
  INSERT INTO public.bk_rate (bucket, key_hmac) VALUES ('ip', p_ip);
  IF p_email IS NOT NULL THEN INSERT INTO public.bk_rate (bucket, key_hmac) VALUES ('email', p_email); END IF;
  IF (SELECT count(*) FROM public.bk_rate WHERE bucket = 'ip' AND key_hmac = p_ip AND at > now() - interval '10 minutes') > 5 THEN RETURN 'rate'; END IF;
  IF p_email IS NOT NULL AND (SELECT count(*) FROM public.bk_rate WHERE bucket = 'email' AND key_hmac = p_email AND at > now() - interval '1 hour') > 3 THEN RETURN 'rate'; END IF;
  RETURN 'ok';
END $r$;

-- 7) Rezerwacja atomowo. Dane o zdrowiu przychodz\u0105 ju\u017C zaszyfrowane (AES-256-GCM, serwer funkcji) jako hex.
CREATE OR REPLACE FUNCTION public.bk_book(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $b$
DECLARE
  v_s public.bk_settings; v_t public.bk_types; v_ex public.bk_bookings; v_id uuid; v_en timestamptz;
  v_st timestamptz := (p->>'starts_at')::timestamptz;
  v_vadmin boolean := COALESCE((p->>'viewer_admin')::boolean, false);
  v_src text := COALESCE(p->>'source', 'klient');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bk_calendar'));
  SELECT * INTO v_s FROM public.bk_settings WHERE id = 1;
  IF v_s.mode = 'off' OR (v_s.mode = 'admin' AND NOT v_vadmin) THEN RETURN jsonb_build_object('error', 'disabled'); END IF;
  IF p->>'idem_key' IS NOT NULL THEN
    SELECT * INTO v_ex FROM public.bk_bookings WHERE idem_key = p->>'idem_key';
    IF FOUND THEN RETURN jsonb_build_object('ok', true, 'already', true, 'id', v_ex.id, 'starts_at', v_ex.starts_at, 'ends_at', v_ex.ends_at); END IF;
  END IF;
  SELECT * INTO v_t FROM public.bk_types WHERE id = (p->>'type_id')::uuid;
  IF NOT FOUND OR (NOT v_t.active AND NOT v_vadmin) THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_src <> 'admin' AND v_t.access <> 'PUBLICZNY' THEN RETURN jsonb_build_object('error', 'access'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bk_free_slots(v_t.id, v_st, v_st + interval '1 minute', v_src = 'admin') f WHERE f.slot_start = v_st) THEN
    RETURN jsonb_build_object('error', 'taken');
  END IF;
  v_en := v_st + v_t.duration_min * interval '1 minute';
  BEGIN
    INSERT INTO public.bk_bookings (type_id, user_id, email, first_name, is_public, starts_at, ends_at, busy, client_tz, source, idem_key)
    VALUES (v_t.id, p->>'user_id', p->>'email', p->>'first_name', v_t.access = 'PUBLICZNY', v_st, v_en,
      tstzrange(v_st - v_t.buffer_before * interval '1 minute', v_en + v_t.buffer_after * interval '1 minute', '[)'),
      p->>'tz', v_src, p->>'idem_key')
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN exclusion_violation THEN RETURN jsonb_build_object('error', 'taken');
    WHEN unique_violation THEN RETURN jsonb_build_object('error', 'one_per_email');
  END;
  IF p ? 'answers' OR COALESCE(p->>'health_enc', '') <> '' THEN
    INSERT INTO public.bk_answers (booking_id, answers, health_enc, health_consent, delete_after)
    VALUES (v_id, p->'answers',
      CASE WHEN COALESCE(p->>'health_enc', '') <> '' THEN decode(p->>'health_enc', 'hex') END,
      COALESCE((p->>'health_consent')::boolean, false), v_en + interval '60 days');
  END IF;
  INSERT INTO public.bk_consents (booking_id, kind, text_version, text, email_hmac, ip_hmac)
  SELECT v_id, x.kind, x.text_version, x.text, x.email_hmac, x.ip_hmac
  FROM jsonb_to_recordset(COALESCE(p->'consents', '[]')) AS x(kind text, text_version text, text text, email_hmac text, ip_hmac text);
  IF p->>'token_hash' IS NOT NULL THEN
    INSERT INTO public.bk_tokens (purpose, token_hash, owner_user_id, owner_email, booking_id, expires_at)
    VALUES ('zarzadzaj', p->>'token_hash', p->>'user_id', p->>'email', v_id, v_en + interval '30 days');
  END IF;
  INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
  VALUES (COALESCE(p->>'actor', v_src), 'rezerwacja', 'booking', v_id::text, v_t.slug || ' ' || to_char(v_st AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI'));
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'starts_at', v_st, 'ends_at', v_en);
END $b$;

CREATE OR REPLACE FUNCTION public.bk_manage_view(p_hash text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $m$
  SELECT jsonb_build_object('type', t.name, 'starts_at', k.starts_at, 'ends_at', k.ends_at, 'status', k.status, 'first_name', k.first_name)
  FROM public.bk_tokens x JOIN public.bk_bookings k ON k.id = x.booking_id JOIN public.bk_types t ON t.id = k.type_id
  WHERE x.token_hash = p_hash AND x.purpose = 'zarzadzaj' AND x.used_at IS NULL AND x.expires_at > now() AND k.status = 'POTWIERDZONA'
$m$;

-- Odczyt odpowiedzi o zdrowiu: zwraca zaszyfrowan\u0105 warto\u015B\u0107 (hex) \u2014 odszyfrowuje j\u0105 wy\u0142\u0105cznie funkcja serwera.
DROP FUNCTION IF EXISTS public.bk_admin_detail(uuid, text);
CREATE OR REPLACE FUNCTION public.bk_admin_detail(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $d$
  SELECT jsonb_build_object('answers', a.answers, 'health_consent', a.health_consent, 'deleted_at', a.deleted_at,
    'health_enc', CASE WHEN a.health_enc IS NOT NULL THEN encode(a.health_enc, 'hex') END)
  FROM public.bk_answers a WHERE a.booking_id = p_id
$d$;

CREATE OR REPLACE FUNCTION public.bk_answers_retention() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $t$
DECLARE n int;
BEGIN
  UPDATE public.bk_answers SET answers = NULL, health_enc = NULL, deleted_at = now()
  WHERE delete_after < now() AND deleted_at IS NULL AND NOT keep;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $t$;

-- 8) Dost\u0119p do danych: wy\u0142\u0105cznie serwer (service_role). RLS bez polityk blokuje role anon/authenticated w PostgREST.
DO $x$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['bk_settings','bk_types','bk_hours','bk_blocks','bk_holidays','bk_packages','bk_bookings',
    'bk_answers','bk_consents','bk_tokens','bk_notifications','bk_rate','bk_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', r);
  END LOOP;
END $x$;
REVOKE ALL ON SEQUENCE public.bk_log_id_seq, public.bk_rate_id_seq FROM PUBLIC, anon, authenticated;

-- 9) Wykonanie funkcji bk_*: odebrane PUBLIC/anon/authenticated, zostaje tylko service_role.
REVOKE EXECUTE ON FUNCTION public.bk_easter(int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_log_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_free_slots(uuid, timestamptz, timestamptz, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_book(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_rate_hit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_manage_view(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_admin_detail(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_log_anonymize(text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_log_purge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_fill_holidays(int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_answers_retention() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bk_free_slots(uuid, timestamptz, timestamptz, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_book(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_rate_hit(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_manage_view(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_admin_detail(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_log_anonymize(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_log_purge() TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_fill_holidays(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_answers_retention() TO service_role;

-- 10) pgcrypto usuwane \u2014 nic ju\u017C z niego nie korzysta (szyfrowanie przeniesione do funkcji serwera).
DO $x$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prokind = 'f' AND n.nspname NOT IN ('pg_catalog','information_schema','extensions')
       AND p.prosrc ILIKE '%pgp_%') THEN
    DROP EXTENSION pgcrypto;
  END IF;
END $x$;

-- ============ KROK 2: pakiety, \u201ERozmowa na progu\u201D, przenoszenie i anulowanie ============

-- 11) Ustawienia pakiet\xF3w, polityki p\xF3\u017Anego odwo\u0142ania i zgody o wykonaniu us\u0142ugi.
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS late_cancel_policy text NOT NULL DEFAULT 'admin';
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS threshold_product_id uuid;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS threshold_type_id uuid;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS threshold_sessions int NOT NULL DEFAULT 1;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS threshold_valid_days int NOT NULL DEFAULT 60;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS service_consent_version text NOT NULL DEFAULT 'rez-2026-11';
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS service_consent_text text NOT NULL DEFAULT '\u017B\u0105dam wykonania us\u0142ugi przed up\u0142ywem 14 dni od zawarcia umowy oraz przyjmuj\u0119 do wiadomo\u015Bci utrat\u0119 prawa odst\u0105pienia od umowy z chwil\u0105 rozpocz\u0119cia \u015Bwiadczenia.';
DO $c$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bk_settings_late_cancel_policy_check') THEN
    ALTER TABLE public.bk_settings ADD CONSTRAINT bk_settings_late_cancel_policy_check CHECK (late_cancel_policy IN ('admin','przepada'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bk_settings_threshold_sessions_check') THEN
    ALTER TABLE public.bk_settings ADD CONSTRAINT bk_settings_threshold_sessions_check CHECK (threshold_sessions BETWEEN 1 AND 20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bk_settings_threshold_valid_days_check') THEN
    ALTER TABLE public.bk_settings ADD CONSTRAINT bk_settings_threshold_valid_days_check CHECK (threshold_valid_days BETWEEN 1 AND 365);
  END IF;
END $c$;

-- 12) Pakiet z zam\xF3wienia \u2014 idempotentnie po unikalnym numerze zam\xF3wienia.
CREATE OR REPLACE FUNCTION public.bk_grant_package(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $gp$
DECLARE v_id uuid; v_days int;
BEGIN
  IF COALESCE(p->>'order_id','') = '' OR COALESCE(p->>'type_id','') = '' THEN RETURN jsonb_build_object('error','config'); END IF;
  v_days := GREATEST(1, LEAST(365, COALESCE((p->>'valid_days')::int, 60)));
  INSERT INTO public.bk_packages (user_id, email_display, type_id, sessions_total, valid_until, source, order_id, payment_status)
  VALUES (COALESCE(NULLIF(p->>'user_id',''), 'zamowienie:' || (p->>'order_id')), lower(btrim(COALESCE(p->>'email',''))),
    (p->>'type_id')::uuid, GREATEST(1, LEAST(20, COALESCE((p->>'sessions')::int, 1))),
    now() + (v_days || ' days')::interval, 'zamowienie', p->>'order_id', 'oplacony')
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.bk_packages WHERE order_id = p->>'order_id';
    RETURN jsonb_build_object('ok', true, 'already', true, 'id', v_id);
  END IF;
  IF COALESCE(p->>'token_hash','') <> '' THEN
    INSERT INTO public.bk_tokens (purpose, token_hash, owner_email, package_id, expires_at)
    VALUES ('zamowienie', p->>'token_hash', lower(btrim(COALESCE(p->>'email',''))), v_id, now() + (v_days || ' days')::interval);
  END IF;
  INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
  VALUES ('system', 'pakiet_z_zamowienia', 'package', v_id::text, p->>'order_id');
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $gp$;

-- 13) Pakiet po jednorazowym tokenie z zam\xF3wienia (w bazie tylko skr\xF3t).
CREATE OR REPLACE FUNCTION public.bk_token_package(p_hash text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $tp$
SELECT jsonb_build_object('package_id', pk.id, 'email', pk.email_display, 'type_id', t.id, 'slug', t.slug,
  'type', t.name, 'duration_min', t.duration_min, 'sessions_left', GREATEST(0, pk.sessions_total - pk.sessions_used),
  'valid_until', pk.valid_until, 'purchased_at', pk.created_at,
  'consent_version', (SELECT service_consent_version FROM public.bk_settings WHERE id = 1),
  'consent_text', (SELECT service_consent_text FROM public.bk_settings WHERE id = 1))
FROM public.bk_tokens x JOIN public.bk_packages pk ON pk.id = x.package_id JOIN public.bk_types t ON t.id = pk.type_id
WHERE x.token_hash = p_hash AND x.purpose = 'zamowienie' AND x.used_at IS NULL AND x.expires_at > now()
  AND pk.payment_status = 'oplacony' AND pk.valid_until > now() AND pk.sessions_used < pk.sessions_total
$tp$;

-- 14) Rezerwacja z pakietu: w\u0142a\u015Bciciel po user_id albo e-mailu, nigdy po samym id pakietu.
--     Odst\u0119p, wa\u017Cno\u015B\u0107, liczba sesji i granica 24 h sprawdzane tutaj, w tej samej transakcji.
${BK_BOOK_PACKAGE_SQL}

-- 15) Przeniesienie terminu \u2014 granica zmiany, limit prze\u0142o\u017Ce\u0144 i wolny termin w jednej transakcji.
${BK_RESCHEDULE_SQL}

-- 16) Anulowanie: w terminie sesja wraca do pakietu; po granicy zostaje wykorzystana
--     (polityka: \u201Edecyduje admin\u201D albo \u201Esesja przepada\u201D). Admin zawsze oddaje sesj\u0119.
CREATE OR REPLACE FUNCTION public.bk_cancel(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $cx$
DECLARE
  v_k public.bk_bookings; v_t public.bk_types; v_s public.bk_settings; v_in_time boolean;
  v_admin boolean := COALESCE((p->>'viewer_admin')::boolean, false);
  v_uid text := NULLIF(p->>'user_id','');
  v_email text := lower(btrim(COALESCE(p->>'email','')));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bk_calendar'));
  SELECT * INTO v_k FROM public.bk_bookings WHERE id = (p->>'booking_id')::uuid FOR UPDATE;
  IF NOT FOUND OR v_k.status <> 'POTWIERDZONA' THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF NOT v_admin THEN
    IF (v_uid IS NULL OR v_k.user_id IS DISTINCT FROM v_uid)
      AND (v_email = '' OR lower(btrim(COALESCE(v_k.email,''))) IS DISTINCT FROM v_email) THEN
      RETURN jsonb_build_object('error','forbidden');
    END IF;
  END IF;
  SELECT * INTO v_t FROM public.bk_types WHERE id = v_k.type_id;
  SELECT * INTO v_s FROM public.bk_settings WHERE id = 1;
  v_in_time := v_admin OR v_k.starts_at >= now() + v_t.change_window_h * interval '1 hour';
  IF v_k.package_id IS NOT NULL AND v_in_time THEN
    UPDATE public.bk_packages SET sessions_used = GREATEST(0, sessions_used - 1) WHERE id = v_k.package_id;
  END IF;
  UPDATE public.bk_bookings SET status = CASE WHEN v_admin THEN 'ANULOWANA_ADMIN' ELSE 'ANULOWANA_KLIENT' END,
    version = version + 1, updated_at = now() WHERE id = v_k.id;
  UPDATE public.bk_tokens SET used_at = now() WHERE booking_id = v_k.id AND used_at IS NULL;
  INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
  VALUES (COALESCE(p->>'actor','klient'), CASE WHEN v_admin THEN 'anulowanie_admin' ELSE 'anulowanie_klient' END, 'booking', v_k.id::text,
    CASE WHEN v_in_time THEN 'w terminie' WHEN v_s.late_cancel_policy = 'przepada' THEN 'po terminie, sesja przepada'
      ELSE 'po terminie, decyduje admin' END);
  RETURN jsonb_build_object('ok', true, 'in_time', v_in_time, 'returned', v_k.package_id IS NOT NULL AND v_in_time);
END $cx$;

-- 17) \u201EMoje sesje\u201D: pakiety i rezerwacje w\u0142a\u015Bciciela. Link Zoom wy\u0142\u0105cznie dla w\u0142a\u015Bciciela
--     i tylko od 15 minut przed spotkaniem.
CREATE OR REPLACE FUNCTION public.bk_my_sessions(p jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ms$
WITH me AS (
  SELECT NULLIF(p->>'user_id','') AS uid, lower(btrim(COALESCE(p->>'email',''))) AS mail
)
SELECT jsonb_build_object(
  'consent', (SELECT jsonb_build_object('version', service_consent_version, 'text', service_consent_text) FROM public.bk_settings WHERE id = 1),
  'packages', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', pk.id, 'type', t.name, 'slug', t.slug, 'type_id', t.id,
      'sessions_total', pk.sessions_total, 'sessions_used', pk.sessions_used,
      'sessions_left', GREATEST(0, pk.sessions_total - pk.sessions_used),
      'valid_until', pk.valid_until, 'purchased_at', pk.created_at, 'min_gap_days', pk.min_gap_days,
      'reschedule_limit', pk.reschedule_limit) ORDER BY pk.valid_until)
    FROM public.bk_packages pk JOIN public.bk_types t ON t.id = pk.type_id, me
    WHERE pk.payment_status = 'oplacony' AND pk.valid_until > now()
      AND ((me.uid IS NOT NULL AND pk.user_id = me.uid) OR (me.mail <> '' AND lower(btrim(COALESCE(pk.email_display,''))) = me.mail))
  ), '[]'::jsonb),
  'bookings', COALESCE((
    SELECT jsonb_agg(z.b) FROM (
      SELECT jsonb_build_object(
        'id', k.id, 'type', t.name, 'slug', t.slug, 'starts_at', k.starts_at, 'ends_at', k.ends_at,
        'status', k.status, 'package_id', k.package_id, 'reschedule_count', k.reschedule_count,
        'reschedule_limit', (SELECT pk2.reschedule_limit FROM public.bk_packages pk2 WHERE pk2.id = k.package_id),
        'change_window_h', t.change_window_h,
        'in_window', k.starts_at >= now() + t.change_window_h * interval '1 hour',
        'can_change', k.status = 'POTWIERDZONA' AND k.starts_at >= now() + t.change_window_h * interval '1 hour'
          AND (k.package_id IS NULL OR (SELECT COALESCE(pk2.reschedule_limit, 0) FROM public.bk_packages pk2 WHERE pk2.id = k.package_id) > k.reschedule_count),
        'can_cancel', k.status = 'POTWIERDZONA' AND k.starts_at >= now() + t.change_window_h * interval '1 hour',
        'zoom_link', CASE WHEN now() >= k.starts_at - interval '15 minutes' AND now() < k.ends_at THEN t.zoom_link END) AS b
      FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id, me
      WHERE (me.uid IS NOT NULL AND k.user_id = me.uid) OR (me.mail <> '' AND lower(btrim(COALESCE(k.email,''))) = me.mail)
      ORDER BY k.starts_at DESC LIMIT 100
    ) z
  ), '[]'::jsonb)
);
$ms$;

-- 18) Panel: lista pakiet\xF3w i r\u0119czne oddanie sesji (polityka \u201Edecyduje admin\u201D).
CREATE OR REPLACE FUNCTION public.bk_admin_packages() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ap$
SELECT COALESCE(jsonb_agg(jsonb_build_object('id', pk.id, 'type', t.name, 'email', pk.email_display,
  'sessions_total', pk.sessions_total, 'sessions_used', pk.sessions_used, 'valid_until', pk.valid_until,
  'payment_status', pk.payment_status, 'source', pk.source, 'order_id', pk.order_id, 'created_at', pk.created_at) ORDER BY pk.created_at DESC), '[]'::jsonb)
FROM public.bk_packages pk JOIN public.bk_types t ON t.id = pk.type_id
$ap$;

CREATE OR REPLACE FUNCTION public.bk_return_session(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $rs$
DECLARE v_pk uuid;
BEGIN
  UPDATE public.bk_packages SET sessions_used = GREATEST(0, sessions_used - 1)
  WHERE id = (p->>'package_id')::uuid RETURNING id INTO v_pk;
  IF v_pk IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
  INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
  VALUES (COALESCE(p->>'actor','admin'), 'sesja_oddana', 'package', v_pk::text, p->>'note');
  RETURN jsonb_build_object('ok', true);
END $rs$;

-- 19) Widok rezerwacji po tokenie: dodane id, granica zmiany i link Zoom od 15 minut przed.
CREATE OR REPLACE FUNCTION public.bk_manage_view(p_hash text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $m$
  SELECT jsonb_build_object('id', k.id, 'type', t.name, 'slug', t.slug,
    'starts_at', k.starts_at, 'ends_at', k.ends_at, 'status', k.status, 'first_name', k.first_name,
    'change_window_h', t.change_window_h,
    'in_window', k.starts_at >= now() + t.change_window_h * interval '1 hour',
    'can_change', k.starts_at >= now() + t.change_window_h * interval '1 hour',
    'can_cancel', k.starts_at >= now() + t.change_window_h * interval '1 hour',
    'zoom_link', CASE WHEN now() >= k.starts_at - interval '15 minutes' AND now() < k.ends_at THEN t.zoom_link END)
  FROM public.bk_tokens x JOIN public.bk_bookings k ON k.id = x.booking_id JOIN public.bk_types t ON t.id = k.type_id
  WHERE x.token_hash = p_hash AND x.purpose = 'zarzadzaj' AND x.expires_at > now() AND k.status = 'POTWIERDZONA'
$m$;

-- 20) Uprawnienia: nowe funkcje wy\u0142\u0105cznie dla service_role.
REVOKE EXECUTE ON FUNCTION public.bk_grant_package(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_token_package(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_book_package(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_reschedule(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_cancel(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_my_sessions(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_admin_packages() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_return_session(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bk_grant_package(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_token_package(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_book_package(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_reschedule(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_cancel(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_my_sessions(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_admin_packages() TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_return_session(jsonb) TO service_role;

-- ============ KROK 3: powiadomienia, kalendarz, statusy, kana\u0142 iCal ============

-- 21) Kana\u0142 iCal i tre\u015Bci e-maili (edytowalne w panelu).
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS ical_token text;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS ical_rotated_at timestamptz;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS mail_texts jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 22) Status po spotkaniu, numer wydarzenia iCal, notatka administratora.
ALTER TABLE public.bk_bookings ADD COLUMN IF NOT EXISTS ics_sequence int NOT NULL DEFAULT 0;
ALTER TABLE public.bk_bookings ADD COLUMN IF NOT EXISTS marked_at timestamptz;
ALTER TABLE public.bk_bookings ADD COLUMN IF NOT EXISTS marked_by text;
ALTER TABLE public.bk_bookings ADD COLUMN IF NOT EXISTS admin_note text;
DO $n$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bk_bookings_admin_note_check') THEN
    ALTER TABLE public.bk_bookings ADD CONSTRAINT bk_bookings_admin_note_check CHECK (admin_note IS NULL OR length(admin_note) <= 500);
  END IF;
END $n$;

-- 23) Kolejka powiadomie\u0144: \u015Blad wysy\u0142ki i indeks na termin.
ALTER TABLE public.bk_notifications ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.bk_notifications ADD COLUMN IF NOT EXISTS error text;
CREATE INDEX IF NOT EXISTS bk_notifications_due ON public.bk_notifications (send_at) WHERE status = 'zaplanowane';

-- 24) Status po spotkaniu: odby\u0142a si\u0119 / nieobecno\u015B\u0107 / prze\u0142o\u017Cona przez admina.
--     Do oznaczenia liczy si\u0119 jako wykorzystana; rezerwacja przestaje blokowa\u0107 kalendarz.
CREATE OR REPLACE FUNCTION public.bk_mark_status(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ms$
DECLARE v_k public.bk_bookings; v_st text := COALESCE(p->>'status','');
BEGIN
  IF v_st NOT IN ('ODBYLA_SIE','NIEOBECNOSC','PRZENIESIONA') THEN RETURN jsonb_build_object('error','bad'); END IF;
  SELECT * INTO v_k FROM public.bk_bookings WHERE id = (p->>'booking_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_k.status <> 'POTWIERDZONA' THEN RETURN jsonb_build_object('error','closed'); END IF;
  IF v_k.ends_at > now() AND v_st <> 'PRZENIESIONA' THEN RETURN jsonb_build_object('error','future'); END IF;
  UPDATE public.bk_bookings SET status = v_st, marked_at = now(), marked_by = p->>'actor', version = version + 1, updated_at = now()
  WHERE id = v_k.id;
  UPDATE public.bk_notifications SET status = 'pominiete' WHERE booking_id = v_k.id AND status = 'zaplanowane';
  UPDATE public.bk_tokens SET used_at = now() WHERE booking_id = v_k.id AND used_at IS NULL;
  INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
  VALUES (COALESCE(p->>'actor','admin'), 'status_po_spotkaniu', 'booking', v_k.id::text, v_st);
  RETURN jsonb_build_object('ok', true, 'status', v_st);
END $ms$;

-- 25) Kalendarz panelu: rezerwacje, spotkania grupowe (tylko odczyt), blokady.
CREATE OR REPLACE FUNCTION public.bk_admin_calendar(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $c$
SELECT jsonb_build_object(
  'bookings', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', k.id, 'type_id', k.type_id, 'type', t.name, 'slug', t.slug,
      'starts_at', k.starts_at, 'ends_at', k.ends_at, 'first_name', k.first_name, 'email', k.email, 'status', k.status,
      'source', k.source, 'package_id', k.package_id, 'marked', k.marked_at IS NOT NULL, 'client_tz', k.client_tz)
      ORDER BY k.starts_at)
    FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
    WHERE k.starts_at < p_to AND k.ends_at > p_from), '[]'::jsonb),
  'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.start_datetime,
      'ends_at', e.start_datetime + COALESCE(e.duration_minutes, 60) * interval '1 minute') ORDER BY e.start_datetime)
    FROM public.events e WHERE e.status = 'Opublikowane' AND e.start_datetime IS NOT NULL
      AND e.start_datetime < p_to AND e.start_datetime + COALESCE(e.duration_minutes, 60) * interval '1 minute' > p_from), '[]'::jsonb),
  'blocks', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'starts_at', x.starts_at,
      'ends_at', x.ends_at, 'note', x.note) ORDER BY x.starts_at)
    FROM public.bk_blocks x WHERE NOT x.disabled AND x.starts_at < p_to AND x.ends_at > p_from), '[]'::jsonb),
  'unmarked', (SELECT count(*) FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.ends_at < now())
);
$c$;

-- 26) Eksport CSV: bez odpowiedzi z formularza i bez danych o zdrowiu.
CREATE OR REPLACE FUNCTION public.bk_export_rows(p_from timestamptz, p_to timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $e$
SELECT COALESCE(jsonb_agg(z ORDER BY z->>'starts_at'), '[]'::jsonb) FROM (
  SELECT jsonb_build_object(
    'starts_at', to_char(k.starts_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI'),
    'koniec', to_char(k.ends_at AT TIME ZONE 'Europe/Warsaw', 'HH24:MI'),
    'rodzaj', t.name, 'imie', k.first_name, 'email', k.email, 'status', k.status,
    'zrodlo', k.source, 'strefa', k.client_tz) AS z
  FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
  WHERE k.starts_at >= p_from AND k.starts_at < p_to
) s;
$e$;

-- 27) Kana\u0142 iCal: obr\xF3t tajnego adresu.
CREATE OR REPLACE FUNCTION public.bk_rotate_ical(p_token text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $ri$
  UPDATE public.bk_settings SET ical_token = p_token, ical_rotated_at = now(), updated_at = now() WHERE id = 1
  RETURNING jsonb_build_object('ok', true, 'rotated_at', ical_rotated_at);
$ri$;

-- 28) Uprawnienia nowych funkcji.
REVOKE EXECUTE ON FUNCTION public.bk_mark_status(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_admin_calendar(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_export_rows(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_rotate_ical(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bk_mark_status(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_admin_calendar(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_export_rows(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_rotate_ical(text) TO service_role;

-- 29) Security Advisor: \u017Caden obiekt bk_* nie jest dost\u0119pny dla anon/authenticated/PUBLIC.
--     Wszystkie funkcje bk_* maj\u0105 ustawione search_path (SECURITY DEFINER albo jawne SET).
DO $s$ DECLARE r record; BEGIN
  FOR r IN SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'bk_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
  END LOOP;
END $s$;
DO $s$ DECLARE r record; BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname LIKE 'bk_%' LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', r.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $s$;

SELECT public.bk_fill_holidays(2);
NOTIFY pgrst, 'reload schema';

-- ============ KROK 4: Kalendarz Google (tylko calendar.app.created + calendar.freebusy) ============

-- 30) W\u0142asny kalendarz \u201Eexmortis \xB7 sesje\u201D, prze\u0142\u0105cznik zaj\u0119to\u015Bci i stan po\u0142\u0105czenia.
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS google_calendar_id text;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS google_busy boolean NOT NULL DEFAULT true;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS google_status text;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS google_status_at timestamptz;
ALTER TABLE public.bk_settings ADD COLUMN IF NOT EXISTS google_error text;

-- 31) Identyfikator wydarzenia w kalendarzu Google \u2014 zapisywany przy rezerwacji.
ALTER TABLE public.bk_bookings ADD COLUMN IF NOT EXISTS gcal_event_id text;
ALTER TABLE public.bk_bookings ADD COLUMN IF NOT EXISTS gcal_synced_at timestamptz;

-- 32) Ponowienia: nieudany zapis do Google nie blokuje rezerwacji, tylko tu czeka.
CREATE TABLE IF NOT EXISTS public.bk_gcal_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  op text NOT NULL CHECK (op IN ('upsert','delete')),
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, op)
);
CREATE INDEX IF NOT EXISTS bk_gcal_queue_due ON public.bk_gcal_queue (created_at);

-- 33) Nowa tabela jak pozosta\u0142e: wy\u0142\u0105cznie serwer (service_role).
ALTER TABLE public.bk_gcal_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bk_gcal_queue FROM PUBLIC, anon, authenticated;
`;

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
async function insertTicket(base44, t) {
  for (let i = 0; i < 6; i++) {
    const rows = await runSql(base44, `INSERT INTO public.event_tickets (code, token, event_id, order_id, line_no, holder_name, buyer_email, price, source)
      VALUES (${escStr(newCode())}, ${escStr(newToken())}, ${escStr(t.event_id)}, ${t.order_id ? escStr(t.order_id) : "NULL"}, ${t.line_no},
        ${escStr(t.holder_name)}, ${t.buyer_email ? escStr(t.buyer_email) : "NULL"}, ${Number(t.price) || 0}, ${escStr(t.source || "zakup")})
      ON CONFLICT DO NOTHING RETURNING *`).catch((e) => {
      if (!/duplicate|unique/i.test(String(e?.message))) throw e;
      return [];
    });
    if (rows?.length) return rows[0];
    if (t.order_id) {
      const had = await runSql(base44, `SELECT * FROM public.event_tickets WHERE order_id = ${escStr(t.order_id)} AND line_no = ${t.line_no}`, true);
      if (had?.length) return had[0];
    }
  }
  throw new Error("Nie uda\u0142o si\u0119 nada\u0107 numeru biletu");
}
async function issueOrderTickets(base44, order, items) {
  const lines = (items || []).filter((i) => i.kind === "bilet" && i.event_id);
  if (!lines.length) return [];
  await ensureTicketSchema(base44);
  const email = String(order.buyer_email || "").trim().toLowerCase();
  const out = [];
  let n = 0;
  for (const l of lines) {
    const holders = Array.isArray(l.holders) && l.holders.length ? l.holders : [order.buyer_name || "Uczestnik"];
    for (const h of holders.slice(0, 20)) {
      out.push(await insertTicket(base44, {
        event_id: l.event_id,
        order_id: String(order.id),
        line_no: n++,
        holder_name: cleanName(h) || "Uczestnik",
        buyer_email: email,
        price: Number(l.unitPrice) / 100
      }));
    }
    if (email) {
      await runSql(base44, `INSERT INTO public.registrations (id, event_id, first_name, email, consent, status, source, created_at)
        VALUES (gen_random_uuid()::text, ${escStr(l.event_id)}, ${escStr(String(order.buyer_name || "").split(" ")[0] || "Uczestnik")}, ${escStr(email)}, TRUE, 'Zapisany', 'bilet', now())
        ON CONFLICT (event_id, email) DO UPDATE SET status = 'Zapisany', source = 'bilet'
          WHERE public.registrations.status NOT IN ('Zapisany','Obecny')`).catch((e) => console.error("bilet: zapis", e?.message));
    }
  }
  const evIds = [...new Set(lines.map((l) => String(l.event_id)))];
  out.overbooked = await runSql(base44, `SELECT e.id, e.title, e.capacity, COUNT(t.id)::int AS sold
      FROM public.events e JOIN public.event_tickets t ON t.event_id = e.id AND t.status <> 'anulowany'
     WHERE e.id IN (${evIds.map(escStr).join(",")}) AND COALESCE(e.capacity, 0) > 0
     GROUP BY e.id, e.title, e.capacity HAVING COUNT(t.id) > e.capacity`, true).catch(() => []);
  return out;
}
async function loadEvent(base44, id) {
  const rows = await runSql(base44, `SELECT id, title, slug, subtitle, format, location, start_datetime, duration_minutes, status, price::float8 AS price,
      capacity, registration_deadline, COALESCE(tickets, false) AS tickets, ticket_template, short_path FROM public.events WHERE id = ${escStr(id)}`, true);
  return rows?.[0] || null;
}
var esc3 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var when = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
function ticketsHtml(tickets, events) {
  if (!tickets.length) return "";
  const byEv = /* @__PURE__ */ new Map();
  for (const t of tickets) byEv.set(t.event_id, [...byEv.get(t.event_id) || [], t]);
  const blocks = [...byEv.entries()].map(([id, list]) => {
    const ev = events.get(id) || {};
    return `<div style="margin:0 0 18px;border:1px solid #C9A24A;padding:22px;">
      <p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 10px;">BILET${list.length > 1 ? "Y" : ""}</p>
      <p style="margin:0 0 6px;color:#F5EFE1;font-size:20px;">${esc3(ev.title || "")}</p>
      ${ev.start_datetime ? `<p style="margin:0 0 14px;color:#8A8A8C;">${esc3(when(ev.start_datetime))} (czas polski)${ev.format === "Online" ? " \xB7 online" : ""}</p>` : ""}
      ${list.map((t) => `<p style="margin:0 0 10px;color:#E2E2E2;">${esc3(t.holder_name)} \xB7 <b style="color:#C9A24A;letter-spacing:2px;">${esc3(showCode(t.code))}</b><br>
        <a href="${esc3(ticketPdfUrl(t.token))}" style="color:#C9A24A;">Pobierz bilet (PDF)</a> \xB7 <a href="${esc3(ticketUrl(t.token))}" style="color:#8A8A8C;">otw\xF3rz na telefonie</a></p>`).join("")}
    </div>`;
  }).join("");
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">${blocks}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Bilet jest imienny i wa\u017Cny na jedno wej\u015Bcie. Przy wej\u015Bciu poka\u017C kod QR \u2014 na telefonie albo wydrukowany. Ka\u017Cd\u0105 osob\u0119 wpuszczam na jej bilet, wi\u0119c bilety dla innych przeka\u017C im wcze\u015Bniej (PDF albo link). Wszystkie bilety s\u0105 te\u017C w Moim koncie \u2192 Spotkania, po zalogowaniu tym adresem e-mail.</p></div>`;
}

// supabase/functions/_shared/dataPatches.ts
var PATCHES = [
  {
    id: "2026-10-14-wracam-inny",
    why: "\u201EWracam inny\u201D: cena regularna 97 z\u0142, drabinka 47 z\u0142 do 22.11 i 77 z\u0142 do 6.12, \u201Ewkr\xF3tce\u201D, premiera (przedsprzeda\u017C) 16.11 o 6:00",
    sql: [
      `UPDATE public.products SET price = 97, price_regular = 97, price_start = NULL, promo_end_date = NULL, old_price = NULL,
         status = 'wkr\xF3tce', available_at = NULL,
         price_steps = '[{"do":"2026-11-22","cena":47},{"do":"2026-12-06","cena":77}]'::jsonb,
         release_at = '2026-11-16T06:00:00+01:00'::timestamptz, release_notify = FALSE
       WHERE slug = 'wracam-inny'`
    ]
  },
  {
    id: "2026-10-14-cudzyslowy",
    why: "Nazwy produkt\xF3w: zamykaj\u0105cy cudzys\u0142\xF3w \u201E\u2026\u201D zamiast apostrofu lub prostego cudzys\u0142owu",
    sql: [
      `UPDATE public.products SET name = regexp_replace(name, '\u201E([^\u201E\u201D"'']*)["'']', '\u201E\\1\u201D', 'g') WHERE name ~ '\u201E[^\u201D]*["'']'`
    ]
  },
  {
    id: "2026-10-14-karta",
    why: "Karta podarunkowa: kwoty 97 \xB7 197 \xB7 497 z\u0142, \u201Ewkr\xF3tce\u201D, premiera 1.12 o 6:00",
    sql: [
      `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_options jsonb`,
      `UPDATE public.products SET price_options = '[97,197,497]'::jsonb, price = 97, price_regular = 97, price_start = NULL,
         promo_end_date = NULL, old_price = NULL, price_steps = NULL, status = 'wkr\xF3tce', available_at = NULL,
         release_at = '2026-12-01T06:00:00+01:00'::timestamptz, release_notify = FALSE
       WHERE slug = 'karta-podarunkowa' AND product_type = 'karta'`
    ]
  },
  {
    id: "2026-10-14-soundtrack-ukryty",
    why: "\u201ESoundtrack powrotu\u201D wycofany (decyzja Dawida): ukryty, nie usuni\u0119ty \u2014 nie pojawia si\u0119 w katalogu, nast\u0119pnym kroku ani powiadomieniach",
    sql: [`UPDATE public.products SET active = FALSE WHERE slug = 'soundtrack-powrotu'`]
  },
  {
    id: "2026-10-14-rezerwacje-raport",
    why: "Raport przed w\u0142\u0105czeniem rezerwacji: tryb, rodzaje (aktywne, dost\u0119p) i godziny",
    sql: [
      `SELECT (SELECT mode FROM public.bk_settings WHERE id = 1) AS mode,
         (SELECT json_agg(json_build_object('slug', t.slug, 'active', t.active, 'access', t.access, 'dur', t.duration_min,
            'hours', (SELECT json_agg(json_build_object('d', h.weekday, 'f', to_char(h.start_local,'HH24:MI'), 't', to_char(h.end_local,'HH24:MI')) ORDER BY h.weekday, h.start_local)
                      FROM public.bk_hours h WHERE h.type_id = t.id)) ORDER BY t.sort) FROM public.bk_types t) AS types,
         (SELECT count(*) FROM public.bk_packages) AS packages,
         (SELECT count(*) FROM public.bk_bookings) AS bookings`
    ]
  },
  {
    id: "2026-10-14-rezerwacje-powrot-start",
    why: "Rezerwacje POWR\xD3T: pn\u2013pt 8:00\u201310:00 i 16:00\u201320:00 dla \u201ESesja POWR\xD3T\u201D i \u201EIndywidualne konsultacje\u201D, oba rodzaje w\u0142\u0105czone, tryb \u201Eon\u201D (decyzja Dawida 14.10; godziny zmienia w panelu)",
    sql: [
      `INSERT INTO public.bk_types (slug, name, description, duration_min, buffer_before, buffer_after, step_min, horizon_days, access, monthly_limit, sort, questions, active)
         VALUES ('indywidualne-konsultacje', 'Indywidualne konsultacje', 'Spotkanie jeden na jeden: rozmowa o tym, z czym przychodzisz, i o najbli\u017Cszym kroku.', 60, 15, 15, 30, 60, 'PAKIET', NULL, 5, '[]', false)
         ON CONFLICT (slug) DO NOTHING`,
      `DELETE FROM public.bk_hours WHERE type_id IN (SELECT id FROM public.bk_types WHERE slug IN ('sesja-powrot', 'indywidualne-konsultacje'))`,
      `INSERT INTO public.bk_hours (type_id, weekday, start_local, end_local)
         SELECT t.id, w, v.f, v.t FROM public.bk_types t, generate_series(1, 5) w,
           (VALUES ('08:00'::time, '10:00'::time), ('16:00'::time, '20:00'::time)) v(f, t)
         WHERE t.slug IN ('sesja-powrot', 'indywidualne-konsultacje')`,
      `UPDATE public.bk_types SET active = TRUE WHERE slug IN ('sesja-powrot', 'indywidualne-konsultacje')`,
      `UPDATE public.bk_settings SET mode = 'on', updated_at = now() WHERE id = 1`,
      `SELECT (SELECT mode FROM public.bk_settings WHERE id = 1) AS mode,
         (SELECT json_agg(json_build_object('slug', t.slug, 'active', t.active, 'n_hours', (SELECT count(*) FROM public.bk_hours h WHERE h.type_id = t.id)) ORDER BY t.sort) FROM public.bk_types t) AS types`
    ]
  },
  {
    id: "2026-10-14-rezerwacje-odstep",
    why: "Rezerwacje z pakietu: odst\u0119p mi\u0119dzy sesjami liczony w obie strony i pilnowany tak\u017Ce przy przenoszeniu terminu",
    sql: [BK_BOOK_PACKAGE_SQL, BK_RESCHEDULE_SQL]
  },
  {
    id: "2026-10-14-rezerwacje-zoom",
    why: "Sesja POWR\xD3T i Indywidualne konsultacje: sta\u0142y link Zoom z Ustawie\u0144 strony (tylko gdy rodzaj nie ma w\u0142asnego)",
    sql: [
      `UPDATE public.bk_types SET zoom_link = (SELECT value->>'link' FROM public.app_settings WHERE key = 'zoom_staly')
         WHERE slug IN ('sesja-powrot', 'indywidualne-konsultacje') AND COALESCE(zoom_link, '') = ''
           AND COALESCE((SELECT value->>'link' FROM public.app_settings WHERE key = 'zoom_staly'), '') LIKE 'https://%'`,
      `SELECT slug, (zoom_link IS NOT NULL) AS ma_zoom FROM public.bk_types WHERE slug IN ('sesja-powrot', 'indywidualne-konsultacje')`
    ]
  },
  {
    id: "2026-10-14-bilety-schemat",
    why: "Bilety na wydarzenia: tabela event_tickets (numer, klucz QR, imi\u0119 i nazwisko, status) i kolumny wydarze\u0144 (sprzeda\u017C, wz\xF3r)",
    sql: [TICKET_SCHEMA_SQL]
  },
  {
    id: "2026-10-14-test-pakiet-usun",
    why: "Sprz\u0105tanie po te\u015Bcie pakiet\xF3w: ukryty produkt \u201ETEST pakiet (do usuni\u0119cia)\u201D (nigdy niewidoczny, bez zam\xF3wie\u0144)",
    sql: [`DELETE FROM public.products WHERE id::text = '62bb36ec-cc82-469f-9e6c-b94a28733df0' AND name LIKE 'TEST pakiet%'
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.items::text LIKE '%62bb36ec-cc82-469f-9e6c-b94a28733df0%')`]
  },
  {
    id: "2026-10-15-rozmowa-na-progu",
    why: "\u201ERozmowa na progu\u201D: 799 z\u0142, jedna sesja 90 min; po op\u0142aceniu pakiet z wyborem terminu (rodzaj rozmowa-na-progu), Zoom ze sta\u0142ego linku",
    sql: [
      `UPDATE public.products SET price = 799, price_regular = 799, price_start = NULL, promo_end_date = NULL, old_price = NULL, price_steps = NULL
         WHERE slug = 'rozmowa-na-progu'`,
      `UPDATE public.bk_settings SET
           threshold_product_id = COALESCE(threshold_product_id, (SELECT id::text::uuid FROM public.products WHERE slug = 'rozmowa-na-progu' LIMIT 1)),
           threshold_type_id = COALESCE(threshold_type_id, (SELECT id::text::uuid FROM public.bk_types WHERE slug = 'rozmowa-na-progu' LIMIT 1))
         WHERE id = 1`,
      `UPDATE public.bk_types SET zoom_link = (SELECT value->>'link' FROM public.app_settings WHERE key = 'zoom_staly')
         WHERE slug = 'rozmowa-na-progu' AND COALESCE(zoom_link, '') = ''
           AND COALESCE((SELECT value->>'link' FROM public.app_settings WHERE key = 'zoom_staly'), '') LIKE 'https://%'`,
      `SELECT (SELECT price FROM public.products WHERE slug = 'rozmowa-na-progu') AS cena,
         (SELECT status FROM public.products WHERE slug = 'rozmowa-na-progu') AS status,
         s.mode, s.threshold_sessions, s.threshold_valid_days,
         (s.threshold_product_id::text = (SELECT id::text FROM public.products WHERE slug = 'rozmowa-na-progu')) AS produkt_ok,
         (s.threshold_type_id::text = t.id::text) AS rodzaj_ok, to_jsonb(t)->>'active' AS rodzaj_aktywny, (t.zoom_link IS NOT NULL) AS ma_zoom,
         (SELECT count(*) FROM public.bk_hours h WHERE h.type_id = t.id) AS godziny
       FROM public.bk_settings s LEFT JOIN public.bk_types t ON t.slug = 'rozmowa-na-progu' WHERE s.id = 1`
    ]
  },
  {
    id: "2026-10-15-rezerwacje-staly-zoom",
    why: "Rodzaje rezerwacji bez w\u0142asnego linku dostaj\u0105 sta\u0142y link Zoom z Ustawie\u0144 strony (wpisany przez Dawida 15.10)",
    sql: [
      `UPDATE public.bk_types SET zoom_link = (SELECT value->>'link' FROM public.app_settings WHERE key = 'zoom_staly')
         WHERE COALESCE(zoom_link, '') = ''
           AND COALESCE((SELECT value->>'link' FROM public.app_settings WHERE key = 'zoom_staly'), '') LIKE 'https://%'`
    ]
  },
  {
    id: "2026-10-15-obecnosc-po-spotkaniu",
    why: "Spotkania: godzina wej\u015Bcia do pokoju (obecno\u015B\u0107) i znacznik maila po spotkaniu; spotkania ju\u017C zako\u0144czone oznaczone jako wys\u0142ane",
    sql: [
      `ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS joined_at timestamptz`,
      `ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS follow_up_sent boolean NOT NULL DEFAULT FALSE`,
      `UPDATE public.registrations r SET follow_up_sent = TRUE FROM public.events e
         WHERE e.id = r.event_id AND e.start_datetime IS NOT NULL
           AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') < now()`
    ]
  },
  {
    id: "2026-10-15-bilety-tylko-stacjonarne",
    why: "Bilety tylko na spotkania stacjonarne \u2014 wy\u0142\u0105czenie bilet\xF3w na spotkaniach online",
    sql: [
      `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tickets boolean DEFAULT false`,
      `UPDATE public.events SET tickets = FALSE WHERE format = 'Online' AND COALESCE(tickets, false) = TRUE`
    ]
  },
  {
    id: "2026-10-15-nowe-tokeny-zadan",
    why: "Bezpiecze\u0144stwo: tokeny zada\u0144 cyklicznych by\u0142y zapisane w plikach workflow (historia kodu) \u2014 nowe warto\u015Bci tylko w bazie",
    sql: [
      `UPDATE public.mb_settings SET tick_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE id = 1`,
      `UPDATE public.bk_settings SET tick_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE id = 1`
    ]
  },
  {
    id: "2026-10-16-webinar-co-otrzymujesz",
    why: "Webinar 1.11: lista \u201EW ramach uczestnictwa otrzymujesz\u201D (tekst Dawida; bez nagrania \u2014 spotkania na \u017Cywo nie s\u0105 nagrywane)",
    sql: [
      `UPDATE public.events SET what_registered = 'Indywidualny link do spotkania na platformie Zoom; Mo\u017Cliwo\u015B\u0107 udzia\u0142u w zamkni\u0119tej sesji pyta\u0144 i odpowiedzi (Q&A); Mo\u017Cliwo\u015B\u0107 otrzymania prezent\xF3w z racji otwarcia platformy exmortis.pl'
         WHERE slug = 'ze-smierci-o-powrotach-o-ktorych-swiat-nie-mowi'`
    ]
  }
];
async function applyDataPatches(base44) {
  const done = await getSetting(base44, "data_patches").catch(() => null) || [];
  const todo = PATCHES.filter((p) => !done.includes(p.id));
  if (!todo.length) return [];
  await ensureWaitlistCols(base44);
  const applied = [];
  for (const p of todo) {
    try {
      for (const q of p.sql) {
        const r = await runSql(base44, q, /^\s*SELECT/i.test(q));
        if (/^\s*SELECT/i.test(q)) console.log(`[poprawka danych] ${p.id} raport:`, JSON.stringify(r).slice(0, 3e3));
      }
      applied.push(p.id);
      console.log(`[poprawka danych] ${p.id}: ${p.why}`);
    } catch (e) {
      console.error(`[poprawka danych] ${p.id} nie powiod\u0142a si\u0119:`, e?.message);
    }
  }
  if (applied.length) {
    await saveSetting(base44, "data_patches", [...done, ...applied]);
    await clearSnap(base44, "products:").catch(() => {
    });
  }
  return applied;
}

// supabase/functions/_shared/orders.ts
var ORDERS_IDX = false;
async function ensureOrdersTable(base44) {
  if (ORDERS_IDX) return;
  ORDERS_IDX = true;
  await runSql(
    base44,
    `CREATE INDEX IF NOT EXISTS orders_payu_idx ON public.orders (payu_order_id);
     CREATE INDEX IF NOT EXISTS orders_email_idx ON public.orders (lower(buyer_email));
     CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_date DESC);
     CREATE INDEX IF NOT EXISTS orders_updated_idx ON public.orders (updated_date)`
  ).catch(() => {
  });
}
async function getOrderByPayuId(base44, payuOrderId) {
  await ensureOrdersTable(base44);
  const rows = await runSql(
    base44,
    `SELECT * FROM public.orders WHERE payu_order_id = ${escStr(payuOrderId)} LIMIT 1`,
    true
  );
  return rows && rows.length > 0 ? rows[0] : null;
}
async function claimCompletion(base44, payuOrderId) {
  const rows = await runSql(
    base44,
    `UPDATE public.orders
     SET status = 'COMPLETED', updated_date = now()
     WHERE payu_order_id = ${escStr(payuOrderId)} AND status NOT IN ('COMPLETED', 'CANCELED')
     RETURNING id`
  );
  return Array.isArray(rows) && rows.length > 0;
}
async function releaseCompletion(base44, payuOrderId, previous) {
  await runSql(
    base44,
    `UPDATE public.orders SET status = ${escStr(previous || "PENDING")}, updated_date = now()
     WHERE payu_order_id = ${escStr(payuOrderId)} AND status = 'COMPLETED'`
  );
}

// supabase/functions/_shared/nextStep.ts
async function nextStep(base44, boughtIds, ownedIds = []) {
  const ids = [...new Set((boughtIds || []).filter(Boolean).map(String))];
  if (!ids.length) return null;
  const skip = [.../* @__PURE__ */ new Set([...ids, ...(ownedIds || []).map(String)])].map(escStr).join(",");
  const rows = await runSql(base44, `
    WITH b AS (SELECT MAX(level) AS lvl, (array_agg(next_step ORDER BY level DESC NULLS LAST) FILTER (WHERE COALESCE(next_step,'') <> ''))[1] AS ns
               FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")}))
    SELECT p.name, p.slug, p.subtitle, b.ns FROM public.products p, b
    WHERE p.active = TRUE AND p.status IN ('dost\u0119pny','wkr\xF3tce') AND p.id::text NOT IN (${skip})
      AND p.level IS NOT NULL AND p.level > COALESCE(b.lvl, -1)
    ORDER BY p.level ASC, p.sort_order ASC NULLS LAST LIMIT 1`, true);
  const r = rows && rows[0];
  if (!r) return null;
  return { name: r.name, slug: r.slug, text: r.ns || r.subtitle || null };
}
var esc5 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function nextStepHtml(base44, step) {
  if (!step) return "";
  const url = `${await loadAppUrl(base44)}/skarbiec/${encodeURIComponent(step.slug)}`;
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;"><div style="border-top:1px solid #3D3D3F;padding-top:20px;">
    <p style="font-size:11px;letter-spacing:.18em;color:#C9A24A;margin:0 0 8px;">NAST\u0118PNY KROK</p>
    ${step.text ? `<p style="line-height:1.7;color:#E2E2E2;margin:0 0 8px;">${esc5(step.text)}</p>` : ""}
    <p style="margin:0;"><a href="${esc5(url)}" style="color:#C9A24A;">${esc5(step.name)} \u2192</a></p></div></div>`;
}

// supabase/functions/_shared/giftCard.ts
var esc6 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
function rand(abc, n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => abc[x % abc.length]).join("");
}
var newCode2 = () => "PREZENT-" + rand("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
var newToken2 = () => rand("abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", 32);
var view = (r) => ({ code: r.code, value: r.value, until: r.valid_until, to_name: r.gift_to || "", message: r.gift_message || "", token: r.gift_token || "" });
var cardKey = (value, toName, message) => `${value}|${clip(toName, 60)}|${clip(message, 200)}`;
async function issueGiftCards(base44, orderId, items, cardIds, buyerEmail = "") {
  const Dc = base44.asServiceRole.entities.DiscountCode;
  const tag = `zam\xF3wienie ${String(orderId).slice(0, 8).toUpperCase()}`;
  const found = await Dc.filter({ opis: { $regex: tag } }, "created_date", 500);
  const existing = Array.isArray(found) ? found : found?.items || [];
  const counts = /* @__PURE__ */ new Map();
  for (const r of existing) {
    const k = cardKey(Math.round(Number(r.value) || 0), r.gift_to, r.gift_message);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const until = existing[0]?.valid_until || new Date(Date.now() + 183 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  const out = existing.map(view);
  for (const it of items.filter((i) => cardIds.includes(String(i.product_id)))) {
    const value = Math.round(Number(it.unitPrice) || 0) / 100;
    const to = clip(it.gift?.to_name, 60);
    const message = clip(it.gift?.message, 200);
    const want = Math.min(20, Number(it.quantity) || 1);
    const have = counts.get(cardKey(value, to, message)) || 0;
    for (let k = have; k < want; k++) {
      const rec = await Dc.create({
        code: newCode2(),
        kind: "kwota",
        value,
        max_uses: 1,
        uses: 0,
        valid_until: until,
        active: true,
        opis: `Karta podarunkowa \xB7 ${tag}`,
        gift_to: to,
        gift_message: message,
        gift_token: newToken2(),
        buyer_email: String(buyerEmail || "").trim().toLowerCase()
      });
      out.push(view(rec));
    }
  }
  return out;
}
var cardLink = (token) => `${APP_URL}/karta#t=${token}`;
function giftCardsHtml(cards) {
  if (!cards.length) return "";
  const d = (s) => (/* @__PURE__ */ new Date(`${s}T12:00:00Z`)).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  const one = (c) => `<div style="margin:0 0 16px;border:1px solid #C9A24A;background:#0A0A0B;padding:24px;">
      <p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 16px;">EXMORTIS \xB7 KARTA PODARUNKOWA</p>
      ${c.to_name ? `<p style="margin:0 0 6px;color:#8A8A8C;font-size:13px;">Dla</p><p style="margin:0 0 14px;color:#E2E2E2;font-size:20px;">${esc6(c.to_name)}</p>` : ""}
      ${c.message ? `<p style="margin:0 0 16px;color:#E2E2E2;font-style:italic;line-height:1.6;">\u201E${esc6(c.message)}\u201D</p>` : ""}
      <p style="margin:0 0 4px;color:#C9A24A;font-size:26px;">${esc6(String(c.value).replace(".", ","))} z\u0142</p>
      <p style="margin:0 0 14px;color:#E2E2E2;">Kod: <b style="color:#C9A24A;letter-spacing:2px;">${esc6(c.code)}</b> \xB7 wa\u017Cna do ${esc6(d(c.until))}</p>
      ${c.token ? `<p style="margin:0;"><a href="${esc6(cardLink(c.token))}" style="color:#C9A24A;">Otw\xF3rz kart\u0119 do wydruku lub zapisania jako PDF</a></p>` : ""}
    </div>`;
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">
    ${cards.map(one).join("")}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Kod wpisuje si\u0119 w kasie Skarbca, w polu \u201Ekod rabatowy\u201D. Dzia\u0142a jednorazowo \u2014 niewykorzystana cz\u0119\u015B\u0107 kwoty przepada. Kart\u0119 mo\u017Cesz wydrukowa\u0107 albo przes\u0142a\u0107 link osobie obdarowanej. Wszystkie Twoje karty s\u0105 te\u017C w zak\u0142adce Zam\xF3wienia na koncie.</p></div>`;
}

// supabase/functions/_shared/discounts.ts
async function markCodeUsed(base44, orderId) {
  await runSql(base44, `DO $m$ BEGIN IF to_regclass('public.discount_reservations') IS NOT NULL THEN
    UPDATE public.discount_reservations SET used = TRUE WHERE order_id = ${escStr(orderId)}; END IF; END $m$`).catch(() => {
  });
}

// supabase/functions/_shared/mirror.ts
var READY = /* @__PURE__ */ new Set();
async function ensureMirrorTable(base44, entity) {
  if (READY.has(entity)) return;
  READY.add(entity);
  const t = `exm_${entity.toLowerCase()}`;
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.${t} (
       id text PRIMARY KEY,
       data jsonb NOT NULL DEFAULT '{}'::jsonb,
       created_date timestamptz NOT NULL DEFAULT now(),
       updated_date timestamptz NOT NULL DEFAULT now(),
       created_by_id text
     );
     CREATE INDEX IF NOT EXISTS ${t}_data_gin ON public.${t} USING gin (data jsonb_path_ops);
     CREATE INDEX IF NOT EXISTS ${t}_updated_idx ON public.${t} (updated_date);`
  ).catch(() => {
  });
}
async function mirrorRecord(base44, entity, id) {
  if (!id) return;
  try {
    await ensureMirrorTable(base44, entity);
    const rec = await base44.asServiceRole.entities[entity].get(id);
    if (!rec) return;
    const data = { ...rec };
    delete data.id;
    delete data.created_date;
    delete data.updated_date;
    delete data.created_by_id;
    const cd = rec.created_date ? `${escStr(rec.created_date)}::timestamptz` : "now()";
    await runSql(
      base44,
      `INSERT INTO public.exm_${entity.toLowerCase()} (id, data, created_date, updated_date, created_by_id)
       VALUES (${escStr(rec.id)}, ${escStr(JSON.stringify(data))}::jsonb, ${cd}, now(),
               ${rec.created_by_id ? escStr(rec.created_by_id) : "NULL"})
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_date = now()`
    );
  } catch (e) {
    console.error(`mirror:${entity}:${id}:`, String(e?.message || e).slice(0, 200));
  }
}
var enc = encodeURIComponent;
function cond(field, c) {
  const col2 = field === "id" ? "id" : `data->>${enc(field)}`;
  if (c === null) return `${col2}=is.null`;
  if (typeof c === "object" && !Array.isArray(c)) {
    const [op, v] = Object.entries(c)[0];
    if (op === "$in") return `${col2}=in.(${(Array.isArray(v) ? v : [v]).map((x) => `"${x}"`).join(",")})`;
    if (op === "$ne") return `${col2}=neq.${enc(String(v))}`;
    if (op === "$regex") {
      const nocase = String(c.$options || "").includes("i");
      const like = nocase ? "ilike" : "like";
      const p = String(v);
      if (p.startsWith("^") && p.endsWith("$")) return `${col2}=${like}.${enc(p.slice(1, -1))}`;
      return `${col2}=${like}.*${enc(p.replace(/\$$/, ""))}`;
    }
    throw new Error(`Nieobs\u0142ugiwany operator kopii: ${op}`);
  }
  return `${col2}=eq.${enc(String(c))}`;
}
function qs(query, sort, limit) {
  const parts = [];
  for (const [f, c] of Object.entries(query || {})) parts.push(cond(f, c));
  if (sort) {
    const dir = String(sort).startsWith("-") ? "desc" : "asc";
    const field = String(sort).replace(/^-/, "");
    const built = ["created_date", "updated_date"].includes(field);
    parts.push(`order=${built ? field : enc("data->>" + field)}.${dir}`);
  }
  if (limit) parts.push(`limit=${limit}`);
  return parts.join("&");
}
var row2rec2 = (r) => ({ ...r.data || {}, id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id });
async function mirrorFilter(base44, entity, query = {}, sort, limit) {
  const rows = await restGet(base44, `exm_${entity.toLowerCase()}?${qs(query, sort, limit)}`);
  return rows.map(row2rec2);
}
async function accessFilter(base44, query = {}, sort, limit) {
  try {
    return await mirrorFilter(base44, "Access", query, sort, limit);
  } catch (e) {
    console.error("odczyt:Access:", String(e?.message || e).slice(0, 200));
    return base44.asServiceRole.entities.Access.filter(query, sort, limit);
  }
}

// supabase/functions/_shared/access.ts
var DIGITAL = ["pdf", "audio", "wideo", "kurs"];
var warsawToday2 = () => (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
function addMonths(ymd, m) {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + m, d)).toISOString().slice(0, 10);
}
async function grantAccess(base44, { email, product, source, orderId = null }) {
  const E = base44.asServiceRole.entities.Access;
  const mail = String(email).toLowerCase();
  const existing = (await accessFilter(base44, { user_email: mail, product_id: String(product.id) }))[0];
  if (existing && source === "darmowy" && !existing.revoked) return;
  if (existing && orderId && (existing.history || []).some((h) => h && h.order_id === orderId)) return existing.valid_until || null;
  const today2 = warsawToday2();
  const months = product.access_months ? Number(product.access_months) : null;
  let until = null;
  if (months) {
    const live = existing && !existing.revoked && existing.valid_until && existing.valid_until >= today2;
    until = addMonths(live ? existing.valid_until : today2, months);
  }
  if (existing && !existing.revoked && !existing.valid_until) until = null;
  const entry = { date: (/* @__PURE__ */ new Date()).toISOString(), source, order_id: orderId, valid_until: until };
  const data = {
    user_email: mail,
    product_id: String(product.id),
    product_name: product.name,
    product_type: product.product_type || "pdf",
    valid_until: until,
    source,
    order_id: orderId || "",
    revoked: false
  };
  if (!until) delete data.valid_until;
  let recId = existing?.id;
  if (existing) {
    await E.update(existing.id, { ...data, history: [...existing.history || [], entry] });
    if (!until && existing.valid_until) await E.updateMany({ id: existing.id }, { $unset: { valid_until: "" } });
  } else recId = (await E.create({ ...data, valid_from: today2, history: [entry] })).id;
  await mirrorRecord(base44, "Access", recId);
  return until;
}
async function ensureAccount(base44, email) {
  const found = await base44.asServiceRole.entities.User.filter({ email: String(email).toLowerCase() });
  if (found.length) return false;
  try {
    await base44.asServiceRole.users.inviteUser(String(email).toLowerCase(), "user");
    return true;
  } catch {
    return false;
  }
}

// supabase/functions/_shared/bundles.ts
function idsOf(r) {
  const raw = r?.bundle_items;
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = [];
    }
  }
  return Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
}
async function expandBundles(base44, rows) {
  const list = (rows || []).filter(Boolean);
  const pkgs = list.filter((r) => r.product_type === "pakiet" && r.id);
  if (!pkgs.length) return list;
  const itemsByPkg = /* @__PURE__ */ new Map();
  for (const r of pkgs) itemsByPkg.set(String(r.id), idsOf(r));
  const missing = [...itemsByPkg].filter(([, v]) => !v.length).map(([k]) => k);
  if (missing.length) {
    const got = await runSql(
      base44,
      `SELECT id::text AS id, to_jsonb(p)->'bundle_items' AS bundle_items
       FROM public.products p WHERE id::text IN (${missing.map(escStr).join(",")})`,
      true
    ).catch(() => []);
    for (const g3 of got || []) itemsByPkg.set(String(g3.id), idsOf(g3));
  }
  const compIds = [...new Set([...itemsByPkg.values()].flat())];
  const comps = compIds.length ? await runSql(
    base44,
    `SELECT id::text AS id, name, product_type, access_months
         FROM public.products WHERE id::text IN (${compIds.map(escStr).join(",")})`,
    true
  ).catch(() => []) : [];
  const compById = new Map((comps || []).map((c) => [String(c.id), c]));
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (row) => {
    const key = String(row?.id || "");
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    out.push(row);
  };
  const monthsOf = (v) => v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  for (const r of list) {
    if (r.product_type !== "pakiet") {
      push(r);
      continue;
    }
    const months = monthsOf(r.access_months);
    for (const cid of itemsByPkg.get(String(r.id)) || []) {
      const c = compById.get(String(cid));
      if (!c) continue;
      push({
        id: String(c.id),
        name: c.name,
        product_type: c.product_type,
        access_months: months != null ? months : monthsOf(c.access_months)
      });
    }
  }
  return out;
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
  const add = async (table, cols2) => {
    const have = await runSql(
      base44,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}'`,
      true
    ).catch(() => []);
    const names = new Set((Array.isArray(have) ? have : []).map((r) => String(r.column_name)));
    for (const c of cols2) {
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

// supabase/functions/_shared/bookingCrypto.ts
var te = new TextEncoder();
var td = new TextDecoder();

// supabase/functions/_shared/booking.ts
var te2 = new TextEncoder();
var hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
var sha256hex = async (text) => hex(await crypto.subtle.digest("SHA-256", te2.encode(String(text))));
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// supabase/functions/_shared/fulfillOrder.ts
function packageEmailHtml(token) {
  const link = `${APP_URL}/rezerwacja/termin#t=${token}`;
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">
    <p style="color:#E2E2E2;margin:0 0 12px;">P\u0142atno\u015B\u0107 przyj\u0119ta. Zosta\u0142o jedno: wybierz termin rozmowy.</p>
    <p style="margin:20px 0;"><a href="${link}" style="color:#C9A24A;">Wybierz termin</a></p>
    <p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Link jest jednorazowy i wa\u017Cny 60 dni. Ten sam termin mo\u017Cesz wybra\u0107 w Moich sesjach na koncie, po zalogowaniu si\u0119 tym adresem.</p>
  </div>`;
}
async function grantThresholdPackage(base44, stored) {
  const [s] = await runSql(base44, `SELECT threshold_product_id, threshold_type_id, threshold_sessions, threshold_valid_days FROM public.bk_settings WHERE id = 1`, true);
  if (!s?.threshold_product_id || !s?.threshold_type_id) return;
  const items = Array.isArray(stored.items) ? stored.items : [];
  const match = items.find((i) => String(i.product_id) === String(s.threshold_product_id));
  if (!match) return;
  const token = randomToken();
  const r = await rpc(base44, "bk_grant_package", { p: {
    order_id: String(stored.id),
    email: stored.buyer_email,
    type_id: s.threshold_type_id,
    sessions: (s.threshold_sessions || 1) * Math.max(1, Number(match.quantity) || 1),
    valid_days: s.threshold_valid_days || 60,
    token_hash: await sha256hex(token)
  } });
  if (r?.already || !r?.ok) return;
  await sendMail(base44, {
    kind: "pakiet",
    ref: stored.id,
    to: stored.buyer_email,
    subject: "EXMORTIS \u2014 wybierz termin rozmowy",
    html: packageEmailHtml(token)
  });
}
var PL_DATE = (ymd) => (/* @__PURE__ */ new Date(`${ymd}T12:00:00Z`)).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
function accessEmailHtml(granted, consent, newAccount = false, email = "") {
  if (!granted.length) return "";
  const rows = granted.map((g3) => `<p style="color:#E2E2E2;margin:0 0 6px;">${String(g3.name).replace(/</g, "&lt;")} \xB7 Dost\u0119p ${g3.until ? `do ${PL_DATE(g3.until)}` : "bezterminowo"}</p>`).join("");
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">
    ${rows}
    <p style="margin:20px 0;"><a href="${APP_URL}/konto" style="color:#C9A24A;">Otw\xF3rz w Moich produktach</a></p>
    ${newAccount ? `<p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Konto za\u0142o\u017Cy\u0142em na adres ${String(email).replace(/</g, "&lt;")}. Wejd\u017A przez \u201EZaloguj przez Google\u201D (je\u015Bli to adres Gmail) albo ustaw has\u0142o: na stronie logowania kliknij \u201ENie pami\u0119tam has\u0142a\u201D i podaj ten adres.</p>` : ""}
    ${consent ? `<p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Potwierdzam Twoje \u017C\u0105danie dostarczenia tre\u015Bci cyfrowych przed up\u0142ywem 14 dni od zawarcia umowy oraz przyj\u0119cie do wiadomo\u015Bci utraty prawa odst\u0105pienia od umowy z chwil\u0105 rozpocz\u0119cia dostarczania.</p>` : ""}
    <p style="color:#5C5C5E;font-size:12px;line-height:1.6;">exmortis to mentoring, nie terapia. Je\u015Bli jest Ci bardzo ci\u0119\u017Cko: 116 123 \xB7 800 70 2222 \xB7 w zagro\u017Ceniu \u017Cycia 112.</p>
  </div>`;
}
async function fulfillOrder(base44, stored, payuOrderId) {
  const items = Array.isArray(stored.items) ? stored.items : [];
  const ids = items.map((i) => i.product_id).filter(Boolean);
  const granted = [];
  let newAccount = false;
  try {
    if (ids.length && stored.buyer_email) {
      const rows = await runSql(
        base44,
        `SELECT id, name, product_type, access_months FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")})`,
        true
      );
      const toGrant = await expandBundles(base44, rows);
      for (const p of toGrant.filter((r) => DIGITAL.includes(r.product_type))) {
        const until = await grantAccess(base44, { email: stored.buyer_email, product: p, source: "zakup", orderId: stored.id });
        granted.push({ name: p.name, until });
      }
      if (granted.length) newAccount = await ensureAccount(base44, stored.buyer_email);
    }
  } catch (e) {
    await releaseCompletion(base44, payuOrderId, stored.status).catch(() => {
    });
    throw e;
  }
  try {
    const code = String(stored.discount_code || "").trim();
    if (code) {
      await markCodeUsed(base44, String(stored.id));
      const rec = (await base44.asServiceRole.entities.DiscountCode.filter({ code }))[0];
      if (rec) {
        let uses = (Number(rec.uses) || 0) + 1;
        if (Number(rec.max_uses) > 0) {
          const [r] = await runSql(base44, `SELECT CASE WHEN to_regclass('public.discount_reservations') IS NULL THEN 0
              ELSE (SELECT count(*)::int FROM public.discount_reservations WHERE code = ${escStr(code.toUpperCase())} AND used) END AS n`, true).catch(() => [{ n: 0 }]);
          uses = Math.max(uses, Number(r?.n) || 0);
        }
        await base44.asServiceRole.entities.DiscountCode.update(rec.id, { uses });
      }
    }
  } catch {
  }
  let cards = "";
  let cardIds = [];
  try {
    const cardRows = ids.length ? await runSql(base44, `SELECT id::text AS id FROM public.products WHERE product_type = 'karta' AND id::text IN (${ids.map(escStr).join(",")})`, true) : [];
    cardIds = cardRows.map((r) => String(r.id));
    if (cardIds.length) cards = giftCardsHtml(await issueGiftCards(base44, stored.id, items, cardIds, stored.buyer_email));
  } catch (e) {
    await releaseCompletion(base44, payuOrderId, stored.status).catch(() => {
    });
    throw e;
  }
  let issued = [];
  try {
    issued = await issueOrderTickets(base44, stored, items);
  } catch (e) {
    await releaseCompletion(base44, payuOrderId, stored.status).catch(() => {
    });
    throw e;
  }
  let tix = "";
  if (issued.length) {
    try {
      const evs = /* @__PURE__ */ new Map();
      for (const id of [...new Set(issued.map((t) => t.event_id))]) evs.set(id, await loadEvent(base44, id));
      tix = ticketsHtml(issued, evs);
    } catch (e) {
      console.error("bilety \u2014 tre\u015B\u0107 maila:", e?.message);
    }
  }
  if (stored.buyer_email) {
    try {
      const own = ids.map(String).filter((id) => !cardIds.includes(id) && !id.startsWith("bilet:"));
      const owned = await accessFilter(base44, { user_email: String(stored.buyer_email).toLowerCase() }, "-created_date", 200).then((l) => l.filter((a) => !a.revoked).map((a) => String(a.product_id))).catch(() => []);
      const step = own.length ? await nextStep(base44, own, owned).then((s) => nextStepHtml(base44, s)).catch(() => "") : "";
      await sendMail(base44, {
        kind: "zamowienie",
        ref: stored.id,
        to: stored.buyer_email,
        subject: Number(stored.total) > 0 ? "EXMORTIS \u2014 p\u0142atno\u015B\u0107 przyj\u0119ta" : "EXMORTIS \u2014 zam\xF3wienie przyj\u0119te",
        html: orderEmailHtml(stored.buyer_name || "", items, stored.total, stored.id, stored.invoice || null) + accessEmailHtml(granted, !!stored.digital_consent_text, newAccount, stored.buyer_email) + tix + cards + step
      });
    } catch {
    }
  }
  try {
    const admin = await adminTo(base44);
    if (admin) {
      const list = items.map((i) => `${String(i.name).replace(/</g, "&lt;")} \xD7 ${Number(i.quantity) || 1}`).join("<br>");
      await sendMail(base44, {
        kind: "zamowienie_admin",
        ref: stored.id,
        to: admin,
        subject: `Nowe zam\xF3wienie: ${Number(stored.total || 0).toFixed(2).replace(".", ",")} z\u0142`,
        html: `<p>${String(stored.buyer_name || "").replace(/</g, "&lt;")} (${String(stored.buyer_email || "").replace(/</g, "&lt;")})</p><p>${list}</p><p>Numer: ${String(stored.id).slice(0, 8).toUpperCase()}</p>${stored.invoice?.nip ? `<p><b>Faktura</b>: ${String(stored.invoice.company).replace(/</g, "&lt;")}, NIP ${String(stored.invoice.nip)}, ${String(stored.invoice.address).replace(/</g, "&lt;")}</p>` : ""}<p>Panel: Zam\xF3wienia.</p>${(issued.overbooked || []).map((o) => `<p style="color:#b00;"><b>Uwaga \u2014 nadkomplet:</b> \u201E${String(o.title).replace(/</g, "&lt;")}\u201D ma ${o.sold} bilet\xF3w przy limicie ${o.capacity}. Bilety z tego zam\xF3wienia s\u0105 op\u0142acone i wa\u017Cne \u2014 zdecyduj: dodatkowe miejsce albo zwrot (Panel \u2192 Spotkania \u2192 BILETY).</p>`).join("")}`
      });
    }
  } catch {
  }
  try {
    await grantThresholdPackage(base44, stored);
  } catch {
  }
  try {
    await issueInvoice(base44, stored);
  } catch (e) {
    console.error("faktura:", e?.message);
  }
}

// supabase/functions/cmsScheduled/index.ts
async function retryFreeOrders(base44) {
  const rows = await runSql(base44, `SELECT payu_order_id FROM public.orders WHERE status = 'PENDING' AND payu_order_id LIKE 'FREE-%'
    AND created_date < now() - interval '3 minutes' AND created_date > now() - interval '1 day' ORDER BY created_date LIMIT 5`, true);
  let done = 0;
  for (const r of rows) {
    const order = await getOrderByPayuId(base44, r.payu_order_id);
    if (order && await claimCompletion(base44, r.payu_order_id)) {
      await fulfillOrder(base44, order, r.payu_order_id).then(() => done++).catch((e) => console.error("zam\xF3wienie 0 z\u0142:", e?.message));
    }
  }
  return done;
}
var lastHygiene = "";
async function pruneSnapshots(base44) {
  const lock = await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date)
      VALUES ('snap_prune', jsonb_build_object('at', now()), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
      WHERE public.app_settings.updated_date < now() - interval '1 day'
    RETURNING key`).catch(() => []);
  if (!lock?.length) return 0;
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const rows = await ent.list("-refreshed_at", 1e3).catch(() => []);
  const cutoff = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const seen = /* @__PURE__ */ new Set();
  const del = [];
  for (const r of rows || []) {
    const k = String(r.key || "");
    const oldDay = /^products:\d{4}-\d{2}-\d{2}$/.test(k) && k.slice(9) < cutoff;
    if (oldDay || seen.has(k)) del.push(r.id);
    else seen.add(k);
  }
  let n = 0;
  for (const id of del.slice(0, 100)) {
    await ent.delete(id).then(() => n++).catch(() => {
    });
  }
  return n;
}
async function waitlistHygiene(base44) {
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (lastHygiene === day) return;
  lastHygiene = day;
  await runSql(base44, `ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS notified_at timestamptz`);
  await runSql(base44, `DELETE FROM public.waitlist WHERE (notified_at IS NOT NULL AND notified_at < now() - interval '90 days')
    OR (notified_at IS NULL AND created_at < now() - interval '12 months')`);
  const snaps = base44.asServiceRole.entities.PublicSnapshot;
  const old = await snaps.filter({ key: { $regex: "^products:" } }, "-refreshed_at", 200).catch(() => []);
  const keep = `products:${warsawToday()}`;
  await Promise.all(old.filter((r) => r.key !== keep).map((r) => snaps.delete(r.id).catch(() => {
  })));
}
async function releaseDue(base44) {
  await ensureWaitlistCols(base44);
  const due = await runSql(base44, `UPDATE public.products SET status = 'dost\u0119pny', available_at = COALESCE(available_at, now()),
      release_at = NULL, release_notify = TRUE
    WHERE status = 'wkr\xF3tce' AND active = TRUE AND release_at IS NOT NULL AND release_at <= now() RETURNING slug`);
  if (due.length) await clearSnap(base44, "products:").catch(() => {
  });
  const ready = await requireMail(base44).then(() => true).catch(() => false);
  if (!ready) return due.map((r) => r.slug);
  const pend = await runSql(base44, `SELECT id, release_note FROM public.products WHERE release_notify = TRUE LIMIT 5`, true);
  for (const p of pend) {
    const r = await notifyBatch(base44, p.id, String(p.release_note || ""), 40).catch(() => ({ left: 0 }));
    if (!r.left) await runSql(base44, `UPDATE public.products SET release_notify = FALSE WHERE id = ${escStr(p.id)}`);
  }
  return due.map((r) => r.slug);
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const me2 = await base44.auth.me().catch(() => null);
    let allowed = me2?.role === "admin";
    if (!allowed) {
      const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
      const stored = rows?.[0]?.tick_token;
      const given = typeof body.tick_token === "string" ? body.tick_token : "";
      allowed = !!stored && !!given && safeEqual(given, stored);
    }
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
    const db = base44.asServiceRole.entities;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const due = await db.SitePage.filter({ status: "zaplanowana", publikacja: { $lte: now } }, { limit: 20 });
    const done = [];
    for (const page of due.items) {
      const bloki = page.plan_bloki || page.bloki || [];
      const wersja = (page.wersja || 0) + 1;
      const kto = page.plan_kto || "";
      const opis = `publikacja zaplanowana \xB7 ${bloki.length} blok\xF3w`;
      await db.PublishedPage.upsert([{
        slug: page.slug,
        tytul: page.tytul,
        seo_title: page.seo_title || "",
        seo_description: page.seo_description || "",
        seo_image: page.seo_image || "",
        noindex: !!page.noindex,
        bloki,
        wersja
      }], { key: "slug" });
      await db.SitePage.update(page.id, { status: "opublikowana", wersja, opublikowano_at: now, plan_bloki: [], publikacja: null });
      await db.PageVersion.create({ slug: page.slug, wersja, tytul: page.tytul, bloki, kto, opis });
      await db.ContentLog.create({ page_slug: page.slug, akcja: "publikacja", wersja, kto, opis });
      done.push(page.slug);
    }
    const patched = await applyDataPatches(base44).catch((e) => {
      console.error("poprawki danych:", e.message);
      return [];
    });
    const prices = await recordPrices(base44, patched.length > 0).catch(() => -1);
    await waitlistHygiene(base44).catch(() => {
    });
    const released = await releaseDue(base44).catch((e) => {
      console.error("premiera:", e.message);
      return [];
    });
    await loadAppUrl(base44).catch(() => {
    });
    const freeDone = await retryFreeOrders(base44).catch((e) => {
      console.error("zam\xF3wienia 0 z\u0142:", e.message);
      return 0;
    });
    const pruned = await pruneSnapshots(base44).catch((e) => {
      console.error("kopie:", e.message);
      return 0;
    });
    const ready = await requireMail(base44).then(() => true).catch(() => false);
    const reminded = ready ? await unpaidReminders(base44).catch((e) => {
      console.error("przypomnienia:", e.message);
      return 0;
    }) : 0;
    return Response.json({ ok: true, published: done, prices, released, reminded, patched, freeDone, pruned });
  } catch (error) {
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
