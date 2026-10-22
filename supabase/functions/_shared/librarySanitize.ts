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

// Quill 2 (react-quill-new) zapisuje listę punktowaną jako <ol><li data-list="bullet">.
// Atrybuty zdejmujemy, więc rozpoznajemy ją tutaj i zamieniamy otaczający <ol> na <ul> —
// inaczej każda lista punktowana wyszłaby jako numerowana. Działa też dla list zagnieżdżonych.
function fixQuillLists(s) {
  const TOKEN = /<\/?ol\b[^>]*>|<li\b[^>]*>/gi;
  const parts = [];
  const open = [];
  let last = 0;
  let m;
  while ((m = TOKEN.exec(s)) !== null) {
    parts.push(s.slice(last, m.index));
    last = TOKEN.lastIndex;
    const t = m[0];
    if (/^<li\b/i.test(t)) {
      // Rodzaj listy rozstrzyga pierwszy punkt w bloku; brak data-list = zwykły HTML, zostawiamy.
      if (/data-list\s*=\s*["']?bullet/i.test(t)) {
        const top = open[open.length - 1];
        if (top) parts[top.idx] = "<ul>";
      }
      parts.push(t);
    } else if (/^<\/ol/i.test(t)) {
      const top = open.pop();
      parts.push(top && parts[top.idx] === "<ul>" ? "</ul>" : "</ol>");
    } else {
      open.push({ idx: parts.length });
      parts.push("<ol>");
    }
  }
  parts.push(s.slice(last));
  return parts.join("");
}

export function sanitizeHtml(input) {
  let s = String(input == null ? "" : input);
  // 0. Listy punktowane z edytora — przed zdjęciem atrybutów.
  s = fixQuillLists(s);
  // 1. Komentarze (mogą ukrywać znaczniki).
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // 2. Znaczniki niebezpieczne — razem z zawartością.
  for (const t of DROP) {
    s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, "gi"), "");
    s = s.replace(new RegExp(`<\\/?${t}\\b[^>]*>`, "gi"), "");
  }
  // 3. Tokenizacja: przechodzą tylko dozwolone znaczniki, zbudowane od zera (żaden atrybut zdarzenia nie ma szans).
  //    Cały tekst pomiędzy znacznikami ma escapowane < i > — niedomknięty znacznik (np. „<img src=x onerror=…”
  //    bez „>”) nie przetrwa jako surowy HTML.
  const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const escText = (t) => t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rebuild = (m, name, attrs) => {
    const tag = String(name).toLowerCase();
    if (!ALLOWED.has(tag)) return "";
    const closing = m.slice(0, 2) === "</";
    if (tag === "a") {
      if (closing) return "</a>";
      const h = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || "");
      const raw = h ? (h[2] !== undefined ? h[2] : h[3] !== undefined ? h[3] : h[4] || "") : "";
      const href = safeHref(raw);
      if (!href) return "<a>";
      return `<a href="${href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" target="_blank" rel="noopener noreferrer">`;
    }
    if (VOID.has(tag)) return closing ? "" : `<${tag}>`;
    return closing ? `</${tag}>` : `<${tag}>`;
  };
  let out = "";
  let last = 0;
  let mt;
  while ((mt = TAG.exec(s)) !== null) {
    out += escText(s.slice(last, mt.index)) + rebuild(mt[0], mt[1], mt[2]);
    last = TAG.lastIndex;
  }
  out += escText(s.slice(last));
  s = out;
  return s.trim();
}

// Skrót do podglądu w panelu — bez znaczników, do 160 znaków.
export function plainText(html, max = 160) {
  const t = String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}