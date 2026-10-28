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
async function accessFilter(base44, query = {}, sort, limit) {
  try {
    return await mirrorFilter(base44, "Access", query, sort, limit);
  } catch (e) {
    console.error("odczyt:Access:", String(e?.message || e).slice(0, 200));
    return base44.asServiceRole.entities.Access.filter(query, sort, limit);
  }
}

// supabase/functions/_shared/announce.ts
function annStatus(a, now = Date.now()) {
  if (!a.opublikowane) return "Szkic";
  if (a.zakonczono_at || a.do && new Date(a.do).getTime() <= now) return "Zako\u0144czone";
  if (a.od && new Date(a.od).getTime() > now) return "Zaplanowane";
  return "Aktywne";
}
async function audienceSets(sr, base44, me2, all) {
  const email = String(me2?.email || "").toLowerCase();
  const idsOf = (typ) => [...new Set(all.filter((a) => a.odbiorcy === typ && a.cel_id).map((a) => String(a.cel_id)))];
  const prodIds = idsOf("produkt"), obokIds = idsOf("obok"), evIds = idsOf("spotkanie");
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const [acc, obok, regs] = await Promise.all([
    prodIds.length ? accessFilter(base44, { user_email: email, product_id: { $in: prodIds } }, "-created_date", 500) : [],
    obokIds.length ? sr.entities.ObokUczestnik.filter({ user_email: email, seria_id: { $in: obokIds } }, "-created_date", 500) : [],
    evIds.length ? runSql(base44, `SELECT DISTINCT event_id::text AS id FROM public.registrations
           WHERE lower(email) = ${escStr(email)} AND status IN ('Zapisany','Obecny','Lista rezerwowa')
             AND event_id::text IN (${evIds.map(escStr).join(",")})`, true).catch(() => []) : []
  ]);
  return {
    produkt: new Set(acc.filter((r) => !r.valid_until || r.valid_until >= today).map((r) => String(r.product_id))),
    obok: new Set(obok.map((r) => String(r.seria_id))),
    spotkanie: new Set((regs || []).map((r) => String(r.id)))
  };
}
async function myAnnouncements(sr, base44, me2) {
  const A = sr.entities.Announcement, S = sr.entities.AnnouncementSeen;
  const all = (await A.filter({ opublikowane: true }, "-created_date", 200)).filter((a) => annStatus(a) === "Aktywne");
  const sets = await audienceSets(sr, base44, me2, all);
  const mine = all.filter((a) => a.odbiorcy === "wszyscy" || !!sets[a.odbiorcy]?.has(String(a.cel_id)));
  const seen = mine.length ? await S.filter({ user_id: me2.id, ann_id: { $in: mine.map((a) => a.id) } }, "-created_date", 500) : [];
  const by = Object.fromEntries(seen.map((s) => [s.ann_id, s]));
  return { items: mine.filter((a) => !by[a.id]?.dismissed_at), seen: by };
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
var MAX_BYTES = { PDF: 100 * 1024 * 1024, AUDIO: 500 * 1024 * 1024, WIDEO: 500 * 1024 * 1024 };
var ALLOWED_EXT = { PDF: ["pdf"], AUDIO: ["mp3", "m4a"], WIDEO: ["mp4", "m4v", "webm"] };
var VIDEO_FILE_EXT = ALLOWED_EXT.WIDEO;

// supabase/functions/_shared/smtp.ts
import nodemailer2 from "npm:nodemailer@6.9.13";

// supabase/functions/_shared/settings.ts
var DEFAULT_APP_URL = globalThis.Deno?.env?.get?.("APP_URL") || "";

// supabase/functions/_shared/smtp.ts
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
async function messagesData(base44, email, me2, preview) {
  const raw = await rpc(base44, "mb_client_messages", { p_email: String(email || ""), p_preview: !!preview });
  return messagesFromRpc(raw, me2);
}

// supabase/functions/notifications/index.ts
var DAY = 864e5;
var NEW_DAYS = 30;
var DEFAULT_PREFS = { nowosci: true, promocje: true, spotkania: true };
var CAT = {
  ogloszenie: "zawsze",
  produkt: "nowosci",
  wkrotce: "nowosci",
  historia: "nowosci",
  promocja: "promocje",
  kod: "promocje",
  spotkanie: "spotkania",
  moje_spotkanie: "moje",
  nagranie: "moje",
  dostep: "moje",
  wiadomosc: "moje",
  obok: "moje",
  lista: "moje",
  zamowienie: "moje",
  platnosc: "moje",
  lekcja: "moje",
  opinia: "moje",
  test: "moje"
};
var PENDING = ["NEW", "PENDING", "WAITING_FOR_CONFIRMATION"];
var names = (items) => {
  const n = (Array.isArray(items) ? items : []).map((i) => i?.name).filter(Boolean);
  return n.length > 2 ? `${n.slice(0, 2).join(", ")} i ${n.length - 2} wi\u0119cej` : n.join(", ");
};
var iso = (v) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
var zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} z\u0142`;
var plDate = (d) => (/* @__PURE__ */ new Date(`${String(d).slice(0, 10)}T12:00:00Z`)).toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "Europe/Warsaw" });
var hm = (v) => new Date(v).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
var wDay = (v) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date(v));
function whenEvent(v) {
  const today = warsawToday(), d = wDay(v), tomorrow = wDay(Date.now() + DAY);
  if (d === today) return `dzi\u015B o ${hm(v)}`;
  if (d === tomorrow) return `jutro o ${hm(v)}`;
  return `${new Date(v).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" })}, ${hm(v)}`;
}
var G = null;
async function globalData(base44) {
  if (G && Date.now() - G.at < 3e5) return G.v;
  const sr = base44.asServiceRole.entities;
  const [products, events, codes, stories] = await Promise.all([
    runSql(base44, `SELECT id::text AS id, name, slug, subtitle, promise, COALESCE(status, 'dost\u0119pny') AS status, is_free,
        price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
        promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps,
        COALESCE((to_jsonb(p)->>'available_at')::timestamptz, created_date::timestamptz) AS since,
        created_date::timestamptz AS created
      FROM public.products p WHERE active = TRUE AND COALESCE(status, 'dost\u0119pny') <> 'ukryty'`, true).catch(() => []),
    runSql(base44, `SELECT e.id::text AS id, e.title, e.slug, e.start_datetime,
        COALESCE((to_jsonb(e)->>'created_at')::timestamptz, (to_jsonb(e)->>'created_date')::timestamptz) AS created
      FROM public.events e WHERE e.status = 'Opublikowane' AND e.start_datetime > now() AND e.start_datetime < now() + interval '60 days'
      ORDER BY e.start_datetime ASC LIMIT 40`, true).catch(() => []),
    sr.DiscountCode.filter({ active: true, w_powiadomieniach: true }, "-created_date", 20).catch(() => []),
    sr.RozdrozaStory.filter({ status: "published" }, "-updated_date", 100).catch(() => [])
  ]);
  const today = warsawToday();
  const promo = (products || []).map((p) => withSteps(p)).filter((p) => p.status === "dost\u0119pny" && !p.is_free && p.price_start != null && p.promo_end_date && String(p.promo_end_date).slice(0, 10) >= today);
  const hist = promo.length ? await runSql(base44, `SELECT product_id, day::text AS day, price::float8 AS price FROM public.product_price_daily
      WHERE product_id IN (${promo.map((p) => escStr(p.id)).join(",")}) AND day > (now() AT TIME ZONE 'Europe/Warsaw')::date - 90 ORDER BY day DESC`, true).catch(() => []) : [];
  for (const p of promo) {
    const cur = unitPrice(p);
    let start = null;
    for (const h of hist.filter((h2) => h2.product_id === p.id)) {
      if (Math.abs(h.price - cur) < 5e-3) start = h.day;
      else break;
    }
    p.promo_from = start ? `${start}T08:00:00Z` : iso(p.since);
  }
  const v = { products: products || [], promo, events: events || [], codes, stories };
  G = { at: Date.now(), v };
  return v;
}
async function buildFeed(base44, me2) {
  const sr = base44.asServiceRole.entities;
  const email = clientEmail(me2);
  const now = Date.now();
  const recent = (v, days = NEW_DAYS) => {
    const t = v ? new Date(v).getTime() : 0;
    return t > now - days * DAY && t <= now + 6e4;
  };
  const g3 = await globalData(base44);
  const out = [];
  const push = (x) => {
    if (x.at) out.push(x);
  };
  const [anns, regs, access, msgs, obok, waits, orders, revOrders, myRevs] = await Promise.all([
    myAnnouncements(base44.asServiceRole, base44, me2).catch(() => ({ items: [], seen: {} })),
    runSql(base44, `SELECT e.id::text AS id, e.title, e.slug, e.start_datetime, r.status AS reg_status, e.recording_until,
        (e.recording_url IS NOT NULL AND e.recording_until IS NOT NULL AND e.recording_until > now()
          AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') < now()) AS rec_open,
        e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') AS ends
      FROM public.registrations r JOIN public.events e ON e.id = r.event_id
      WHERE lower(r.email) = ${escStr(email)} AND r.status IN ('Zapisany','Obecny','Lista rezerwowa')
        AND e.status = 'Opublikowane' AND e.start_datetime > now() - interval '30 days'`, true).catch(() => []),
    sr.Access.filter({ user_email: email }, "-created_date", 200).catch(() => []),
    (async () => {
      const s = await libSettings(base44).catch(() => null);
      if (!s || !modeVisible(s.messages_mode, me2)) return [];
      return (await messagesData(base44, email, me2, false)).items.filter((m) => !m.read_at).slice(0, 5);
    })().catch(() => []),
    (async () => {
      const mine = await sr.ObokUczestnik.filter({ user_email: email }, "-created_date", 50);
      if (!mine.length) return [];
      const ids = [...new Set(mine.map((u) => u.seria_id))];
      const [recs, series] = await Promise.all([
        sr.ObokNagranie.filter({ seria_id: { $in: ids }, status: "opublikowane" }, "-publikacja", 50),
        sr.ObokSeria.filter({ id: { $in: ids } }, "nazwa", 50)
      ]);
      const slug = Object.fromEntries(series.map((s) => [s.id, s.slug]));
      return recs.filter((r) => recent(r.publikacja, 14) && slug[r.seria_id]).map((r) => ({ ...r, seria_slug: slug[r.seria_id] }));
    })().catch(() => []),
    // Moja lista oczekujących i zamówienia z ostatnich 14 dni (płatne).
    runSql(base44, `SELECT DISTINCT product_id::text AS id FROM public.waitlist WHERE lower(email) = ${escStr(email)}`, true).catch(() => []),
    runSql(base44, `SELECT id, status, total::float8 AS total, items, created_date::timestamptz AS created, updated_date::timestamptz AS updated
      FROM public.orders WHERE lower(buyer_email) = ${escStr(email)} AND COALESCE(total, 0) > 0 AND created_date::timestamptz > now() - interval '14 days'
      ORDER BY created_date DESC LIMIT 10`, true).catch(() => []),
    // Opinie: zamówienia opłacone w ostatnich 60 dniach i już wystawione opinie (żeby przypomnienie zniknęło).
    runSql(base44, `SELECT id::text AS id, items, COALESCE(updated_date, created_date)::timestamptz AS paid
      FROM public.orders WHERE lower(buyer_email) = ${escStr(email)} AND status = 'COMPLETED'
        AND COALESCE(updated_date, created_date) > now() - interval '60 days'`, true).catch(() => []),
    runSql(base44, `SELECT order_id, product_id FROM public.product_reviews WHERE lower(email) = ${escStr(email)}`, true).catch(() => [])
  ]);
  for (const a of anns.items) {
    push({
      key: `ann:${a.id}`,
      kind: "ogloszenie",
      title: a.tytul,
      body: a.tresc || "",
      link: a.przycisk_link || "/konto",
      at: iso(a.od || a.created_date),
      important: !!a.wazne,
      ann_id: a.id,
      ann_seen: !!anns.seen[a.id]?.seen_at
    });
  }
  const today = warsawToday();
  const owned = new Set(access.filter((x) => !x.revoked).map((x) => String(x.product_id)));
  const waiting = new Set((waits || []).map((w) => String(w.id)));
  for (const p of g3.products) {
    if (!waiting.has(p.id) || owned.has(p.id) || p.status !== "dost\u0119pny" || !recent(p.since)) continue;
    push({
      key: `wl:${p.id}`,
      kind: "lista",
      title: `Ju\u017C dost\u0119pne: ${p.name}`,
      body: "Ten adres by\u0142 na li\u015Bcie oczekuj\u0105cych \u2014 premiera w\u0142a\u015Bnie si\u0119 odby\u0142a.",
      link: `/skarbiec/${p.slug}`,
      at: iso(p.since),
      important: true
    });
  }
  const paidAfter = (t) => (orders || []).some((o) => o.status === "COMPLETED" && new Date(o.created).getTime() > t);
  for (const o of orders || []) {
    const created2 = new Date(o.created).getTime();
    const what = names(o.items);
    if (o.status === "COMPLETED" && recent(o.updated || o.created, 7)) {
      push({
        key: `order:${o.id}`,
        kind: "zamowienie",
        title: `P\u0142atno\u015B\u0107 przyj\u0119ta${what ? `: ${what}` : ""}`,
        body: `${zl(o.total)} \xB7 materia\u0142y s\u0105 w zak\u0142adce \u201EMoje produkty\u201D.`,
        link: "/konto?tab=produkty",
        at: iso(o.updated || o.created)
      });
    } else if (PENDING.includes(o.status) && now - created2 > 20 * 6e4 && now - created2 < 2 * DAY && !paidAfter(created2)) {
      push({
        key: `pay:${o.id}`,
        kind: "platnosc",
        title: `P\u0142atno\u015B\u0107 niedoko\u0144czona${what ? `: ${what}` : ""}`,
        body: "Je\u015Bli to nie by\u0142o celowe, mo\u017Cesz z\u0142o\u017Cy\u0107 zam\xF3wienie jeszcze raz w Skarbcu. Gdy PayU potwierdzi wcze\u015Bniejsz\u0105 p\u0142atno\u015B\u0107, ta informacja zniknie.",
        link: "/skarbiec",
        at: new Date(created2 + 20 * 6e4).toISOString(),
        important: true
      });
    }
  }
  const reviewed = new Set((myRevs || []).map((r) => `${r.order_id}:${r.product_id}`));
  const revPids = [...new Set((revOrders || []).flatMap((o) => (Array.isArray(o.items) ? o.items : []).map((it) => String(it?.product_id || "")).filter((x) => /^[0-9a-f-]{36}$/i.test(x))))];
  const reviewable = new Set(revPids.length ? (await runSql(base44, `SELECT id::text AS id FROM public.products
    WHERE id::text IN (${revPids.map(escStr).join(",")}) AND COALESCE(product_type, '') <> 'karta'`, true).catch(() => [])).map((r) => String(r.id)) : []);
  for (const o of revOrders || []) {
    const paid = new Date(o.paid).getTime();
    if (!Number.isFinite(paid) || paid > now - 14 * DAY) continue;
    for (const it of Array.isArray(o.items) ? o.items : []) {
      const pid = it?.product_id ? String(it.product_id) : "";
      if (!reviewable.has(pid) || it.gift || reviewed.has(`${o.id}:${pid}`)) continue;
      push({
        key: `rev:${o.id}:${pid}`,
        kind: "opinia",
        title: `Jak Ci si\u0119 czyta/s\u0142ucha \u201E${String(it.name || "").slice(0, 60)}\u201D?`,
        body: "Zostaw opini\u0119 \u2014 kilka zda\u0144. Publikuj\u0119 te\u017C krytyczne, nie p\u0142ac\u0119 za opinie.",
        link: "/konto?tab=zakupy",
        at: new Date(paid + 14 * DAY).toISOString()
      });
    }
  }
  const courses = access.filter((x) => !x.revoked && ["kurs", "wideo"].includes(x.product_type) && (!x.valid_until || x.valid_until >= today));
  if (courses.length) {
    const lessons = await sr.CourseLesson.filter({ product_id: { $in: courses.map((c) => String(c.product_id)) }, published: true }, "-created_date", 100).catch(() => []);
    for (const c of courses) {
      const fresh = lessons.filter((l) => String(l.product_id) === String(c.product_id) && recent(l.created_date, 14) && new Date(l.created_date) > new Date(c.created_date));
      if (!fresh.length) continue;
      push({
        key: `lesson:${c.product_id}:${fresh[0].id}`,
        kind: "lekcja",
        title: fresh.length === 1 ? `Nowa lekcja w \u201E${c.product_name || "kursie"}\u201D: ${fresh[0].title}` : `${fresh.length} ${[2, 3, 4].includes(fresh.length % 10) && ![12, 13, 14].includes(fresh.length % 100) ? "nowe lekcje" : "nowych lekcji"} w \u201E${c.product_name || "kursie"}\u201D`,
        body: "",
        link: `/konto/kurs/${c.id}`,
        at: iso(fresh[0].created_date)
      });
    }
  }
  for (const p of g3.products) {
    if (owned.has(p.id) || waiting.has(p.id) && p.status === "dost\u0119pny") continue;
    if (p.status === "dost\u0119pny" && recent(p.since)) {
      push({
        key: `prod:${p.id}`,
        kind: "produkt",
        title: `${p.is_free ? "Nowy bezp\u0142atny materia\u0142" : "Nowe w Skarbcu"}: ${p.name}`,
        body: p.promise || p.subtitle || "",
        link: `/skarbiec/${p.slug}`,
        at: iso(p.since)
      });
    } else if (p.status === "wkr\xF3tce" && recent(p.created)) {
      push({
        key: `soon:${p.id}`,
        kind: "wkrotce",
        title: `Wkr\xF3tce: ${p.name}`,
        body: waiting.has(p.id) ? "Ten adres jest ju\u017C na li\u015Bcie oczekuj\u0105cych \u2014 dam zna\u0107 w dniu premiery." : "Zapisz si\u0119 na list\u0119 oczekuj\u0105cych \u2014 dam zna\u0107 w dniu premiery.",
        link: `/skarbiec/${p.slug}`,
        at: iso(p.created)
      });
    }
  }
  for (const p of g3.promo) {
    if (owned.has(p.id)) continue;
    const price = unitPrice(p), end = String(p.promo_end_date).slice(0, 10);
    const next = p.next_price ? `, potem ${zl(p.next_price.cena)}` : p.price_regular ? `, potem ${zl(p.price_regular)}` : "";
    push({
      key: `promo:${p.id}:${end}:${price}`,
      kind: "promocja",
      title: `${p.next_price && p.next_price.cena > price ? "Przedsprzeda\u017C" : "Promocja"}: ${p.name} za ${zl(price)}`,
      body: `Ta cena obowi\u0105zuje do ${plDate(end)}${next}.`,
      link: `/skarbiec/${p.slug}`,
      at: p.promo_from
    });
    const endsAt = (/* @__PURE__ */ new Date(`${end}T00:00:00Z`)).getTime() - DAY;
    if (endsAt <= now && end >= today) {
      push({
        key: `promo-end:${p.id}:${end}:${price}`,
        kind: "promocja",
        title: `Ostatnie dni ceny ${zl(price)}: ${p.name}`,
        body: `Do ${plDate(end)} w\u0142\u0105cznie${next}.`,
        link: `/skarbiec/${p.slug}`,
        at: new Date(endsAt).toISOString(),
        important: true
      });
    }
  }
  for (const c of g3.codes) {
    if (c.valid_until && c.valid_until < today) continue;
    if (c.max_uses && (c.uses || 0) >= c.max_uses) continue;
    const val2 = c.kind === "kwota" ? `\u2212${zl(c.value)}` : `\u2212${c.value}%`;
    push({
      key: `code:${c.id}`,
      kind: "kod",
      title: `Kod rabatowy ${c.code}: ${val2}`,
      body: [c.opis ? String(c.opis).replace(/[.!]?\s*$/, ".") : "", c.product_ids?.length ? "Na wybrane produkty." : "Na ca\u0142y Skarbiec.", c.valid_until ? `Wa\u017Cny do ${plDate(c.valid_until)}.` : ""].filter(Boolean).join(" "),
      link: "/skarbiec",
      at: iso(c.created_date),
      code: c.code
    });
  }
  const registered = new Set(regs.map((r) => r.id));
  for (const r of regs) {
    const start = new Date(r.start_datetime).getTime();
    if (start > now && start - now <= DAY && r.reg_status !== "Lista rezerwowa") {
      push({
        key: `ev-soon:${r.id}`,
        kind: "moje_spotkanie",
        title: `${whenEvent(r.start_datetime).replace(/^./, (c) => c.toUpperCase())}: ${r.title}`,
        body: "Link do do\u0142\u0105czenia jest w Twoim koncie (zak\u0142adka Spotkania) i w mailu.",
        link: "/konto?tab=spotkania",
        at: new Date(start - DAY).toISOString(),
        important: true
      });
    }
    if (r.rec_open) {
      push({
        key: `rec:${r.id}:${r.recording_until}`,
        kind: "nagranie",
        title: `Nagranie czeka: ${r.title}`,
        body: `Dost\u0119pne do ${plDate(wDay(r.recording_until))}, ${hm(r.recording_until)}.`,
        link: "/konto?tab=spotkania",
        at: iso(r.ends)
      });
    }
  }
  for (const e of g3.events) {
    if (registered.has(e.id) || !recent(e.created)) continue;
    push({
      key: `ev-new:${e.id}`,
      kind: "spotkanie",
      title: `Nowe spotkanie: ${e.title}`,
      body: whenEvent(e.start_datetime).replace(/^./, (c) => c.toUpperCase()) + ".",
      link: `/spotkania/${e.slug}`,
      at: iso(e.created)
    });
  }
  const in14 = new Date(now + 14 * DAY).toISOString().slice(0, 10);
  for (const a of access) {
    if (a.revoked || !a.valid_until || a.valid_until < today || a.valid_until > in14) continue;
    push({
      key: `access:${a.id}:${a.valid_until}`,
      kind: "dostep",
      title: `Dost\u0119p do \u201E${a.product_name || "materia\u0142u"}\u201D ko\u0144czy si\u0119 ${plDate(a.valid_until)}`,
      body: "Zajrzyj, p\xF3ki mo\u017Cesz \u2014 dost\u0119p mo\u017Cesz te\u017C przed\u0142u\u017Cy\u0107 w Skarbcu.",
      link: "/konto?tab=produkty",
      at: new Date((/* @__PURE__ */ new Date(`${a.valid_until}T00:00:00Z`)).getTime() - 14 * DAY).toISOString(),
      important: a.valid_until <= new Date(now + 3 * DAY).toISOString().slice(0, 10)
    });
  }
  for (const m of msgs) {
    push({
      key: `msg:${m.id}`,
      kind: "wiadomosc",
      title: m.title ? `Wiadomo\u015B\u0107: ${m.title}` : "Nowa wiadomo\u015B\u0107 od Dawida",
      body: "",
      link: "/konto?tab=wiadomosci",
      at: iso(m.sent_at),
      important: true
    });
  }
  const created = me2.created_date ? new Date(me2.created_date).getTime() : NaN;
  if (Number.isFinite(created) && me2.role !== "admin" && now - created < 120 * DAY) {
    const H2 = 36e5;
    const steps = [
      { k: "12h", at: created + 12 * H2, until: created + 30 * DAY },
      { k: "30d", at: created + 30 * DAY, until: created + 90 * DAY },
      { k: "90d", at: created + 90 * DAY, until: created + 120 * DAY }
    ];
    const st = steps.find((s) => s.at <= now && now < s.until);
    if (st) {
      const last = (await runSql(base44, `SELECT max(created_at)::timestamptz AS t FROM public.quiz_result WHERE lower(email) = ${escStr(email)}`, true).catch(() => []))?.[0]?.t;
      const lastT = last ? new Date(last).getTime() : 0;
      const due = st.k === "12h" ? !lastT : lastT < st.at - 14 * DAY;
      if (due) {
        const t = st.k === "12h" || !lastT ? { title: st.k === "12h" ? "Zacznij od kr\xF3tkiego testu" : "Test wci\u0105\u017C na Ciebie czeka", body: "Kilka minut, \u017Ceby zobaczy\u0107, w kt\xF3rym miejscu drogi jeste\u015B teraz. Wynik pojawi si\u0119 od razu." } : { title: st.k === "30d" ? "Min\u0105\u0142 miesi\u0105c \u2014 zr\xF3b test jeszcze raz" : "Trzy miesi\u0105ce drogi \u2014 sprawd\u017A, gdzie jeste\u015B teraz", body: "Por\xF3wnaj wynik z poprzednim i zobacz, co si\u0119 zmieni\u0142o." };
        push({ key: `test:${st.k}`, kind: "test", ...t, link: "/test", at: iso(st.at) });
      }
    }
  }
  for (const s of g3.stories) {
    const from = s.visible_from || s.published_at;
    if (!recent(from, 14)) continue;
    push({ key: `story:${s.id}`, kind: "historia", title: `Nowa historia w ROZDRO\u017BACH: ${s.title}`, body: "", link: `/konto/rozdroza/${s.slug}`, at: iso(from) });
  }
  for (const r of obok) {
    push({ key: `obok:${r.id}`, kind: "obok", title: `Nowe nagranie w Obok: ${r.tytul}`, body: "", link: `/obok/${r.seria_slug}/${r.numer}`, at: iso(r.publikacja) });
  }
  return out.filter((x) => x.at && new Date(x.at).getTime() <= now + 6e4);
}
async function getState(sr, me2) {
  const rows = await sr.NotificationState.filter({ user_id: me2.id }, "-created_date", 2);
  return rows[0] || null;
}
var cacheFeed = /* @__PURE__ */ new Map();
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole.entities;
    const me2 = await base44.auth.me().catch(() => null);
    if (!me2?.id) return Response.json({ error: "Zaloguj si\u0119" }, { status: 401 });
    if (me2.role === "zablokowane") return Response.json({ items: [], unread: 0, prefs: DEFAULT_PREFS });
    const body = await req.json().catch(() => ({}));
    const a = body.action || "feed";
    let st = await getState(sr, me2);
    const save = async (patch) => {
      st = st ? await sr.NotificationState.update(st.id, patch) : await sr.NotificationState.create({ user_id: me2.id, ...patch });
      return st;
    };
    const cap = (arr) => arr.slice(-200);
    if (a === "prefs") {
      const p = body.prefs || {};
      const prefs2 = Object.fromEntries(Object.keys(DEFAULT_PREFS).map((k) => [k, p[k] !== false]));
      await save({ prefs: prefs2 });
      cacheFeed.delete(me2.id);
      return Response.json({ ok: true, prefs: prefs2 });
    }
    const hit = cacheFeed.get(me2.id);
    const all = hit && Date.now() - hit.at < 3e4 ? hit.v : await buildFeed(base44, me2);
    if (!hit || hit.v !== all) cacheFeed.set(me2.id, { at: Date.now(), v: all });
    if (cacheFeed.size > 2e3) cacheFeed.clear();
    if (a === "read" || a === "hide") {
      const key = String(body.key || "").slice(0, 200);
      const item = all.find((x) => x.key === key);
      if (!item) return Response.json({ ok: true });
      const read2 = new Set(st?.read || []);
      read2.add(key);
      const patch = { read: cap([...read2]) };
      if (a === "hide") patch.hidden = cap([.../* @__PURE__ */ new Set([...st?.hidden || [], key])]);
      await save(patch);
      if (item.ann_id) await markAnnSeen(sr, me2, [item.ann_id]);
      return Response.json({ ok: true });
    }
    if (a === "read_all") {
      await save({ seen_at: (/* @__PURE__ */ new Date()).toISOString(), read: [] });
      const ids = all.filter((x) => x.ann_id && !x.ann_seen).map((x) => x.ann_id);
      if (ids.length) await markAnnSeen(sr, me2, ids);
      cacheFeed.delete(me2.id);
      return Response.json({ ok: true });
    }
    const prefs = { ...DEFAULT_PREFS, ...st?.prefs || {} };
    const seenAt = st?.seen_at ? new Date(st.seen_at).getTime() : 0;
    const read = new Set(st?.read || []), hidden = new Set(st?.hidden || []);
    const items = all.filter((x) => !hidden.has(x.key)).filter((x) => {
      const c = CAT[x.kind];
      return c === "zawsze" || c === "moje" || prefs[c] !== false;
    }).map((x) => ({
      key: x.key,
      kind: x.kind,
      title: x.title,
      body: x.body,
      link: x.link,
      at: x.at,
      important: !!x.important,
      code: x.code || null,
      unread: !read.has(x.key) && new Date(x.at).getTime() > seenAt && !(x.ann_id && x.ann_seen)
    })).sort((p, q) => (q.unread ? 1 : 0) - (p.unread ? 1 : 0) || (q.important ? 1 : 0) - (p.important ? 1 : 0) || q.at.localeCompare(p.at)).slice(0, 30);
    return Response.json({ items, unread: items.filter((x) => x.unread).length, prefs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
async function markAnnSeen(sr, me2, ids) {
  const S = sr.AnnouncementSeen;
  const prev = await S.filter({ user_id: me2.id, ann_id: { $in: ids } }, "-created_date", 50).catch(() => []);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const id of ids) {
    const p = prev.find((s) => s.ann_id === id);
    if (p?.seen_at) continue;
    await (p ? S.update(p.id, { seen_at: now }) : S.create({ ann_id: id, user_id: me2.id, seen_at: now })).catch(() => {
    });
  }
}
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
