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

// supabase/functions/_shared/discounts.ts
async function applyDiscount(base44, rawCode, lines) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return null;
  const found = (await base44.asServiceRole.entities.DiscountCode.filter({ code, active: true }))[0];
  if (!found) throw new Error("Nieprawid\u0142owy kod rabatowy");
  const today2 = (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  if (found.valid_until && found.valid_until < today2) throw new Error("Kod rabatowy wygas\u0142");
  if (found.max_uses && (found.uses || 0) >= found.max_uses) throw new Error("Kod rabatowy zosta\u0142 ju\u017C wykorzystany");
  const ids = found.product_ids || [];
  const pids = [...new Set(lines.map((l) => String(l.product_id)))];
  const rows = pids.length ? await runSql(base44, `SELECT id::text AS id FROM public.products WHERE product_type = 'karta' AND id::text IN (${pids.map(escStr).join(",")})`, true) : [];
  const cards = rows.map((r) => r.id);
  const fromCard = String(found.opis || "").startsWith("Karta podarunkowa");
  const base = lines.filter((l) => !cards.includes(String(l.product_id))).filter((l) => ids.length === 0 || ids.includes(String(l.product_id))).reduce((s, l) => s + l.unit * l.qty, 0);
  const onlyCards = lines.length > 0 && lines.every((l) => cards.includes(String(l.product_id)));
  if (base === 0) throw new Error(onlyCards ? fromCard ? "Kodem z karty podarunkowej nie op\u0142acisz innej karty podarunkowej" : "Kod\xF3w rabatowych nie \u0142\u0105czy si\u0119 z kart\u0105 podarunkow\u0105" : "Kod nie obejmuje produkt\xF3w w koszyku");
  const off = found.kind === "kwota" ? Math.min(base, Math.round(found.value * 100)) : Math.round(base * Math.min(100, found.value) / 100);
  return { record: found, code, discount: off };
}
var RESERVE_SQL = `
CREATE TABLE IF NOT EXISTS public.discount_reservations (
  order_id text PRIMARY KEY, code text NOT NULL, email text, used boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS discount_reservations_code_idx ON public.discount_reservations (code);
ALTER TABLE public.discount_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discount_reservations FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.exm_reserve_code(p_code text, p_order text, p_email text, p_free int) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kod:' || p_code));
  DELETE FROM public.discount_reservations WHERE NOT used AND created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.discount_reservations WHERE code = p_code AND NOT used AND created_at > now() - interval '30 minutes'
        AND order_id <> p_order AND lower(COALESCE(email, '')) <> lower(COALESCE(p_email, ''))) >= p_free THEN
    RETURN false;
  END IF;
  INSERT INTO public.discount_reservations (order_id, code, email) VALUES (p_order, p_code, lower(p_email)) ON CONFLICT (order_id) DO NOTHING;
  RETURN true;
END $f$;
REVOKE EXECUTE ON FUNCTION public.exm_reserve_code(text, text, text, int) FROM PUBLIC, anon, authenticated;`;
var reserveReady = false;
async function reserveCode(base44, record, orderId, email) {
  const max = Number(record?.max_uses) || 0;
  if (!max) return false;
  if (!reserveReady) {
    await runSql(base44, RESERVE_SQL);
    reserveReady = true;
  }
  const free = max - (Number(record.uses) || 0);
  const [r] = await runSql(base44, `SELECT public.exm_reserve_code(${escStr(String(record.code).toUpperCase())}, ${escStr(orderId)}, ${escStr(email || "")}, ${free}) AS ok`);
  if (!r?.ok) throw new Error("Kod rabatowy zosta\u0142 ju\u017C wykorzystany");
  return true;
}
async function releaseCode(base44, orderId) {
  await runSql(base44, `DELETE FROM public.discount_reservations WHERE order_id = ${escStr(orderId)} AND NOT used`).catch(() => {
  });
}
async function markCodeUsed(base44, orderId) {
  await runSql(base44, `DO $m$ BEGIN IF to_regclass('public.discount_reservations') IS NOT NULL THEN
    UPDATE public.discount_reservations SET used = TRUE WHERE order_id = ${escStr(orderId)}; END IF; END $m$`).catch(() => {
  });
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

// supabase/functions/_shared/shim.ts
var secrets = {
  get: (k) => Deno.env.get(k) ?? null
};

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
async function getOrderStatus(base44, id) {
  const rows = await runSql(base44, `SELECT status FROM public.orders WHERE id = ${escStr(id)} LIMIT 1`, true);
  return rows && rows.length ? String(rows[0].status || "") : null;
}

// supabase/functions/_shared/errors.ts
var VALIDATION_RE = /^(Brak pola|Pole .* jest zbyt długie|Niepoprawny adres e-mail|Zaakceptuj|Zaznacz|Koszyk jest pusty|Jeden z produktów|Nieprawidłowy kod|Kod |Kodem |Kwota zamówienia|Podaj |Niepoprawny NIP|Bilet:|Brak wolnych|Zostało tylko|Zbyt wiele prób|Ten materiał)/;
function errorResponse(error, fallback) {
  const e = error;
  const msg = String(e?.message || "");
  if (e?.isValidation === true || VALIDATION_RE.test(msg)) {
    return Response.json({ error: msg }, { status: 400 });
  }
  console.error("error:", msg);
  return Response.json({ error: fallback }, { status: 500 });
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
var esc3 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function nextStepHtml(base44, step) {
  if (!step) return "";
  const url = `${await loadAppUrl(base44)}/skarbiec/${encodeURIComponent(step.slug)}`;
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;"><div style="border-top:1px solid #3D3D3F;padding-top:20px;">
    <p style="font-size:11px;letter-spacing:.18em;color:#C9A24A;margin:0 0 8px;">NAST\u0118PNY KROK</p>
    ${step.text ? `<p style="line-height:1.7;color:#E2E2E2;margin:0 0 8px;">${esc3(step.text)}</p>` : ""}
    <p style="margin:0;"><a href="${esc3(url)}" style="color:#C9A24A;">${esc3(step.name)} \u2192</a></p></div></div>`;
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

// supabase/functions/_shared/giftCard.ts
var esc4 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
function rand(abc, n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => abc[x % abc.length]).join("");
}
var newCode = () => "PREZENT-" + rand("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
var newToken = () => rand("abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", 32);
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
        code: newCode(),
        kind: "kwota",
        value,
        max_uses: 1,
        uses: 0,
        valid_until: until,
        active: true,
        opis: `Karta podarunkowa \xB7 ${tag}`,
        gift_to: to,
        gift_message: message,
        gift_token: newToken(),
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
      ${c.to_name ? `<p style="margin:0 0 6px;color:#8A8A8C;font-size:13px;">Dla</p><p style="margin:0 0 14px;color:#E2E2E2;font-size:20px;">${esc4(c.to_name)}</p>` : ""}
      ${c.message ? `<p style="margin:0 0 16px;color:#E2E2E2;font-style:italic;line-height:1.6;">\u201E${esc4(c.message)}\u201D</p>` : ""}
      <p style="margin:0 0 4px;color:#C9A24A;font-size:26px;">${esc4(String(c.value).replace(".", ","))} z\u0142</p>
      <p style="margin:0 0 14px;color:#E2E2E2;">Kod: <b style="color:#C9A24A;letter-spacing:2px;">${esc4(c.code)}</b> \xB7 wa\u017Cna do ${esc4(d(c.until))}</p>
      ${c.token ? `<p style="margin:0;"><a href="${esc4(cardLink(c.token))}" style="color:#C9A24A;">Otw\xF3rz kart\u0119 do wydruku lub zapisania jako PDF</a></p>` : ""}
    </div>`;
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">
    ${cards.map(one).join("")}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Kod wpisuje si\u0119 w kasie Skarbca, w polu \u201Ekod rabatowy\u201D. Dzia\u0142a jednorazowo \u2014 niewykorzystana cz\u0119\u015B\u0107 kwoty przepada. Kart\u0119 mo\u017Cesz wydrukowa\u0107 albo przes\u0142a\u0107 link osobie obdarowanej. Wszystkie Twoje karty s\u0105 te\u017C w zak\u0142adce Zam\xF3wienia na koncie.</p></div>`;
}
function giftLine(p, it) {
  if (p.product_type !== "karta") return null;
  let opts = p.price_options;
  if (typeof opts === "string") {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = null;
    }
  }
  const amounts = Array.isArray(opts) ? opts.map(Number).filter((n) => n > 0) : [];
  const want = Number((it || {}).amount);
  const amount = amounts.length ? amounts.includes(want) ? want : NaN : unitPrice(p);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Jeden z produkt\xF3w nie jest ju\u017C dost\u0119pny \u2014 wybierz kwot\u0119 karty jeszcze raz");
  return { unit: Math.round(amount * 100), gift: { to_name: clip(it?.to_name, 60), message: clip(it?.message, 200) } };
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
function newCode2() {
  const b = rnd(7);
  return [...b.slice(0, 3)].map((x) => LETTERS[x % LETTERS.length]).join("") + [...b.slice(3)].map((x) => String(x % 10)).join("");
}
var showCode = (c) => c && c.length === 7 ? `${c.slice(0, 3)}-${c.slice(3)}` : String(c || "");
var TOKEN_ABC = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var newToken2 = () => [...rnd(32)].map((x) => TOKEN_ABC[x % TOKEN_ABC.length]).join("");
var ticketUrl = (token) => `${APP_URL}/bilet#t=${token}`;
var ticketPdfUrl = (token) => `${APP_URL}/functions/tickets?pdf=${token}`;
var cleanName = (v) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
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
async function ticketLines(base44, items) {
  const wanted = /* @__PURE__ */ new Map();
  for (const it of items) {
    const id = String(it?.id || "").slice(0, 64);
    const holders = (Array.isArray(it?.holders) ? it.holders : []).slice(0, 10).map(cleanName);
    if (!id || !holders.length) throw new Error("Bilet: podaj imi\u0119 i nazwisko ka\u017Cdej osoby");
    if (holders.some((h) => h.length < 3)) throw new Error("Bilet: podaj imi\u0119 i nazwisko ka\u017Cdej osoby");
    wanted.set(id, [...wanted.get(id) || [], ...holders]);
  }
  if (!wanted.size) return [];
  await ensureTicketSchema(base44);
  const rows = await runSql(base44, `SELECT id, title, status, format, price::float8 AS price, capacity, start_datetime, registration_deadline,
      COALESCE(tickets, false) AS tickets FROM public.events WHERE id IN (${[...wanted.keys()].map(escStr).join(",")})`, true);
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const out = [];
  let total = 0;
  for (const [id, holders] of wanted) {
    const ev = byId.get(id);
    const closed = salesClosed(ev);
    if (closed) throw new Error(`Bilet: ${closed}`);
    if (holders.length > 10) throw new Error("Bilet: najwy\u017Cej 10 bilet\xF3w na jedno wydarzenie w zam\xF3wieniu");
    total += holders.length;
    if (Number(ev.capacity) > 0) {
      const { sold, pending } = await seatsTaken(base44, id);
      const left = Number(ev.capacity) - sold - pending;
      if (holders.length > left) throw new Error(left > 0 ? `Brak wolnych miejsc: zosta\u0142o ${left}` : "Brak wolnych miejsc na to wydarzenie");
    }
    const unit = Math.round(Number(ev.price) * 100);
    out.push({ event_id: id, kind: "bilet", product_id: `bilet:${id}`, name: `Bilet \u2014 ${String(ev.title).slice(0, 120)}`, unitPrice: String(unit), quantity: holders.length, holders });
  }
  if (total > 20) throw new Error("Bilet: najwy\u017Cej 20 bilet\xF3w w jednym zam\xF3wieniu");
  return out;
}
async function insertTicket(base44, t) {
  for (let i = 0; i < 6; i++) {
    const rows = await runSql(base44, `INSERT INTO public.event_tickets (code, token, event_id, order_id, line_no, holder_name, buyer_email, price, source)
      VALUES (${escStr(newCode2())}, ${escStr(newToken2())}, ${escStr(t.event_id)}, ${t.order_id ? escStr(t.order_id) : "NULL"}, ${t.line_no},
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
var esc5 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var when = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
function ticketsHtml(tickets, events) {
  if (!tickets.length) return "";
  const byEv = /* @__PURE__ */ new Map();
  for (const t of tickets) byEv.set(t.event_id, [...byEv.get(t.event_id) || [], t]);
  const blocks = [...byEv.entries()].map(([id, list]) => {
    const ev = events.get(id) || {};
    return `<div style="margin:0 0 18px;border:1px solid #C9A24A;padding:22px;">
      <p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 10px;">BILET${list.length > 1 ? "Y" : ""}</p>
      <p style="margin:0 0 6px;color:#F5EFE1;font-size:20px;">${esc5(ev.title || "")}</p>
      ${ev.start_datetime ? `<p style="margin:0 0 14px;color:#8A8A8C;">${esc5(when(ev.start_datetime))} (czas polski)${ev.format === "Online" ? " \xB7 online" : ""}</p>` : ""}
      ${list.map((t) => `<p style="margin:0 0 10px;color:#E2E2E2;">${esc5(t.holder_name)} \xB7 <b style="color:#C9A24A;letter-spacing:2px;">${esc5(showCode(t.code))}</b><br>
        <a href="${esc5(ticketPdfUrl(t.token))}" style="color:#C9A24A;">Pobierz bilet (PDF)</a> \xB7 <a href="${esc5(ticketUrl(t.token))}" style="color:#8A8A8C;">otw\xF3rz na telefonie</a></p>`).join("")}
    </div>`;
  }).join("");
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">${blocks}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Bilet jest imienny i wa\u017Cny na jedno wej\u015Bcie. Przy wej\u015Bciu poka\u017C kod QR \u2014 na telefonie albo wydrukowany. Ka\u017Cd\u0105 osob\u0119 wpuszczam na jej bilet, wi\u0119c bilety dla innych przeka\u017C im wcze\u015Bniej (PDF albo link). Wszystkie bilety s\u0105 te\u017C w Moim koncie \u2192 Spotkania, po zalogowaniu tym adresem e-mail.</p></div>`;
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
  const add = async (table, cols) => {
    const have = await runSql(
      base44,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}'`,
      true
    ).catch(() => []);
    const names = new Set((Array.isArray(have) ? have : []).map((r) => String(r.column_name)));
    for (const c of cols) {
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
function applyDiscount2(positions, discountGrosze) {
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
  const lines = applyDiscount2(positions, sum - Math.round(total * 100));
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

// supabase/functions/_shared/newsletter.ts
var esc6 = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var newToken3 = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
async function addSubscriber(base44, { email, name }) {
  const nameVal = name === void 0 || name === null || String(name).trim() === "" ? "NULL" : escStr(String(name).trim().slice(0, 200));
  const token = newToken3();
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
        <p style="font-family:Arial,sans-serif;line-height:1.7;">${name ? esc6(name) + ", " : ""}kto\u015B (mam nadziej\u0119, \u017Ce Ty) zapisa\u0142 ten adres na Listy powrotu, jeden list w ka\u017Cdy poniedzia\u0142ek. \u017Beby zacz\u0105\u0107 je dostawa\u0107, kliknij poni\u017Cej.</p>
        <p style="margin:32px 0;"><a href="${url}" style="background:#C9A24A;color:#0A0A0B;padding:14px 28px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;letter-spacing:2px;">POTWIERDZAM ZAPIS</a></p>
        <p style="font-family:Arial,sans-serif;color:#8A8A8C;font-size:13px;line-height:1.6;">Je\u015Bli to nie Ty, zignoruj t\u0119 wiadomo\u015B\u0107. Bez potwierdzenia adres zostanie usuni\u0119ty po 7 dniach.</p>
      </div></div>`
  });
}

// supabase/functions/_shared/seats.ts
var PENDING_MIN = 15;
async function productSeats(base44, ids) {
  const list = [...new Set((ids || []).map((x) => String(x || "")).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
  if (!list.length) return /* @__PURE__ */ new Map();
  const inList = list.map(escStr).join(",");
  const items = `jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END)`;
  const rows = await runSql(
    base44,
    // capacity czytane przez to_jsonb — działa także, zanim kolumna powstała (jak invoice w zamówieniach).
    `SELECT p.id::text AS id, to_jsonb(p)->>'capacity' AS capacity,
        COALESCE(s.n, 0)::int AS sold,
        COALESCE(q.n, 0)::int AS pending
     FROM public.products p
     LEFT JOIN (
       SELECT i->>'product_id' AS pid, SUM(COALESCE((i->>'quantity')::int, 1))::int AS n
       FROM public.orders o, ${items} i
       WHERE o.status = 'COMPLETED' AND i->>'product_id' IN (${inList})
         -- Zam\xF3wienie zwr\xF3cone w ca\u0142o\u015Bci nie zajmuje miejsca (cz\u0119\u015Bciowy zwrot zostaje \u2014 nie sprzedajemy nadkompletu).
         -- Uwaga: zwrot musi by\u0107 wi\u0119kszy od zera \u2014 inaczej zam\xF3wienie darmowe (total 0) wypada\u0142oby z puli sprzedanych.
         AND NOT (COALESCE((to_jsonb(o)->>'refunded_total')::numeric, 0) > 0
                  AND COALESCE((to_jsonb(o)->>'refunded_total')::numeric, 0) >= COALESCE(o.total, 0))
       GROUP BY 1
     ) s ON s.pid = p.id::text
     LEFT JOIN (
       SELECT i->>'product_id' AS pid, SUM(COALESCE((i->>'quantity')::int, 1))::int AS n
       FROM public.orders o, ${items} i
       WHERE o.status IN ('NEW', 'PENDING', 'WAITING_FOR_CONFIRMATION')
         AND COALESCE(o.updated_date, o.created_date) > now() - interval '${PENDING_MIN} minutes'
         AND i->>'product_id' IN (${inList})
       GROUP BY 1
     ) q ON q.pid = p.id::text
     WHERE p.id::text IN (${inList}) AND to_jsonb(p)->>'capacity' IS NOT NULL`,
    true
  );
  const out = /* @__PURE__ */ new Map();
  for (const r of rows || []) {
    const capacity = Number(r.capacity) || 0;
    const sold = Number(r.sold) || 0;
    const pending = Number(r.pending) || 0;
    out.set(String(r.id), { capacity, sold, pending, left: Math.max(0, capacity - sold - pending) });
  }
  return out;
}

// supabase/functions/_shared/legalDocs.ts
var DOC_KEYS = ["operator_nazwa", "operator_adres", "metody", "przelozenie_h", "data_od", "poczta", "newsletter", "biuro"];
var DOCS = ["regulamin", "prywatnosc", "cookies"];
var BASE = { regulamin: "1.0", prywatnosc: "1.1", cookies: "1.0" };
function cleanPola(data) {
  const out = {};
  for (const k of DOC_KEYS) out[k] = String(data?.[k] ?? "").trim().slice(0, 300);
  if (out.przelozenie_h && !/^\d{1,3}$/.test(out.przelozenie_h)) throw new Error("Termin prze\u0142o\u017Cenia podaj w pe\u0142nych godzinach (np. 24).");
  return out;
}
function publicDocs(s) {
  const docs = {};
  for (const d of DOCS) docs[d] = { version: s?.docs?.[d]?.version || BASE[d], date: s?.docs?.[d]?.date || null };
  return { pola: cleanPola(s?.pola || {}), docs };
}
async function regulaminVersion(base44) {
  return publicDocs(await getSetting(base44, "dokumenty").catch(() => null)).docs.regulamin.version;
}

// supabase/functions/_shared/invoice.ts
function validNip(raw) {
  const d = String(raw ?? "").toUpperCase().replace(/^PL/, "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(d)) return null;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0) % 11;
  if (sum === 10 || sum !== Number(d[9])) return null;
  return d;
}
function cleanInvoice(b) {
  if (!b || b.want !== true) return null;
  const company = String(b.company ?? "").trim().slice(0, 200);
  const nip = validNip(b.nip);
  const address = String(b.address ?? "").trim().slice(0, 300);
  if (!company) throw new Error("Podaj nazw\u0119 firmy do faktury");
  if (!nip) throw new Error("Niepoprawny NIP \u2014 sprawd\u017A 10 cyfr");
  if (address.length < 5) throw new Error("Podaj adres firmy do faktury");
  return { company, nip, address };
}
var nipPretty = (nip) => String(nip || "").replace(/^(\d{3})(\d{3})(\d{2})(\d{2})$/, "$1-$2-$3-$4");
function invoiceText(inv) {
  if (!inv) return "";
  return `Faktura: ${inv.company}, NIP ${nipPretty(inv.nip)}, ${inv.address}`;
}

// supabase/functions/payuCreateOrder/index.ts
var DIGITAL_CONSENT = "\u017B\u0105dam dostarczenia tre\u015Bci cyfrowych przed up\u0142ywem 14 dni od zawarcia umowy i przyjmuj\u0119 do wiadomo\u015Bci, \u017Ce z chwil\u0105 rozpocz\u0119cia ich dostarczania trac\u0119 prawo odst\u0105pienia od umowy.";
async function saveConsents(base44, req, orderId, email, hasDigital, newsletterConsent) {
  const cBase = { email, source: "kasa", order_id: orderId, doc_version: `regulamin ${await regulaminVersion(base44)}`, ip: clientIp(req), status: "udzielona" };
  const consents = [{ ...cBase, kind: "regulamin", text: "Akceptuj\u0119 Regulamin. Znam Polityk\u0119 prywatno\u015Bci." }];
  if (hasDigital) consents.push({ ...cBase, kind: "tresci_cyfrowe", text: DIGITAL_CONSENT });
  if (newsletterConsent) consents.push({ ...cBase, kind: "newsletter", text: "Chc\u0119 otrzymywa\u0107 Listy powrotu \u2014 newsletter exmortis z tre\u015Bciami oraz informacjami o produktach i wydarzeniach \u2014 na podany adres e-mail. Zgod\u0119 mog\u0119 wycofa\u0107 w ka\u017Cdej chwili." });
  const made = await base44.asServiceRole.entities.Consent.bulkCreate(consents);
  for (const c of made || []) await mirrorRecord(base44, "Consent", c.id);
}
function safeJson(res) {
  return res.json().catch(() => ({}));
}
var BASE_URLS = {
  secure: "https://secure.payu.com",
  sandbox: "https://merch-prod.snd.payu.com"
};
var handler = async function(req) {
  let base44Ref = null;
  let reservedFor = null;
  try {
    const base44 = createClientFromRequest(req);
    base44Ref = base44;
    await loadAppUrl(base44);
    const body = await req.json().catch(() => ({}));
    if (body.action === "status") {
      const id = String(body.orderId || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ status: null });
      return Response.json({ status: await getOrderStatus(base44, id) });
    }
    if (!await ipAllowed(base44, clientIp(req), "kasa", 20, 36e5)) {
      return Response.json({ error: TOO_MANY }, { status: 429 });
    }
    const buyerName = textField(body, "name", { max: 100 });
    const buyerEmail = emailField(body);
    const note = textField(body, "note", { max: 2e3, required: false }) || "";
    const newsletterConsent = body.newsletter_consent === true;
    if (body.terms_consent !== true) throw new Error("Zaakceptuj Regulamin");
    const invoice = cleanInvoice(body.invoice);
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    if (items.length === 0) throw new Error("Koszyk jest pusty");
    const ticketItems = items.filter((i) => i && i.kind === "bilet");
    const productItems = items.filter((i) => !(i && i.kind === "bilet"));
    const tickets = await ticketLines(base44, ticketItems);
    const ids = [...new Set(productItems.map((i) => String((i || {}).id || "")).filter(Boolean))];
    if (ids.length === 0 && tickets.length === 0) throw new Error("Koszyk jest pusty");
    const idList = ids.map((id) => escStr(id)).join(",");
    const rows = !ids.length ? [] : await runSql(
      base44,
      `SELECT id, name, price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
              promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps,
              active, is_free, COALESCE(status, 'dost\u0119pny') AS status, product_type, to_jsonb(p)->'price_options' AS price_options
       FROM public.products p WHERE id IN (${idList})`,
      true
    );
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    const hasDigital = rows.some((r) => DIGITAL.includes(r.product_type) || r.product_type === "pakiet");
    if (hasDigital && body.digital_consent !== true) {
      throw new Error("Zaznacz zgod\u0119 na dostarczenie tre\u015Bci cyfrowych");
    }
    const products = [];
    const stored = [];
    let totalGrosze = 0;
    for (const t of tickets) {
      totalGrosze += Number(t.unitPrice) * t.quantity;
      products.push({ name: t.name, unitPrice: t.unitPrice, quantity: t.quantity });
      stored.push(t);
    }
    for (const it of productItems) {
      const p = byId.get(String((it || {}).id));
      if (!p || p.active === false || p.status === "wkr\xF3tce" || p.status === "ukryty" || p.is_free === true) {
        throw new Error("Jeden z produkt\xF3w nie jest ju\u017C dost\u0119pny");
      }
      const qty = Math.max(1, Math.min(20, Math.floor(Number((it || {}).qty) || 1)));
      const card = giftLine(p, it);
      const unit = card ? card.unit : Math.round(unitPrice(p) * 100);
      if (!Number.isFinite(unit) || unit <= 0) throw new Error("Niepoprawna cena produktu");
      totalGrosze += unit * qty;
      const label = card ? `${String(p.name).slice(0, 120)} ${(unit / 100).toFixed(0)} z\u0142` : String(p.name).slice(0, 150);
      products.push({ name: label, unitPrice: String(unit), quantity: qty });
      stored.push({ product_id: String(p.id), name: label, unitPrice: String(unit), quantity: qty, ...card ? { gift: card.gift } : {} });
    }
    const need = /* @__PURE__ */ new Map();
    for (const s of stored) {
      const pid = String(s.product_id || "");
      if (pid && !pid.startsWith("bilet:")) need.set(pid, (need.get(pid) || 0) + (Number(s.quantity) || 1));
    }
    if (need.size) {
      const seats = await productSeats(base44, [...need.keys()]);
      for (const [pid, q] of need) {
        const st = seats.get(pid);
        if (st && st.left < q) {
          const nm = String(byId.get(pid)?.name || "produkt");
          throw new Error(st.left > 0 ? `Zosta\u0142o tylko ${st.left} miejsc: ${nm}` : `Brak wolnych miejsc: ${nm}`);
        }
      }
    }
    const disc = await applyDiscount(base44, body.code, stored.map((s) => ({
      product_id: s.product_id,
      unit: Number(s.unitPrice),
      qty: s.quantity
    })));
    if (disc) {
      totalGrosze -= disc.discount;
      products.length = 0;
      products.push({ name: `EXMORTIS \u2014 zam\xF3wienie (kod ${disc.code})`, unitPrice: String(totalGrosze), quantity: 1 });
    }
    if (totalGrosze < 0) totalGrosze = 0;
    if (totalGrosze > 0 && totalGrosze < 100) throw new Error("Kwota zam\xF3wienia jest zbyt niska dla PayU");
    const orderId = crypto.randomUUID();
    if (disc && await reserveCode(base44, disc.record, orderId, buyerEmail)) reservedFor = orderId;
    if (totalGrosze === 0) {
      const id = orderId;
      const freeId = `FREE-${id}`;
      await insertOrder(base44, {
        id,
        payuOrderId: freeId,
        buyerName,
        buyerEmail,
        note: [note, invoice ? invoiceText(invoice) : "", disc ? `Kod rabatowy: ${disc.code} (\u2212${(disc.discount / 100).toFixed(2)} z\u0142)` : ""].filter(Boolean).join("\n"),
        invoice,
        items: stored,
        total: 0,
        status: "PENDING",
        newsletterConsent,
        digitalConsent: hasDigital ? DIGITAL_CONSENT : null,
        discountCode: disc ? disc.code : null
      });
      await saveConsents(base44, req, id, buyerEmail, hasDigital, newsletterConsent);
      if (newsletterConsent) await addSubscriber(base44, { email: buyerEmail, name: buyerName, consentGiven: true });
      const order = await getOrderByPayuId(base44, freeId);
      if (await claimCompletion(base44, freeId)) await fulfillOrder(base44, order, freeId);
      return Response.json({ redirectUri: `${APP_URL}/kasa?payu=done`, orderId: id, free: true });
    }
    const payu = await getSetting(base44, "payu");
    if (!payu || !payu.posId || !payu.clientId || !payu.clientSecret || !payu.secondKey) {
      return Response.json({ error: "PAYU_NOT_CONFIGURED" }, { status: 400 });
    }
    const base = BASE_URLS[payu.env === "sandbox" ? "sandbox" : "secure"];
    const tokenRes = await fetch(`${base}/pl/standard/user/oauth/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: payu.clientId,
        client_secret: payu.clientSecret
      })
    });
    const token = await safeJson(tokenRes);
    if (!tokenRes.ok || !token.access_token) {
      throw new Error("PayU: b\u0142\u0105d autoryzacji (sprawd\u017A Client ID / Client Secret)");
    }
    const extOrderId = orderId;
    const realIp = clientIp(req);
    const customerIp = realIp === "brak" ? "127.0.0.1" : realIp;
    const orderRes = await fetch(`${base}/api/v2_1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.access_token}`
      },
      body: JSON.stringify({
        notifyUrl: `${APP_URL}/functions/payuNotification`,
        continueUrl: `${APP_URL}/kasa?payu=done`,
        customerIp,
        merchantPosId: String(payu.posId),
        description: tickets.length ? "EXMORTIS \u2014 bilety" : "EXMORTIS \u2014 skarbiec",
        currencyCode: "PLN",
        totalAmount: String(totalGrosze),
        extOrderId,
        buyer: { email: buyerEmail, firstName: buyerName.slice(0, 100), language: "pl" },
        products
      })
    });
    const data = await safeJson(orderRes);
    if (!orderRes.ok || !data.redirectUri) {
      throw new Error(
        data && data.error && data.error.message || "PayU: nie uda\u0142o si\u0119 utworzy\u0107 p\u0142atno\u015Bci"
      );
    }
    await insertOrder(base44, {
      id: extOrderId,
      payuOrderId: String(data.orderId || ""),
      buyerName,
      buyerEmail,
      note: [note, invoice ? invoiceText(invoice) : "", disc ? `Kod rabatowy: ${disc.code} (\u2212${(disc.discount / 100).toFixed(2)} z\u0142)` : ""].filter(Boolean).join("\n"),
      invoice,
      items: stored,
      total: totalGrosze / 100,
      status: "PENDING",
      newsletterConsent,
      digitalConsent: hasDigital ? DIGITAL_CONSENT : null,
      discountCode: disc ? disc.code : null
    });
    await saveConsents(base44, req, extOrderId, buyerEmail, hasDigital, newsletterConsent);
    if (newsletterConsent) {
      await addSubscriber(base44, { email: buyerEmail, name: buyerName, consentGiven: true });
    }
    return Response.json({ redirectUri: data.redirectUri, orderId: extOrderId });
  } catch (error) {
    if (reservedFor) await releaseCode(base44Ref, reservedFor);
    return errorResponse(error, "Nie uda\u0142o si\u0119 rozpocz\u0105\u0107 p\u0142atno\u015Bci. Spr\xF3buj ponownie.");
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
