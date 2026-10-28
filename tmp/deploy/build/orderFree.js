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
function esc(value) {
  if (value === null || value === void 0) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return escStr(value);
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
var TOO_MANY = "Zbyt wiele zg\u0142osze\u0144 z tego po\u0142\u0105czenia. Spr\xF3buj ponownie za godzin\u0119.";

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
async function insertOrder(base44, order) {
  await ensureOrdersTable(base44);
  const itemsJson = JSON.stringify(order.items);
  await runSql(
    base44,
    `INSERT INTO public.orders
       (id, payu_order_id, buyer_name, buyer_email, buyer_phone, note, items, total, status,
        phone_consent_date, newsletter_consent_date, digital_consent_text, digital_consent_date)
     VALUES (${escStr(order.id)}, ${escStr(order.payuOrderId || "")}, ${escStr(order.buyerName || "")},
             ${escStr(order.buyerEmail || "")},
             ${order.buyerPhone ? escStr(order.buyerPhone) : "NULL"},
             ${escStr(order.note || "")},
             ${escStr(itemsJson)}::jsonb, ${esc(order.total)}, ${escStr(order.status)},
             ${order.phoneConsent ? "now()" : "NULL"},
             ${order.newsletterConsent ? "now()" : "NULL"},
             ${order.digitalConsent ? escStr(order.digitalConsent) : "NULL"},
             ${order.digitalConsent ? "now()" : "NULL"})`
  );
  if (order.invoice) {
    try {
      if (await ensureInvoiceColumn(base44)) {
        await runSql(base44, `UPDATE public.orders SET invoice = ${escStr(JSON.stringify(order.invoice))}::jsonb WHERE id = ${escStr(order.id)}`);
      }
    } catch {
    }
  }
  if (order.discountCode) {
    try {
      await ensureDiscountColumn(base44);
      await runSql(base44, `UPDATE public.orders SET discount_code = ${escStr(order.discountCode)} WHERE id = ${escStr(order.id)}`);
    } catch {
    }
  }
}
var INVOICE_COL = false;
async function ensureInvoiceColumn(base44) {
  if (INVOICE_COL) return true;
  const has = await runSql(base44, `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'invoice'`, true);
  if (!(Array.isArray(has) && has.length)) await runSql(base44, `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice jsonb`);
  INVOICE_COL = true;
  return true;
}
var DISCOUNT_COL = false;
async function ensureDiscountColumn(base44) {
  if (DISCOUNT_COL) return true;
  const has = await runSql(base44, `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount_code'`, true);
  if (!(Array.isArray(has) && has.length)) await runSql(base44, `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code text`);
  DISCOUNT_COL = true;
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

// supabase/functions/_shared/newsletter.ts
var esc3 = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var newToken = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
async function addSubscriber(base44, { email, name }) {
  const nameVal = name === void 0 || name === null || String(name).trim() === "" ? "NULL" : escStr(String(name).trim().slice(0, 200));
  const token = newToken();
  const rows = await runSql(
    base44,
    `INSERT INTO public.subscribers (id, email, name, status, confirm_token, confirm_sent_at)
     VALUES (gen_random_uuid()::text, ${escStr(String(email).toLowerCase())}, ${nameVal}, 'pending', ${escStr(token)}, NULL)
     ON CONFLICT (email) DO UPDATE SET
       status = 'pending', confirm_token = EXCLUDED.confirm_token, confirm_sent_at = NULL,
       name = COALESCE(EXCLUDED.name, public.subscribers.name), updated_date = now()
     WHERE public.subscribers.status <> 'active'
     RETURNING id`
  );
  if (rows.length) await sendConfirmMail(base44, { email, name, token }).catch((e) => console.error("Listy: potwierdzenie", e.message));
}
async function sendConfirmMail(base44, { email, name, token }) {
  const url = `${await loadAppUrl(base44)}/listy/potwierdz?t=${token}`;
  await sendMail(base44, {
    kind: "listy_potwierdzenie",
    to: email,
    subject: "Potwierd\u017A zapis na Listy powrotu",
    html: `<div style="background:#0A0A0B;padding:40px 24px;font-family:Cinzel,Georgia,serif;color:#E2E2E2;">
      <div style="max-width:560px;margin:0 auto;">
        <p style="letter-spacing:3px;color:#C9A24A;font-size:12px;">EXMORTIS \xB7 LISTY POWROTU</p>
        <h1 style="font-size:24px;">Potwierd\u017A zapis</h1>
        <p style="font-family:Arial,sans-serif;line-height:1.7;">${name ? esc3(name) + ", " : ""}kto\u015B (mam nadziej\u0119, \u017Ce Ty) zapisa\u0142 ten adres na Listy powrotu, jeden list w ka\u017Cdy poniedzia\u0142ek. \u017Beby zacz\u0105\u0107 je dostawa\u0107, kliknij poni\u017Cej.</p>
        <p style="margin:32px 0;"><a href="${url}" style="background:#C9A24A;color:#0A0A0B;padding:14px 28px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;letter-spacing:2px;">POTWIERDZAM ZAPIS</a></p>
        <p style="font-family:Arial,sans-serif;color:#8A8A8C;font-size:13px;line-height:1.6;">Je\u015Bli to nie Ty, zignoruj t\u0119 wiadomo\u015B\u0107. Bez potwierdzenia adres zostanie usuni\u0119ty po 7 dniach.</p>
      </div></div>`
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
var warsawToday = () => (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
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
  const today = warsawToday();
  const months = product.access_months ? Number(product.access_months) : null;
  let until = null;
  if (months) {
    const live = existing && !existing.revoked && existing.valid_until && existing.valid_until >= today;
    until = addMonths(live ? existing.valid_until : today, months);
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
  } else recId = (await E.create({ ...data, valid_from: today, history: [entry] })).id;
  await mirrorRecord(base44, "Access", recId);
  return until;
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

// supabase/functions/_shared/pdfLicense.ts
import { PDFDocument, StandardFonts, rgb, degrees } from "npm:@cantoo/pdf-lib@2.4.1";
async function personalizePdf(bytes, o) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const label = `${o.email} \xB7 licencja osobista \xB7 zam. ${o.orderNo} \xB7 ${o.date}`;
  const pages = doc.getPages();
  const hidden = /* @__PURE__ */ new Set();
  for (let i = 0; i < Math.min(3, pages.length); i++) hidden.add(Math.floor(Math.random() * pages.length));
  const diag = `${o.email} \xB7 ${o.orderNo}`;
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const color = i === 0 ? rgb(0.96, 0.94, 0.88) : rgb(0.45, 0.45, 0.45);
    const box = page.getCropBox ? page.getCropBox() : { x: 0, y: 0, width, height };
    page.drawText(label, { x: box.x + 4, y: box.y + box.height - 8, size: 7, font, color, opacity: 0.7 });
    page.drawText(label, { x: 14, y: 8, size: 6, font, color, opacity: 0.45 });
    const size = Math.max(14, Math.min(28, Math.hypot(width, height) * 0.7 / Math.max(1, diag.length) * 1.9));
    const tw = font.widthOfTextAtSize(diag, size);
    const ang = Math.atan2(height, width);
    const cx = width / 2 - Math.cos(ang) * tw / 2 + Math.sin(ang) * size / 2;
    const cy = height / 2 - Math.sin(ang) * tw / 2 - Math.cos(ang) * size / 2;
    page.drawText(diag, { x: cx, y: cy, size, font, color: i === 0 ? rgb(1, 1, 1) : rgb(0.5, 0.5, 0.5), opacity: i === 0 ? 0.1 : 0.08, rotate: degrees(ang * 180 / Math.PI) });
    if (hidden.has(i)) page.drawText(`LIC ${o.licenseId}`, { x: 20, y: 20, size: 1, font, color: rgb(1, 1, 1) });
  });
  doc.setAuthor(`exmortis \xB7 licencja ${o.licenseId}`);
  doc.setSubject(`Zam\xF3wienie ${o.orderNo} \xB7 licencja ${o.licenseId}`);
  doc.setKeywords(["exmortis", `order:${o.orderNo}`, `license:${o.licenseId}`]);
  doc.setTitle(o.title);
  doc.setProducer("exmortis");
  await doc.encrypt({
    userPassword: "",
    ownerPassword: crypto.randomUUID(),
    permissions: { printing: "highResolution", copying: true, contentAccessibility: true, modifying: false, annotating: false, fillingForms: false, documentAssembly: false }
  });
  return await doc.save();
}
function newLicenseId() {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return "EXM-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// supabase/functions/orderFree/index.ts
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const name = textField(body, "name", { max: 100 });
    const email = emailField(body);
    const phone = textField(body, "phone", { max: 40, required: false }) || "";
    const slug = String(body.slug || "").trim();
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Brak produktu");
    const phoneConsent = body.phone_consent === true && phone !== "";
    const newsletterConsent = body.newsletter_consent === true;
    const rows = await runSql(
      base44,
      `SELECT id, name, is_free, active, COALESCE(status, 'dost\u0119pny') AS status, file_url, private_file_uri, product_type, access_months
       FROM public.products WHERE slug = ${escStr(slug)} LIMIT 1`,
      true
    );
    const product = rows && rows.length > 0 ? rows[0] : null;
    if (!product || product.active === false || product.status === "ukryty" || product.is_free !== true) {
      throw new Error("Ten materia\u0142 nie jest ju\u017C dost\u0119pny");
    }
    if (!await ipAllowed(base44, clientIp(req), "darmowy", 5, 36e5, slug)) return Response.json({ error: TOO_MANY }, { status: 429 });
    const firstName = name.split(" ")[0] || name;
    const orderId = crypto.randomUUID();
    await insertOrder(base44, {
      id: orderId,
      buyerName: name,
      buyerEmail: email,
      buyerPhone: phone || null,
      note: `Bezp\u0142atne pobranie: ${product.name}`,
      items: [{ name: product.name, quantity: 1, unitPrice: 0 }],
      total: 0,
      status: "FREE",
      phoneConsent,
      newsletterConsent
    });
    if (newsletterConsent) {
      await addSubscriber(base44, { email, name, consentGiven: true });
    }
    const hasAccount = (await base44.asServiceRole.entities.User.filter({ email: email.toLowerCase() })).length > 0;
    if (hasAccount) {
      if (product.product_type === "pakiet") {
        for (const it of await expandBundles(base44, [product])) {
          await grantAccess(base44, { email, product: it, source: "darmowy" });
        }
      } else if (["pdf", "audio", "wideo", "kurs"].includes(product.product_type)) {
        await grantAccess(base44, {
          email,
          product: { id: product.id, name: product.name, product_type: product.product_type || "pdf", access_months: null },
          source: "darmowy"
        });
      }
    }
    let fileUrl = String(product.file_url || "").trim();
    let linkDays = 0;
    const src = product.private_file_uri || fileUrl;
    if (src && (product.product_type === "pdf" || /\.pdf(\?|$)/i.test(src))) {
      try {
        const sr = base44.asServiceRole;
        const { signed_url } = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: src, expires_in: 300 });
        const orig = new Uint8Array(await (await fetch(signed_url, { signal: AbortSignal.timeout(6e4) })).arrayBuffer());
        const out = await personalizePdf(orig, {
          email,
          orderNo: orderId.slice(0, 8).toUpperCase(),
          licenseId: newLicenseId(),
          title: product.name,
          date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
        });
        const safe = String(product.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "material";
        const { file_uri } = await sr.integrations.Core.UploadPrivateFile({ file: new File([out], `${safe}_exmortis.pdf`, { type: "application/pdf" }) });
        fileUrl = (await sr.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 604800 })).signed_url;
        linkDays = 7;
        await sr.entities.SecurityLog.create({ type: "pdf", user_email: email, ip: clientIp(req), details: `darmowy: ${product.name}` }).catch(() => {
        });
      } catch (e) {
        console.error("orderFree: znak wodny", e?.message || e);
        fileUrl = "";
        await sendMail(base44, {
          kind: "alarm_pdf",
          to: await adminTo(base44).catch(() => null),
          subject: `Darmowy PDF nie wys\u0142any: ${product.name}`,
          html: `<p>Nie uda\u0142o si\u0119 przygotowa\u0107 kopii ze znakiem wodnym dla ${escapeHtml(email)} (${escapeHtml(String(e?.message || e).slice(0, 200))}). Wy\u015Blij plik r\u0119cznie.</p>`
        }).catch(() => {
        });
      }
    }
    await sendMail(base44, {
      kind: "zamowienie",
      to: email,
      subject: `Tw\xF3j materia\u0142: ${product.name}`,
      html: `
      <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
        <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
        <p style="color:#8A8A8C;line-height:1.7;">${escapeHtml(firstName)},</p>
        <p style="line-height:1.7;color:#E2E2E2;">dzi\u0119kuj\u0119 za si\u0119gni\u0119cie po <strong>${escapeHtml(
        product.name
      )}</strong>.</p>
        ${fileUrl ? `<p style="line-height:1.7;color:#E2E2E2;">Tw\xF3j plik jest gotowy do pobrania.</p>
               <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="background:#C9A24A;">
                 <a href="${escapeHtml(fileUrl)}" style="display:inline-block;padding:14px 30px;color:#0A0A0B;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:3px;font-weight:bold;">POBIERZ PLIK</a>
               </td></tr></table>${linkDays ? `<p style="font-size:12px;color:#8A8A8C;line-height:1.6;">Link jest wa\u017Cny ${linkDays} dni. Plik jest Twoj\u0105 osobist\u0105 kopi\u0105 \u2014 oznaczon\u0105 Twoim adresem e-mail.</p>` : ""}` : `<p style="line-height:1.7;color:#E2E2E2;">Przygotowuj\u0119 Twoj\u0105 osobist\u0105 kopi\u0119 \u2014 wy\u015Bl\u0119 j\u0105 w osobnej wiadomo\u015Bci.</p>`}
        <p style="line-height:1.7;color:#8A8A8C;">Powr\xF3t nie ko\u0144czy si\u0119 na jednym kroku \u2014 dopiero si\u0119 nim zaczyna.</p>
        <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>
      </div>`
    });
    return Response.json({ ok: true });
  } catch (error) {
    const bad = /^(Brak pola|Pole .* jest zbyt długie|Niepoprawny adres e-mail|Brak produktu|Ten materiał)/.test(String(error?.message || ""));
    return Response.json({ error: error.message }, { status: bad ? 400 : 500 });
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
