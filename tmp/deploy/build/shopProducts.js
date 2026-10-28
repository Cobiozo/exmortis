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
function omnibusFrom(history, current, today = warsawToday()) {
  const past = history.filter((h) => h.day < today).sort((a, b) => b.day.localeCompare(a.day));
  let start = today;
  for (const h of past) {
    if (Math.abs(Number(h.price) - current) < 5e-3) start = h.day;
    else break;
  }
  const from = /* @__PURE__ */ new Date(`${start}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 30);
  const fromS = from.toISOString().slice(0, 10);
  const window = past.filter((h) => h.day < start && h.day >= fromS).map((h) => Number(h.price));
  return window.length ? Math.min(...window) : null;
}
async function omnibusPrices(base44, ids) {
  const out = /* @__PURE__ */ new Map();
  if (!ids.length) return out;
  try {
    await ensureHistory(base44);
    const rows = await runSql(base44, `SELECT product_id, day::text AS day, price::float8 AS price FROM public.product_price_daily
      WHERE product_id IN (${ids.map((i) => escStr(String(i))).join(",")}) AND day > (now() AT TIME ZONE 'Europe/Warsaw')::date - 120`, true);
    for (const r of rows || []) {
      if (!out.has(r.product_id)) out.set(r.product_id, []);
      out.get(r.product_id).push({ day: r.day, price: Number(r.price) });
    }
  } catch {
  }
  return out;
}

// supabase/functions/_shared/shim.ts
var waitUntil = (p) => {
  try {
    globalThis.EdgeRuntime?.waitUntil?.(p);
  } catch {
  }
};

// supabase/functions/_shared/snapshot.ts
var MEM = /* @__PURE__ */ new Map();
var TTL = 6e4;
var LIMIT = 2e3;
var busy = /* @__PURE__ */ new Set();
var timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Limit czasu Supabase")), ms))]);
async function getSnap(base44, key, loader) {
  const t0 = Date.now();
  const m = MEM.get(key);
  if (m) {
    if (Date.now() - m.at >= TTL) bg(base44, key, loader);
    return m.v;
  }
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const row = (await ent.filter({ key }, "-refreshed_at", 1).catch(() => []))[0];
  const t1 = Date.now();
  if (row) {
    const age = Date.now() - Date.parse(row.refreshed_at || 0);
    const v2 = row.value?.v;
    MEM.set(key, { v: v2, at: Date.now() - Math.min(age, TTL) });
    if (age >= TTL) bg(base44, key, loader, row.id);
    console.log(`[snap] ${key} kopia z bazy ${t1 - t0} ms`);
    return v2;
  }
  const v = await timeout(refresh(base44, key, loader, null), LIMIT);
  console.log(`[snap] ${key} brak kopii: baza ${t1 - t0} ms, Supabase ${Date.now() - t1} ms`);
  return v;
}
function bg(base44, key, loader, id = void 0) {
  if (busy.has(key)) return;
  busy.add(key);
  waitUntil(refresh(base44, key, loader, id).catch(() => {
  }).finally(() => busy.delete(key)));
}
async function refresh(base44, key, loader, id) {
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const v = await loader();
  MEM.set(key, { v, at: Date.now() });
  const data = { key, value: { v }, refreshed_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (id === void 0) id = (await ent.filter({ key }, "-refreshed_at", 1).catch(() => []))[0]?.id || null;
  if (id) await ent.update(id, data);
  else await ent.create(data);
  return v;
}

// supabase/functions/_shared/reviews.ts
async function ratingMap(base44, ids) {
  const list = [...new Set((ids || []).map(String))].filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
  if (!list.length) return /* @__PURE__ */ new Map();
  const rows = await runSql(
    base44,
    `SELECT product_id, count(*)::int AS count, round(avg(rating)::numeric, 1)::float8 AS avg
     FROM public.product_reviews
     WHERE status = 'opublikowana' AND product_id IN (${list.map(escStr).join(",")})
     GROUP BY product_id`,
    true
  );
  return new Map((rows || []).map((r) => [String(r.product_id), { count: Number(r.count) || 0, avg: Number(r.avg) || 0 }]));
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

// supabase/functions/shopProducts/index.ts
async function loadCatalog(base44, slug, today) {
  let where = "active = TRUE AND COALESCE(status, 'dost\u0119pny') <> 'ukryty'";
  if (slug) where += ` AND slug = ${escStr(slug)}`;
  const products = await runSql(
    base44,
    `SELECT id, name, slug, subtitle, description, long_description,
            price::float8 AS price, old_price::float8 AS old_price, category, image_url, gallery,
            featured, active, details, format, duration, spots,
            level, stage, form, audience_tags, promise, for_whom, format_details,
            price_start::float8 AS price_start, price_regular::float8 AS price_regular,
            is_free, status, promo_end_date::text AS promo_end_date,
            button_label, checkout_url, next_step, is_featured, sort_order, cover_image,
            product_type, access_months, to_jsonb(p)->>'capacity' AS capacity,
            to_jsonb(p)->'price_steps' AS price_steps, to_jsonb(p)->'price_options' AS price_options,
            to_jsonb(p)->'bundle_items' AS bundle_items,
            created_date, updated_date
     FROM public.products p
     WHERE ${where}
     ORDER BY level ASC NULLS LAST, sort_order ASC NULLS LAST, created_date ASC
     LIMIT 200`,
    true
  );
  const out = (products || []).map((p) => withSteps(p));
  const promo = out.filter((p) => p.price_start != null && p.promo_end_date && String(p.promo_end_date).slice(0, 10) >= today);
  const hist = await omnibusPrices(base44, promo.map((p) => String(p.id)));
  for (const p of promo) {
    const low = omnibusFrom(hist.get(String(p.id)) || [], unitPrice(p), today);
    if (low != null) p.omnibus_price = low;
  }
  for (const p of out) delete p.price_steps;
  const ratings = await ratingMap(base44, out.map((p) => String(p.id))).catch(() => /* @__PURE__ */ new Map());
  for (const p of out) {
    const r = ratings.get(String(p.id));
    if (r) {
      p.rating_avg = r.avg;
      p.rating_count = r.count;
    }
  }
  const seats = await productSeats(base44, out.filter((p) => p.capacity != null).map((p) => String(p.id))).catch(() => /* @__PURE__ */ new Map());
  for (const p of out) {
    const s = seats.get(String(p.id));
    if (s) p.seats = s;
  }
  const catalogIds = new Set(out.map((p) => String(p.id)));
  const pkgs = out.filter((p) => p.product_type === "pakiet" && Array.isArray(p.bundle_items) && p.bundle_items.length);
  const compIds = [...new Set(pkgs.flatMap((p) => p.bundle_items.map(String)))];
  const comps = compIds.length ? await runSql(base44, `SELECT id::text AS id, name, slug, product_type,
        price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
        promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps
       FROM public.products WHERE id::text IN (${compIds.map(escStr).join(",")})`, true).catch(() => []) : [];
  const compById = new Map((comps || []).map((c) => [String(c.id), withSteps(c)]));
  const inPkg = /* @__PURE__ */ new Map();
  for (const p of pkgs) {
    const items = p.bundle_items.map(String).map((id) => compById.get(id)).filter(Boolean).map((c) => ({
      id: String(c.id),
      name: c.name,
      slug: c.slug,
      product_type: c.product_type,
      price: unitPrice(c),
      available: catalogIds.has(String(c.id))
    }));
    if (!items.length) continue;
    const separately = Math.round(items.reduce((s, c) => s + (Number(c.price) || 0), 0) * 100) / 100;
    const now = unitPrice(p);
    p.bundle = { items, separately, save: Math.round((separately - now) * 100) / 100 };
    if (p.status === "wkr\xF3tce") continue;
    for (const c of items) {
      const l = inPkg.get(c.id) || [];
      l.push({ slug: p.slug, name: p.name, price: now });
      inPkg.set(c.id, l);
    }
  }
  for (const p of out) {
    delete p.bundle_items;
    const ip = inPkg.get(String(p.id));
    if (ip) p.in_packages = ip;
  }
  return out;
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (body.action === "curriculum") {
      const pid = String(body.product_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(pid)) return Response.json({ lessons: [] });
      const ok = await runSql(base44, `SELECT 1 FROM public.products WHERE id::text = ${escStr(pid)} AND active = TRUE AND product_type IN ('kurs', 'wideo') AND COALESCE(status, 'dost\u0119pny') <> 'ukryty'`, true);
      if (!ok.length) return Response.json({ lessons: [] });
      const list = await base44.asServiceRole.entities.CourseLesson.filter({ product_id: pid, published: true }, "order", 300);
      return Response.json({ lessons: list.map((l) => ({ module: l.module || "", title: l.title, duration_min: l.duration_min || null })) });
    }
    const raw = typeof body.slug === "string" ? body.slug.trim() : "";
    const slug = raw && /^[a-z0-9-]{1,120}$/.test(raw) ? raw : "";
    const today = warsawToday();
    let out;
    try {
      out = await getSnap(base44, `products:${today}`, () => loadCatalog(base44, "", today));
      if (slug) out = (out || []).filter((p) => p.slug === slug);
    } catch {
      out = await loadCatalog(base44, slug, today);
    }
    if (slug && out?.length) {
      const me2 = await base44.auth.me().catch(() => null);
      const mail = me2?.email ? String(me2.email).toLowerCase() : "";
      if (mail) {
        const access = await accessFilter(base44, { user_email: mail }, "-created_date", 300).catch(() => []);
        const owned = new Set(access.filter((a) => !a.revoked).map((a) => String(a.product_id)));
        out = out.map((p) => p.bundle ? { ...p, bundle: { ...p.bundle, items: p.bundle.items.map((c) => ({ ...c, owned: owned.has(String(c.id)) })) } } : p);
      }
    }
    return Response.json({ products: out || [] });
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
