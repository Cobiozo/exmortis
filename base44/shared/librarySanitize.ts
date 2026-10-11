// Serwerowa sanityzacja HTML dla materiałów „tekst" i wiadomości.
// Zasada: biała lista znaczników, zero atrybutów poza href w <a>, linki tylko https: i mailto:.
// Uruchamiana przy zapisie i ponownie przy wyświetleniu.

const ALLOWED = new Set(["p", "br", "strong", "em", "ul", "ol", "li", "h2", "h3", "blockquote", "a"]);
const VOID = new Set(["br"]);
// Znaczniki usuwane razem z zawartością — nigdy nie mają prawa przejść.
const DROP = ["script", "style", "iframe", "svg", "object", "embed", "form", "input", "button", "select", "textarea",
  "link", "meta", "noscript", "template", "math", "video", "audio", "source", "img", "base", "applet", "frame", "frameset"];

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", colon: ":", tab: "\t", newline: "\n", sol: "/" };

// Rozkodowanie encji — potrzebne, żeby „&#106;avascript:" nie przemyciło schematu javascript:.
export function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    const key = String(e);
    if (key[0] === "#") {
      const hex = key[1] === "x" || key[1] === "X";
      const n = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    const v = NAMED[key.toLowerCase()];
    return v === undefined ? m : v;
  });
}

// Bezpieczny adres: po rozkodowaniu encji i usunięciu znaków sterujących musi zaczynać się od https:// albo mailto:.
// Odrzuca javascript:, JaVaScRiPt:, data:, //host, encje liczbowe i wstawione białe znaki.
export function safeHref(raw) {
  const s = decodeEntities(String(raw || ""))
    .replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u2000-\u200f\u2028\u2029]/g, "")
    .trim();
  if (/^https:\/\/[^\s]+$/i.test(s)) return s;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s]+$/i.test(s)) return s;
  return null;
}

export function sanitizeHtml(input) {
  let s = String(input == null ? "" : input);
  // 1. Komentarze (mogą ukrywać znaczniki).
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // 2. Znaczniki niebezpieczne — razem z zawartością.
  for (const t of DROP) {
    s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, "gi"), "");
    s = s.replace(new RegExp(`<\\/?${t}\\b[^>]*>`, "gi"), "");
  }
  // 3. Reszta: przechodzą tylko dozwolone znaczniki, zbudowane od zera (żaden atrybut zdarzenia nie ma szans).
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, (m, name, attrs) => {
    const tag = String(name).toLowerCase();
    if (!ALLOWED.has(tag)) return "";
    if (tag === "a") {
      const h = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || "");
      const raw = h ? (h[2] !== undefined ? h[2] : h[3] !== undefined ? h[3] : h[4] || "") : "";
      const href = safeHref(raw);
      if (!href) return "<a>";
      return `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">`;
    }
    if (VOID.has(tag)) return `<${tag}>`;
    return m.slice(0, 2) === "</" ? `</${tag}>` : `<${tag}>`;
  });
  // 4. Osierocone nawiasy ostre w tekście.
  s = s.replace(/<(?![a-zA-Z/])/g, "&lt;");
  return s.trim();
}

// Skrót do podglądu w panelu — bez znaczników, do 160 znaków.
export function plainText(html, max = 160) {
  const t = String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}