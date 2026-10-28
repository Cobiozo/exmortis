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
  const h2 = (req?.headers.get("authorization") || "").match(/^Bearer (.+)$/i);
  return h2 ? h2[1] : "";
};
async function me() {
  const token2 = jwtOf(CURRENT_REQ);
  if (!token2) return null;
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token2}` }, signal: AbortSignal.timeout(1e4) });
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
function esc(value) {
  if (value === null || value === void 0) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return escStr(value);
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

// supabase/functions/_shared/shim.ts
var secrets = {
  get: (k) => Deno.env.get(k) ?? null
};

// supabase/functions/_shared/bookingCrypto.ts
var te = new TextEncoder();
var td = new TextDecoder();
var fromHex = (s) => Uint8Array.from((String(s).match(/../g) || []).map((h2) => parseInt(h2, 16)));
async function aesKeyFromSecret(bytes) {
  const raw = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function decryptHealth(key, hexStr) {
  const bytes = fromHex(hexStr);
  if (bytes.length < 14 || bytes[0] !== 1) return null;
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(1, 13) }, key, bytes.slice(13));
  return td.decode(pt);
}

// supabase/functions/_shared/booking.ts
var KEYS_MSG = "Rezerwacje chwilowo niedost\u0119pne";
var te2 = new TextEncoder();
var hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
function parseKey(name) {
  let s = null;
  try {
    s = secrets.get(name);
  } catch {
    s = null;
  }
  if (!s || !String(s).trim()) return null;
  s = String(s).trim();
  const isHex = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
  const bytes = isHex ? Uint8Array.from(s.match(/../g).map((h2) => parseInt(h2, 16))) : te2.encode(s);
  return { bytes, format: isHex ? "hex" : "utf8" };
}
async function loadKeys(simulateMissing = false) {
  const h2 = simulateMissing ? null : parseKey("BOOKING_HMAC_KEY");
  const e = simulateMissing ? null : parseKey("BOOKING_ENC_KEY");
  const info = {
    hmac: h2 ? { present: true, format: h2.format, length_ok: h2.bytes.length >= 32 } : { present: false },
    enc: e ? { present: true, format: e.format, length_ok: e.bytes.length >= 32 } : { present: false }
  };
  const ok = !!(info.hmac.length_ok && info.enc.length_ok);
  if (!ok) return { ok, info };
  const key = await crypto.subtle.importKey("raw", h2.bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return {
    ok,
    info,
    hmac: async (text) => hex(await crypto.subtle.sign("HMAC", key, te2.encode(String(text)))),
    enc: await aesKeyFromSecret(e.bytes)
    // klucz AES-256-GCM; zostaje wyłącznie w pamięci funkcji
  };
}
var sha256hex = async (text) => hex(await crypto.subtle.digest("SHA-256", te2.encode(String(text))));
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
var MODE = { v: null, at: 0 };
async function getMode(base44, fresh = false) {
  if (!fresh && MODE.v && Date.now() - MODE.at < 15e3) return MODE.v;
  const r = await runSql(base44, `SELECT mode FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  MODE = { v: r?.[0]?.mode || "off", at: Date.now() };
  return MODE.v;
}
var safeErr = (e) => String(e?.message || e).replace(/[^\s@"'()]+@[^\s@"'()]+/g, "[email]").slice(0, 200);

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

// supabase/functions/_shared/bookingNotify.ts
var ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]);
var unh = (s) => String(s ?? "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
var icsText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
var stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
var plFull = (iso2) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso2));
function localLabel(iso2, tz) {
  if (!tz) return "";
  try {
    const opts = { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" };
    const g3 = new Intl.DateTimeFormat("pl-PL", { ...opts, timeZone: tz }).format(new Date(iso2));
    const pl = new Intl.DateTimeFormat("pl-PL", { ...opts, timeZone: "Europe/Warsaw" }).format(new Date(iso2));
    return g3 === pl ? "" : `${g3} Twojego czasu`;
  } catch {
    return "";
  }
}
var DEFAULT_TEXTS = {
  potwierdzenie: {
    subject: "Potwierdzenie: {{rodzaj}} \u2014 {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, Tw\xF3j termin jest zarezerwowany.</p>
<p style="color:#C9A24A;font-size:19px;margin:0 0 6px;">{{rodzaj}}</p>
<p style="margin:0 0 4px;">{{termin}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0 0 18px;">{{termin_lokalny}}</p>
<p style="margin:0 0 18px;">{{zoom}}</p>
<p style="margin:0 0 18px;">{{przenies}} &nbsp;\xB7&nbsp; {{anuluj}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0;">W za\u0142\u0105czniku jest plik do Twojego kalendarza. Link do spotkania dzia\u0142a od 15 minut przed terminem.</p>`
  },
  przypomnienie24: {
    subject: "Jutro: {{rodzaj}} \u2014 {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, przypominam o jutrzejszym spotkaniu.</p>
<p style="color:#C9A24A;margin:0 0 4px;">{{rodzaj}}</p>
<p style="margin:0 0 4px;">{{termin}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0 0 18px;">{{termin_lokalny}}</p>
<p style="margin:0 0 18px;">{{zoom}}</p>
<p style="margin:0;">{{przenies}} &nbsp;\xB7&nbsp; {{anuluj}}</p>`
  },
  przypomnienie1: {
    subject: "Za godzin\u0119: {{rodzaj}} \u2014 {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, spotykamy si\u0119 za godzin\u0119.</p>
<p style="margin:0 0 18px;">{{zoom}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0;">{{termin}} \xB7 {{termin_lokalny}}</p>`
  },
  przeniesienie: {
    subject: "Nowy termin: {{rodzaj}} \u2014 {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, termin zosta\u0142 przeniesiony.</p>
<p style="color:#C9A24A;margin:0 0 4px;">{{rodzaj}}</p>
<p style="margin:0 0 4px;">{{termin}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0 0 18px;">{{termin_lokalny}}</p>
<p style="margin:0 0 18px;">{{zoom}}</p>
<p style="margin:0;">{{przenies}} &nbsp;\xB7&nbsp; {{anuluj}}</p>`
  },
  anulowanie: {
    subject: "Anulowane: {{rodzaj}} \u2014 {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, spotkanie zosta\u0142o anulowane.</p>
<p style="color:#C9A24A;margin:0 0 4px;">{{rodzaj}}</p>
<p style="margin:0;">{{termin}}</p>`
  }
};
async function mailTexts(base44) {
  const r = await runSql(base44, `SELECT mail_texts FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  const t = r?.[0]?.mail_texts || {};
  const out = {};
  for (const k of Object.keys(DEFAULT_TEXTS)) {
    out[k] = {
      subject: String(t?.[k]?.subject || "").trim() || DEFAULT_TEXTS[k].subject,
      body: String(t?.[k]?.body || "").trim() || DEFAULT_TEXTS[k].body
    };
  }
  return out;
}
var shell = (inner) => `<div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
  <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;margin:0 0 18px;">EXMORTIS</p>
  ${inner}
  <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>
</div>`;
var fill = (tpl, v) => String(tpl || "").replace(/\{\{(\w+)\}\}/g, (_, k) => k in v ? v[k] : "");
function icsAttach(b, method) {
  const cancelled = method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//exmortis//rezerwacje 1:1//PL",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${b.ics_uid}`,
    `SEQUENCE:${Number(b.ics_sequence || 0)}`,
    `DTSTAMP:${stamp(/* @__PURE__ */ new Date())}`,
    `DTSTART:${stamp(b.starts_at)}`,
    `DTEND:${stamp(b.ends_at)}`,
    `SUMMARY:${icsText(`${b.type || ""} \u2014 ${b.first_name || ""}`.trim())}`,
    `DESCRIPTION:${icsText(b.zoom_link ? `Spotkanie online: ${b.zoom_link}` : "Spotkanie online \u2014 link pojawi si\u0119 przed terminem.")}`,
    `ORGANIZER;CN=exmortis:mailto:${b.organizer || "kontakt@exmortis.pl"}`,
    b.email ? `ATTENDEE;CN=${icsText(b.first_name || "")};RSVP=TRUE:mailto:${b.email}` : null,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    cancelled ? null : "BEGIN:VALARM",
    cancelled ? null : "TRIGGER:-PT30M",
    cancelled ? null : "ACTION:DISPLAY",
    cancelled ? null : "DESCRIPTION:Spotkanie",
    cancelled ? null : "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean);
  return {
    filename: cancelled ? "spotkanie-anulowane.ics" : "spotkanie.ics",
    content: lines.join("\r\n") + "\r\n",
    contentType: `text/calendar; method=${method}; charset=UTF-8`
  };
}
async function loadBooking(base44, id) {
  const r = await runSql(base44, `SELECT k.id, k.email, k.first_name, k.starts_at, k.ends_at, k.status, k.client_tz,
      k.ics_uid, k.ics_sequence, t.name AS type, t.zoom_link, t.slug
    FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id WHERE k.id = ${escStr(id)}::uuid`, true).catch(() => []);
  const b = r?.[0];
  if (b) b.organizer = await adminTo(base44).catch(() => null);
  return b || null;
}
async function mailVars(base44, b, token2) {
  const url = await loadAppUrl(base44);
  const manage = token2 ? `${url}/rezerwacja/zarzadzaj#t=${token2}` : null;
  return {
    imie: h(b.first_name || ""),
    rodzaj: h(b.type || ""),
    termin: h(plFull(b.starts_at)),
    termin_lokalny: h(localLabel(b.starts_at, b.client_tz)),
    zoom: b.zoom_link ? `<a href="${h(b.zoom_link)}" style="color:#C9A24A;">Wejd\u017A na spotkanie</a>` : "Link do spotkania pojawi si\u0119 przed terminem.",
    przenies: manage ? `<a href="${h(manage)}" style="color:#C9A24A;">Przenie\u015B termin</a>` : "",
    anuluj: manage ? `<a href="${h(manage)}&a=anuluj" style="color:#C9A24A;">Anuluj spotkanie</a>` : ""
  };
}
async function trace(base44, bookingId, kind, res) {
  await runSql(base44, `INSERT INTO public.bk_notifications (booking_id, kind, send_at, idem_key, status, sent_at)
    VALUES (${escStr(bookingId)}::uuid, ${escStr(kind)}, now(), ${escStr(`${bookingId}:${kind}:log:${Date.now()}`)},
      ${escStr(res === "wyslany" ? "wyslane" : "zaplanowane")}, now())
    ON CONFLICT (idem_key) DO NOTHING`).catch(() => {
  });
}
async function mintManageToken(base44, b) {
  const token2 = randomToken();
  await runSql(base44, `INSERT INTO public.bk_tokens (purpose, token_hash, owner_email, booking_id, expires_at)
    VALUES ('zarzadzaj', ${escStr(await sha256hex(token2))}, ${escStr(b.email || null)}, ${escStr(b.id)}::uuid,
      ${escStr(new Date(new Date(b.ends_at).getTime() + 30 * 864e5).toISOString())})`).catch(() => {
  });
  return token2;
}
async function sendBookingMail(base44, { kind, booking, token: token2 }) {
  const texts = await mailTexts(base44);
  const tpl = texts[kind] || DEFAULT_TEXTS[kind];
  const link = kind === "anulowanie" ? null : token2 || await mintManageToken(base44, booking);
  const v = await mailVars(base44, booking, link);
  const withIcs = kind === "potwierdzenie" || kind === "przeniesienie" || kind === "anulowanie";
  const res = await sendMail(base44, {
    to: booking.email,
    subject: unh(fill(tpl.subject, v)),
    html: shell(fill(tpl.body, v)),
    kind: `rez_${kind}`,
    ref: booking.id,
    attachments: withIcs ? [icsAttach(booking, kind === "anulowanie" ? "CANCEL" : "REQUEST")] : [],
    // Przypomnienie starsze niż termin nie ma po co wychodzić — także przy późniejszym opróżnianiu kolejki.
    waznyDo: kind === "przypomnienie1" || kind === "przypomnienie24" ? booking.starts_at : void 0
  });
  await trace(base44, booking.id, kind, res);
  return res;
}
async function sendAdminMail(base44, b) {
  const to = await adminTo(base44).catch(() => null);
  if (!to) return null;
  const html = `<div style="background:#0A0A0B;padding:28px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:12px;margin:0 0 14px;">EXMORTIS \xB7 REZERWACJE</p>
    <p style="margin:0 0 6px;font-size:18px;">${h(b.type)} \u2014 ${h(plFull(b.starts_at))}</p>
    <p style="color:#8A8A8C;margin:0 0 4px;">${h(b.first_name)} \xB7 ${h(b.email)}</p>
    <p style="color:#8A8A8C;margin:0;">\u0179r\xF3d\u0142o: ${b.source === "admin" ? "um\xF3wione z panelu" : "zapisa\u0142a si\u0119 sama"}</p>
  </div>`;
  return sendMail(base44, { to, subject: `Nowa rezerwacja: ${b.type} \u2014 ${plFull(b.starts_at)}`, html, kind: "rez_admin", ref: b.id, attachments: [icsAttach(b, "REQUEST")] });
}
var REMIND = [["przypomnienie24", 24 * 36e5], ["przypomnienie1", 36e5]];
async function scheduleNotifications(base44, b) {
  const seq = Number(b.ics_sequence || 0);
  for (const [kind, off] of REMIND) {
    const sendAt = new Date(new Date(b.starts_at).getTime() - off);
    if (sendAt.getTime() <= Date.now()) continue;
    await runSql(base44, `INSERT INTO public.bk_notifications (booking_id, kind, send_at, idem_key, status)
      VALUES (${escStr(b.id)}::uuid, ${escStr(kind)}, ${escStr(sendAt.toISOString())}, ${escStr(`${b.id}:${kind}:${seq}`)}, 'zaplanowane')
      ON CONFLICT (idem_key) DO NOTHING`).catch(() => {
    });
  }
}
async function dropPending(base44, bookingId) {
  await runSql(base44, `UPDATE public.bk_notifications SET status = 'pominiete'
    WHERE booking_id = ${escStr(bookingId)}::uuid AND status = 'zaplanowane'`).catch(() => {
  });
}
async function onBookingCreated(base44, bookingId, token2, source) {
  const b = await loadBooking(base44, bookingId);
  if (!b) return null;
  b.source = source;
  await scheduleNotifications(base44, b);
  await sendBookingMail(base44, { kind: "potwierdzenie", booking: b, token: token2 });
  await sendAdminMail(base44, b);
  return b;
}
async function onBookingMoved(base44, bookingId) {
  const b = await loadBooking(base44, bookingId);
  if (!b) return null;
  await dropPending(base44, bookingId);
  await scheduleNotifications(base44, b);
  await sendBookingMail(base44, { kind: "przeniesienie", booking: b, token: null });
  return b;
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
var SEED_SQL = `
INSERT INTO public.bk_types (slug, name, description, duration_min, buffer_before, buffer_after, step_min, horizon_days, access, monthly_limit, sort, questions) VALUES
 ('rozmowa-kwalifikacyjna', 'Rozmowa kwalifikacyjna POWR\xD3T', 'Bezp\u0142atna rozmowa, po kt\xF3rej oboje wiemy, czy POWR\xD3T jest dla Ciebie.', 30, 15, 15, 30, 30, 'PUBLICZNY', NULL, 1,
  '[{"id":"q1","label":"Co sprawia, \u017Ce szukasz zmiany w\u0142a\u015Bnie teraz?","required":true},
    {"id":"q2","label":"Kt\xF3r\u0105 \u015Bmier\u0107 prze\u017Cywasz: mentaln\u0105, duchow\u0105 czy \u017Cyciow\u0105? Opisz kr\xF3tko.","required":true},
    {"id":"q3","label":"Co ju\u017C pr\xF3bowa\u0142e\u015B/a\u015B zrobi\u0107?","required":false},
    {"id":"q4","label":"Czego oczekujesz po tej rozmowie?","required":true},
    {"id":"q5","label":"Czy jeste\u015B obecnie pod opiek\u0105 specjalisty (psycholog, psychiatra, terapeuta)?","required":false,"health":true}]'),
 ('rozmowa-na-progu', 'Rozmowa na progu', NULL, 90, 15, 15, 30, 60, 'PO_ZAKUPIE', 4, 2, '[]'),
 ('sesja-powrot', 'Sesja POWR\xD3T', NULL, 90, 15, 15, 30, 90, 'PAKIET', NULL, 3, '[]'),
 ('sesja-kontrolna', 'Sesja kontrolna POWR\xD3T', NULL, 60, 15, 15, 30, 90, 'PAKIET', NULL, 4, '[]')
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.bk_hours (type_id, weekday, start_local, end_local)
SELECT t.id, w, '10:00', '12:00' FROM public.bk_types t, unnest(ARRAY[2,5]) w
WHERE t.slug = 'rozmowa-kwalifikacyjna' AND NOT EXISTS (SELECT 1 FROM public.bk_hours h WHERE h.type_id = t.id);
`;

// supabase/functions/_shared/bookingGoogle.ts
var API = "https://www.googleapis.com/calendar/v3";
var CAL_NAME = "exmortis \xB7 sesje";
var TZ = "Europe/Warsaw";
var CACHE_MS = 5 * 60 * 1e3;
var busyCache = { at: 0, from: 0, to: 0, ranges: [] };
async function gerr(r) {
  const t = await r.text().catch(() => "");
  let m = "";
  try {
    m = JSON.parse(t)?.error?.message || "";
  } catch {
  }
  return `${r.status}${m ? " \xB7 " + m.slice(0, 160) : ""}`;
}
async function token(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");
  if (!accessToken) throw new Error("brak tokenu Google");
  return accessToken;
}
var call = (tk, path, init = {}) => fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json", ...init.headers || {} } });
async function mark(base44, status, error = null) {
  await runSql(base44, `UPDATE public.bk_settings SET google_status = ${escStr(status)}, google_status_at = now(),
    google_error = ${error ? escStr(String(error).slice(0, 500)) : "NULL"} WHERE id = 1`).catch(() => {
  });
}
async function ensureCalendar(base44) {
  const [row] = await runSql(base44, `SELECT google_calendar_id FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  if (row?.google_calendar_id) return row.google_calendar_id;
  const tk = await token(base44);
  const r = await call(tk, "/calendars", { method: "POST", body: JSON.stringify({ summary: CAL_NAME, timeZone: TZ }) });
  if (!r.ok) throw new Error(await gerr(r));
  const j = await r.json();
  await runSql(base44, `UPDATE public.bk_settings SET google_calendar_id = ${escStr(j.id)}, updated_at = now() WHERE id = 1`);
  return j.id;
}
async function typeDuration(base44, typeId) {
  const [r] = await runSql(base44, `SELECT duration_min FROM public.bk_types WHERE id = ${escStr(typeId)}::uuid`, true).catch(() => []);
  return r?.duration_min || null;
}
async function busyOn(base44) {
  const [s] = await runSql(base44, `SELECT google_busy FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  return s?.google_busy !== false;
}
var overlapsBusy = (startIso, endIso, ranges) => {
  const a = new Date(startIso).getTime(), b = new Date(endIso).getTime();
  return (ranges || []).some((r) => a < r.to && b > r.from);
};
async function freeBusy(base44, from, to, fresh = false) {
  const f = new Date(from).getTime(), t = new Date(to).getTime(), now = Date.now();
  if (!fresh && busyCache.ranges.length && now - busyCache.at < CACHE_MS && busyCache.from <= f && busyCache.to >= t) {
    return { ok: true, cached: true, ranges: busyCache.ranges };
  }
  try {
    const tk = await token(base44);
    const r = await call(tk, "/freeBusy", { method: "POST", body: JSON.stringify({
      timeMin: new Date(f).toISOString(),
      timeMax: new Date(t).toISOString(),
      items: [{ id: "primary" }]
    }) });
    if (!r.ok) throw new Error(await gerr(r));
    const j = await r.json();
    const cal = j?.calendars?.primary;
    if (cal?.errors?.length) throw new Error(`freeBusy: ${cal.errors[0]?.reason || "b\u0142\u0105d"}`);
    const ranges = (cal?.busy || []).map((b) => ({ from: new Date(b.start).getTime(), to: new Date(b.end).getTime() }));
    busyCache = { at: now, from: f, to: t, ranges };
    await mark(base44, "ok");
    return { ok: true, cached: false, ranges };
  } catch (e) {
    await mark(base44, "error", e.message);
    return { ok: false, ranges: [] };
  }
}
async function dropBusy(base44, slots, from, to) {
  if (!slots.length || !await busyOn(base44)) return slots;
  const b = await freeBusy(base44, from, to);
  if (!b.ok) return slots;
  return slots.filter((s) => !overlapsBusy(s.start, s.end, b.ranges));
}
async function takenByGoogle(base44, startIso, endIso) {
  if (!await busyOn(base44)) return false;
  const b = await freeBusy(base44, startIso, endIso, true);
  return b.ok && overlapsBusy(startIso, endIso, b.ranges);
}
async function queue(base44, bookingId, op, error) {
  await runSql(base44, `INSERT INTO public.bk_gcal_queue (booking_id, op, attempts, last_error)
    VALUES (${escStr(bookingId)}::uuid, ${escStr(op)}, 1, ${escStr(String(error).slice(0, 500))})
    ON CONFLICT (booking_id, op) DO UPDATE SET attempts = bk_gcal_queue.attempts + 1, last_error = EXCLUDED.last_error`).catch(() => {
  });
}
async function loadRow(base44, bookingId) {
  const r = await runSql(base44, `SELECT k.id, k.starts_at, k.ends_at, k.first_name, k.status, k.gcal_event_id,
      t.name AS type FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
    WHERE k.id = ${escStr(bookingId)}::uuid`, true).catch(() => []);
  return r?.[0] || null;
}
async function push(base44, row) {
  const cal = await ensureCalendar(base44);
  const tk = await token(base44);
  const body = {
    summary: ["exmortis", row.type, row.first_name].filter(Boolean).join(" \xB7 "),
    start: { dateTime: new Date(row.starts_at).toISOString(), timeZone: TZ },
    end: { dateTime: new Date(row.ends_at).toISOString(), timeZone: TZ }
  };
  const path = row.gcal_event_id ? `/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(row.gcal_event_id)}` : `/calendars/${encodeURIComponent(cal)}/events`;
  const r = await call(tk, `${path}?sendUpdates=none`, { method: row.gcal_event_id ? "PATCH" : "POST", body: JSON.stringify(body) });
  if (row.gcal_event_id && (r.status === 404 || r.status === 410)) {
    await runSql(base44, `UPDATE public.bk_bookings SET gcal_event_id = NULL WHERE id = ${escStr(row.id)}::uuid`).catch(() => {
    });
    return push(base44, { ...row, gcal_event_id: null });
  }
  if (!r.ok) throw new Error(await gerr(r));
  const j = await r.json();
  await runSql(base44, `UPDATE public.bk_bookings SET gcal_event_id = ${escStr(j.id)}, gcal_synced_at = now() WHERE id = ${escStr(row.id)}::uuid`).catch(() => {
  });
  return j.id;
}
async function syncBooking(base44, bookingId, op) {
  try {
    const row = await loadRow(base44, bookingId);
    if (!row) return { ok: false };
    if (op === "delete" || row.status !== "POTWIERDZONA") {
      if (row.gcal_event_id) {
        const cal = await ensureCalendar(base44);
        const tk = await token(base44);
        const r = await call(tk, `/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(row.gcal_event_id)}?sendUpdates=none`, { method: "DELETE" });
        if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(await gerr(r));
        await runSql(base44, `UPDATE public.bk_bookings SET gcal_event_id = NULL, gcal_synced_at = now() WHERE id = ${escStr(row.id)}::uuid`).catch(() => {
        });
      }
    } else {
      await push(base44, row);
    }
    await runSql(base44, `DELETE FROM public.bk_gcal_queue WHERE booking_id = ${escStr(row.id)}::uuid`).catch(() => {
    });
    await mark(base44, "ok");
    return { ok: true };
  } catch (e) {
    await queue(base44, bookingId, op === "delete" ? "delete" : "upsert", e.message);
    await mark(base44, "error", e.message);
    return { ok: false, error: e.message };
  }
}
async function googleStatus(base44) {
  const [s] = await runSql(base44, `SELECT google_calendar_id, google_busy, google_status, google_status_at, google_error
    FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  const [q] = await runSql(base44, `SELECT count(*)::int AS n FROM public.bk_gcal_queue`, true).catch(() => []);
  let account = null, connected = false;
  try {
    const tk = await token(base44);
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tk}` } });
    if (r.ok) {
      const j = await r.json();
      account = j.email || null;
      connected = true;
    } else connected = (await freeBusy(base44, (/* @__PURE__ */ new Date()).toISOString(), new Date(Date.now() + 36e5).toISOString())).ok;
  } catch {
  }
  return {
    connected,
    account,
    calendar_id: s?.google_calendar_id || null,
    busy: s?.google_busy !== false,
    status: s?.google_status || null,
    status_at: s?.google_status_at || null,
    error: s?.google_error || null,
    pending: q?.n || 0,
    scopes: ["calendar.app.created", "calendar.freebusy", "email"]
  };
}

// supabase/functions/bookingAdmin/index.ts
var int = (v, min, max, def = null) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== "" && v !== null ? Math.min(max, Math.max(min, n)) : def;
};
var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
var iso = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new Error("Niepoprawna data");
  return d.toISOString();
};
var uuidOrNull = (v) => {
  const s = String(v || "").trim();
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s) ? s : null;
};
var log = (base44, actor, action, type, id, summary) => runSql(
  base44,
  `INSERT INTO public.bk_log (actor, action, object_type, object_id, summary) VALUES (${escStr(actor)}, ${escStr(action)}, ${esc(type)}, ${esc(id)}, ${esc(summary)})`
);
var POWROT_KEY = "powrot_sesje";
var POWROT_DEFAULTS = { type_slug: "sesja-powrot", sessions: 8, gap_days: 14, valid_months: 6 };
async function powrotDefaults(base44) {
  const s = await getSetting(base44, POWROT_KEY).catch(() => null);
  return { ...POWROT_DEFAULTS, ...s && typeof s === "object" ? s : {} };
}
var typesEnsured = false;
async function ensureTypes(base44) {
  if (typesEnsured) return;
  await runSql(base44, `INSERT INTO public.bk_types (slug, name, description, duration_min, buffer_before, buffer_after, step_min, horizon_days, access, monthly_limit, sort, questions, active)
    VALUES ('indywidualne-konsultacje', 'Indywidualne konsultacje', 'Spotkanie jeden na jeden: rozmowa o tym, z czym przychodzisz, i o najbli\u017Cszym kroku.', 60, 15, 15, 30, 60, 'PAKIET', NULL, 5, '[]', false)
    ON CONFLICT (slug) DO NOTHING`).catch(() => {
  });
  typesEnsured = true;
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me2 = await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    if (a === "migrate") {
      await runSql(base44, SCHEMA_SQL);
      await runSql(base44, SEED_SQL);
      return Response.json({ ok: true });
    }
    if (a === "status") {
      const keys = await loadKeys(body.simulate_missing_keys === true);
      return Response.json({ keys_ok: keys.ok, keys: keys.info, mode: await getMode(base44, true) });
    }
    if (a === "get") {
      await ensureTypes(base44);
      const [s, types, hours, blocks, hol] = await Promise.all([
        runSql(base44, `SELECT mode, min_notice_h, daily_limit, weekly_limit, late_cancel_policy, threshold_product_id, threshold_type_id, threshold_sessions, threshold_valid_days, service_consent_version, service_consent_text FROM public.bk_settings WHERE id = 1`, true),
        runSql(base44, `SELECT id, slug, name, description, duration_min, buffer_before, buffer_after, step_min, horizon_days, access, zoom_link, questions, change_window_h, monthly_limit, active FROM public.bk_types ORDER BY sort, name`, true),
        runSql(base44, `SELECT id, type_id, weekday, to_char(start_local,'HH24:MI') AS "from", to_char(end_local,'HH24:MI') AS "to" FROM public.bk_hours ORDER BY weekday, start_local`, true),
        runSql(base44, `SELECT id, kind, starts_at, ends_at, rep_weekday, to_char(rep_from,'HH24:MI') AS rep_from, to_char(rep_to,'HH24:MI') AS rep_to, note FROM public.bk_blocks WHERE NOT disabled AND ends_at > now() ORDER BY starts_at LIMIT 200`, true),
        runSql(base44, `SELECT d, name, blocked FROM public.bk_holidays WHERE d >= date_trunc('year', now())::date ORDER BY d`, true)
      ]);
      return Response.json({ settings: s[0], types: types.map((t) => ({ ...t, hours: hours.filter((h2) => h2.type_id === t.id) })), blocks, holidays: hol });
    }
    if (a === "save_settings") {
      const mode = ["off", "admin", "on"].includes(body.mode) ? body.mode : "off";
      const daily = int(body.daily_limit, 1, 20, 3), weekly = int(body.weekly_limit, 1, 100, null);
      const policy = body.late_cancel_policy === "przepada" ? "przepada" : "admin";
      const prodId = uuidOrNull(body.threshold_product_id), typeId = uuidOrNull(body.threshold_type_id);
      const thSessions = int(body.threshold_sessions, 1, 20, 1), thDays = int(body.threshold_valid_days, 1, 365, 60);
      const svcText = String(body.service_consent_text || "").trim().slice(0, 2e3);
      if (!svcText) throw new Error("Tre\u015B\u0107 zgody nie mo\u017Ce by\u0107 pusta");
      const svcVer = String(body.service_consent_version || "").trim().slice(0, 40) || "rez-2026-11";
      await runSql(base44, `UPDATE public.bk_settings SET mode = ${escStr(mode)}, daily_limit = ${daily}, weekly_limit = ${esc(weekly)},
        late_cancel_policy = ${escStr(policy)}, threshold_product_id = ${esc(prodId)}, threshold_type_id = ${esc(typeId)},
        threshold_sessions = ${thSessions}, threshold_valid_days = ${thDays},
        service_consent_text = ${escStr(svcText)}, service_consent_version = ${escStr(svcVer)}, updated_at = now() WHERE id = 1`);
      await log(base44, me2.email, "ustawienia", "settings", "1", `tryb=${mode} dzien=${daily} tydzien=${weekly ?? "-"} pozne=${policy} prog=${prodId ? "tak" : "nie"}`);
      await getMode(base44, true);
      return Response.json({ ok: true });
    }
    if (a === "save_type") {
      const t = body.type || {};
      const name = textField(t, "name", { max: 120 });
      const access = ["PUBLICZNY", "PO_ZAKUPIE", "PAKIET"].includes(t.access) ? t.access : "PAKIET";
      const zoom = t.zoom_link ? String(t.zoom_link).trim() : null;
      if (zoom && !/^https:\/\/\S+$/.test(zoom)) throw new Error("Link Zoom musi zaczyna\u0107 si\u0119 od https://");
      const qs = Array.isArray(t.questions) ? t.questions.slice(0, 10).map((q, i) => ({
        id: /^[a-z0-9]{1,10}$/.test(q.id) ? q.id : `q${i + 1}`,
        label: String(q.label || "").slice(0, 300),
        required: !!q.required,
        health: !!q.health
      })).filter((q) => q.label) : [];
      const cols = {
        name: escStr(name),
        description: esc(t.description ? String(t.description).slice(0, 2e3) : null),
        duration_min: int(t.duration_min, 10, 480, 60),
        buffer_before: int(t.buffer_before, 0, 240, 0),
        buffer_after: int(t.buffer_after, 0, 240, 0),
        step_min: int(t.step_min, 5, 240, 30),
        horizon_days: int(t.horizon_days, 1, 365, 60),
        access: escStr(access),
        zoom_link: esc(zoom),
        questions: `${escStr(JSON.stringify(qs))}::jsonb`,
        change_window_h: int(t.change_window_h, 0, 720, 24),
        monthly_limit: esc(int(t.monthly_limit, 1, 100, null)),
        active: t.active === true ? "TRUE" : "FALSE"
      };
      let id = t.id;
      if (id) {
        await runSql(base44, `UPDATE public.bk_types SET ${Object.entries(cols).map(([k, v]) => `${k} = ${v}`).join(", ")} WHERE id = ${escStr(id)}`);
      } else {
        const slug = String(t.slug || "").toLowerCase();
        if (!/^[a-z0-9-]{2,60}$/.test(slug)) throw new Error("Adres: ma\u0142e litery, cyfry i my\u015Blniki");
        id = (await runSql(base44, `INSERT INTO public.bk_types (slug, ${Object.keys(cols).join(", ")}) VALUES (${escStr(slug)}, ${Object.values(cols).join(", ")}) RETURNING id`))[0].id;
      }
      await log(base44, me2.email, "rodzaj", "type", id, `${name} aktywny=${t.active === true}`);
      return Response.json({ ok: true, id });
    }
    if (a === "save_hours") {
      const typeId = textField(body, "type_id", { max: 40 });
      const rows = (Array.isArray(body.hours) ? body.hours : []).slice(0, 50).map((h2) => {
        const w = int(h2.weekday, 1, 7);
        if (!w || !TIME.test(h2.from) || !TIME.test(h2.to) || h2.to <= h2.from) throw new Error("Godziny: koniec musi by\u0107 po pocz\u0105tku");
        return `(${escStr(typeId)}::uuid, ${w}, ${escStr(h2.from)}::time, ${escStr(h2.to)}::time)`;
      });
      await runSql(base44, `WITH d AS (DELETE FROM public.bk_hours WHERE type_id = ${escStr(typeId)}::uuid)
        ${rows.length ? `INSERT INTO public.bk_hours (type_id, weekday, start_local, end_local) VALUES ${rows.join(", ")}` : "SELECT 1"}`);
      await log(base44, me2.email, "godziny", "type", typeId, `${rows.length} przedzialow`);
      return Response.json({ ok: true });
    }
    if (a === "save_block") {
      const b = body.block || {};
      const kind = ["jednorazowa", "calodniowa", "powtarzalna"].includes(b.kind) ? b.kind : "jednorazowa";
      const st = iso(b.starts_at), en = iso(b.ends_at);
      if (en <= st) throw new Error("Koniec musi by\u0107 po pocz\u0105tku");
      let rep = "NULL, NULL, NULL";
      if (kind === "powtarzalna") {
        const w = int(b.rep_weekday, 1, 7);
        if (!w || !TIME.test(b.rep_from) || !TIME.test(b.rep_to) || b.rep_to <= b.rep_from) throw new Error("Podaj dzie\u0144 tygodnia i godziny");
        rep = `${w}, ${escStr(b.rep_from)}::time, ${escStr(b.rep_to)}::time`;
      }
      const id = (await runSql(base44, `INSERT INTO public.bk_blocks (kind, starts_at, ends_at, rep_weekday, rep_from, rep_to, note, created_by)
        VALUES (${escStr(kind)}, ${escStr(st)}, ${escStr(en)}, ${rep}, ${esc(b.note ? String(b.note).slice(0, 500) : null)}, ${escStr(me2.email)}) RETURNING id`))[0].id;
      const coll = await runSql(base44, `SELECT k.id, t.name AS type, k.starts_at, k.first_name FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
        JOIN public.bk_blocks x ON x.id = ${escStr(id)}::uuid
        WHERE k.status = 'POTWIERDZONA' AND k.busy && tstzrange(x.starts_at, x.ends_at, '[)')
          AND (x.kind <> 'powtarzalna' OR (extract(isodow FROM (k.starts_at AT TIME ZONE 'Europe/Warsaw'))::int = x.rep_weekday
            AND k.busy && tstzrange(((k.starts_at AT TIME ZONE 'Europe/Warsaw')::date + x.rep_from) AT TIME ZONE 'Europe/Warsaw',
              ((k.starts_at AT TIME ZONE 'Europe/Warsaw')::date + x.rep_to) AT TIME ZONE 'Europe/Warsaw', '[)')))
        ORDER BY k.starts_at`, true);
      await log(base44, me2.email, "blokada", "block", id, `${kind} ${st}\u2013${en}`);
      return Response.json({ ok: true, id, collisions: coll });
    }
    if (a === "delete_block") {
      const id = textField(body, "id", { max: 40 });
      await runSql(base44, `UPDATE public.bk_blocks SET disabled = TRUE WHERE id = ${escStr(id)}::uuid`);
      await log(base44, me2.email, "blokada_usunieta", "block", id, null);
      return Response.json({ ok: true });
    }
    if (a === "toggle_holiday") {
      const d = textField(body, "d", { max: 10 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Niepoprawna data");
      await runSql(base44, `UPDATE public.bk_holidays SET blocked = ${body.blocked === true ? "TRUE" : "FALSE"} WHERE d = ${escStr(d)}::date`);
      await log(base44, me2.email, body.blocked === true ? "swieto_zablokowane" : "swieto_odblokowane", "holiday", d, null);
      return Response.json({ ok: true });
    }
    if (a === "bookings") {
      const rows = await runSql(base44, `SELECT k.id, t.name AS type, k.starts_at, k.ends_at, k.first_name, k.email, k.status, k.source, k.client_tz
        FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
        WHERE k.ends_at > now() - interval '7 days' ORDER BY k.starts_at LIMIT 200`, true);
      return Response.json({ bookings: rows });
    }
    if (a === "detail") {
      const keys = await loadKeys();
      if (!keys.ok) throw new Error(KEYS_MSG);
      const id = textField(body, "id", { max: 40 });
      const [booking] = await runSql(base44, `SELECT k.id, t.name AS type, t.zoom_link, t.questions, k.starts_at, k.first_name, k.email, k.status FROM public.bk_bookings k
        JOIN public.bk_types t ON t.id = k.type_id WHERE k.id = ${escStr(id)}::uuid`, true);
      if (!booking) return Response.json({ error: "Nie znaleziono" }, { status: 404 });
      const d = await rpc(base44, "bk_admin_detail", { p_id: id });
      const health = d?.health_enc ? await decryptHealth(keys.enc, d.health_enc).catch(() => null) : null;
      await log(base44, me2.email, "odczyt_odpowiedzi", "booking", id, null);
      return Response.json({ booking, detail: { answers: d?.answers ?? null, health_consent: d?.health_consent ?? false, deleted_at: d?.deleted_at ?? null, health } });
    }
    if (a === "products") {
      const rows = await runSql(base44, `SELECT id, name, active, product_type FROM public.products ORDER BY name LIMIT 500`, true);
      return Response.json({ products: rows });
    }
    if (a === "packages") {
      await ensureTypes(base44);
      const types = await runSql(base44, `SELECT id, slug, name, active FROM public.bk_types WHERE access = 'PAKIET' ORDER BY sort, name`, true);
      const rows = await runSql(base44, `SELECT pk.id, t.name AS type, t.id AS type_id, pk.email_display AS email, pk.sessions_total, pk.sessions_used,
          pk.valid_until, pk.min_gap_days, pk.payment_status, pk.source, pk.order_id, pk.created_at,
          (SELECT max(k.starts_at) FROM public.bk_bookings k WHERE k.package_id = pk.id AND k.status IN ('POTWIERDZONA','ODBYLA_SIE')) AS last_start
        FROM public.bk_packages pk JOIN public.bk_types t ON t.id = pk.type_id ORDER BY pk.created_at DESC LIMIT 500`, true);
      return Response.json({ packages: rows || [], types: types || [], defaults: await powrotDefaults(base44) });
    }
    if (a === "powrot_defaults") {
      const cur = await powrotDefaults(base44);
      const slug = /^[a-z0-9-]{2,60}$/.test(String(body.type_slug || "")) ? String(body.type_slug) : cur.type_slug;
      const next = { type_slug: slug, sessions: int(body.sessions, 1, 100, cur.sessions), gap_days: int(body.gap_days, 0, 90, cur.gap_days), valid_months: int(body.valid_months, 1, 36, cur.valid_months) };
      await saveSetting(base44, POWROT_KEY, next);
      await log(base44, me2.email, "powrot_domyslne", "settings", POWROT_KEY, `${next.sessions} spotka\u0144, co ${next.gap_days} dni, ${next.valid_months} mies.`);
      return Response.json({ ok: true, defaults: next });
    }
    if (a === "grant_package") {
      const email = emailField(body).toLowerCase();
      const d = await powrotDefaults(base44);
      const typeId = uuidOrNull(body.type_id) || (await runSql(base44, `SELECT id FROM public.bk_types WHERE slug = ${escStr(d.type_slug)}`, true))?.[0]?.id;
      if (!typeId) throw new Error("Brak rodzaju spotkania \u2014 wybierz go albo ustaw w parametrach domy\u015Blnych.");
      const sessions = int(body.sessions_total, 1, 100, d.sessions), gap = int(body.min_gap_days, 0, 90, d.gap_days);
      const until = body.valid_until ? iso(`${String(body.valid_until).slice(0, 10)}T21:59:59Z`) : new Date(Date.now() + d.valid_months * 30.5 * 864e5).toISOString();
      if (new Date(until).getTime() < Date.now()) throw new Error("Data wa\u017Cno\u015Bci jest w przesz\u0142o\u015Bci.");
      const users = await base44.asServiceRole.entities.User.filter({ email }, "-created_date", 1).catch(() => []);
      const uid = users?.[0]?.id || `email:${email}`;
      const dup = await runSql(base44, `SELECT id FROM public.bk_packages WHERE type_id = ${escStr(typeId)}::uuid AND lower(email_display) = ${escStr(email)}
        AND valid_until > now() AND sessions_used < sessions_total AND payment_status = 'oplacony' LIMIT 1`, true);
      if (dup?.length && body.force !== true) return Response.json({ error: "Ta osoba ma ju\u017C aktywny dost\u0119p do tego rodzaju spotka\u0144 \u2014 zmie\u0144 jego parametry na li\u015Bcie poni\u017Cej.", duplicate: dup[0].id }, { status: 409 });
      const [row] = await runSql(base44, `INSERT INTO public.bk_packages (user_id, email_display, type_id, sessions_total, valid_until, min_gap_days, source, payment_status)
        VALUES (${escStr(uid)}, ${escStr(email)}, ${escStr(typeId)}::uuid, ${sessions}, ${escStr(until)}::timestamptz, ${gap}, 'reczny', 'oplacony') RETURNING id`);
      await log(base44, me2.email, "pakiet_nadany", "package", row?.id, `${email}: ${sessions} spotka\u0144, co ${gap} dni, do ${until.slice(0, 10)}${users?.[0] ? "" : " (bez konta \u2014 dopasowanie po e-mailu)"}`);
      return Response.json({ ok: true, id: row?.id, has_account: !!users?.[0] });
    }
    if (a === "update_package") {
      const id = uuidOrNull(body.package_id);
      if (!id) throw new Error("Brak pakietu");
      const [p] = await runSql(base44, `SELECT sessions_used FROM public.bk_packages WHERE id = ${escStr(id)}::uuid`, true);
      if (!p) return Response.json({ error: "Nie znaleziono pakietu" }, { status: 404 });
      const sets = [];
      if (body.sessions_total !== void 0) sets.push(`sessions_total = ${Math.max(int(body.sessions_total, 1, 100, 1), Number(p.sessions_used) || 0, 1)}`);
      if (body.min_gap_days !== void 0) sets.push(`min_gap_days = ${int(body.min_gap_days, 0, 90, 0)}`);
      if (body.end_now === true) sets.push(`valid_until = now()`);
      else if (body.valid_until) sets.push(`valid_until = ${escStr(iso(`${String(body.valid_until).slice(0, 10)}T21:59:59Z`))}::timestamptz`);
      if (!sets.length) return Response.json({ ok: true });
      await runSql(base44, `UPDATE public.bk_packages SET ${sets.join(", ")} WHERE id = ${escStr(id)}::uuid`);
      await log(base44, me2.email, "pakiet_zmiana", "package", id, sets.join("; ").slice(0, 300));
      return Response.json({ ok: true });
    }
    if (a === "return_session") {
      const r = await rpc(base44, "bk_return_session", { p: {
        package_id: textField(body, "package_id", { max: 40 }),
        actor: me2.email,
        note: String(body.note || "").slice(0, 200) || null
      } });
      return Response.json(r, { status: r?.error ? 404 : 200 });
    }
    if (a === "book") {
      const typeId = textField(body, "type_id", { max: 40 });
      const st = iso(body.starts_at);
      const dur = await typeDuration(base44, typeId);
      if (dur && await takenByGoogle(base44, st, new Date(new Date(st).getTime() + dur * 6e4).toISOString())) {
        return Response.json({ error: "Ten termin jest zaj\u0119ty w Twoim kalendarzu Google." }, { status: 409 });
      }
      const r = await rpc(base44, "bk_book", { p: {
        type_id: typeId,
        starts_at: st,
        email: emailField(body).toLowerCase(),
        first_name: textField(body, "first_name", { max: 120 }),
        viewer_admin: true,
        source: "admin",
        actor: me2.email
      } });
      if (!r?.error && r?.id) await onBookingCreated(base44, r.id, null, "admin").catch(() => {
      });
      if (!r?.error && r?.id) await syncBooking(base44, r.id, "upsert").catch(() => {
      });
      return Response.json(r, { status: r?.error ? 409 : 200 });
    }
    if (a === "slots") {
      const from = new Date(body.from || Date.now());
      const to = new Date(Math.min(new Date(body.to || Date.now() + 31 * 864e5).getTime(), from.getTime() + 62 * 864e5));
      if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error("Niepoprawny zakres");
      const rows = await rpc(base44, "bk_free_slots", {
        p_type: textField(body, "type_id", { max: 40 }),
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_admin: true,
        p_ignore: null
      });
      const slots = (rows || []).map((r) => ({ start: r.slot_start, end: r.slot_end }));
      return Response.json({ slots: await dropBusy(base44, slots, from.toISOString(), to.toISOString()) });
    }
    if (a === "calendar") {
      const from = new Date(body.from || Date.now());
      const to = new Date(body.to || Date.now() + 7 * 864e5);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error("Niepoprawny zakres");
      const r = await rpc(base44, "bk_admin_calendar", { p_from: from.toISOString(), p_to: to.toISOString() });
      return Response.json(r || { bookings: [], events: [], blocks: [], unmarked: 0 });
    }
    if (a === "dashboard") {
      const cal = await rpc(base44, "bk_admin_calendar", { p_from: (/* @__PURE__ */ new Date()).toISOString(), p_to: new Date(Date.now() + 2 * 864e5).toISOString() });
      const log2 = await runSql(base44, `SELECT at, actor, action, summary FROM public.bk_log
        WHERE action IN ('rezerwacja','rezerwacja_z_pakietu','przeniesienie','anulowanie_klient','anulowanie_admin','status_po_spotkaniu','sesja_oddana')
        ORDER BY at DESC LIMIT 12`, true);
      const g3 = await googleStatus(base44);
      return Response.json({
        ...cal || { bookings: [], events: [], blocks: [], unmarked: 0 },
        log: log2,
        google: { status: g3.status, error: g3.error, pending: g3.pending, busy: g3.busy }
      });
    }
    if (a === "mark_status") {
      const r = await rpc(base44, "bk_mark_status", { p: {
        booking_id: textField(body, "booking_id", { max: 40 }),
        status: textField(body, "status", { max: 20 }),
        actor: me2.email
      } });
      const map = { bad: "Nieznany status.", not_found: "Nie znaleziono rezerwacji.", closed: "Ta rezerwacja jest ju\u017C zamkni\u0119ta.", future: "Termin jeszcze si\u0119 nie odby\u0142." };
      if (r?.error) return Response.json({ error: map[r.error] || "Nie uda\u0142o si\u0119 oznaczy\u0107." }, { status: 409 });
      return Response.json(r);
    }
    if (a === "reschedule") {
      const bookingId = textField(body, "booking_id", { max: 40 });
      const r = await rpc(base44, "bk_reschedule", { p: { booking_id: bookingId, starts_at: iso(body.starts_at), viewer_admin: true, actor: me2.email } });
      if (r?.error) return Response.json({ error: r.error === "taken" ? "Ten termin jest zaj\u0119ty." : "Nie uda\u0142o si\u0119 przenie\u015B\u0107." }, { status: 409 });
      await runSql(base44, `UPDATE public.bk_bookings SET ics_sequence = ics_sequence + 1 WHERE id = ${escStr(bookingId)}::uuid`);
      await onBookingMoved(base44, bookingId).catch(() => {
      });
      await syncBooking(base44, bookingId, "upsert").catch(() => {
      });
      return Response.json(r);
    }
    if (a === "send_mail") {
      const kind = ["potwierdzenie", "przypomnienie24", "przypomnienie1"].includes(body.kind) ? body.kind : "potwierdzenie";
      const booking = await loadBooking(base44, textField(body, "booking_id", { max: 40 }));
      if (!booking) return Response.json({ error: "Nie znaleziono" }, { status: 404 });
      const res = await sendBookingMail(base44, { kind, booking, token: null });
      await log(base44, me2.email, "wysylka_reczna", "booking", booking.id, kind);
      return Response.json({ ok: true, result: res });
    }
    if (a === "unavailable") {
      const preset = ["do-konca-dnia", "2h", "jutro"].includes(body.preset) ? body.preset : "2h";
      const note = String(body.note || "").slice(0, 200) || null;
      const range = {
        "do-konca-dnia": `(date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw')) AT TIME ZONE 'Europe/Warsaw',
          ((date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw') + interval '1 day') - interval '1 minute') AT TIME ZONE 'Europe/Warsaw'`,
        "2h": `now(), now() + interval '2 hours'`,
        "jutro": `(date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw') + interval '1 day') AT TIME ZONE 'Europe/Warsaw',
          (date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw') + interval '2 days') AT TIME ZONE 'Europe/Warsaw'`
      }[preset];
      const id = (await runSql(base44, `INSERT INTO public.bk_blocks (kind, starts_at, ends_at, note, created_by)
        VALUES (${preset === "2h" ? "'jednorazowa'" : "'calodniowa'"}, ${range}, ${esc(note)}, ${escStr(me2.email)}) RETURNING id`))[0].id;
      await log(base44, me2.email, "blokada", "block", id, `niedostepny: ${preset}`);
      return Response.json({ ok: true, id, preset });
    }
    if (a === "export_csv") {
      const from = new Date(body.from || Date.now() - 30 * 864e5);
      const to = new Date(body.to || Date.now() + 90 * 864e5);
      const rows = await rpc(base44, "bk_export_rows", { p_from: from.toISOString(), p_to: to.toISOString() });
      const cols = ["starts_at", "koniec", "rodzaj", "imie", "email", "status", "zrodlo", "strefa"];
      const cell = (v) => {
        let s = v === null || v === void 0 ? "" : String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = [cols.join(","), ...(rows || []).map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
      await log(base44, me2.email, "eksport", "csv", null, `${(rows || []).length} wierszy`);
      return Response.json({ csv, rows: (rows || []).length });
    }
    if (a === "ical") {
      const r = await runSql(base44, `SELECT ical_token, ical_rotated_at FROM public.bk_settings WHERE id = 1`, true);
      const had = r?.[0]?.ical_token;
      let token2 = had;
      if (body.rotate === true || !had) {
        token2 = randomToken();
        await rpc(base44, "bk_rotate_ical", { p_token: token2 });
        await log(base44, me2.email, "ical_obrot", "settings", "1", null);
      }
      const appUrl = await loadAppUrl(base44);
      return Response.json({ url: `${appUrl}/functions/bookingPublic?ical=${token2}`, rotated_at: r?.[0]?.ical_rotated_at || null, fresh: body.rotate === true || !had });
    }
    if (a === "mail_texts") return Response.json({ texts: await mailTexts(base44), defaults: DEFAULT_TEXTS });
    if (a === "save_mail_texts") {
      const src = body.texts && typeof body.texts === "object" ? body.texts : {};
      const out = {};
      for (const k of Object.keys(DEFAULT_TEXTS)) {
        out[k] = {
          subject: String(src?.[k]?.subject || "").slice(0, 200).trim() || DEFAULT_TEXTS[k].subject,
          body: String(src?.[k]?.body || "").slice(0, 8e3).trim() || DEFAULT_TEXTS[k].body
        };
      }
      await runSql(base44, `UPDATE public.bk_settings SET mail_texts = ${escStr(JSON.stringify(out))}::jsonb, updated_at = now() WHERE id = 1`);
      await log(base44, me2.email, "tresci_maili", "settings", "1", null);
      return Response.json({ ok: true, texts: out });
    }
    if (a === "google_status") return Response.json({ google: await googleStatus(base44) });
    if (a === "google_calendar") {
      try {
        const id = await ensureCalendar(base44);
        await log(base44, me2.email, "google_kalendarz", "settings", "1", id || null);
        return Response.json({ ok: true, calendar_id: id });
      } catch {
        return Response.json({ error: "Nie uda\u0142o si\u0119 utworzy\u0107 kalendarza w Google." }, { status: 400 });
      }
    }
    if (a === "save_google") {
      await runSql(base44, `UPDATE public.bk_settings SET google_busy = ${body.busy === true ? "TRUE" : "FALSE"}, updated_at = now() WHERE id = 1`);
      await log(base44, me2.email, "google_zajetosc", "settings", "1", body.busy === true ? "wlaczona" : "wylaczona");
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    if (e.message === "FORBIDDEN") return Response.json({ error: "Forbidden" }, { status: 403 });
    console.error("bookingAdmin:", safeErr(e));
    const userMsg = /^(Niepoprawn|Koniec|Podaj|Godziny|Link Zoom|Adres|Brak pola|Pole|Rezerwacje)/.test(e.message) ? e.message : "Nie uda\u0142o si\u0119 zapisa\u0107.";
    return Response.json({ error: userMsg }, { status: 400 });
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
    const h2 = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h2.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h2 });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
