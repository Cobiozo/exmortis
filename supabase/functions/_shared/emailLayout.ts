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

// JEDYNE źródło adresu kanału WhatsApp w mailach (frontend: src/lib/whatsappChannel.js).
// Pusty adres → pozycja w stopce i przyciski kanału się nie pokazują.
export const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbDYXi1Lo4hfFPvT3O3G";

export const SOCIAL = [
  ["Instagram", "https://www.instagram.com/e.x.m.o.r.t.i.s/"],
  ["Facebook", "https://www.facebook.com/dawidkowalczyk.exmortis"],
  ["YouTube", "https://www.youtube.com/@e.x.m.o.r.t.i.s"],
  ...(WHATSAPP_CHANNEL ? [["WhatsApp", WHATSAPP_CHANNEL]] : []),
];

// Rodzaje maili marketingowych (zgoda na listy) — w stopce informacja o wypisie.
const MARKETING = new Set(["listy", "newsletter", "kampania"]);

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Przycisk do użycia w treściach maili.
// 19.11.2026: złoty obrys na ciemnym tle zamiast złotego wypełnienia. Gmail w trybie ciemnym (iOS, Android)
// odwraca jasne tła — złoty przycisk robił się niebieski. Ciemne tło i złote linie zostają bez zmian w każdym trybie.
export const BTN_BG = "#1A160D";
export function emailButton(label, url, { secondary = false } = {}) {
  const bg = secondary ? "transparent" : BTN_BG;
  const fg = secondary ? BRAND.text : BRAND.gold;
  const line = secondary ? BRAND.line : BRAND.gold;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr>
<td bgcolor="${secondary ? "" : BTN_BG}" style="border-radius:2px;background:${bg};border:${secondary ? 1 : 2}px solid ${line};">
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
  // Starsze przyciski z złotym wypełnieniem wpisane w treści (oczekiwanie na płatność, lista oczekujących, Listy,
  // spotkania, zmiana adresu, darmowe zamówienie) → ten sam złoty obrys co emailButton (tryb ciemny Gmaila).
  s = s.replace(/style="([^"]*background(?:-color)?:\s*#C9A24A[^"]*)"/gi, (_, st) => `style="${st
    .replace(/background(?:-color)?:\s*#C9A24A;?/gi, `background:${BTN_BG};border:2px solid ${BRAND.gold};`)
    .replace(/(^|;)\s*color:\s*#0A0A0B/gi, `$1color:${BRAND.gold}`)}"`);
  s = s.replace(/bgcolor="#C9A24A"/gi, `bgcolor="${BTN_BG}"`);
  // Czarny tekst w treści maila występował tylko na złotych przyciskach (np. link w komórce tabeli) → złoty.
  s = s.replace(/(^|[;"\s])color:\s*#0A0A0B/gi, `$1color:${BRAND.gold}`);
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

// Dane nadawcy wymagane prawem (u.ś.u.d.e. art. 5, CEIDG): firma, imię i nazwisko, adres, NIP, REGON,
// e-mail i telefon. Ułożone w krótkie wiersze; numery nie zamieniają się w niebieskie linki (iOS, Gmail).
const telHref = (t) => "tel:" + (String(t).replace(/[^\d+]/g, "").replace(/^(?!\+)(\d{9})$/, "+48$1"));
const telLabel = (t) => { const d = String(t).replace(/\D/g, ""); return d.length === 9 ? d.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : String(t); };
const nolink = (v) => esc(v).replace(/(\d)/g, "$1&#8288;"); // łącznik zerowej szerokości — bez autolinków
function firmaBlock(f, style, link) {
  if (!f || !f.nazwa) return "";
  const nazwa = f.osoba && !String(f.nazwa).includes(f.osoba) ? `${f.nazwa} (${f.osoba})` : f.nazwa;
  const ids = [f.nip && `NIP ${nolink(f.nip)}`, f.regon && `REGON ${nolink(f.regon)}`].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const kontakt = [f.email && link(`mailto:${f.email}`, f.email), f.telefon && link(telHref(f.telefon), `tel. ${telLabel(f.telefon)}`)]
    .filter(Boolean).join(" &nbsp;·&nbsp; ");
  const rows = [`<strong style="font-weight:600;color:#8E8E91;">${esc(nazwa)}</strong>`,
    (f.adres || f.korespondencja) && nolink(f.adres || f.korespondencja), ids, kontakt].filter(Boolean);
  return `<p style="${style}">${rows.join("<br>")}</p>`;
}

export function emailLayout(html, { firma = null, appUrl = APP_URL, kind = "", preheader = "", unsubUrl = "" } = {}) {
  const body = normalizeBody(html);
  const site = String(appUrl || APP_URL).replace(/\/+$/, "");
  const pre = (preheader || textOf(body).replace(/^(EXMORTIS\s*)+/, "")).slice(0, 140);
  const marketing = MARKETING.has(kind) || !!unsubUrl;
  const hasCrisis = /116\s?123/.test(body);
  const contact = firma?.email || "kontakt@exmortis.pl";
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
  const linkF = (href, label) => `<a href="${esc(href)}" target="_blank" style="color:${BRAND.faint};text-decoration:underline;">${esc(label)}</a>`;
  const legal = `font-family:${BRAND.sans};font-size:11px;line-height:1.75;color:${BRAND.faint};margin:0 0 12px;`;
  const nav = site ? [["Skarbiec", "/skarbiec"], ["Spotkania", "/spotkania"], ["Kontakt", "/kontakt"]]
    .map(([l, p]) => `<a href="${esc(site + p)}" target="_blank" style="color:${BRAND.gold};text-decoration:none;">${l.toUpperCase()}</a>`)
    .join(`<span style="color:${BRAND.line};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`) : "";
  const docs = [
    site && linkF(`${site}/regulamin`, "Regulamin"),
    site && linkF(`${site}/polityka-prywatnosci`, "Polityka prywatności"),
    marketing && unsubUrl && linkF(unsubUrl, "Wypisz się"),
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const why = marketing
    ? `Otrzymujesz Listy powrotu, bo ten adres został zapisany${onSite} i zapis potwierdzono. ${unsubUrl ? "Wypis to jedno kliknięcie w link poniżej, bez podawania powodu." : "Aby się wypisać, odpowiedz na ten list słowem STOP."}`
    : `Wiadomość dotyczy Twojego konta, zamówienia lub zapisu${onSite}. Możesz na nią po prostu odpowiedzieć.`;
  const rule = (w, c) => `<table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr><td width="${w}" height="1" style="width:${w}px;height:1px;line-height:1px;font-size:1px;background:${c};">&nbsp;</td></tr></table>`;

  const footer = [
    // 1. Marka
    rule(48, BRAND.gold),
    `<p style="font-family:${BRAND.serif};font-size:15px;font-style:italic;line-height:1.5;color:${BRAND.text};margin:22px 0 4px;">Wracam z siebie · uczę wracać</p>`,
    `<p style="font-family:${BRAND.sans};font-size:10px;letter-spacing:3px;color:${BRAND.faint};margin:0 0 22px;">EXMORTIS · MENTORING POWROTU</p>`,
    // 2. Nawigacja i social
    nav ? `<p style="font-family:${BRAND.sans};font-size:11px;letter-spacing:2px;line-height:1.6;margin:0 0 14px;">${nav}</p>` : "",
    `<p style="${small}">${SOCIAL.map(([l, u]) => link(u, l)).join(" &nbsp;·&nbsp; ")}</p>`,
    // 3. Bezpieczeństwo (gdy treść jeszcze tego nie mówi)
    hasCrisis ? "" : `<p style="font-family:${BRAND.sans};font-size:11px;line-height:1.7;color:${BRAND.faint};margin:16px auto 0;max-width:440px;">exmortis to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko: ${nolink("116 123").replace(" ", "&nbsp;")} lub ${nolink("800 70 2222").replace(/ /g, "&nbsp;")} (całą dobę, bezpłatnie), w&nbsp;zagrożeniu życia ${nolink("112")}.</p>`,
    // 4. Część formalna
    `<div style="height:26px;line-height:26px;font-size:1px;">&nbsp;</div>`,
    rule(520, BRAND.line),
    `<div style="height:22px;line-height:22px;font-size:1px;">&nbsp;</div>`,
    firmaBlock(firma, legal, linkF) || `<p style="${legal}">${linkF(`mailto:${contact}`, contact)}</p>`,
    `<p style="${legal}">${why}</p>`,
    docs ? `<p style="${legal}margin-bottom:0;">${docs}</p>` : "",
  ].join("\n");

  return `<!DOCTYPE html>
<html lang="pl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>exmortis</title>
<style>
  body{margin:0;padding:0;background:${BRAND.bg};}
  a{color:${BRAND.gold};}
  img{border:0;line-height:100%;outline:none;text-decoration:none;}
  table{border-collapse:collapse;}
  a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;font-size:inherit !important;font-family:inherit !important;font-weight:inherit !important;line-height:inherit !important;}
  .exm-body p,.exm-body li,.exm-body td{font-size:16px;}
  @media (max-width:620px){
    .exm-card{padding:28px 22px !important;}
    .exm-wrap{padding:16px 10px !important;}
    .exm-body h1{font-size:24px !important;}
  }
</style>
</head>
<body id="exm" style="margin:0;padding:0;background:${BRAND.bg};">
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
    <tr><td align="center" style="padding:36px 16px 8px;text-align:center;">
${footer}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}