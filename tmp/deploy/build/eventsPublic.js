var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// supabase/functions/_shared/shim.ts
var waitUntil;
var init_shim = __esm({
  "supabase/functions/_shared/shim.ts"() {
    waitUntil = (p) => {
      try {
        globalThis.EdgeRuntime?.waitUntil?.(p);
      } catch {
      }
    };
  }
});

// supabase/functions/_shared/supabase.ts
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
function clientIp(req) {
  const ok = (v2) => /^[0-9a-fA-F:.]{3,45}$/.test(v2);
  const t = (req.headers.get("true-client-ip") || "").trim();
  if (ok(t)) return t;
  const xff = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ok(xff)) return xff;
  const v = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "").trim();
  return ok(v) ? v : "brak";
}
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
var SUPA_URL2, SRK2, PROJECT_REF, READ_RE, EMAIL_RE;
var init_supabase = __esm({
  "supabase/functions/_shared/supabase.ts"() {
    SUPA_URL2 = Deno.env.get("SUPABASE_URL") || "";
    SRK2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    PROJECT_REF = SUPA_URL2.replace(/^https:\/\//, "").split(".")[0] || "fqhvxhnbeyvwubpnuzxe";
    READ_RE = /^\s*(select|with|values|show|explain)\b/i;
    EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  }
});

// supabase/functions/_shared/snapshot.ts
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
var MEM, TTL, LIMIT, busy, timeout;
var init_snapshot = __esm({
  "supabase/functions/_shared/snapshot.ts"() {
    init_shim();
    MEM = /* @__PURE__ */ new Map();
    TTL = 6e4;
    LIMIT = 2e3;
    busy = /* @__PURE__ */ new Set();
    timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Limit czasu Supabase")), ms))]);
  }
});

// supabase/functions/_shared/settings.ts
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
async function loadAppUrl(base44) {
  if (Date.now() - APP_URL_AT < 3e5) return APP_URL;
  const s = await getSetting(base44, "app").catch(() => null);
  APP_URL = safeAppUrl(s?.url);
  APP_URL_AT = Date.now();
  return APP_URL;
}
var TABLE_OK, FIRMA, DEFAULT_APP_URL, APP_URL, safeAppUrl, APP_URL_AT;
var init_settings = __esm({
  "supabase/functions/_shared/settings.ts"() {
    init_supabase();
    init_snapshot();
    TABLE_OK = true;
    FIRMA = null;
    DEFAULT_APP_URL = globalThis.Deno?.env?.get?.("APP_URL") || "";
    APP_URL = DEFAULT_APP_URL;
    safeAppUrl = (u) => !u || /preview--/i.test(String(u)) ? DEFAULT_APP_URL : String(u).replace(/\/+$/, "");
    APP_URL_AT = 0;
  }
});

// supabase/functions/_shared/mirror.ts
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
var READY, enc, row2rec2;
var init_mirror = __esm({
  "supabase/functions/_shared/mirror.ts"() {
    init_supabase();
    READY = /* @__PURE__ */ new Set();
    enc = encodeURIComponent;
    row2rec2 = (r) => ({ ...r.data || {}, id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id });
  }
});

// supabase/functions/_shared/emailLayout.ts
function emailButton(label, url, { secondary = false } = {}) {
  const bg2 = secondary ? "transparent" : BRAND.gold;
  const fg = secondary ? BRAND.gold : BRAND.bg;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr>
<td style="border-radius:2px;background:${bg2};border:1px solid ${BRAND.gold};">
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
var BRAND, SOCIAL, MARKETING, esc;
var init_emailLayout = __esm({
  "supabase/functions/_shared/emailLayout.ts"() {
    init_settings();
    BRAND = {
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
    SOCIAL = [
      ["Instagram", "https://www.instagram.com/e.x.m.o.r.t.i.s/"],
      ["Facebook", "https://www.facebook.com/dawidkowalczyk.exmortis"],
      ["YouTube", "https://www.youtube.com/@e.x.m.o.r.t.i.s"],
      ["WhatsApp", "https://whatsapp.com/channel/0029VbDYXi1Lo4hfFPvT3O3G"]
    ];
    MARKETING = /* @__PURE__ */ new Set(["listy", "newsletter", "kampania"]);
    esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }
});

// supabase/functions/_shared/smtp.ts
import nodemailer2 from "npm:nodemailer@6.9.13";
import { setImmediate as nodeSetImmediate2, clearImmediate as nodeClearImmediate2 } from "node:timers";
async function mailConfig(base44) {
  if (CFG_AT && Date.now() - CFG_AT < 3e4) return CFG;
  CFG = await getSetting(base44, "smtp").catch(() => null);
  CFG_AT = Date.now();
  return CFG;
}
async function mailConfigMarketing(base44) {
  if (MCFG_AT && Date.now() - MCFG_AT < 3e4) return MCFG;
  MCFG = await getSetting(base44, "smtp_marketing").catch(() => null);
  MCFG_AT = Date.now();
  return MCFG;
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
var g2, mailReady, CFG, CFG_AT, MCFG, MCFG_AT, MARKETING_KINDS, MAIL_BUDGET, LIMIT_MARK, SENT;
var init_smtp = __esm({
  "supabase/functions/_shared/smtp.ts"() {
    init_settings();
    init_emailLayout();
    init_supabase();
    g2 = globalThis;
    if (typeof g2.setImmediate !== "function") g2.setImmediate = nodeSetImmediate2;
    if (typeof g2.clearImmediate !== "function") g2.clearImmediate = nodeClearImmediate2;
    mailReady = (s) => !!(s && s.status === "dziala" && s.host && s.user && s.password);
    CFG = null;
    CFG_AT = 0;
    MCFG = null;
    MCFG_AT = 0;
    MARKETING_KINDS = /* @__PURE__ */ new Set(["listy", "ogloszenie"]);
    MAIL_BUDGET = 240;
    LIMIT_MARK = "Czeka na limit wysy\u0142ki (najwy\u017Cej 240 maili na 2 godziny)";
    SENT = { at: 0, n: 0 };
  }
});

// supabase/functions/_shared/newsletter.ts
var newsletter_exports = {};
__export(newsletter_exports, {
  addSubscriber: () => addSubscriber,
  confirmSubscriber: () => confirmSubscriber,
  purgeUnconfirmed: () => purgeUnconfirmed,
  sendConfirmMail: () => sendConfirmMail,
  unsubscribeByToken: () => unsubscribeByToken
});
async function addSubscriber(base44, { email, name }) {
  const nameVal = name === void 0 || name === null || String(name).trim() === "" ? "NULL" : escStr(String(name).trim().slice(0, 200));
  const token = newToken2();
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
        <p style="font-family:Arial,sans-serif;line-height:1.7;">${name ? esc2(name) + ", " : ""}kto\u015B (mam nadziej\u0119, \u017Ce Ty) zapisa\u0142 ten adres na Listy powrotu, jeden list w ka\u017Cdy poniedzia\u0142ek. \u017Beby zacz\u0105\u0107 je dostawa\u0107, kliknij poni\u017Cej.</p>
        <p style="margin:32px 0;"><a href="${url}" style="background:#C9A24A;color:#0A0A0B;padding:14px 28px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;letter-spacing:2px;">POTWIERDZAM ZAPIS</a></p>
        <p style="font-family:Arial,sans-serif;color:#8A8A8C;font-size:13px;line-height:1.6;">Je\u015Bli to nie Ty, zignoruj t\u0119 wiadomo\u015B\u0107. Bez potwierdzenia adres zostanie usuni\u0119ty po 7 dniach.</p>
      </div></div>`
  });
}
async function confirmSubscriber(base44, token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await runSql(
    base44,
    `UPDATE public.subscribers SET status = 'active', consent_date = now(), confirmed_at = now(), updated_date = now()
     WHERE confirm_token = ${escStr(token)} AND status = 'pending' RETURNING email, name, confirmed_at`
  );
  if (rows[0]) return { row: rows[0], already: false };
  const act = await runSql(base44, `SELECT email FROM public.subscribers WHERE confirm_token = ${escStr(token)} AND status = 'active' LIMIT 1`, true).catch(() => []);
  return act[0] ? { row: act[0], already: true } : null;
}
async function unsubscribeByToken(base44, token) {
  if (!/^[a-f0-9]{32}$/.test(String(token || ""))) return null;
  const rows = await runSql(
    base44,
    `UPDATE public.subscribers SET status = 'unsubscribed', updated_date = now()
     WHERE unsub_token = ${escStr(token)} RETURNING email`
  ).catch(() => []);
  return rows[0]?.email || null;
}
async function purgeUnconfirmed(base44) {
  const r = await runSql(base44, `DELETE FROM public.subscribers WHERE status = 'pending' AND confirm_sent_at < now() - interval '7 days' RETURNING 1`);
  return r.length;
}
var esc2, newToken2;
var init_newsletter = __esm({
  "supabase/functions/_shared/newsletter.ts"() {
    init_supabase();
    init_settings();
    init_smtp();
    esc2 = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    newToken2 = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  }
});

// supabase/functions/_shared/retention.ts
var retention_exports = {};
__export(retention_exports, {
  runRetention: () => runRetention
});
async function runRetention(base44) {
  const withdrawn = await consentFilter(base44, { kind: "test_art9", status: "wycofana" }, "-created_date", 1e3);
  const emails = [...new Set(withdrawn.map((c) => String(c.email).toLowerCase()))];
  const [quiz, quizW, powrot, listy] = await Promise.all([
    runSql(base44, `DELETE FROM public.quiz_result WHERE created_at < now() - interval '12 months' RETURNING 1`),
    emails.length ? runSql(base44, `DELETE FROM public.quiz_result WHERE lower(email) IN (${emails.map(escStr).join(",")}) RETURNING 1`) : [],
    runSql(base44, `DELETE FROM public.powrot_applications
      WHERE (wspolpraca_od IS NULL AND created_date::timestamptz < now() - interval '6 months')
         OR (wspolpraca_do IS NOT NULL AND wspolpraca_do < (now() - interval '12 months')::date) RETURNING 1`),
    purgeUnconfirmed(base44)
  ]);
  const before = new Date(Date.now() - LOG_RETENTION_DAYS * 864e5).toISOString();
  const [dziennik_odtworzen, dziennik_bezpieczenstwa] = await Promise.all([
    purgeLogs(base44.asServiceRole.entities.PlaybackLog, before),
    purgeLogs(base44.asServiceRole.entities.SecurityLog, before)
  ]);
  return {
    quiz_12m: quiz.length,
    quiz_wycofane: quizW.length,
    powrot: powrot.length,
    listy_niepotwierdzone: listy,
    dziennik_odtworzen,
    dziennik_bezpieczenstwa
  };
}
var LOG_RETENTION_DAYS, purgeLogs;
var init_retention = __esm({
  "supabase/functions/_shared/retention.ts"() {
    init_supabase();
    init_mirror();
    init_newsletter();
    LOG_RETENTION_DAYS = 90;
    purgeLogs = (E, before) => E.deleteMany({ created_date: { $lt: before } }).then((r) => Number(typeof r === "number" ? r : r?.deleted ?? r?.count ?? 0) || 0).catch(() => 0);
  }
});

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

// supabase/functions/eventsPublic/index.ts
init_shim();
init_supabase();
init_settings();
init_snapshot();

// supabase/functions/_shared/registrations.ts
init_shim();
init_supabase();
init_mirror();
init_settings();

// supabase/functions/_shared/events.ts
init_smtp();
init_settings();
init_emailLayout();

// supabase/functions/_shared/tickets.ts
init_supabase();
init_settings();
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
var ticketsAllowed = (ev) => !!ev && ev.format !== "Online";
async function regTicket(base44, eventId, reg) {
  if (!eventId || !reg?.id || !reg?.email) return null;
  await ensureTicketSchema(base44);
  const [ev] = await runSql(base44, `SELECT format, COALESCE(tickets, false) AS tickets, price::float8 AS price FROM public.events WHERE id = ${escStr(String(eventId))}`, true);
  if (!ev || ev.tickets !== true || !ticketsAllowed(ev) || Number(ev.price) > 0) return null;
  const key = `zapis:${reg.id}`;
  const [had] = await runSql(base44, `SELECT * FROM public.event_tickets WHERE order_id = ${escStr(key)} AND line_no = 0`, true);
  if (had) {
    if (had.status !== "anulowany") return had;
    const [back] = await runSql(base44, `UPDATE public.event_tickets SET status = CASE WHEN checked_at IS NULL THEN 'wazny' ELSE 'wykorzystany' END
      WHERE id = ${escStr(had.id)} RETURNING *`);
    return back || had;
  }
  return insertTicket(base44, {
    event_id: String(eventId),
    order_id: key,
    line_no: 0,
    holder_name: cleanName(reg.first_name) || "Uczestnik",
    buyer_email: String(reg.email).trim().toLowerCase(),
    price: 0,
    source: "zapis"
  });
}

// supabase/functions/_shared/events.ts
var warsawFmt = (opts) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", ...opts });
function plDate(value) {
  return warsawFmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(value));
}
function plTime(value) {
  return warsawFmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
function plWhen(value) {
  return `${plDate(value)} \xB7 ${plTime(value)}`;
}
var CITY = {
  "Europe/London": "Londyn",
  "America/New_York": "Nowy Jork",
  "Asia/Tokyo": "Tokio",
  "Europe/Dublin": "Dublin",
  "Europe/Berlin": "Berlin",
  "Europe/Paris": "Pary\u017C",
  "America/Chicago": "Chicago",
  "America/Los_Angeles": "Los Angeles",
  "Europe/Oslo": "Oslo"
};
var validTz = (tz) => {
  try {
    return !!tz && !!new Intl.DateTimeFormat("pl-PL", { timeZone: tz });
  } catch {
    return false;
  }
};
function mailWhen(value, tz) {
  const pl = `${plDate(value)} \xB7 ${plTime(value)} (czas polski, Warszawa)`;
  if (!validTz(tz) || tz === "Europe/Warsaw") return pl;
  const f = (o) => new Intl.DateTimeFormat("pl-PL", { timeZone: tz, ...o }).format(new Date(value));
  const local = f({ hour: "2-digit", minute: "2-digit", hour12: false });
  if (local === plTime(value) && f({ day: "numeric" }) === warsawFmt({ day: "numeric" }).format(new Date(value))) return pl;
  const day = f({ day: "numeric" }) !== warsawFmt({ day: "numeric" }).format(new Date(value)) ? `${f({ weekday: "long", day: "numeric", month: "long" })}, ` : "";
  return `${pl} \xB7 ${day}${local} u Ciebie (${CITY[tz] || tz.split("/").pop().replace(/_/g, " ")})`;
}
function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function icsStamp(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
var isOnline = (ev) => ev.format === "Online";
function joinUrl(ev, token = null) {
  const q = token ? `?t=${token}` : "";
  if (ev.short_path) return `${APP_URL}/${ev.short_path}/dolacz${q}`;
  return ev.slug ? `${APP_URL}/spotkania/${ev.slug}/dolacz${q}` : null;
}
async function joinToken(cancelToken) {
  if (!cancelToken) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`join:${cancelToken}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
function joinState(ev, now = Date.now()) {
  if (ev.status === "Odwo\u0142ane") return "odwolane";
  const start = new Date(ev.start_datetime).getTime();
  const open = start - (Number(ev.open_minutes) || 15) * 6e4;
  const close = start + ((Number(ev.duration_minutes) || 60) + 30) * 6e4;
  return now < open ? "przed" : now <= close ? "otwarte" : "po";
}
function icsLocal(d) {
  const o = {};
  for (const p of warsawFmt({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d)) o[p.type] = p.value;
  return `${o.year}${o.month}${o.day}T${o.hour === "24" ? "00" : o.hour}${o.minute}${o.second}`;
}
function buildIcs(ev, token = null) {
  const start = new Date(ev.start_datetime);
  const end = new Date(start.getTime() + (Number(ev.duration_minutes) || 60) * 6e4);
  const esc4 = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const url = isOnline(ev) ? joinUrl(ev, token) : null;
  const place = isOnline(ev) ? "" : ev.location || "";
  const desc = [ev.subtitle || "", url ? `Do\u0142\u0105cz do spotkania (pok\xF3j otwiera si\u0119 kilka minut przed startem):
${url}` : ""].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EXMORTIS//Spotkania//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.id}@exmortis`,
    `SEQUENCE:${Math.floor(Date.now() / 1e3) - 17e8}`,
    `DTSTAMP:${icsStamp(/* @__PURE__ */ new Date())}`,
    `DTSTART;TZID=Europe/Warsaw:${icsLocal(start)}`,
    `DTEND;TZID=Europe/Warsaw:${icsLocal(end)}`,
    `SUMMARY:${esc4(ev.title)}`,
    `DESCRIPTION:${esc4(desc)}`,
    ...place ? [`LOCATION:${esc4(place)}`] : [],
    ...url ? [`URL:${url}`] : [],
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc4(ev.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}
function icsAttachment(ev, token = null) {
  return {
    filename: "exmortis-spotkanie.ics",
    content: buildIcs(ev, token),
    contentType: "text/calendar; charset=utf-8"
  };
}
function coverOf(ev) {
  let c = ev?.cover;
  if (typeof c === "string") {
    try {
      c = JSON.parse(c);
    } catch {
      c = null;
    }
  }
  return c && typeof c === "object" ? c : null;
}
function shell(ev, content) {
  const c = coverOf(ev);
  const img = c?.crops?.mail ? `<img src="${escHtml(c.crops.mail)}" alt="${escHtml(c.alt || ev.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:0 0 24px;${ev.status === "Odwo\u0142ane" ? "filter:grayscale(1);" : ""}" />` : "";
  return `<div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>${img}
    ${content}
    <p style="color:#8A8A8C;font-size:12px;line-height:1.7;margin-top:28px;">exmortis to mentoring, nie terapia. Je\u015Bli jest Ci bardzo ci\u0119\u017Cko: 116 123 \xB7 800 70 2222 (ca\u0142\u0105 dob\u0119, bezp\u0142atnie) \xB7 w zagro\u017Ceniu \u017Cycia 112.</p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE \xB7 UCZ\u0118 WRACA\u0106</p>
  </div>`;
}
function cancelLink(token) {
  return `<p style="margin-top:28px;font-size:12px;"><a href="${APP_URL}/functions/eventsCancel?token=${token}" style="color:#8A8A8C;">Nie mog\u0119 przyj\u015B\u0107 \u2014 zwalniam miejsce</a></p>`;
}
function meetingLine(ev, reg) {
  return `<p style="color:#C9A24A;letter-spacing:1px;">${escHtml(mailWhen(ev.start_datetime, reg?.tz))} \xB7 ${escHtml(ev.format || "")}</p>
    <p style="color:#8A8A8C;">${escHtml(ev.location || "")}</p>`;
}
function joinBlock(ev, token = null) {
  const url = isOnline(ev) && joinUrl(ev, token);
  if (url) {
    return `${emailButton("DO\u0141\u0104CZ DO SPOTKANIA", url)}<p style="margin-top:0;font-size:13px;color:#A3A3A6;line-height:1.6;">Przycisk prowadzi na Twoj\u0105 stron\u0119 do\u0142\u0105czenia. Pok\xF3j otwiera si\u0119 kilka minut przed startem \u2014 wtedy pojawi si\u0119 tam przycisk wej\u015Bcia do Zoom. Zachowaj ten e-mail albo dodaj spotkanie do kalendarza.</p><p style="color:#8A8A8C;font-size:12px;line-height:1.6;">Przycisk jest przypisany do Twojego zapisu \u2014 nie przekazuj tego maila dalej. Na stronie spotkania wejdziesz te\u017C, wpisuj\u0105c adres e-mail podany przy zapisie.</p>`;
  }
  if (ev.format === "Online" && ev.external_url) {
    return `<p style="margin-top:20px;"><a href="${escHtml(ev.external_url)}" style="color:#C9A24A;">Do\u0142\u0105cz do spotkania tutaj</a></p>`;
  }
  return `<p style="margin-top:20px;color:#8A8A8C;">${escHtml(ev.location || "")} \u2014 przyjd\u017A kilka minut wcze\u015Bniej.</p>`;
}
async function ticketBlock(base44, ev, reg) {
  try {
    const t = await regTicket(base44, ev?.id || reg?.event_id, reg);
    if (!t) return "";
    return `<div style="margin:22px 0;border:1px solid #C9A24A;padding:20px;"><p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 10px;">TW\xD3J BILET</p><p style="margin:0 0 8px;color:#E2E2E2;">${escHtml(t.holder_name)} \xB7 <b style="color:#C9A24A;letter-spacing:2px;">${escHtml(showCode(t.code))}</b></p>` + emailButton("POBIERZ BILET (PDF)", ticketPdfUrl(t.token)) + `<p style="margin:0;font-size:13px;color:#8A8A8C;line-height:1.6;"><a href="${ticketUrl(t.token)}" style="color:#C9A24A;">Otw\xF3rz bilet na telefonie</a>. Przy wej\u015Bciu poka\u017C kod QR \u2014 na telefonie albo wydrukowany. Bilet jest imienny i wa\u017Cny na jedno wej\u015Bcie. Znajdziesz go te\u017C w Moim koncie \u2192 Spotkania.</p></div>`;
  } catch (e) {
    console.error("bilet zapisu:", e?.message);
    return "";
  }
}
function whatList(raw) {
  const items = String(raw || "").split(/\s*[;\n]\s*/).map((x) => x.trim()).filter(Boolean);
  if (!items.length) return "";
  return `<p style="line-height:1.7;margin-bottom:6px;">W ramach uczestnictwa otrzymujesz:</p><ul style="margin:0 0 16px;padding-left:20px;line-height:1.7;">${items.map((x) => `<li>${escHtml(x)}</li>`).join("")}</ul>`;
}
async function sendConfirmationMail(base44, ev, reg) {
  const jt = await joinToken(reg.cancel_token);
  const waitlist = reg.status === "Lista rezerwowa";
  const tix = waitlist ? "" : await ticketBlock(base44, ev, reg);
  const lead = waitlist ? `${escHtml(reg.first_name)}, wszystkie miejsca na \xAB${escHtml(ev.title)}\xBB s\u0105 ju\u017C zaj\u0119te. Zapisa\u0142em Ci\u0119 na list\u0119 rezerwow\u0105 \u2014 dam zna\u0107, je\u015Bli kto\u015B zrezygnuje.` : `${escHtml(reg.first_name)}, zapisuj\u0119 Ci\u0119 na \xAB${escHtml(ev.title)}\xBB. ${ev.format === "Online" ? "Sta\u0142y adres do\u0142\u0105czenia masz poni\u017Cej \u2014 zadzia\u0142a w dniu spotkania." : "Czekam na Ciebie na miejscu."}`;
  return sendMail(base44, {
    kind: "zapis",
    ref: reg.id,
    waznyDo: ev.start_datetime,
    to: reg.email,
    subject: `EXMORTIS \xB7 ${waitlist ? "Lista rezerwowa" : "Zapis potwierdzony"} \u2014 ${ev.title}`,
    html: shell(
      ev,
      `<h1 style="font-size:24px;">${waitlist ? "Lista rezerwowa" : "Zapis potwierdzony"}</h1>${meetingLine(ev, reg)}<p style="line-height:1.7;">${lead}</p>` + whatList(ev.what_registered) + (waitlist ? "" : joinBlock(ev, jt)) + tix + `<p style="color:#8A8A8C;font-size:13px;">Spotkanie masz w za\u0142\u0105czonym pliku kalendarza (.ics).</p>` + cancelLink(reg.cancel_token)
    ),
    attachments: [icsAttachment(ev, waitlist ? null : jt)]
  });
}
async function sendReminderMail(base44, ev, reg, kind) {
  const jt = await joinToken(reg.cancel_token);
  const head = kind === "1h" ? "Za godzin\u0119 si\u0119 widzimy" : kind === "now" ? "Do zobaczenia wkr\xF3tce" : "Jutro si\u0119 widzimy";
  const lead = kind === "1h" ? `${escHtml(reg.first_name)}, za godzin\u0119 spotykamy si\u0119 na \xAB${escHtml(ev.title)}\xBB. Zostaw wszystko i po prostu przyjd\u017A.` : kind === "now" ? `${escHtml(reg.first_name)}, przypominam o spotkaniu \xAB${escHtml(ev.title)}\xBB \u2014 ${escHtml(mailWhen(ev.start_datetime, reg.tz))}. Czekam na Ciebie.` : `${escHtml(reg.first_name)}, jutro o ${escHtml(plTime(ev.start_datetime))} (czas polski) spotykamy si\u0119 na \xAB${escHtml(ev.title)}\xBB. To kr\xF3tkie przypomnienie \u2014 nic nie musisz robi\u0107, tylko przyj\u015B\u0107.`;
  return sendMail(base44, {
    kind: "przypomnienie",
    ref: reg.id,
    waznyDo: ev.start_datetime,
    to: reg.email,
    subject: `EXMORTIS \xB7 ${head} \u2014 ${ev.title}`,
    html: shell(ev, `<h1 style="font-size:24px;">${head}</h1>${meetingLine(ev, reg)}<p style="line-height:1.7;">${lead}</p>${joinBlock(ev, jt)}${await ticketBlock(base44, ev, reg)}${cancelLink(reg.cancel_token)}`)
  });
}
async function sendRecordingMail(base44, ev, reg, inviteHtml) {
  const konto = `${APP_URL}/konto?tab=spotkania`;
  const rejestracja = `${APP_URL}/register?returnTo=${encodeURIComponent("/konto?tab=spotkania")}`;
  const until = ev.recording_until ? escHtml(plWhen(ev.recording_until)) : "";
  return sendMail(base44, {
    kind: "nagranie",
    ref: reg.id,
    waznyDo: ev.recording_until || void 0,
    to: reg.email,
    subject: `EXMORTIS \xB7 Nagranie czeka w Twoim koncie \u2014 ${ev.title}`,
    html: shell(
      ev,
      `<h1 style="font-size:24px;">Nagranie czeka w Twoim koncie</h1><p style="line-height:1.7;">${escHtml(reg.first_name)}, nagranie ze spotkania \xAB${escHtml(ev.title)}\xBB jest w Twoim koncie na exmortis.pl` + (until ? `. Dost\u0119pne do: <strong>${until}</strong> (czasu polskiego) \u2014 potem zniknie.` : ".") + `</p><p><a href="${escHtml(konto)}" style="display:inline-block;background:#C9A24A;color:#0A0A0B;text-decoration:none;padding:12px 22px;font-weight:bold;">Obejrzyj w koncie</a></p><p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Zaloguj si\u0119 adresem <strong>${escHtml(reg.email)}</strong> \u2014 tym samym, kt\xF3ry by\u0142 podany przy zapisie. Nie masz jeszcze konta? <a href="${escHtml(rejestracja)}" style="color:#C9A24A;">Za\u0142\xF3\u017C je na ten sam adres</a> \u2014 nagranie pojawi si\u0119 od razu.</p>` + inviteHtml
    )
  });
}

// supabase/functions/_shared/registrations.ts
init_smtp();

// supabase/functions/_shared/legalDocs.ts
init_settings();
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

// supabase/functions/_shared/registrations.ts
var MAX_PROBY = 8;
var REGULAMIN_TEXT = "Akceptuj\u0119 regulamin.";
var LISTY_TEXT = "Chc\u0119 te\u017C dostawa\u0107 Listy powrotu \u2014 jeden list w ka\u017Cdy poniedzia\u0142ek.";
var RPC_ERRORS = {
  not_found: [404, "Nie znaleziono wydarzenia"],
  unavailable: [400, "To wydarzenie nie jest ju\u017C dost\u0119pne."],
  no_site: [400, "To wydarzenie nie przyjmuje zapis\xF3w na stronie."],
  closed: [400, "Zapisy zamkni\u0119te."],
  rate: [429, "Za du\u017Co zapis\xF3w w kr\xF3tkim czasie. Spr\xF3buj za kilka minut."]
};
function rpcRegister(base44, d, skipRate = false) {
  return rpc(base44, "exm_register", {
    p_slug: d.slug,
    p_email: d.email,
    p_first_name: d.first_name,
    p_question: d.question || null,
    p_source: d.source || null,
    p_ip: d.ip || "brak",
    p_listy: !!d.listy,
    p_at: d.at,
    p_skip_rate: skipRate
  });
}
async function saveConsents(base44, d, refId) {
  const base = { email: d.email, source: `spotkanie:${d.slug}`, ref_id: refId, ip: d.ip, given_at: d.at };
  const list = [{ ...base, kind: "wydarzenie", text: REGULAMIN_TEXT, doc_version: `regulamin ${await regulaminVersion(base44)}` }];
  if (d.listy) list.push({ ...base, kind: "newsletter", text: LISTY_TEXT });
  const made = await base44.asServiceRole.entities.Consent.bulkCreate(list);
  for (const c of made || []) await mirrorRecord(base44, "Consent", c.id);
}
var tzReady = false;
async function ensureTzColumn(base44) {
  if (tzReady) return;
  await runSql(base44, `ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS tz text`);
  tzReady = true;
}
function afterSaved(base44, ev, reg, d) {
  const tz = typeof d.tz === "string" && /^[A-Za-z_+\-\/0-9]{1,64}$/.test(d.tz) ? d.tz : null;
  if (tz) reg = { ...reg, tz };
  const jobs = [loadAppUrl(base44).then(() => sendConfirmationMail(base44, ev, reg))];
  if (tz) jobs.push(ensureTzColumn(base44).then(() => runSql(base44, `UPDATE public.registrations SET tz = ${escStr(tz)} WHERE id = ${escStr(reg.id)}`)));
  if (d.listy) {
    jobs.push(Promise.resolve().then(() => (init_newsletter(), newsletter_exports)).then((m) => m.addSubscriber(base44, { email: d.email, name: d.first_name, consentGiven: true })));
  }
  return Promise.allSettled(jobs);
}
async function enqueue(base44, d, err) {
  const Q = base44.asServiceRole.entities.PendingRegistration;
  const p = await Q.create({ ...d, status: "oczekujace", proby: 0, blad: String(err?.message || err).slice(0, 300) });
  await saveConsents(base44, d, `kolejka:${p.id}`);
  console.log("Zapis w kolejce:", p.id, String(err?.message || err).slice(0, 200));
  waitUntil(new Promise((r) => setTimeout(r, 2e4)).then(() => flushQueue(base44)).catch(() => {
  }));
  return p;
}
async function flushQueue(base44, { simulateDown = false } = {}) {
  const Q = base44.asServiceRole.entities.PendingRegistration;
  const items = await Q.filter({ status: "oczekujace" }, "created_date", 50);
  let moved = 0, failed = 0;
  for (const p of items) {
    try {
      if (simulateDown) throw new Error("Symulowana awaria Supabase");
      const res = await rpcRegister(base44, p, true);
      if (res.error) throw new Error(`Zapis odrzucony: ${res.error}`);
      const reg = res.reg || null;
      const ev = res.ev;
      const regId = reg?.id || res.reg_id;
      const affected = await consentFilter(base44, { ref_id: `kolejka:${p.id}` });
      await base44.asServiceRole.entities.Consent.updateMany({ ref_id: `kolejka:${p.id}` }, { $set: { ref_id: regId } });
      for (const c of affected) await mirrorRecord(base44, "Consent", c.id);
      await Q.update(p.id, { status: "przeniesione", reg_id: regId, przeniesiono_at: (/* @__PURE__ */ new Date()).toISOString() });
      if (reg) await afterSaved(base44, ev, reg, p);
      moved++;
    } catch (e) {
      const proby = (p.proby || 0) + 1;
      const dead = proby >= MAX_PROBY;
      await Q.update(p.id, { proby, blad: String(e?.message || e).slice(0, 300), status: dead ? "nieudane" : "oczekujace" });
      if (dead) failed++;
    }
  }
  const alarm = await sendAlarm(base44);
  return { checked: items.length, moved, failed, alarm };
}
async function sendAlarm(base44) {
  const Q = base44.asServiceRole.entities.PendingRegistration;
  const total = await Q.filter({ status: "nieudane" }, "created_date", 1e3);
  const fresh = total.filter((x) => !x.alarm_at);
  if (!fresh.length) return null;
  const firma = await getSetting(base44, "firma").catch(() => null);
  const subject = `exmortis: ${fresh.length} zapis(\xF3w) na spotkanie nie uda\u0142o si\u0119 przenie\u015B\u0107`;
  const html = `<p>Nie uda\u0142o si\u0119 zapisa\u0107 w bazie Supabase <strong>${fresh.length}</strong> nowych zg\u0142osze\u0144 na spotkania (\u0142\u0105cznie nieprzeniesionych: ${total.length}), mimo ${MAX_PROBY} pr\xF3b.</p>
<p>Zg\u0142oszenia nie zgin\u0119\u0142y \u2014 s\u0105 w bazie aplikacji (PendingRegistration, status \u201Enieudane\u201D). Po usuni\u0119ciu awarii zmie\u0144 ich status na \u201Eoczekuj\u0105ce\u201D, a zostan\u0105 przeniesione automatycznie.</p>
<p>Spotkania: ${[...new Set(fresh.map((x) => x.slug))].join(", ")}</p>`;
  let via = null;
  const to = firma?.email;
  if (to) {
    via = await sendMail(base44, { to, subject, html, kind: "alarm" }).then((r) => r === "wyslany" ? "smtp" : null).catch(() => null);
    if (!via) via = await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html }).then(() => "platforma").catch(() => null);
  }
  if (!via) {
    const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
    for (const a of admins) {
      if (await base44.asServiceRole.integrations.Core.SendEmail({ to: a.email, subject, body: html }).then(() => true).catch(() => false)) via = "admin";
    }
  }
  const at = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all(fresh.map((x) => Q.update(x.id, { alarm_at: at })));
  return { count: fresh.length, via };
}
async function snapEvent(base44, slug) {
  const row = (await base44.asServiceRole.entities.PublicSnapshot.filter({ key: `events:get:${slug}` }, "-refreshed_at", 1).catch(() => []))[0];
  return row?.value?.v || null;
}

// supabase/functions/eventsPublic/index.ts
init_smtp();

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

// supabase/functions/_shared/libraryAccess.ts
init_supabase();
function safeEqual(a, b) {
  const x = String(a == null ? "" : a);
  const y = String(b == null ? "" : b);
  if (!x.length || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// supabase/functions/_shared/followup.ts
init_supabase();
init_settings();
init_emailLayout();
var esc3 = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
var P = (t) => `<p style="margin:0 0 18px;">${t}</p>`;
var LABEL = (t) => `<p style="margin:0 0 10px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#C9A24A;">${t}</p>`;
var SIGN = `<p style="margin:30px 0 0;">Dawid</p><p style="margin:4px 0 0;font-size:13px;color:#A3A3A6;">Mo\u017Cesz po prostu odpowiedzie\u0107 na ten list.</p>`;
var firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
async function followupOn(base44) {
  const s = await getSetting(base44, "po_spotkaniu").catch(() => null);
  return s?.wlaczone !== false;
}
var plDay = (iso) => new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" });
var plHour = (iso) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
function nextBox(next, site) {
  if (!next) return "";
  return [
    `<div style="margin:28px 0;padding:22px 22px 4px;border:1px solid #2A2A2C;">`,
    LABEL("NAST\u0118PNE SPOTKANIE"),
    `<p style="margin:0 0 6px;font-size:21px;line-height:1.35;color:#F5EFE1;">${esc3(next.title)}</p>`,
    `<p style="margin:0 0 4px;color:#C8C6C1;">${esc3(plDay(next.start_datetime))}, ${esc3(plHour(next.start_datetime))} (czasu polskiego)</p>`,
    emailButton("ZOBACZ I ZAPISZ SI\u0118", `${site}/spotkania/${encodeURIComponent(next.slug)}`),
    `</div>`
  ].join("");
}
function followupMail(variant, ctx) {
  const hi = ctx.name ? `${esc3(ctx.name)}, ` : "";
  const title = `\xAB${esc3(ctx.title)}\xBB`;
  if (variant === "obecny") {
    return {
      subject: "Dzi\u0119kuj\u0119 za wczorajszy wiecz\xF3r",
      html: [
        `<h1>Dzi\u0119kuj\u0119 za wczoraj</h1>`,
        P(`${hi}dzi\u0119kuj\u0119 za wsp\xF3lny wiecz\xF3r ${title}. Za czas, uwag\u0119 i pytania \u2014 tak\u017Ce te, kt\xF3re zosta\u0142y niezadane.`),
        P(`Po takim spotkaniu \u0142atwo wr\xF3ci\u0107 do codzienno\u015Bci i zostawi\u0107 wszystko tak, jak by\u0142o. Dlatego jedna pro\u015Bba: zanim minie ten tydzie\u0144, zr\xF3b jeden ma\u0142y krok. Nie wielki \u2014 jeden.`),
        LABEL("PIERWSZY KROK"),
        P(`Kr\xF3tki test \u2014 kilka minut, \u017Ceby zobaczy\u0107, ile jest w Tobie ka\u017Cdej z trzech \u015Bmierci i od kt\xF3rego etapu powrotu warto zacz\u0105\u0107.`),
        emailButton("ZR\xD3B TEST", `${ctx.site}/test`),
        nextBox(ctx.next, ctx.site),
        P(`Je\u015Bli chcesz, odpowiedz na ten list jednym zdaniem: co z wczorajszego wieczoru zosta\u0142o z Tob\u0105 najbardziej?`),
        SIGN
      ].join("")
    };
  }
  return {
    subject: "Wczoraj Ci\u0119 zabrak\u0142o \u2014 i to w porz\u0105dku",
    html: [
      `<h1>Mo\u017Ce nast\u0119pnym razem</h1>`,
      P(`${hi}wczoraj by\u0142 wiecz\xF3r ${title}. Nie uda\u0142o Ci si\u0119 do\u0142\u0105czy\u0107 \u2014 i to w porz\u0105dku. \u017Bycie rzadko pyta o nasze plany.`),
      P(`Spotka\u0144 nie nagrywam. To, co dzieje si\u0119 na \u017Cywo, zostaje mi\u0119dzy tymi, kt\xF3rzy byli obecni \u2014 i w\u0142a\u015Bnie dlatego mo\u017Ce by\u0107 prawdziwe.`),
      ctx.next ? nextBox(ctx.next, ctx.site) : [P(`Kolejne terminy pojawiaj\u0105 si\u0119 na stronie spotka\u0144.`), emailButton("ZOBACZ SPOTKANIA", `${ctx.site}/spotkania`)].join(""),
      P(`A je\u015Bli chcesz zacz\u0105\u0107 ju\u017C teraz \u2014 <a href="${esc3(ctx.site)}/test">kr\xF3tki test</a> poka\u017Ce, od czego zacz\u0105\u0107.`),
      SIGN
    ].join("")
  };
}
function warsawHour(d = /* @__PURE__ */ new Date()) {
  return Number(new Intl.DateTimeFormat("pl-PL", { hour: "numeric", hour12: false, timeZone: "Europe/Warsaw" }).format(d));
}
async function claimFollowups(base44, limit = 150) {
  if (!await followupOn(base44)) return [];
  const h = warsawHour();
  if (h < 8 || h >= 20) return [];
  const due = `(((date_trunc('day', (e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute')) AT TIME ZONE 'Europe/Warsaw')
                 + interval '1 day 9 hours') AT TIME ZONE 'Europe/Warsaw'))`;
  return await runSql(base44, `
    WITH c AS (
      SELECT r.id FROM public.registrations r JOIN public.events e ON e.id = r.event_id
       WHERE r.status IN ('Zapisany','Obecny') AND e.status = 'Opublikowane' AND e.format = 'Online'
         AND e.start_datetime IS NOT NULL AND COALESCE(r.follow_up_sent, FALSE) = FALSE
         AND now() >= ${due} AND now() < ${due} + interval '36 hours'
       ORDER BY e.start_datetime LIMIT ${Number(limit) || 150}
       FOR UPDATE OF r SKIP LOCKED
    ), u AS (
      UPDATE public.registrations r SET follow_up_sent = TRUE FROM c WHERE r.id = c.id
      RETURNING r.id AS reg_id, r.first_name, r.email, r.status, r.joined_at, r.event_id
    )
    SELECT u.reg_id, u.first_name, u.email, u.status, u.joined_at, e.id AS event_id, e.title, e.start_datetime
      FROM u JOIN public.events e ON e.id = u.event_id`).catch(() => []);
}
async function nextEventAfter(base44, eventId) {
  const rows = await runSql(base44, `SELECT title, slug, start_datetime FROM public.events
     WHERE status = 'Opublikowane' AND start_datetime > now() AND id::text <> ${escStr(String(eventId))}
     ORDER BY start_datetime ASC LIMIT 1`, true).catch(() => []);
  return rows?.[0] || null;
}
var followupCtx = (row, site, next) => ({ name: firstName(row.first_name), title: row.title, site, next });
var attended = (row) => !!row.joined_at || row.status === "Obecny";

// supabase/functions/_shared/publicData.ts
init_supabase();
init_settings();
init_snapshot();
var PUB_COLS = `e.id, e.title, e.slug, e.subtitle, e.event_type, e.format, e.start_datetime,
  e.duration_minutes, e.description, e.for_whom, e.price, e.checkout_url,
  e.capacity, e.registration_type, e.external_url, (e.recording_url IS NOT NULL) AS has_recording, e.recording_until, e.stage,
  e.cover_image, e.cover, e.status, e.cancel_reason, e.registration_deadline, e.what_registered,
  e.open_minutes, e.zoom_faq, e.short_path, COALESCE((to_jsonb(e)->>'tickets')::boolean, false) AS tickets`;
var REG_COUNT = `(SELECT COUNT(*) FROM public.registrations r
  WHERE r.event_id = e.id AND r.status IN ('Zapisany','Obecny'))::int AS registered`;
var publicEvent = (base44, slug) => getSnap(base44, `events:get:${slug}`, async () => {
  const rows = await runSql(base44, `SELECT ${PUB_COLS}, ${REG_COUNT} FROM public.events e WHERE e.slug = ${escStr(slug)}`, true);
  return rows?.[0] || null;
});

// supabase/functions/eventsPublic/index.ts
var ensureJoinColumns = (base44) => runSql(
  base44,
  `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS open_minutes int DEFAULT 15,
     ADD COLUMN IF NOT EXISTS zoom_faq boolean DEFAULT true, ADD COLUMN IF NOT EXISTS short_path text`
);
var JOIN_CACHE = /* @__PURE__ */ new Map();
var REG_OPENS = { "ze-smierci-o-powrotach-o-ktorych-swiat-nie-mowi": "2026-10-20T00:00:00+02:00" };
var REG_CACHE = /* @__PURE__ */ new Map();
async function regAccess(base44, eventId, fresh = false) {
  const hit = REG_CACHE.get(eventId);
  if (hit && !fresh && Date.now() - hit.at < 6e4) return hit;
  const rows = await runSql(
    base44,
    `SELECT lower(email) AS email, cancel_token FROM public.registrations
     WHERE event_id = ${escStr(String(eventId))} AND status IN ('Zapisany', 'Obecny')`,
    true
  );
  const emails = new Set(rows.map((r) => String(r.email || "")));
  const pairs = await Promise.all(rows.map(async (r) => [await joinToken(r.cancel_token), r.cancel_token]));
  const tokens = new Set(pairs.map(([t]) => t).filter(Boolean));
  const byToken = new Map(pairs.filter(([t]) => t));
  const byEmail = new Map(rows.map((r) => [String(r.email || ""), r.cancel_token]));
  const out = { at: Date.now(), emails, tokens, byToken, byEmail };
  REG_CACHE.set(eventId, out);
  return out;
}
var MISSES = /* @__PURE__ */ new Map();
function tooManyMisses(ip) {
  const m = MISSES.get(ip);
  return !!m && Date.now() - m.at < 6e5 && m.n >= 12;
}
function addMiss(ip) {
  if (MISSES.size > 1e4) MISSES.clear();
  const m = MISSES.get(ip);
  if (!m || Date.now() - m.at > 6e5) MISSES.set(ip, { at: Date.now(), n: 1 });
  else m.n++;
}
var joinColsReady = false;
var JOINED = /* @__PURE__ */ new Set();
function markJoined(base44, cancelToken) {
  if (!cancelToken || JOINED.has(cancelToken)) return;
  if (JOINED.size > 2e4) JOINED.clear();
  JOINED.add(cancelToken);
  waitUntil(runSql(base44, `UPDATE public.registrations SET joined_at = now()
     WHERE cancel_token = ${escStr(String(cancelToken))} AND joined_at IS NULL`).catch(() => JOINED.delete(cancelToken)));
}
async function zoomAlarm(base44, ev) {
  const ref = `zoom:${ev.id}`;
  if ((await base44.asServiceRole.entities.MailQueue.filter({ kind: "alarm_zoom", ref }, "-created_date", 1)).length) return;
  const to = await adminTo(base44);
  const subject = `PILNE: brak linku Zoom \u2014 ${ev.title}`;
  if (!to) return base44.asServiceRole.entities.MailQueue.create({ to_email: "\u2014", kind: "alarm_zoom", ref, subject, status: "pominiety", blad: "Uzupe\u0142nij e-mail firmy w Ustawieniach" });
  await sendMail(base44, {
    kind: "alarm_zoom",
    ref,
    to,
    subject,
    html: `<p>Pok\xF3j spotkania \xAB${ev.title}\xBB jest otwarty, a w panelu nie ma linku do Zoom. Uczestnicy widz\u0105: \u201EZa chwil\u0119 podam link\u201D.</p>`
  });
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const isGet = req.method === "GET";
    const body = isGet ? Object.fromEntries(new URL(req.url).searchParams) : await req.json().catch(() => ({}));
    if (isGet && body.action !== "ics") return Response.json({ error: "Method not allowed" }, { status: 405 });
    if (body.ping) return Response.json({ ok: true });
    if (body.action === "list") {
      const data = await getSnap(base44, "events:list", async () => {
        const [upcoming, past] = await Promise.all([
          runSql(
            base44,
            `SELECT ${PUB_COLS}, ${REG_COUNT}
           FROM public.events e
           WHERE e.status IN ('Opublikowane','Odwo\u0142ane')
             AND e.start_datetime IS NOT NULL
             AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') >= now()
           ORDER BY e.start_datetime ASC`,
            true
          ),
          runSql(
            base44,
            `SELECT ${PUB_COLS}
           FROM public.events e
           WHERE e.status = 'Opublikowane'
             AND e.recording_url IS NOT NULL
             AND e.start_datetime IS NOT NULL
             AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') < now()
           AND e.recording_until IS NOT NULL AND e.recording_until > now()
           ORDER BY e.start_datetime DESC
           LIMIT 20`,
            true
          )
        ]);
        return { upcoming: upcoming || [], past: past || [] };
      });
      return Response.json(data);
    }
    if (body.action === "get") {
      const slug = textField(body, "slug", { max: 200 });
      const ev = await publicEvent(base44, slug);
      if (!ev) {
        return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      }
      return Response.json({ event: ev });
    }
    if (body.action === "register") {
      if (body.website) return Response.json({ ok: true, status: "Zapisany", first_name: String(body.first_name || "").slice(0, 120) });
      const slug = textField(body, "slug", { max: 200 });
      const firstName2 = textField(body, "first_name", { max: 120 });
      const email = emailField(body).toLowerCase();
      const question = textField(body, "question", { required: false, max: 2e3 });
      if (body.consent !== true) {
        return Response.json({ error: "Zaznacz, \u017Ceby si\u0119 zapisa\u0107." }, { status: 400 });
      }
      const opens = REG_OPENS[slug];
      if (opens && Date.now() < new Date(opens).getTime() && (await base44.auth.me().catch(() => null))?.role !== "admin") {
        return Response.json({ error: `Zapisy ruszaj\u0105 ${new Date(opens).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}.`, not_yet: true }, { status: 400 });
      }
      const source = typeof body.source === "string" && body.source.trim() !== "" ? body.source.trim().slice(0, 100) : null;
      const ip = clientIp(req);
      if (!await ipAllowed(base44, ip, "zapis", 8, 36e5, slug)) return Response.json({ error: TOO_MANY }, { status: 429 });
      const tz = typeof body.tz === "string" ? body.tz.slice(0, 64) : null;
      const d = { slug, first_name: firstName2, email, question, listy: body.listy === true, source, ip, tz, at: (/* @__PURE__ */ new Date()).toISOString() };
      const isAdmin = (body.simulate_down === true || body.load_test === true) && (await base44.auth.me().catch(() => null))?.role === "admin";
      const simulate = isAdmin && body.simulate_down === true;
      const closedErr = (ev2) => {
        if (ev2.status !== "Opublikowane") return "To wydarzenie nie jest ju\u017C dost\u0119pne.";
        if ((ev2.tickets === true || ev2.tickets === "true") && Number(ev2.price) > 0) return "Na to wydarzenie wchodzi si\u0119 z biletem \u2014 kup go na stronie wydarzenia.";
        if (ev2.registration_type !== "Zapis na stronie") return "To wydarzenie nie przyjmuje zapis\xF3w na stronie.";
        const deadline = ev2.registration_deadline ? new Date(ev2.registration_deadline) : ev2.start_datetime ? new Date(new Date(ev2.start_datetime).getTime() - 15 * 6e4) : null;
        if (deadline && /* @__PURE__ */ new Date() > deadline) return "Zapisy zamkni\u0119te.";
        return null;
      };
      const queued = async (err) => {
        const snap = await snapEvent(base44, slug);
        const e = snap && closedErr(snap);
        if (e) return Response.json({ error: e, closed: e === "Zapisy zamkni\u0119te." }, { status: 400 });
        await enqueue(base44, d, err);
        return Response.json({ ok: true, status: "Zapisany", first_name: firstName2, pending: true });
      };
      const tk = (await runSql(base44, `SELECT e.id, COALESCE((to_jsonb(e)->>'tickets')::boolean, false) AS t, COALESCE(e.price, 0)::float8 AS price FROM public.events e WHERE slug = ${escStr(slug)}`, true).catch(() => []))[0];
      if (tk?.t === true && Number(tk.price) > 0) return Response.json({ error: "Na to wydarzenie wchodzi si\u0119 z biletem \u2014 kup go na stronie wydarzenia." }, { status: 400 });
      let res;
      try {
        if (simulate) throw new Error("Symulowana awaria Supabase");
        res = await rpcRegister(base44, d, isAdmin && body.load_test === true);
      } catch (err) {
        return queued(err);
      }
      if (res.error) {
        const [code, msg] = RPC_ERRORS[res.error] || [400, "Nie uda\u0142o si\u0119 zapisa\u0107."];
        return Response.json({ error: msg, closed: res.error === "closed" }, { status: code });
      }
      if (res.already) return Response.json({ ok: true, already: true });
      const regRow = res.reg;
      const sp = (await runSql(base44, `SELECT short_path FROM public.events WHERE slug = ${escStr(slug)}`, true).catch(() => []))[0]?.short_path || null;
      const ev = { ...res.ev, id: res.ev?.id || tk?.id, slug: res.ev.slug || slug, short_path: sp };
      const jt = regRow.status === "Zapisany" && ev.format === "Online" ? await joinToken(regRow.cancel_token) : null;
      waitUntil(Promise.allSettled([saveConsents(base44, d, regRow.id), loadAppUrl(base44).then(() => afterSaved(base44, ev, regRow, d))]));
      return Response.json({
        ok: true,
        status: regRow.status,
        first_name: regRow.first_name,
        checkout_url: Number(ev.price) > 0 ? ev.checkout_url : null,
        join_url: jt ? `${sp ? `/${sp}/dolacz` : `/spotkania/${slug}/dolacz`}?t=${jt}` : null
      });
    }
    if (body.action === "join" || body.action === "ics") {
      const key = textField(body, "slug", { max: 200 });
      let admin = false;
      if (body.preview) {
        const me2 = await base44.auth.me().catch(() => null);
        admin = me2?.role === "admin";
      }
      let hit = JOIN_CACHE.get(key);
      if (!hit || Date.now() - hit.at > 3e4 || body.preview && admin) {
        if (!joinColsReady) {
          await ensureJoinColumns(base44);
          joinColsReady = true;
        }
        const rows = await runSql(
          base44,
          `SELECT id, title, slug, subtitle, format, status, start_datetime, duration_minutes, location, join_link, join_password, price,
             recording_url, recording_until, open_minutes, short_path FROM public.events
           WHERE (slug = ${escStr(key)} OR short_path = ${escStr(key)}) ORDER BY slug = ${escStr(key)} DESC LIMIT 1`,
          true
        );
        hit = { at: Date.now(), ev: rows[0] || null };
        if (!(body.preview && admin)) JOIN_CACHE.set(key, hit);
      }
      const ev = hit.ev;
      if (!ev || !ev.start_datetime || !admin && !["Opublikowane", "Odwo\u0142ane"].includes(ev.status)) {
        return Response.json({ error: "Nie znaleziono spotkania" }, { status: 404 });
      }
      if (body.action === "ics") {
        await loadAppUrl(base44);
        const it = /^[0-9a-f]{16,64}$/i.test(String(body.t || "")) ? String(body.t) : null;
        const ics = buildIcs(ev, it);
        if (isGet) return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="exmortis-spotkanie.ics"', "Cache-Control": "no-store" } });
        return Response.json({ ics });
      }
      const base = { title: ev.title, slug: ev.slug, start_datetime: ev.start_datetime, duration_minutes: ev.duration_minutes, open_minutes: Number(ev.open_minutes) || 15 };
      if (ev.format !== "Online") return Response.json({ ...base, state: "stacjonarne" });
      const state = admin && ["przed", "otwarte", "po"].includes(body.preview) ? body.preview : joinState(ev);
      const rec = state === "po" && !!ev.recording_url && !!ev.recording_until && new Date(ev.recording_until) > /* @__PURE__ */ new Date();
      let okToken = null;
      if (state === "otwarte" && ev.join_link && !admin) {
        const ip = clientIp(req);
        const t = String(body.t || "").trim().toLowerCase();
        const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
        const paid = Number(ev.price) > 0;
        if (paid && !t) return Response.json({ ...base, state, need: true, token_only: true });
        if (!t && !email) return Response.json({ ...base, state, need: true });
        if (tooManyMisses(ip)) return Response.json({ ...base, state, need: true, error: "Zbyt wiele pr\xF3b. Spr\xF3buj za kilka minut." });
        let acc = await regAccess(base44, ev.id);
        const byEmail = !paid && !!email;
        let ok = t && acc.tokens.has(t) || byEmail && acc.emails.has(email);
        if (!ok && Date.now() - acc.at > 1e4) {
          acc = await regAccess(base44, ev.id, true);
          ok = t && acc.tokens.has(t) || byEmail && acc.emails.has(email);
        }
        if (!ok) {
          addMiss(ip);
          if (paid) return Response.json({ ...base, state, need: true, token_only: true, error: "Ten link jest nieaktualny. Otw\xF3rz osobisty link z e-maila potwierdzaj\u0105cego zakup biletu." });
          return Response.json({ ...base, state, need: true, error: email ? "Nie znajduj\u0119 zapisu na ten adres. Sprawd\u017A pisowni\u0119 albo u\u017Cyj linku z e-maila." : "Ten link jest nieaktualny. Wpisz e-mail podany przy zapisie." });
        }
        okToken = t && acc.tokens.has(t) ? t : null;
        markJoined(base44, t && acc.byToken?.get(t) || byEmail && acc.byEmail?.get(email) || null);
        if (!okToken && byEmail) {
          const r = (await runSql(base44, `SELECT cancel_token FROM public.registrations WHERE event_id = ${escStr(String(ev.id))} AND lower(email) = ${escStr(email)} AND status IN ('Zapisany', 'Obecny') LIMIT 1`, true).catch(() => []))[0];
          okToken = r ? await joinToken(r.cancel_token) : null;
        }
      }
      if (state === "otwarte") {
        if (!ev.join_link) {
          if (!admin) waitUntil(zoomAlarm(base44, ev).catch((e) => console.error("Alarm Zoom", e.message)));
          return Response.json({ ...base, state, missing: true });
        }
        return Response.json({ ...base, state, join_link: ev.join_link, join_password: ev.join_password || null, ok_token: okToken });
      }
      return Response.json({ ...base, state, recording_in_account: rec, ok_token: okToken });
    }
    if (body.action === "flush") {
      const me2 = await base44.auth.me().catch(() => null);
      if (me2?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
      return Response.json(await flushQueue(base44, { simulateDown: body.simulate_down === true }));
    }
    await loadAppUrl(base44);
    if (body.action === "remind") {
      const slug = textField(body, "slug", { max: 200 });
      const email = emailField(body);
      const firstName2 = textField(body, "first_name", { required: false, max: 120 }) || "Nieznajomy";
      const source = typeof body.source === "string" && body.source.trim() !== "" ? body.source.trim().slice(0, 100) : null;
      if (!await ipAllowed(base44, clientIp(req), "przypomnij", 5, 36e5)) {
        return Response.json({ error: TOO_MANY }, { status: 429 });
      }
      const evRows = await runSql(
        base44,
        `SELECT ${PUB_COLS} FROM public.events e
         WHERE e.slug = ${escStr(slug)} AND e.status = 'Opublikowane'
           AND e.registration_type = 'Link zewn\u0119trzny'`,
        true
      );
      const ev = evRows && evRows[0];
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      await runSql(
        base44,
        `INSERT INTO public.registrations
           (id, event_id, first_name, email, consent, status, source)
         VALUES (gen_random_uuid()::text, ${escStr(ev.id)}, ${escStr(firstName2)}, ${escStr(email)},
           TRUE, 'Zapisany', ${source ? escStr(source) : "NULL"})
         ON CONFLICT (event_id, email) DO NOTHING`
      );
      return Response.json({ ok: true });
    }
    if (body.action === "tick") {
      const who = await base44.auth.me().catch(() => null);
      if (who?.role !== "admin") {
        const tk = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
        const stored = String(tk?.[0]?.tick_token || "");
        const given = typeof body.tick_token === "string" ? body.tick_token : "";
        if (!stored || !given || !await safeEqual(given, stored)) return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const lock = await runSql(
        base44,
        `INSERT INTO public.app_settings (key, value, updated_date)
           VALUES ('events_tick', jsonb_build_object('at', now()), now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
           WHERE public.app_settings.updated_date < now() - interval '60 seconds'
         RETURNING key`
      ).catch(() => [{ key: "events_tick" }]);
      if (!lock || !lock.length) return Response.json({ ok: true, skipped: true });
      await ensureTzColumn(base44);
      const queue = await flushQueue(base44).catch((e) => ({ error: e.message }));
      const retention = await (await Promise.resolve().then(() => (init_retention(), retention_exports))).runRetention(base44).catch((e) => ({ error: e.message }));
      const removed = await runSql(
        base44,
        `DELETE FROM public.registrations r USING public.events e
         WHERE r.event_id = e.id
           AND e.start_datetime IS NOT NULL
           AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') + interval '90 days' < now()
         RETURNING r.id`
      );
      await runSql(base44, `DO $t$ BEGIN IF to_regclass('public.event_tickets') IS NOT NULL THEN
          DELETE FROM public.event_tickets t USING public.events e WHERE t.event_id = e.id AND e.start_datetime IS NOT NULL
            AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') + interval '90 days' < now();
        END IF; END $t$`).catch(() => {
      });
      const evCols = `e.id, e.title, e.slug, e.subtitle, e.event_type, e.format,
        e.start_datetime, e.duration_minutes, e.location, e.join_link, e.external_url, e.recording_url, e.short_path, e.recording_until`;
      const claim = (flag, where, extraSet = "", limit = 100) => runSql(
        base44,
        `WITH c AS (
           SELECT r.id FROM public.registrations r JOIN public.events e ON e.id = r.event_id
            WHERE r.status IN ('Zapisany','Obecny') AND e.status = 'Opublikowane'
              AND e.start_datetime IS NOT NULL AND r.${flag} = FALSE AND ${where}
            ORDER BY e.start_datetime
            LIMIT ${limit}
            FOR UPDATE OF r SKIP LOCKED
         ), u AS (
           UPDATE public.registrations r SET ${flag} = TRUE${extraSet}
             FROM c WHERE r.id = c.id
           RETURNING r.id AS reg_id, r.first_name, r.email, r.cancel_token, r.tz, r.event_id
         )
         SELECT u.reg_id, u.first_name, u.email, u.cancel_token, u.tz, ${evCols}
           FROM u JOIN public.events e ON e.id = u.event_id`
      );
      const due24 = await claim(
        "reminder_24h_sent",
        `e.start_datetime > now() + interval '1 hour' AND e.start_datetime <= now() + interval '24 hours'`,
        "",
        200
      );
      const due1 = await claim(
        "reminder_1h_sent",
        `e.start_datetime > now() AND e.start_datetime <= now() + interval '1 hour'`,
        ", reminder_24h_sent = TRUE",
        400
      );
      const dueFollow = await claimFollowups(base44).catch(() => []);
      const dueRec = await claim(
        "recording_sent",
        `e.recording_url IS NOT NULL AND e.recording_until IS NOT NULL AND e.recording_until > now() + interval '30 minutes'
           AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') < now()`
      );
      const regOf = (row) => ({ id: row.reg_id, first_name: row.first_name, email: row.email, cancel_token: row.cancel_token, tz: row.tz });
      const release = (flag, row) => runSql(
        base44,
        `UPDATE public.registrations SET ${flag} = FALSE WHERE id = ${escStr(row.reg_id)}`
      ).catch(() => {
      });
      const pool = async (rows, fn, n = 10) => {
        let i = 0;
        await Promise.all(Array.from({ length: Math.min(n, rows.length) }, async () => {
          while (i < rows.length) {
            const row = rows[i++];
            await fn(row);
          }
        }));
      };
      waitUntil(
        (async () => {
          await pool(due1, async (row) => {
            try {
              await sendReminderMail(base44, row, regOf(row), "1h");
            } catch {
              await release("reminder_1h_sent", row);
            }
          });
          await pool(due24, async (row) => {
            try {
              await sendReminderMail(base44, row, regOf(row), "24h");
            } catch {
              await release("reminder_24h_sent", row);
            }
          });
          if (dueFollow.length > 0) {
            const site = APP_URL;
            const nexts = /* @__PURE__ */ new Map();
            for (const row of dueFollow) {
              if (!nexts.has(row.event_id)) nexts.set(row.event_id, await nextEventAfter(base44, row.event_id));
            }
            await pool(dueFollow, async (row) => {
              const variant = attended(row) ? "obecny" : "nieobecny";
              const m = followupMail(variant, followupCtx(row, site, nexts.get(row.event_id)));
              try {
                await sendMail(base44, {
                  kind: `po_spotkaniu_${variant}`,
                  ref: row.reg_id,
                  to: row.email,
                  subject: m.subject,
                  html: m.html,
                  waznyDo: new Date(Date.now() + 2 * 864e5)
                });
              } catch {
                await release("follow_up_sent", row);
              }
            }, 5);
          }
          if (dueRec.length > 0) {
            const next = await runSql(
              base44,
              `SELECT title, slug, start_datetime FROM public.events
               WHERE status = 'Opublikowane' AND start_datetime > now()
               ORDER BY start_datetime ASC LIMIT 1`,
              true
            ).catch(() => []);
            const inviteHtml = next && next[0] ? `<p style="margin-top:24px;color:#8A8A8C;">Najbli\u017Csze spotkanie: \xAB${next[0].title}\xBB \u2014 ${plWhen(next[0].start_datetime)}. <a href="${APP_URL}/spotkania/${next[0].slug}" style="color:#C9A24A;">Zobacz i zapisz si\u0119</a>.</p>` : `<p style="margin-top:24px;color:#8A8A8C;">Je\u015Bli chcesz porozmawia\u0107 o w\u0142asnym powrocie \u2014 <a href="${APP_URL}/powrot" style="color:#C9A24A;">um\xF3w rozmow\u0119 kwalifikacyjn\u0105 POWR\xD3T</a>.</p>`;
            await pool(dueRec, async (row) => {
              try {
                await sendRecordingMail(base44, row, regOf(row), inviteHtml);
              } catch {
                await release("recording_sent", row);
              }
            });
          }
        })()
      );
      return Response.json({
        ok: true,
        removed: (removed || []).length,
        queue,
        retention,
        due: { r24: due24.length, r1: due1.length, rec: dueRec.length, po: dueFollow.length }
      });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.isValidation ? 400 : 500 });
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
