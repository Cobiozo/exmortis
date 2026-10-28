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
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

// supabase/functions/_shared/mirror.ts
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
async function consentFilter(base44, query = {}, sort, limit) {
  try {
    return await mirrorFilter(base44, "Consent", query, sort, limit);
  } catch (e) {
    console.error("odczyt:Consent:", String(e?.message || e).slice(0, 200));
    return base44.asServiceRole.entities.Consent.filter(query, sort, limit);
  }
}

// supabase/functions/_shared/libraryAccess.ts
var moveLibraryEmail = (base44, oldEmail, newEmail) => rpc(base44, "mb_move_email", { p_old: String(oldEmail || ""), p_new: String(newEmail || "") });
function safeEqual(a, b) {
  const x = String(a == null ? "" : a);
  const y = String(b == null ? "" : b);
  if (!x.length || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
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

// supabase/functions/_shared/libraryNotify.ts
var libLog = (base44, actor, action, objectType, objectId, summary) => rpc(base44, "mb_log_add", {
  p_actor: String(actor || "system").slice(0, 200),
  p_action: String(action || "").slice(0, 60),
  p_object_type: objectType || null,
  p_object_id: objectId ? String(objectId) : null,
  p_summary: summary ? String(summary).slice(0, 500) : null
});

// supabase/functions/emailChange/index.ts
var TTL_H = 48;
var MAX_PROBY = 8;
var SB = {
  registrations: "email",
  contact_messages: "email",
  podcast_applications: "email",
  powrot_applications: "email",
  quiz_result: "email",
  subscribers: "email",
  campaign_recipients: "email",
  users: "email",
  waitlist: "email",
  webinar_1_11: "email"
};
var APP = {
  Access: "user_email",
  ActiveStream: "user_email",
  LessonProgress: "user_email",
  ObokOdsluch: "user_email",
  ObokUczestnik: "user_email",
  PlaybackLog: "user_email",
  SecurityLog: "user_email",
  ContactMessage: "email",
  PodcastApplication: "email",
  PodcastGuest: "email",
  PowrotApplication: "email",
  PendingRegistration: "email"
};
var KEEP = { orders: "buyer_email", Consent: "email", License: "user_email", Withdrawal: "email" };
var lc = (s) => String(s || "").trim().toLowerCase();
var rx = (e) => ({ $regex: `^${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" });
var mask = (e) => {
  const [u, d] = String(e || "").split("@");
  return d ? `${u.slice(0, 2)}***@${d}` : "\u2014";
};
async function sha(t) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
var enabled = async (b) => (await getSetting(b, "zmiana_email").catch(() => null))?.wlaczona !== false;
var wrap = (h) => `<div style="font-family:Arial,sans-serif;background:#0A0A0B;color:#E2E2E2;padding:32px"><p style="color:#C9A24A;letter-spacing:3px;font-size:12px">EXMORTIS</p>${h}</div>`;
async function collect(base44, email) {
  const sr = base44.asServiceRole.entities;
  const sb = {}, app = {}, keep = {};
  await Promise.all(Object.entries(SB).map(async ([t, c]) => {
    sb[t] = await runSql(base44, `SELECT * FROM public.${t} WHERE lower(${c}) = ${escStr(email)}`, true);
  }));
  keep.orders = (await runSql(base44, `SELECT id FROM public.orders WHERE lower(buyer_email) = ${escStr(email)}`, true)).length;
  for (const [e, f] of Object.entries(APP)) app[e] = await sr[e].filter({ [f]: rx(email) }, "-created_date", 5e3);
  for (const e of ["Consent", "License", "Withdrawal"]) keep[e] = (await (e === "Consent" ? consentFilter(base44, { [KEEP[e]]: rx(email) }, "-created_date", 5e3) : sr[e].filter({ [KEEP[e]]: rx(email) }, "-created_date", 5e3))).length;
  const user = (await sr.User.filter({ email }))[0] || null;
  return { sb, app, keep, user };
}
function planOf(d) {
  return [
    ...Object.entries(d.sb).map(([t, r]) => ({ baza: "Supabase", zbior: t, liczba: r.length, akcja: "przeniesienie" })),
    ...Object.entries(d.app).map(([e, r]) => ({ baza: "Aplikacja", zbior: e, liczba: r.length, akcja: "przeniesienie" })),
    { baza: "Supabase", zbior: "orders", liczba: d.keep.orders, akcja: "zostaje (adres na dokumentach), dost\u0119py przechodz\u0105" },
    { baza: "Aplikacja", zbior: "Consent", liczba: d.keep.Consent, akcja: "bez zmian + adnotacja" },
    { baza: "Aplikacja", zbior: "License", liczba: d.keep.License, akcja: "zostaje (dokument)" },
    { baza: "Aplikacja", zbior: "Withdrawal", liczba: d.keep.Withdrawal, akcja: "zostaje (dokument)" },
    { baza: "Aplikacja", zbior: "Konto i rola", liczba: d.user ? 1 : 0, akcja: d.user ? `rola \u201E${d.user.role}\u201D \u2192 nowe konto, stare zablokowane` : "brak konta" }
  ].filter((x) => x.liczba > 0);
}
async function newUser(base44, email) {
  return (await base44.asServiceRole.entities.User.filter({ email }))[0] || null;
}
async function transfer(base44, ch) {
  const sr = base44.asServiceRole.entities;
  const o = ch.old_email, n = ch.new_email;
  const nu = await newUser(base44, n);
  if (!nu) throw new Error("Nowe konto jeszcze nie istnieje (zaproszenie nieprzyj\u0119te).");
  if (!ch.kopia) {
    const d = await collect(base44, o);
    const consents = await sr.Consent.filter({ email: rx(o) }, "-created_date", 5e3);
    const kopia = {
      old_email: o,
      new_email: n,
      supabase: d.sb,
      aplikacja: d.app,
      consent_ids: consents.map((c) => c.id),
      konto_stare: d.user ? { id: d.user.id, role: d.user.role, imie: d.user.imie || null } : null,
      konto_nowe: { id: nu.id, role: nu.role }
    };
    await sr.EmailChange.update(ch.id, { kopia, kopia_at: (/* @__PURE__ */ new Date()).toISOString(), plan: planOf(d) });
    ch.kopia = kopia;
  }
  await sr.EmailChange.update(ch.id, { status: "przenoszenie" });
  for (const [t, c] of Object.entries(SB)) {
    await runSql(base44, `UPDATE public.${t} SET ${c} = ${escStr(n)} WHERE lower(${c}) = ${escStr(o)}`);
  }
  for (const [e, f] of Object.entries(APP)) {
    const ids = (ch.kopia.aplikacja[e] || []).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) await sr[e].updateMany({ id: { $in: ids.slice(i, i + 500) } }, { $set: { [f]: n } });
  }
  try {
    await moveLibraryEmail(base44, o, n);
  } catch (e) {
    await libLog(base44, "zmiana_adresu", "biblioteka_blad", "klient", null, "danych biblioteki nie przeniesiono").catch(() => {
    });
  }
  const done = new Set((await sr.ConsentNote.filter({ change_id: ch.id }, "-created_date", 5e3)).map((x) => x.consent_id));
  const date = (/* @__PURE__ */ new Date()).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
  const notes = ch.kopia.consent_ids.filter((id) => !done.has(id)).map((id) => ({ consent_id: id, change_id: ch.id, text: `adres zmieniony z ${o} na ${n}, ${date}` }));
  if (notes.length) await sr.ConsentNote.bulkCreate(notes);
  const old = ch.kopia.konto_stare;
  await sr.User.update(nu.id, { role: old?.role && old.role !== "zablokowane" ? old.role : "user", ...old?.imie ? { imie: old.imie } : {} });
  if (old) await sr.User.update(old.id, { role: "zablokowane" });
  await sr.EmailChange.update(ch.id, { status: "przeniesiono", przeniesiono_at: (/* @__PURE__ */ new Date()).toISOString(), blad: null });
  await sendMail(base44, { to: o, kind: "zmiana_email", subject: "exmortis: adres e-mail konta zosta\u0142 zmieniony", html: wrap(`<p>Adres e-mail konta zosta\u0142 zmieniony.</p>`) }).catch(() => {
  });
}
async function restore(base44, ch) {
  const sr = base44.asServiceRole.entities;
  const k = ch.kopia;
  if (!k) throw new Error("Brak kopii.");
  for (const [t, c] of Object.entries(SB)) {
    const rows = k.supabase[t] || [];
    if (!rows.length) continue;
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length) await runSql(base44, `UPDATE public.${t} SET ${c} = ${escStr(k.old_email)} WHERE id IN (${ids.map(escStr).join(",")})`);
    else await runSql(base44, `UPDATE public.${t} SET ${c} = ${escStr(k.old_email)} WHERE lower(${c}) = ${escStr(k.new_email)}`);
  }
  for (const [e, f] of Object.entries(APP)) {
    const ids = (k.aplikacja[e] || []).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) await sr[e].updateMany({ id: { $in: ids.slice(i, i + 500) } }, { $set: { [f]: k.old_email } });
  }
  await sr.ConsentNote.deleteMany({ change_id: ch.id });
  if (k.konto_stare) await sr.User.update(k.konto_stare.id, { role: k.konto_stare.role });
  if (k.konto_nowe) await sr.User.update(k.konto_nowe.id, { role: k.konto_nowe.role === "zablokowane" ? "user" : k.konto_nowe.role }).catch(() => {
  });
  await sr.EmailChange.update(ch.id, { status: "przywrocono", przywrocono_at: (/* @__PURE__ */ new Date()).toISOString() });
}
var view = (c) => ({
  id: c.id,
  old: mask(c.old_email),
  new: c.new_email ? mask(c.new_email) : null,
  status: c.status,
  kto: c.kto,
  created_date: c.created_date,
  expires_at: c.expires_at,
  plan: c.plan || null,
  ma_kopie: !!c.kopia,
  kopia_at: c.kopia_at || null,
  blad: c.blad || null,
  proby: c.proby || 0
});
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    if (body.action === "check" || body.action === "submit") {
      const ch2 = (await sr.EmailChange.filter({ token_hash: await sha(String(body.t || "")) }))[0];
      const valid = ch2 && ch2.status === "wyslano" && new Date(ch2.expires_at) > /* @__PURE__ */ new Date();
      if (ch2 && ch2.status === "wyslano" && !valid) await sr.EmailChange.update(ch2.id, { status: "wygaslo" });
      if (!valid) return Response.json({ error: "Link wygas\u0142 albo zosta\u0142 ju\u017C u\u017Cyty." }, { status: 410 });
      if (body.action === "check") return Response.json({ ok: true });
      const a = lc(body.email1), b = lc(body.email2);
      if (!EMAIL_RE.test(a)) return Response.json({ error: "Podaj poprawny adres e-mail." }, { status: 400 });
      if (a !== b) return Response.json({ error: "Adresy nie s\u0105 takie same." }, { status: 400 });
      if (a === ch2.old_email) return Response.json({ error: "To jest obecny adres." }, { status: 400 });
      if (await newUser(base44, a)) return Response.json({ error: "Ten adres jest ju\u017C u\u017Cywany." }, { status: 400 });
      await sr.EmailChange.update(ch2.id, { new_email: a, status: "podano", podano_at: (/* @__PURE__ */ new Date()).toISOString(), token_hash: "uzyty:" + ch2.id });
      return Response.json({ ok: true });
    }
    if (body.action === "tick") {
      const who = await base44.auth.me().catch(() => null);
      if (who?.role !== "admin") {
        const tk = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
        const stored = tk?.[0]?.tick_token || "";
        const given = typeof body.tick_token === "string" ? body.tick_token : "";
        if (!stored || !given || !await safeEqual(given, stored)) return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const lock = await runSql(
        base44,
        `INSERT INTO public.app_settings (key, value, updated_date)
           VALUES ('email_change_tick', jsonb_build_object('at', now()), now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
           WHERE public.app_settings.updated_date < now() - interval '240 seconds'
         RETURNING key`
      ).catch(() => [{ key: "email_change_tick" }]);
      if (!lock || !lock.length) return Response.json({ ok: true, skipped: true });
      const open = await sr.EmailChange.filter({ status: { $in: ["podano", "przenoszenie", "blad"] } }, "created_date", 50);
      let accepted = 0, moved = 0;
      for (const c of open) {
        if (c.status === "podano") {
          if (await newUser(base44, c.new_email)) {
            await sr.EmailChange.update(c.id, { status: "przyjeto" });
            accepted++;
          }
          continue;
        }
        if ((c.proby || 0) >= MAX_PROBY) continue;
        try {
          await transfer(base44, c);
          moved++;
        } catch (e) {
          await sr.EmailChange.update(c.id, { status: "blad", proby: (c.proby || 0) + 1, blad: String(e?.message || e).slice(0, 300) });
        }
      }
      const stale = await sr.EmailChange.filter({ status: "wyslano", expires_at: { $lt: (/* @__PURE__ */ new Date()).toISOString() } }, "created_date", 200);
      for (const c of stale) await sr.EmailChange.update(c.id, { status: "wygaslo" });
      return Response.json({ ok: true, accepted, moved, expired: stale.length });
    }
    const me2 = await requireAdmin(base44);
    for (const c of (await sr.EmailChange.filter({ status: "podano" }, "created_date", 50)).filter((x) => !x.zaproszono_at)) {
      await base44.users.inviteUser(c.new_email, "user").then(() => sr.EmailChange.update(c.id, { zaproszono_at: (/* @__PURE__ */ new Date()).toISOString() })).catch((e) => sr.EmailChange.update(c.id, { blad: `Zaproszenie: ${String(e?.message || e).slice(0, 200)}` }));
    }
    if (body.action === "settings") {
      if (typeof body.wlaczona === "boolean") await saveSetting(base44, "zmiana_email", { wlaczona: body.wlaczona });
      return Response.json({ wlaczona: await enabled(base44) });
    }
    if (body.action === "log") {
      const rows = await sr.EmailChange.filter({}, "-created_date", 100);
      return Response.json({ log: rows.map(view) });
    }
    if (body.action === "aliases") {
      const e = lc(body.email);
      const rows = [...await sr.EmailChange.filter({ old_email: e, status: "przeniesiono" }), ...await sr.EmailChange.filter({ new_email: e, status: "przeniesiono" })];
      return Response.json({ aliases: rows.map((r) => ({ old: r.old_email, new: r.new_email, at: r.przeniesiono_at })) });
    }
    const email = lc(body.email);
    if (body.action === "state") {
      const [mail, on] = [mailReady(await mailConfig(base44)), await enabled(base44)];
      let ch2 = (await sr.EmailChange.filter({ old_email: email }, "-created_date", 1))[0] || null;
      if (ch2?.status === "podano" && await newUser(base44, ch2.new_email)) {
        await sr.EmailChange.update(ch2.id, { status: "przyjeto" });
        ch2 = { ...ch2, status: "przyjeto" };
      }
      if (ch2?.status === "wyslano" && new Date(ch2.expires_at) < /* @__PURE__ */ new Date()) {
        await sr.EmailChange.update(ch2.id, { status: "wygaslo" });
        ch2 = { ...ch2, status: "wygaslo" };
      }
      return Response.json({ mail, on, change: ch2 ? view(ch2) : null });
    }
    if (body.action === "start") {
      if (!await enabled(base44)) return Response.json({ error: "Funkcja wy\u0142\u0105czona w ustawieniach." }, { status: 400 });
      if (!mailReady(await mailConfig(base44))) return Response.json({ error: "Wymaga skonfigurowanej wysy\u0142ki e-mail" }, { status: 400 });
      if (!EMAIL_RE.test(email)) return Response.json({ error: "Z\u0142y adres." }, { status: 400 });
      const open = await sr.EmailChange.filter({ old_email: email, status: { $in: ["wyslano", "podano", "przyjeto", "przenoszenie", "blad"] } });
      for (const c of open.filter((c2) => c2.status === "wyslano")) await sr.EmailChange.update(c.id, { status: "wygaslo" });
      if (open.some((c) => c.status !== "wyslano")) return Response.json({ error: "Dla tej osoby trwa ju\u017C zmiana adresu." }, { status: 400 });
      const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
      const ch2 = await sr.EmailChange.create({
        old_email: email,
        token_hash: await sha(token),
        status: "wyslano",
        kto: me2.email,
        expires_at: new Date(Date.now() + TTL_H * 36e5).toISOString(),
        test: body.test === true
      });
      const url = `${await loadAppUrl(base44)}/zmiana-adresu?t=${token}`;
      const r = await sendMail(base44, {
        to: email,
        kind: "zmiana_email",
        ref: ch2.id,
        subject: "exmortis: zmiana adresu e-mail konta",
        html: wrap(`<p>Na Twoj\u0105 pro\u015Bb\u0119 mo\u017Cesz zmieni\u0107 adres e-mail konta. Kliknij, aby poda\u0107 nowy adres.</p><p><a href="${url}" style="display:inline-block;background:#C9A24A;color:#0A0A0B;padding:12px 24px;text-decoration:none">PODAJ NOWY ADRES</a></p><p style="color:#8A8A8C;font-size:12px">Link jest jednorazowy i wa\u017Cny 48 godzin.</p>`)
      });
      return Response.json({ ok: true, sent: r, ...body.test === true ? { test_token: token } : {} });
    }
    const ch = body.id ? await sr.EmailChange.get(body.id) : null;
    if (!ch) return Response.json({ error: "Nie znaleziono procesu." }, { status: 404 });
    if (body.action === "plan") {
      const d = await collect(base44, ch.old_email);
      return Response.json({ plan: planOf(d), nowe_konto: !!(ch.new_email && await newUser(base44, ch.new_email)) });
    }
    if (body.action === "transfer") {
      if (!["przyjeto", "blad"].includes(ch.status)) return Response.json({ error: "Zaproszenie nie zosta\u0142o jeszcze przyj\u0119te." }, { status: 400 });
      try {
        await transfer(base44, ch);
      } catch (e) {
        await sr.EmailChange.update(ch.id, { status: "blad", proby: (ch.proby || 0) + 1, blad: String(e?.message || e).slice(0, 300) });
        return Response.json({ error: `Przeniesienie przerwane, ponowi\u0119 automatycznie: ${e?.message || e}` }, { status: 500 });
      }
      return Response.json({ ok: true });
    }
    if (body.action === "backup") return Response.json({ kopia: ch.kopia || null });
    if (body.action === "restore") {
      await restore(base44, ch);
      return Response.json({ ok: true });
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
