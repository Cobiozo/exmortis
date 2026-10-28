// Wspólna oprawa WSZYSTKICH maili exmortis (nakładana w smtpSend — jedna zmiana obejmuje każdy rodzaj).
// Zasady: tabela 600 px (Outlook, Gmail, Apple Mail), style w linii, ciemne tło marki, złoty akcent,
// logo z adresu strony (z tekstem zastępczym, gdy obrazki są wyłączone), ukryta zajawka (preheader),
// przyciski „kuloodporne” (tabela, nie obrazek), stopka: kontakt, social, dane firmy, dokumenty,
// numery pomocowe i — w listach marketingowych — wypis jednym kliknięciem.
//
// Starsze treści maili miały własną ciemną ramkę, napis EXMORTIS i hasło w stopce. Tu je porządkujemy,
// żeby nic się nie dublowało, a samodzielne linki („Wybierz termin”, „Otwórz w Moich produktach”…)
// zamieniamy na przyciski.

// Adres aplikacji pochodzi z ustawień (panel: Adres aplikacji) — bez wpisu na stałe.
import { APP_URL } from "./settings.ts";

export const BRAND = {
  bg: "#0A0A0B",
  card: "#111113",
  line: "#2A2A2C",
  text: "#E8E6E1",
  muted: "#A3A3A6",
  faint: "#7A7A7D",
  gold: "#C9A24A",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export const SOCIAL = [
  ["Instagram", "https://www.instagram.com/e.x.m.o.r.t.i.s/"],
  ["Facebook", "https://www.facebook.com/dawidkowalczyk.exmortis"],
  ["YouTube", "https://www.youtube.com/@e.x.m.o.r.t.i.s"],
  ["WhatsApp", "https://whatsapp.com/channel/0029VbDYXi1Lo4hfFPvT3O3G"],
];

// Rodzaje maili marketingowych (zgoda na listy) — w stopce informacja o wypisie.
const MARKETING = new Set(["listy", "newsletter", "kampania"]);

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Przycisk do użycia w treściach maili.
export function emailButton(label, url, { secondary = false } = {}) {
  const bg = secondary ? "transparent" : BRAND.gold;
  const fg = secondary ? BRAND.gold : BRAND.bg;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr>
<td style="border-radius:2px;background:${bg};border:1px solid ${BRAND.gold};">
<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${BRAND.sans};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${fg};text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

// Porządkowanie starszych treści: bez podwójnej ramki, logo i hasła; samodzielne linki → przyciski.
// Treść kampanii z edytora → bezpieczny HTML do e-maila: bez skryptów, ramek, formularzy, zdarzeń on*,
// stylów <style>, obiektów i adresów innych niż http(s):, mailto: (javascript:, data: zablokowane).
const EMAIL_DROP = /<(script|style|iframe|frame|frameset|object|embed|form|input|button|select|textarea|link|meta|base|svg|math|template|noscript|applet)\b[\s\S]*?(<\/\1\s*>|$)/gi;
const EMAIL_SINGLE = /<\/?(script|style|iframe|frame|frameset|object|embed|form|input|button|select|textarea|link|meta|base|svg|math|template|noscript|applet)\b[^>]*>/gi;
const decodeEnt = (v) => String(v).replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 32))
  .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d) || 32)).replace(/&(colon|tab|newline);/gi, (_, n) => ({ colon: ":", tab: "", newline: "" }[n.toLowerCase()]));
const okUrl = (v) => /^(https?:\/\/|mailto:|#)/i.test(decodeEnt(v).replace(/[\u0000-\u0020]/g, ""));
export function cleanEmailHtml(html) {
  let s = String(html || "").replace(/<!--[\s\S]*?-->/g, "");
  for (let i = 0; i < 3; i++) s = s.replace(EMAIL_DROP, "");
  s = s.replace(EMAIL_SINGLE, "");
  // Atrybuty zdarzeń (onclick, onerror…) i srcdoc/formaction.
  s = s.replace(/\s(on[a-z]+|srcdoc|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Adresy w href/src: tylko https:, mailto: i kotwice.
  s = s.replace(/\s(href|src|background|action)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (m, attr, _q, a, b, c) => (okUrl(a ?? b ?? c ?? "") ? m : ""));
  // Style z expression()/url(javascript:) — usuwamy cały atrybut.
  s = s.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, (m) => (/expression\s*\(|javascript:|url\s*\(\s*['"]?\s*(?!https:)/i.test(decodeEnt(m)) ? "" : m));
  return s;
}

export function normalizeBody(html) {
  let s = String(html || "");
  s = s.replace(/<p style="[^"]*">\s*EXMORTIS\s*<\/p>/g, "");
  s = s.replace(/<p style="[^"]*">\s*WRACAM Z SIEBIE · UCZĘ WRACAĆ\s*<\/p>/g, "");
  s = s.replace(/background:#0A0A0B;\s*padding:[^;"]*;?/g, "");
  s = s.replace(/font-family:Cinzel,\s*Georgia,\s*serif/g, "font-family:Georgia,serif");
  // Kolory tekstu z dawnych szablonów → czytelniejsze na nowej karcie (kontrast WCAG AA).
  s = s.replace(/color:#8A8A8C/g, `color:${BRAND.muted}`).replace(/color:#5C5C5E/g, `color:${BRAND.faint}`)
    .replace(/color:#3D3D3F/g, `color:${BRAND.faint}`);
  // Akapit zawierający wyłącznie jeden link http(s) → przycisk.
  s = s.replace(/<p[^>]*>\s*<a\s+href="(https?:[^"]+)"[^>]*>\s*([^<]{2,60}?)\s*<\/a>\s*<\/p>/g,
    (_, href, label) => emailButton(label.replace(/&amp;/g, "&").replace(/&quot;/g, '"'), href.replace(/&amp;/g, "&")));
  // Nagłówki: jeden krój i rozmiar w całej korespondencji.
  s = s.replace(/<h1 style="[^"]*">/g, `<h1 style="margin:0 0 18px;font-family:${BRAND.serif};font-size:28px;line-height:1.25;font-weight:normal;color:#F5EFE1;">`);
  s = s.replace(/<h1>/g, `<h1 style="margin:0 0 18px;font-family:${BRAND.serif};font-size:28px;line-height:1.25;font-weight:normal;color:#F5EFE1;">`);
  s = s.replace(/<h2>/g, `<h2 style="margin:28px 0 12px;font-family:${BRAND.serif};font-size:21px;line-height:1.3;font-weight:normal;color:#F5EFE1;">`);
  return s;
}

function textOf(html) {
  return String(html || "").replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}

export function emailLayout(html, { firma = null, appUrl = APP_URL, kind = "", preheader = "", unsubUrl = "" } = {}) {
  const body = normalizeBody(html);
  const site = String(appUrl || APP_URL).replace(/\/+$/, "");
  const pre = (preheader || textOf(body).replace(/^(EXMORTIS\s*)+/, "")).slice(0, 140);
  const marketing = MARKETING.has(kind) || !!unsubUrl;
  const hasCrisis = /116\s?123/.test(body);
  const contact = firma?.email || "kontakt@exmortis.pl";
  const firmLine = [firma?.nazwa || firma?.osoba, firma?.adres, firma?.nip && `NIP ${firma.nip}`, firma?.regon && `REGON ${firma.regon}`]
    .filter(Boolean).map(esc).join(" · ");
  const link = (href, label) => `<a href="${esc(href)}" target="_blank" style="color:${BRAND.muted};text-decoration:underline;">${esc(label)}</a>`;
  const small = `font-family:${BRAND.sans};font-size:12px;line-height:1.7;color:${BRAND.faint};margin:0 0 10px;`;

  // Bez adresu strony (app_url jeszcze niewczytany) nie ma z czego zbudować obrazka ani linków
  // ze ścieżką względną — wtedy zamiast logo sam złoty napis. Żadnej domeny na stałe.
  const host = site.replace(/^https?:\/\//, "");
  const onSite = host ? ` na ${esc(host)}` : "";
  const logo = site
    ? `<a href="${esc(site)}" target="_blank" style="text-decoration:none;">
        <img src="${esc(site)}/exmortis-logo-500.png" width="64" height="64" alt="exmortis" style="display:block;width:64px;height:64px;margin:0 auto 12px;font-family:${BRAND.serif};font-size:18px;color:${BRAND.gold};">
        <span style="font-family:${BRAND.sans};font-size:12px;letter-spacing:6px;color:${BRAND.gold};">EXMORTIS</span>
      </a>`
    : `<span style="font-family:${BRAND.sans};font-size:12px;letter-spacing:6px;color:${BRAND.gold};">EXMORTIS</span>`;
  const docs = [
    site && link(`${site}/regulamin`, "Regulamin"),
    site && link(`${site}/polityka-prywatnosci`, "Polityka prywatności"),
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const footer = [
    `<p style="font-family:${BRAND.sans};font-size:11px;letter-spacing:3px;color:${BRAND.gold};margin:0 0 14px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>`,
    `<p style="${small}">${SOCIAL.map(([l, u]) => link(u, l)).join(" &nbsp;·&nbsp; ")}</p>`,
    `<p style="${small}">${link(`mailto:${contact}`, contact)}${host ? ` &nbsp;·&nbsp; ${link(site, host)}` : ""}</p>`,
    hasCrisis ? "" : `<p style="${small}">exmortis to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko: <span style="color:${BRAND.muted};">116 123</span> · <span style="color:${BRAND.muted};">800 70 2222</span> (całą dobę, bezpłatnie) · w zagrożeniu życia <span style="color:${BRAND.muted};">112</span>.</p>`,
    firmLine ? `<p style="${small}">${firmLine}</p>` : "",
    docs ? `<p style="${small}">${docs}</p>` : "",
    marketing
      ? `<p style="${small}">Dostajesz Listy powrotu, bo zapisano ten adres${onSite} i potwierdzono zapis.${unsubUrl ? ` ${link(unsubUrl, "Wypisz się jednym kliknięciem")}.` : " Aby się wypisać, odpowiedz na ten list słowem STOP."}</p>`
      : `<p style="${small}">To wiadomość dotycząca Twojego konta, zamówienia lub zapisu${onSite}. Możesz na nią po prostu odpowiedzieć.</p>`,
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
      ${logo}
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