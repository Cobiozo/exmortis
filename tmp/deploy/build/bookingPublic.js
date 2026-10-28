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

// supabase/functions/_shared/shim.ts
var secrets = {
  get: (k) => Deno.env.get(k) ?? null
};

// supabase/functions/_shared/bookingCrypto.ts
var te = new TextEncoder();
var td = new TextDecoder();
var toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function aesKeyFromSecret(bytes) {
  const raw = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptHealth(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(String(text))));
  const out = new Uint8Array(1 + 12 + ct.length);
  out[0] = 1;
  out.set(iv, 1);
  out.set(ct, 13);
  return toHex(out);
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
async function safeEqual(a, b) {
  const x = await sha256hex(String(a)), y = await sha256hex(String(b));
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
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
var CONSENTS = {
  regulamin: { version: "rez-2026-10", text: "Akceptuj\u0119 regulamin i polityk\u0119 prywatno\u015Bci exmortis." },
  zdrowie: { version: "rez-2026-10", text: "Zgadzam si\u0119 na przetwarzanie podanych przeze mnie informacji o zdrowiu wy\u0142\u0105cznie w celu przygotowania rozmowy. Dane zostan\u0105 usuni\u0119te 60 dni po rozmowie." }
};
var TZ_RE = /^[A-Za-z_+\-\/0-9]{1,64}$/;

// supabase/functions/_shared/smtp.ts
import nodemailer2 from "npm:nodemailer@6.9.13";

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
var plFull = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
function localLabel(iso, tz) {
  if (!tz) return "";
  try {
    const opts = { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" };
    const g3 = new Intl.DateTimeFormat("pl-PL", { ...opts, timeZone: tz }).format(new Date(iso));
    const pl = new Intl.DateTimeFormat("pl-PL", { ...opts, timeZone: "Europe/Warsaw" }).format(new Date(iso));
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
async function onBookingCancelled(base44, bookingId) {
  const b = await loadBooking(base44, bookingId);
  if (!b) return null;
  await dropPending(base44, bookingId);
  await sendBookingMail(base44, { kind: "anulowanie", booking: b, token: null });
  return b;
}
async function runReminders(base44) {
  const due = await runSql(base44, `SELECT n.id AS nid, n.kind, n.send_at, k.id AS id, k.starts_at, k.ends_at,
      k.status, k.ics_uid, k.ics_sequence, k.first_name, k.email, k.client_tz, t.name AS type, t.zoom_link, t.slug
    FROM public.bk_notifications n JOIN public.bk_bookings k ON k.id = n.booking_id JOIN public.bk_types t ON t.id = k.type_id
    WHERE n.status = 'zaplanowane' AND n.kind IN ('przypomnienie24','przypomnienie1') AND n.send_at <= now() + interval '1 minute'
    ORDER BY n.send_at LIMIT 40`, true).catch(() => []);
  let sent = 0, skipped = 0;
  const organizer = due.length ? await adminTo(base44).catch(() => null) : null;
  for (const r of due) {
    const off = r.kind === "przypomnienie24" ? 24 * 36e5 : 36e5;
    const expected = new Date(r.starts_at).getTime() - off;
    const late = Date.now() - new Date(r.send_at).getTime() > 20 * 6e4;
    const stale = Math.abs(expected - new Date(r.send_at).getTime()) > 6e4;
    if (r.status !== "POTWIERDZONA" || new Date(r.starts_at).getTime() <= Date.now() || stale || late) {
      await runSql(base44, `UPDATE public.bk_notifications SET status = 'pominiete' WHERE id = ${r.nid}`);
      skipped++;
      continue;
    }
    const b = {
      id: r.id,
      email: r.email,
      first_name: r.first_name,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      status: r.status,
      client_tz: r.client_tz,
      ics_uid: r.ics_uid,
      ics_sequence: r.ics_sequence,
      type: r.type,
      zoom_link: r.zoom_link,
      slug: r.slug,
      organizer
    };
    const res = await sendBookingMail(base44, { kind: r.kind, booking: b, token: null });
    await runSql(base44, `UPDATE public.bk_notifications SET status = ${escStr(res === "wyslany" ? "wyslane" : "zaplanowane")}, sent_at = now() WHERE id = ${r.nid}`);
    sent++;
  }
  return { sent, skipped };
}

// supabase/functions/_shared/bookingIcal.ts
var TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
async function icalFeed(base44, token2) {
  const rows = await runSql(base44, `SELECT ical_token FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  const stored = rows?.[0]?.ical_token;
  if (!stored || !TOKEN_RE.test(String(token2 || "")) || !await safeEqual(token2, stored)) {
    return new Response("Nie znaleziono", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const bookings = await runSql(base44, `SELECT k.ics_uid, k.ics_sequence, k.starts_at, k.ends_at, k.first_name, t.name AS type
    FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
    WHERE k.status IN ('POTWIERDZONA','PRZENIESIONA') AND k.ends_at > now() - interval '7 days'
      AND k.starts_at < now() + interval '120 days' ORDER BY k.starts_at LIMIT 1000`, true).catch(() => []);
  const blocks = await runSql(base44, `SELECT id, starts_at, ends_at, note FROM public.bk_blocks
    WHERE NOT disabled AND kind <> 'powtarzalna' AND ends_at > now() - interval '7 days' AND starts_at < now() + interval '120 days'
    ORDER BY starts_at LIMIT 500`, true).catch(() => []);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//exmortis//rezerwacje 1:1//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:exmortis \xB7 sesje",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
    "X-PUBLISHED-TTL:PT30M"
  ];
  for (const b of bookings) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.ics_uid}`,
      `SEQUENCE:${Number(b.ics_sequence || 0)}`,
      `DTSTAMP:${stamp(/* @__PURE__ */ new Date())}`,
      `DTSTART:${stamp(b.starts_at)}`,
      `DTEND:${stamp(b.ends_at)}`,
      `SUMMARY:${icsText(`${b.type || "Spotkanie"}${b.first_name ? ` \u2014 ${b.first_name}` : ""}`)}`,
      "END:VEVENT"
    );
  }
  for (const x of blocks) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:block-${x.id}@exmortis`,
      `DTSTAMP:${stamp(/* @__PURE__ */ new Date())}`,
      `DTSTART:${stamp(x.starts_at)}`,
      `DTEND:${stamp(x.ends_at)}`,
      "SUMMARY:Zaj\u0119te",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="exmortis-sesje.ics"',
      "Cache-Control": "no-store"
    }
  });
}

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
async function retryGoogle(base44) {
  const rows = await runSql(base44, `SELECT booking_id, op FROM public.bk_gcal_queue ORDER BY created_at LIMIT 20`, true).catch(() => []);
  let done = 0, left = 0;
  for (const r of rows) {
    const res = await syncBooking(base44, r.booking_id, r.op);
    if (res.ok) done++;
    else left++;
  }
  return { google_done: done, google_left: left };
}

// supabase/functions/bookingPublic/index.ts
var ERR = {
  taken: [409, "Ten termin w\u0142a\u015Bnie si\u0119 zaj\u0105\u0142. Wybierz inny."],
  one_per_email: [409, "Masz ju\u017C zarezerwowan\u0105 rozmow\u0119 tego rodzaju."],
  disabled: [404, "Nie znaleziono"],
  not_found: [404, "Nie znaleziono"],
  access: [403, "Ten rodzaj spotkania nie jest dost\u0119pny publicznie."]
};
var bad = (msg, status = 400) => Response.json({ error: msg }, { status });
async function getType(base44, slug, admin) {
  const rows = await runSql(
    base44,
    `SELECT id, slug, name, description, duration_min, questions, access, active FROM public.bk_types WHERE slug = ${escStr(slug)}`,
    true
  );
  const t = rows?.[0];
  if (!t || t.access !== "PUBLICZNY" || !t.active && !admin) return null;
  return t;
}
async function resolvePackage(base44, body, me2, admin) {
  const tok = typeof body.token === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(body.token) ? body.token : null;
  if (tok) {
    const r = await rpc(base44, "bk_token_package", { p_hash: await sha256hex(tok) });
    return r ? { package_id: r.package_id, type_id: r.type_id, email: r.email, from_token: true } : null;
  }
  if (body.package_id) {
    const rows = await runSql(
      base44,
      `SELECT id, type_id, user_id, email_display FROM public.bk_packages WHERE id = ${escStr(textField(body, "package_id", { max: 40 }))}::uuid`,
      true
    );
    const p = rows?.[0];
    if (!p) return null;
    if (!admin) {
      const mine = me2?.id && p.user_id === me2.id || me2?.email && (p.email_display || "").toLowerCase() === String(me2.email).toLowerCase();
      if (!mine) return null;
    }
    return { package_id: p.id, type_id: p.type_id, email: p.email_display, from_token: false };
  }
  return null;
}
async function packageEarliest(base44, packageIds) {
  const ids = (packageIds || []).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x)));
  if (!ids.length) return {};
  const rows = await runSql(
    base44,
    `SELECT pk.id, pk.min_gap_days, (SELECT max(k.starts_at) FROM public.bk_bookings k WHERE k.package_id = pk.id AND k.status IN ('POTWIERDZONA','ODBYLA_SIE')) AS last_start
     FROM public.bk_packages pk WHERE pk.id IN (${ids.map((x) => `${escStr(x)}::uuid`).join(",")})`,
    true
  );
  const out = {};
  for (const r of rows || []) {
    const gap = Number(r.min_gap_days) || 0;
    out[r.id] = {
      last_start: r.last_start || null,
      earliest: r.last_start && gap > 0 ? new Date(new Date(r.last_start).getTime() + gap * 864e5).toISOString() : null
    };
  }
  return out;
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const icalToken = new URL(req.url).searchParams.get("ical");
    if (icalToken) return await icalFeed(base44, icalToken);
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    if (a === "tick" || a === "notify_tick") {
      const who = await base44.auth.me().catch(() => null);
      let allowed = who?.role === "admin";
      if (!allowed) {
        const [row] = await runSql(base44, `SELECT tick_token FROM public.bk_settings WHERE id = 1`, true);
        const given = typeof body.tick_token === "string" ? body.tick_token : "";
        allowed = !!row?.tick_token && !!given && await safeEqual(given, row.tick_token);
      }
      if (!allowed) return bad("Forbidden", 403);
      if (a === "notify_tick") return Response.json({ ok: true, ...await runReminders(base44), ...await retryGoogle(base44) });
      const r = await runSql(base44, `SELECT public.bk_fill_holidays(2) AS holidays, public.bk_log_purge() AS log_purged, public.bk_answers_retention() AS answers_removed, backup.purge_expired() AS backups_removed`);
      await ensureCalendar(base44).catch(() => {
      });
      return Response.json({ ok: true, ...r?.[0] || {}, ...await retryGoogle(base44) });
    }
    const me2 = await base44.auth.me().catch(() => null);
    const admin = me2?.role === "admin";
    const mode = await getMode(base44);
    const visible = mode === "on" || mode === "admin" && admin;
    if (a === "config") return Response.json({ enabled: visible });
    if (a === "my_sessions" && !visible) {
      if (!me2) return bad("Zaloguj si\u0119, aby zobaczy\u0107 swoje sesje.", 401);
      const r = await rpc(base44, "bk_my_sessions", { p: { user_id: me2.id, email: String(me2.email || "").toLowerCase() } }).catch(() => null);
      return Response.json({ off: true, has_access: (r?.packages || []).some((p) => p.sessions_left > 0), packages: [], bookings: [] });
    }
    if (!visible) return bad("Nie znaleziono", 404);
    if (a === "type") {
      const t = await getType(base44, textField(body, "slug", { max: 60 }), admin);
      if (!t) return bad("Nie znaleziono", 404);
      const questions = (t.questions || []).map((q) => ({ id: q.id, label: q.label, required: !!q.required, health: !!q.health }));
      return Response.json({ type: { slug: t.slug, name: t.name, description: t.description, duration_min: t.duration_min, questions } });
    }
    if (a === "slots") {
      let t = null, earliest = null;
      if (body.slug) t = await getType(base44, textField(body, "slug", { max: 60 }), admin);
      else if (body.manage_token) {
        const tok = typeof body.manage_token === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(body.manage_token) ? body.manage_token : null;
        const v = tok ? await rpc(base44, "bk_manage_view", { p_hash: await sha256hex(tok) }) : null;
        if (v?.id) t = (await runSql(base44, `SELECT id, slug, name, duration_min FROM public.bk_types WHERE id = (SELECT type_id FROM public.bk_bookings WHERE id = ${escStr(v.id)}::uuid)`, true))?.[0] || null;
      } else if (body.booking_id) {
        const own = admin ? "TRUE" : `(user_id = ${me2?.id ? escStr(me2.id) : "NULL"} OR lower(btrim(COALESCE(email,''))) = ${escStr(String(me2?.email || "").toLowerCase())})`;
        const bid = textField(body, "booking_id", { max: 40 });
        if (!/^[0-9a-f-]{36}$/i.test(bid)) return bad("Nie znaleziono", 404);
        const rows2 = await runSql(base44, `SELECT type_id FROM public.bk_bookings WHERE id = ${escStr(bid)}::uuid AND ${own}`, true);
        if (rows2?.[0]) t = (await runSql(base44, `SELECT id, slug, name, duration_min FROM public.bk_types WHERE id = ${escStr(rows2[0].type_id)} AND (active OR ${admin ? "TRUE" : "FALSE"})`, true))?.[0] || null;
      } else {
        const pk = await resolvePackage(base44, body, me2, admin);
        if (pk) {
          t = (await runSql(base44, `SELECT id, slug, name, duration_min FROM public.bk_types WHERE id = ${escStr(pk.type_id)} AND (active OR ${admin ? "TRUE" : "FALSE"})`, true))?.[0] || null;
          earliest = (await packageEarliest(base44, [pk.package_id]))[pk.package_id]?.earliest || null;
        }
      }
      if (!t) return bad("Nie znaleziono", 404);
      let from = new Date(body.from || Date.now());
      if (earliest && new Date(earliest) > from) from = new Date(earliest);
      const to = new Date(Math.min(new Date(body.to || from.getTime() + 31 * 864e5).getTime(), from.getTime() + 62 * 864e5));
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return bad("Niepoprawny zakres");
      if (to <= from) return Response.json({ slots: [], earliest });
      const rows = await rpc(base44, "bk_free_slots", { p_type: t.id, p_from: from.toISOString(), p_to: to.toISOString() });
      const slots = (rows || []).map((r) => ({ start: r.slot_start, end: r.slot_end })).filter((s) => !earliest || new Date(s.start) >= new Date(earliest));
      return Response.json({ slots: await dropBusy(base44, slots, from.toISOString(), to.toISOString()), earliest });
    }
    if (a === "book") {
      const keys = await loadKeys(admin && body.simulate_missing_keys === true);
      if (!keys.ok) return bad(KEYS_MSG, 503);
      if (body.website) return Response.json({ ok: true });
      const t = await getType(base44, textField(body, "slug", { max: 60 }), admin);
      if (!t) return bad("Nie znaleziono", 404);
      let firstName, email;
      try {
        firstName = textField(body, "first_name", { max: 120 });
        email = emailField(body).toLowerCase();
      } catch (e) {
        return bad(e.message.startsWith("Brak") ? "Uzupe\u0142nij imi\u0119 i e-mail." : e.message);
      }
      const ip = clientIp(req);
      const rate = await rpc(base44, "bk_rate_hit", { p_ip: await keys.hmac(ip), p_email: await keys.hmac(email) });
      if (rate !== "ok") return bad("Za du\u017Co pr\xF3b w kr\xF3tkim czasie. Spr\xF3buj ponownie za kilka minut.", 429);
      if (body.consent !== true) return bad("Zaznacz akceptacj\u0119 regulaminu i polityki prywatno\u015Bci.");
      const st = new Date(body.starts_at);
      if (isNaN(st.getTime())) return bad("Wybierz termin.");
      const answers = {};
      let health = null;
      for (const q of t.questions || []) {
        const v = typeof body.answers?.[q.id] === "string" ? body.answers[q.id].trim() : "";
        if (v.length > 2e3) return bad("Odpowied\u017A jest zbyt d\u0142uga (maks. 2000 znak\xF3w).");
        if (q.required && !v) return bad(`Odpowiedz na pytanie: ${q.label}`);
        if (q.health) health = v || null;
        else if (v) answers[q.id] = v;
      }
      if (health && body.health_consent !== true) return bad("Zaznacz zgod\u0119 na dane o zdrowiu albo zostaw to pytanie puste.");
      const emailH = await keys.hmac(email), ipH = await keys.hmac(ip);
      const consents = [{ kind: "regulamin", text_version: CONSENTS.regulamin.version, text: CONSENTS.regulamin.text, email_hmac: emailH, ip_hmac: ipH }];
      if (health) consents.push({ kind: "zdrowie", text_version: CONSENTS.zdrowie.version, text: CONSENTS.zdrowie.text, email_hmac: emailH, ip_hmac: ipH });
      const token2 = randomToken();
      const idem = typeof body.idem_key === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.idem_key) ? body.idem_key : null;
      const health_enc = health ? await encryptHealth(keys.enc, health) : null;
      if (await takenByGoogle(base44, st.toISOString(), new Date(st.getTime() + t.duration_min * 6e4).toISOString())) return bad(ERR.taken[1], 409);
      const res = await rpc(base44, "bk_book", { p: {
        type_id: t.id,
        starts_at: st.toISOString(),
        email,
        first_name: firstName,
        user_id: me2?.id || null,
        tz: typeof body.tz === "string" && TZ_RE.test(body.tz) ? body.tz : null,
        idem_key: idem,
        viewer_admin: admin,
        source: "klient",
        actor: "klient",
        answers,
        health_enc,
        health_consent: !!health,
        consents,
        token_hash: await sha256hex(token2)
      } });
      if (res?.error) {
        const [c, m] = ERR[res.error] || [400, "Nie uda\u0142o si\u0119 zarezerwowa\u0107."];
        return bad(m, c);
      }
      if (!res.already && res.id) await onBookingCreated(base44, res.id, token2, "klient").catch(() => {
      });
      if (!res.already && res.id) await syncBooking(base44, res.id, "upsert").catch(() => {
      });
      return Response.json({
        ok: true,
        starts_at: res.starts_at,
        ends_at: res.ends_at,
        manage_url: res.already ? null : `/rezerwacja/zarzadzaj#t=${token2}`
      });
    }
    if (a === "manage") {
      const tok = typeof body.token === "string" ? body.token : "";
      if (!/^[A-Za-z0-9_-]{20,100}$/.test(tok)) return bad("Link jest niewa\u017Cny.", 404);
      const r = await rpc(base44, "bk_manage_view", { p_hash: await sha256hex(tok) });
      if (!r) return bad("Link jest niewa\u017Cny.", 404);
      return Response.json({ booking: r });
    }
    if (a === "order") {
      const tok = typeof body.token === "string" ? body.token : "";
      if (!/^[A-Za-z0-9_-]{20,100}$/.test(tok)) return bad("Link jest niewa\u017Cny.", 404);
      const r = await rpc(base44, "bk_token_package", { p_hash: await sha256hex(tok) });
      if (!r) return bad("Link jest niewa\u017Cny albo zosta\u0142 ju\u017C u\u017Cyty.", 404);
      return Response.json({ package: r });
    }
    if (a === "my_sessions") {
      if (!me2) return bad("Zaloguj si\u0119, aby zobaczy\u0107 swoje sesje.", 401);
      const r = await rpc(base44, "bk_my_sessions", { p: { user_id: me2.id, email: String(me2.email || "").toLowerCase() } });
      const out = r || { packages: [], bookings: [] };
      const early = await packageEarliest(base44, (out.packages || []).map((p) => p.id)).catch(() => ({}));
      out.packages = (out.packages || []).map((p) => ({ ...p, next_possible: early[p.id]?.earliest || null }));
      out.has_access = out.packages.some((p) => p.sessions_left > 0);
      return Response.json(out);
    }
    if (a === "book_package") {
      const keys = await loadKeys(admin && body.simulate_missing_keys === true);
      if (!keys.ok) return bad(KEYS_MSG, 503);
      if (body.website) return Response.json({ ok: true });
      const tok = typeof body.token === "string" && body.token ? body.token : null;
      if (tok && !/^[A-Za-z0-9_-]{20,100}$/.test(tok)) return bad("Link jest niewa\u017Cny.", 404);
      if (!me2 && !tok) return bad("Zaloguj si\u0119, aby zarezerwowa\u0107 termin.", 401);
      const st = new Date(body.starts_at);
      if (isNaN(st.getTime())) return bad("Wybierz termin.");
      let firstName;
      try {
        firstName = textField(body, "first_name", { max: 120 });
      } catch {
        return bad("Uzupe\u0142nij imi\u0119.");
      }
      const ip = clientIp(req);
      const emailForRate = String(me2?.email || body.email || "").toLowerCase();
      if (emailForRate) {
        const rate = await rpc(base44, "bk_rate_hit", { p_ip: await keys.hmac(ip), p_email: await keys.hmac(emailForRate) });
        if (rate !== "ok") return bad("Za du\u017Co pr\xF3b w kr\xF3tkim czasie. Spr\xF3buj ponownie za kilka minut.", 429);
      }
      const emailH = await keys.hmac(emailForRate || "brak"), ipH = await keys.hmac(ip);
      const consents = [];
      if (body.service_consent === true) {
        const [cs] = await runSql(base44, `SELECT service_consent_version, service_consent_text FROM public.bk_settings WHERE id = 1`, true);
        consents.push({ kind: "odstapienie", text_version: String(cs?.service_consent_version || "").slice(0, 40), text: String(cs?.service_consent_text || "").slice(0, 2e3), email_hmac: emailH, ip_hmac: ipH });
      }
      const pkRow = await resolvePackage(base44, body, me2, admin);
      const dur = pkRow ? await typeDuration(base44, pkRow.type_id) : null;
      if (dur && await takenByGoogle(base44, st.toISOString(), new Date(st.getTime() + dur * 6e4).toISOString())) {
        return bad("Ten termin jest zaj\u0119ty w Twoim kalendarzu Google.", 409);
      }
      const res = await rpc(base44, "bk_book_package", { p: {
        package_id: tok ? null : textField(body, "package_id", { max: 40 }),
        token_hash: tok ? await sha256hex(tok) : null,
        starts_at: st.toISOString(),
        user_id: me2?.id || null,
        email: String(me2?.email || "").toLowerCase() || null,
        first_name: firstName,
        tz: typeof body.tz === "string" && TZ_RE.test(body.tz) ? body.tz : null,
        viewer_admin: admin,
        source: "klient",
        actor: "klient",
        consents
      } });
      if (res?.error) {
        const map = {
          forbidden: [403, "Ten pakiet nale\u017Cy do innego konta."],
          not_found: [404, "Nie znaleziono pakietu."],
          unpaid: [409, "P\u0142atno\u015B\u0107 za pakiet nie zosta\u0142a potwierdzona."],
          expired: [409, "Wa\u017Cno\u015B\u0107 pakietu si\u0119 sko\u0144czy\u0142a."],
          used_up: [409, "Wszystkie sesje z pakietu s\u0105 ju\u017C wykorzystane."],
          consent: [400, "Zaznacz zgod\u0119 o wykonaniu us\u0142ugi przed up\u0142ywem 14 dni."],
          gap: [409, `Odst\u0119p mi\u0119dzy sesjami to co najmniej ${res.min_days} dni.`],
          taken: [409, "Ten termin w\u0142a\u015Bnie si\u0119 zaj\u0105\u0142. Wybierz inny."]
        };
        const [c, m] = map[res.error] || [400, "Nie uda\u0142o si\u0119 zarezerwowa\u0107."];
        return bad(m, c);
      }
      if (res.id) await onBookingCreated(base44, res.id, null, "klient").catch(() => {
      });
      if (res.id) await syncBooking(base44, res.id, "upsert").catch(() => {
      });
      return Response.json({ ok: true, starts_at: res.starts_at, ends_at: res.ends_at });
    }
    if (a === "reschedule" || a === "cancel") {
      const tok = typeof body.token === "string" && body.token ? body.token : null;
      if (tok && !/^[A-Za-z0-9_-]{20,100}$/.test(tok)) return bad("Link jest niewa\u017Cny.", 404);
      if (!me2 && !tok) return bad("Zaloguj si\u0119, aby zmieni\u0107 rezerwacj\u0119.", 401);
      let bookingId = body.booking_id ? textField(body, "booking_id", { max: 40 }) : null;
      if (!bookingId && tok) {
        const v = await rpc(base44, "bk_manage_view", { p_hash: await sha256hex(tok) });
        bookingId = v?.id || null;
      }
      if (!bookingId) return bad("Nie znaleziono rezerwacji.", 404);
      const p = {
        booking_id: bookingId,
        user_id: me2?.id || null,
        email: String(me2?.email || "").toLowerCase() || null,
        viewer_admin: admin,
        actor: admin ? me2.email : "klient"
      };
      if (a === "reschedule") {
        const st = new Date(body.starts_at);
        if (isNaN(st.getTime())) return bad("Wybierz nowy termin.");
        p.starts_at = st.toISOString();
      }
      const res = await rpc(base44, a === "reschedule" ? "bk_reschedule" : "bk_cancel", { p });
      if (res?.error) {
        const map = {
          forbidden: [403, "Ta rezerwacja nale\u017Cy do innego konta."],
          not_found: [404, "Nie znaleziono rezerwacji."],
          too_late: [409, "Na zmian\u0119 jest ju\u017C za p\xF3\u017Ano \u2014 napisz do mnie."],
          gap: [409, `Odst\u0119p mi\u0119dzy sesjami to co najmniej ${res.min_days} dni. Wybierz inny termin.`],
          limit: [409, `Limit prze\u0142o\u017Ce\u0144 (${res.max}) zosta\u0142 wykorzystany.`],
          expired: [409, "Wa\u017Cno\u015B\u0107 pakietu si\u0119 sko\u0144czy\u0142a."],
          taken: [409, "Ten termin w\u0142a\u015Bnie si\u0119 zaj\u0105\u0142. Wybierz inny."]
        };
        const [c, m] = map[res.error] || [400, "Nie uda\u0142o si\u0119 zmieni\u0107 rezerwacji."];
        return bad(m, c);
      }
      await runSql(base44, `UPDATE public.bk_bookings SET ics_sequence = ics_sequence + 1 WHERE id = ${escStr(bookingId)}::uuid`).catch(() => {
      });
      if (a === "reschedule") await onBookingMoved(base44, bookingId).catch(() => {
      });
      else await onBookingCancelled(base44, bookingId).catch(() => {
      });
      await syncBooking(base44, bookingId, a === "reschedule" ? "upsert" : "delete").catch(() => {
      });
      return Response.json(res);
    }
    return bad("Nieznana akcja");
  } catch (e) {
    console.error("bookingPublic:", safeErr(e));
    return Response.json({ error: "Co\u015B posz\u0142o nie tak. Spr\xF3buj ponownie." }, { status: 500 });
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
