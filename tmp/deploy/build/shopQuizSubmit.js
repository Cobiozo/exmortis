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

// supabase/functions/_shared/supabase.ts
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

// supabase/functions/_shared/shim.ts
var init_shim = __esm({
  "supabase/functions/_shared/shim.ts"() {
  }
});

// supabase/functions/_shared/snapshot.ts
var init_snapshot = __esm({
  "supabase/functions/_shared/snapshot.ts"() {
    init_shim();
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

// supabase/functions/_shared/emailLayout.ts
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
var esc2, newToken;
var init_newsletter = __esm({
  "supabase/functions/_shared/newsletter.ts"() {
    init_supabase();
    init_settings();
    init_smtp();
    esc2 = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    newToken = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
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

// supabase/functions/shopQuizSubmit/index.ts
init_supabase();

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

// supabase/functions/shopQuizSubmit/index.ts
init_settings();
init_smtp();
var escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var STAGES = ["\u015Amier\u0107", "Pr\xF3g", "Powr\xF3t", "Inny"];
var CRISIS = "Je\u015Bli jeste\u015B w kryzysie albo my\u015Blisz o odebraniu sobie \u017Cycia: 116 123 (bezp\u0142atny telefon zaufania dla doros\u0142ych), 800 70 2222 (Centrum Wsparcia, ca\u0142\u0105 dob\u0119), a w sytuacji zagro\u017Cenia \u017Cycia 112.";
var NOT_DIAGNOSIS = "Ten test nie jest diagnoz\u0105 i nie zast\u0119puje rozmowy z lekarzem, psychologiem ani psychoterapeut\u0105. To narz\u0119dzie do zatrzymania si\u0119 i przyjrzenia sobie.";
var V2 = { n: 15, max: 15, idx: { mentalna: [0, 3, 6, 9, 12], duchowa: [1, 4, 7, 10, 13], zyciowa: [2, 5, 8, 11, 14] } };
var DIM_LABEL = { mentalna: "Mentalna", duchowa: "Duchowa", zyciowa: "\u017Byciowa" };
var LEVELS = [
  { key: "brak", label: "brak wyra\u017Anych oznak", min: 0 },
  { key: "sygnaly", label: "pierwsze sygna\u0142y", min: 4 },
  { key: "wyraznie", label: "wyra\u017Anie obecna", min: 8 },
  { key: "gleboko", label: "g\u0142\u0119boko obecna", min: 12 }
];
var levelOf = (score) => [...LEVELS].reverse().find((l) => score >= l.min);
var DIM_TEXT = {
  mentalna: {
    brak: "W tym obszarze nie wida\u0107 wyra\u017Anych oznak. Masz dzi\u015B dost\u0119p do energii i obecno\u015Bci \u2014 warto wiedzie\u0107, co je podtrzymuje.",
    sygnaly: "Pojawiaj\u0105 si\u0119 pierwsze sygna\u0142y: zm\u0119czenie, kt\xF3re wraca, chwile dzia\u0142ania na autopilocie. To jeszcze nie \u015Bmier\u0107 \u2014 to ostrze\u017Cenie, kt\xF3re \u0142atwo zag\u0142uszy\u0107 kolejnym obowi\u0105zkiem.",
    wyraznie: "Zm\u0119czenie i oboj\u0119tno\u015B\u0107 sta\u0142y si\u0119 t\u0142em codzienno\u015Bci. Funkcjonujesz, ale coraz mniej w tym Ciebie. To miejsce, w kt\xF3rym najcz\u0119\u015Bciej pada zdanie: \u201Emusz\u0119 si\u0119 bardziej postara\u0107\u201D.",
    gleboko: "Odpowiedzi wskazuj\u0105 na g\u0142\u0119bokie wyczerpanie. Kiedy si\u0142y ko\u0144cz\u0105 si\u0119 na tym poziomie, sama wola nie wystarczy \u2014 potrzebny jest odpoczynek, wsparcie bliskich i cz\u0119sto rozmowa ze specjalist\u0105."
  },
  duchowa: {
    brak: "Sens i kierunek s\u0105 dzi\u015B dla Ciebie dost\u0119pne. To zas\xF3b \u2014 warto go nazwa\u0107, zanim przyjdzie czas, w kt\xF3rym b\u0119dzie potrzebny.",
    sygnaly: "Pojawiaj\u0105 si\u0119 pytania o sens, kt\xF3re jeszcze nie bol\u0105, ale nie daj\u0105 spokoju. To cz\u0119sto pierwszy znak, \u017Ce dotychczasowe odpowiedzi robi\u0105 si\u0119 za ciasne.",
    wyraznie: "Sens, kt\xF3ry dot\u0105d ni\xF3s\u0142, przesta\u0142 wystarcza\u0107. Masz to, co \u201Epowinno\u201D dawa\u0107 spe\u0142nienie \u2014 a w \u015Brodku jest cisza. To nie niewdzi\u0119czno\u015B\u0107. To sygna\u0142, \u017Ce dawne odpowiedzi si\u0119 wyczerpa\u0142y.",
    gleboko: "Odpowiedzi wskazuj\u0105 na g\u0142\u0119bok\u0105 utrat\u0119 sensu i kierunku. Pustka na tym poziomie bardzo obci\u0105\u017Ca \u2014 nie warto zostawa\u0107 z ni\u0105 w pojedynk\u0119."
  },
  zyciowa: {
    brak: "Nie wida\u0107 \u015Blad\xF3w straty ani ko\u0144ca, kt\xF3ry wci\u0105\u017C Ci\u0119 zatrzymuje. Je\u015Bli co\u015B wa\u017Cnego si\u0119 sko\u0144czy\u0142o, wygl\u0105da na to, \u017Ce znalaz\u0142o ju\u017C swoje miejsce.",
    sygnaly: "Jest w Tobie co\u015B, co si\u0119 sko\u0144czy\u0142o i wci\u0105\u017C daje o sobie zna\u0107. Wraca w pojedynczych chwilach, cho\u0107 na co dzie\u0144 sobie radzisz.",
    wyraznie: "Jedno wydarzenie podzieli\u0142o \u017Cycie na \u201Eprzed\u201D i \u201Epo\u201D. Otoczenie oczekuje, \u017Ce to ju\u017C za Tob\u0105, a Ty wci\u0105\u017C jeste\u015B w \u015Brodku. To nie op\xF3\u017Anienie \u2014 \u017Ca\u0142oba ma w\u0142asny czas.",
    gleboko: "Odpowiedzi wskazuj\u0105, \u017Ce strata wci\u0105\u017C zajmuje bardzo du\u017Co miejsca i odbiera si\u0142y na codzienno\u015B\u0107. Przez to nie trzeba przechodzi\u0107 w pojedynk\u0119."
  }
};
var DOMINANT = {
  Mentalna: {
    head: (n) => `${n}, w Twoich odpowiedziach najwyra\u017Aniej wida\u0107 \u015Bmier\u0107 mentaln\u0105.`,
    body: "\u015Amier\u0107 mentalna nie wygl\u0105da jak upadek. Wygl\u0105da jak sprawne dzia\u0142anie: obowi\u0105zki zrobione, terminy dotrzymane, a w \u015Brodku coraz mniej obecno\u015Bci. Najwi\u0119ksza pu\u0142apka tego miejsca brzmi: \u201Emusz\u0119 si\u0119 bardziej postara\u0107\u201D. Nie musisz bardziej. Najpierw trzeba si\u0119 zatrzyma\u0107 i zobaczy\u0107, co naprawd\u0119 zabiera Ci si\u0142y \u2014 i po co to wszystko robisz.",
    questions: ["Co robisz dzi\u015B tylko dlatego, \u017Ce \u201Etak trzeba\u201D?", "Kiedy ostatnio co\u015B naprawd\u0119 Ci\u0119 o\u017Cywi\u0142o \u2014 i co wtedy by\u0142o inne?", "Co by si\u0119 sta\u0142o, gdyby przez tydzie\u0144 nikt nie widzia\u0142 Twojego wysi\u0142ku?"]
  },
  Duchowa: {
    head: (n) => `${n}, w Twoich odpowiedziach najwyra\u017Aniej wida\u0107 \u015Bmier\u0107 duchow\u0105.`,
    body: "\u015Amier\u0107 duchowa przychodzi cicho. Z zewn\u0105trz wszystko jest na miejscu, a w \u015Brodku ga\u015Bnie \u015Bwiat\u0142o, kt\xF3re dawa\u0142o kierunek. Pustka nie jest niewdzi\u0119czno\u015Bci\u0105 ani s\u0142abo\u015Bci\u0105. Jest znakiem, \u017Ce dawne odpowiedzi sta\u0142y si\u0119 za ciasne. Sensu nie znajduje si\u0119 gotowego. Sens si\u0119 buduje \u2014 od pyta\u0144, kt\xF3rych dot\u0105d nie by\u0142o wolno zada\u0107.",
    questions: ["Co straci\u0142o dla Ciebie znaczenie w ostatnich latach?", "Za czym t\u0119sknisz, kiedy wok\xF3\u0142 robi si\u0119 cicho?", "Gdyby nikt nie ocenia\u0142 Twojego wyboru \u2014 jaki by\u0142by nast\u0119pny krok?"]
  },
  \u017Byciowa: {
    head: (n) => `${n}, w Twoich odpowiedziach najwyra\u017Aniej wida\u0107 \u015Bmier\u0107 \u017Cyciow\u0105.`,
    body: "\u015Amier\u0107 \u017Cyciowa ma dat\u0119. Strata, rozstanie, koniec pracy, zdrowia albo roli, kt\xF3ra by\u0142a ca\u0142ym \u017Cyciem. \u015Awiat ma kr\xF3tk\u0105 pami\u0119\u0107 i szybko oczekuje powrotu do formy. Nie chodzi jednak o powr\xF3t do siebie sprzed. Chodzi o zbudowanie nowego domu w miejscu, w kt\xF3rym ten pierwszy si\u0119 spali\u0142.",
    questions: ["Co sko\u0144czy\u0142o si\u0119 razem z tym wydarzeniem \u2014 poza tym, co wida\u0107?", "Czego nie pozwalasz sobie jeszcze op\u0142aka\u0107?", "Co z tamtego \u017Cycia chcesz zabra\u0107 dalej, a co zostawi\u0107?"]
  },
  Mieszana: {
    head: (n) => `${n}, niesiesz wi\u0119cej ni\u017C jedn\u0105 \u015Bmier\u0107.`,
    body: "Tak jest u wi\u0119kszo\u015Bci ludzi, kt\xF3rzy do mnie przychodz\u0105. Jedna \u015Bmier\u0107 uruchamia drug\u0105, druga maskuje trzeci\u0105: strata odbiera sens, brak sensu wyczerpuje, a wyczerpanie nie pozwala prze\u017Cy\u0107 straty. Dlatego warto zacz\u0105\u0107 nie od jednego fragmentu, ale od mapy ca\u0142ej drogi \u2014 i od pytania, kt\xF3ra \u015Bmier\u0107 by\u0142a pierwsza.",
    questions: ["Kt\xF3ra z tych \u015Bmierci by\u0142a pierwsza?", "Kt\xF3ra z nich zabiera Ci dzi\u015B najwi\u0119cej si\u0142?", "Gdyby mo\u017Cna by\u0142o zaj\u0105\u0107 si\u0119 dzi\u015B tylko jedn\u0105 \u2014 kt\xF3ra by to by\u0142a?"]
  },
  \u017Badna: {
    head: (n) => `${n}, \u017Cadna z trzech \u015Bmierci nie dominuje.`,
    body: "Twoje odpowiedzi s\u0105 niskie we wszystkich trzech obszarach. To mo\u017Ce znaczy\u0107, \u017Ce jeste\u015B dzi\u015B w dobrym miejscu \u2014 i warto wiedzie\u0107, co Ci\u0119 w nim trzyma. Mo\u017Ce te\u017C znaczy\u0107, \u017Ce trudne rzeczy s\u0105 dobrze schowane. Odpowiedz sobie uczciwie, co jest bli\u017Csze prawdy, i wr\xF3\u0107 do testu za kilka tygodni.",
    questions: ["Co dzi\u015B daje Ci si\u0142\u0119, sens i oparcie?", "O co dbasz, \u017Ceby tak zosta\u0142o?", "Czy kto\u015B w Twoim otoczeniu przechodzi teraz swoj\u0105 \u015Bmier\u0107?"]
  }
};
function scoreV2(answers) {
  const sum = (idx) => idx.reduce((acc, i) => acc + Number(answers[i]), 0);
  const scores = { mentalna: sum(V2.idx.mentalna), duchowa: sum(V2.idx.duchowa), zyciowa: sum(V2.idx.zyciowa) };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let dominant = DIM_LABEL[ranked[0][0]];
  if (ranked[0][1] < LEVELS[1].min) dominant = "\u017Badna";
  else if (ranked[1][1] >= LEVELS[1].min && ranked[0][1] - ranked[1][1] <= 2) dominant = "Mieszana";
  const dims = Object.keys(scores).map((k) => {
    const l = levelOf(scores[k]);
    return { key: k, label: DIM_LABEL[k], score: scores[k], max: V2.max, level: l.key, level_label: l.label, text: DIM_TEXT[k][l.key] };
  });
  return { scores, dominant, dims, deep: dims.some((d) => d.level === "gleboko") };
}
var STAGE_TEXT = {
  "\u015Amier\u0107": "Jeste\u015B na pocz\u0105tku drogi. Tu nie trzeba jeszcze niczego zmienia\u0107 \u2014 trzeba zobaczy\u0107 i nazwa\u0107, co si\u0119 sko\u0144czy\u0142o.",
  "Pr\xF3g": "Wiesz ju\u017C, co umar\u0142o. Teraz liczy si\u0119 jedna rzecz: decyzja, nie deklaracja.",
  "Powr\xF3t": "Budujesz co\u015B nowego. To najd\u0142u\u017Cszy etap \u2014 i ten, w kt\xF3rym naj\u0142atwiej wr\xF3ci\u0107 do starego.",
  "Inny": "Najtrudniejsze masz za sob\u0105. Teraz zadanie na d\u0142ugo: nie wr\xF3ci\u0107 do tego, co Ci\u0119 zabija\u0142o."
};
var IDX_MENTAL = [0, 3, 6, 9];
var IDX_SPIRITUAL = [1, 4, 7, 10];
var IDX_LIFE = [2, 5, 8, 11];
var RECIPES = {
  "\u015Amier\u0107": ["mini-ebook-trzy-smierci", "wracam-inny", "listy-powrotu"],
  "Pr\xF3g": ["3-pierwsze-ruchy", "wracam-inny", "powrot-mentoring"],
  "Powr\xF3t": ["wracam-inny", "dziennik-powrotu-90-dni", "powrot-mentoring"],
  "Inny": ["listy-powrotu", "kanal-whatsapp", "wracam-inny"]
};
function resultTextV1(dominant, isF) {
  if (dominant === "Mentalna") return DOMINANT.Mentalna.body;
  if (dominant === "Duchowa") {
    return isF ? "Sens, na kt\xF3rym sta\u0142a\u015B, przesta\u0142 wystarcza\u0107. Twoja pustka nie jest niewdzi\u0119czno\u015Bci\u0105 \u2014 jest sygna\u0142em, \u017Ce jeste\u015B gotowa na sens g\u0142\u0119bszy ni\u017C ten, kt\xF3ry mia\u0142a\u015B. Sensu si\u0119 nie znajduje. Sens si\u0119 buduje." : "Sens, kt\xF3ry dot\u0105d wystarcza\u0142, przesta\u0142 wystarcza\u0107. Twoja pustka nie jest niewdzi\u0119czno\u015Bci\u0105 \u2014 jest sygna\u0142em gotowo\u015Bci na sens g\u0142\u0119bszy ni\u017C dotychczasowy. Sensu si\u0119 nie znajduje. Sens si\u0119 buduje.";
  }
  if (dominant === "\u017Byciowa") return DOMINANT["\u017Byciowa"].body;
  return DOMINANT.Mieszana.body;
}
function recommendProducts(products, stage, dominant) {
  const available = products.filter((p) => p.status === "dost\u0119pny");
  const bySlug = new Map(available.map((p) => [p.slug, p]));
  const picks = (RECIPES[stage] || []).filter((slug) => bySlug.has(slug));
  if (dominant === "Mentalna" && bySlug.has("pusty-szczyt")) {
    picks[2] = "pusty-szczyt";
  }
  for (const p of available) {
    if (picks.length >= 3) break;
    if (!picks.includes(p.slug)) picks.push(p.slug);
  }
  return picks.slice(0, 3).map((slug) => ({ slug, name: bySlug.get(slug).name }));
}
var P = (s, extra = "") => `<p style="line-height:1.7;color:#E2E2E2;margin:0 0 14px;${extra}">${s}</p>`;
var GOLD = (s, extra = "") => `<p style="color:#C9A24A;margin:26px 0 10px;letter-spacing:2px;font-size:12px;${extra}">${s}</p>`;
function resultEmailHtml({ name, head, body, dims, questions, stage, sText, recommended, deep }) {
  const links = recommended.map((p) => `<p style="margin:8px 0;"><a href="${APP_URL}/skarbiec/${p.slug}" style="color:#C9A24A;text-decoration:none;">${escHtml(p.name)}</a></p>`).join("");
  const dimHtml = (dims || []).map((d) => `<p style="margin:0 0 4px;color:#C9A24A;font-size:12px;letter-spacing:2px;">${d.label.toUpperCase()} \xB7 ${d.score}/${d.max} \xB7 ${d.level_label}</p>${P(d.text, "color:#B8B8BA;")}`).join("");
  const qHtml = (questions || []).map((q) => P(`\u2014 ${q}`)).join("");
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    ${P(escHtml(head), "font-size:19px;color:#F5EFE1;")}
    ${P(body)}
    ${dims ? GOLD("TRZY OBSZARY") + dimHtml : ""}
    ${deep ? P(`Przynajmniej w jednym obszarze Twoje odpowiedzi s\u0105 bardzo wysokie. Dobrze jest porozmawia\u0107 o tym z kim\u015B zaufanym i ze specjalist\u0105 \u2014 lekarzem, psychologiem albo psychoterapeut\u0105. ${CRISIS}`, "border-left:2px solid #5C1A1B;padding-left:12px;") : ""}
    ${questions ? GOLD("PYTANIA DO ZABRANIA ZE SOB\u0104") + qHtml : ""}
    ${GOLD(`TW\xD3J ETAP: ${stage.toUpperCase()}`)}
    ${P(sText)}
    ${links ? GOLD("OD CZEGO ZACZ\u0104\u0106") + links : ""}
    ${P(`Je\u015Bli czujesz, \u017Ce to Tw\xF3j moment \u2014 porozmawiajmy. Trzydzie\u015Bci minut, bezp\u0142atnie, bez zobowi\u0105za\u0144: <a href="${APP_URL}/powrot" style="color:#C9A24A;">um\xF3w rozmow\u0119 kwalifikacyjn\u0105</a>.`, "margin-top:24px;")}
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">Dawid \u2014 exmortis. Wracam z siebie. Ucz\u0119 wraca\u0107.</p>
    <p style="color:#6A6A6C;font-size:11px;line-height:1.6;">${NOT_DIAGNOSIS} ${CRISIS}</p>
  </div>`;
}
var migrated = false;
async function ensureColumns(base44) {
  if (migrated) return;
  await runSql(base44, `DO $q$
  DECLARE r record; t text;
  BEGIN
    ALTER TABLE public.quiz_result ADD COLUMN IF NOT EXISTS test_version smallint NOT NULL DEFAULT 1;
    ALTER TABLE public.quiz_result ADD COLUMN IF NOT EXISTS score_max smallint NOT NULL DEFAULT 12;
    ALTER TABLE public.quiz_result ADD COLUMN IF NOT EXISTS levels jsonb;
    -- Wcze\u015Bniejsze ograniczenia dominanty i punkt\xF3w (0\u201312) nie znaj\u0105 wyniku \u201E\u017Badna\u201D ani skali 0\u201315.
    FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.quiz_result'::regclass AND contype = 'c'
      AND conname <> 'quiz_result_v2_values' AND pg_get_constraintdef(oid) ~ '(dominant|score_)' LOOP
      EXECUTE format('ALTER TABLE public.quiz_result DROP CONSTRAINT %I', r.conname);
    END LOOP;
    SELECT CASE WHEN data_type = 'USER-DEFINED' THEN udt_schema || '.' || udt_name END INTO t
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quiz_result' AND column_name = 'dominant';
    IF t IS NOT NULL THEN EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', t, '\u017Badna'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_result_v2_values') THEN
      ALTER TABLE public.quiz_result ADD CONSTRAINT quiz_result_v2_values CHECK (
        score_mental BETWEEN 0 AND 15 AND score_spiritual BETWEEN 0 AND 15 AND score_life BETWEEN 0 AND 15) NOT VALID;
    END IF;
  END $q$`);
  migrated = true;
}
var handler = async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    const body = await req.json().catch(() => ({}));
    const email = emailField(body);
    const firstName = textField(body, "first_name", { max: 200, required: true });
    const formOfAddress = body.form_of_address;
    if (formOfAddress !== "M\u0119\u017Cczyzna" && formOfAddress !== "Kobieta") {
      throw new Error("Brak formy zwracania si\u0119");
    }
    const stage = body.stage;
    if (!STAGES.includes(stage)) {
      throw new Error("Brak etapu drogi");
    }
    const openAnswer = textField(body, "open_answer", { max: 2e3, required: false });
    const source = textField(body, "source", { max: 50, required: false });
    const isF = formOfAddress === "Kobieta";
    const answers = body.answers;
    const n = Array.isArray(answers) ? answers.length : 0;
    if (n !== 12 && n !== V2.n || answers.some((a) => ![0, 1, 2, 3].includes(Number(a)))) {
      return Response.json({ error: "Niepoprawne odpowiedzi testu" }, { status: 400 });
    }
    if (!await ipAllowed(base44, clientIp(req), "test", 10, 36e5)) return Response.json({ error: TOO_MANY }, { status: 429 });
    const v2 = n === V2.n;
    let scores, dominant, r2 = null;
    if (v2) {
      r2 = scoreV2(answers);
      scores = r2.scores;
      dominant = r2.dominant;
    } else {
      const sum = (idx) => idx.reduce((acc, i) => acc + Number(answers[i]), 0);
      scores = { mentalna: sum(IDX_MENTAL), duchowa: sum(IDX_SPIRITUAL), zyciowa: sum(IDX_LIFE) };
      const ranked = [["Mentalna", scores.mentalna], ["Duchowa", scores.duchowa], ["\u017Byciowa", scores.zyciowa]].sort((a, b) => b[1] - a[1]);
      dominant = ranked[0][0];
      if (ranked[0][1] - ranked[1][1] <= 2) dominant = "Mieszana";
    }
    try {
      await ensureColumns(base44).catch((e) => console.error("quiz migrate:", e?.message));
      const levels = r2 ? escStr(JSON.stringify(Object.fromEntries(r2.dims.map((d2) => [d2.key, d2.level])))) + "::jsonb" : "NULL";
      await runSql(
        base44,
        `INSERT INTO public.quiz_result (email, first_name, form_of_address, score_mental, score_spiritual, score_life, dominant, stage, open_answer, newsletter_consent, source${migrated ? ", test_version, score_max, levels" : ""})
         VALUES (${escStr(email)}, ${escStr(firstName)}, ${escStr(formOfAddress)}, ${scores.mentalna}, ${scores.duchowa}, ${scores.zyciowa}, ${escStr(dominant)}, ${escStr(stage)}, ${openAnswer === null ? "NULL" : escStr(openAnswer)}, ${body.newsletter_consent === true}, ${source === null ? "NULL" : escStr(source)}${migrated ? `, ${v2 ? 2 : 1}, ${v2 ? V2.max : 12}, ${levels}` : ""})`
      );
    } catch (e) {
      console.error("quiz insert:", e?.message);
    }
    if (body.newsletter_consent === true) {
      await (await Promise.resolve().then(() => (init_newsletter(), newsletter_exports))).addSubscriber(base44, { email, name: firstName }).catch(() => {
      });
    }
    const productRows = await runSql(base44, `SELECT slug, name, status FROM public.products WHERE active = true`, true).catch(() => []);
    const recommended = recommendProducts(productRows || [], stage, dominant);
    const d = DOMINANT[dominant] || DOMINANT.Mieszana;
    const out = v2 ? {
      version: 2,
      dominant,
      scores,
      dims: r2.dims,
      deep: r2.deep,
      recommended,
      headline: d.head(firstName),
      body: d.body,
      questions: d.questions,
      stage,
      stage_text: STAGE_TEXT[stage],
      not_diagnosis: NOT_DIAGNOSIS,
      crisis: CRISIS
    } : { dominant, scores, recommended };
    let emailSent = false;
    try {
      const r = await sendMail(base44, {
        kind: "test_wynik",
        to: email,
        subject: v2 ? `Tw\xF3j wynik testu: ${dominant === "\u017Badna" ? "\u017Cadna \u015Bmier\u0107 nie dominuje" : dominant === "Mieszana" ? "wi\u0119cej ni\u017C jedna \u015Bmier\u0107" : `\u015Bmier\u0107 ${dominant.toLowerCase()}`} \xB7 etap ${stage}` : `Tw\xF3j wynik: ${dominant} \xB7 etap ${stage}`,
        html: resultEmailHtml(v2 ? { name: firstName, head: out.headline, body: out.body, dims: r2.dims, questions: d.questions, stage, sText: STAGE_TEXT[stage], recommended, deep: r2.deep } : { name: firstName, head: `${firstName},`, body: resultTextV1(dominant, isF), dims: null, questions: null, stage, sText: STAGE_TEXT[stage], recommended, deep: false })
      });
      emailSent = r === "wyslany";
    } catch {
      emailSent = false;
    }
    return Response.json({ ...out, email_sent: emailSent });
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
