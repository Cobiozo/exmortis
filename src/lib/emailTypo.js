// Podpowiedź literówki w adresie e-mail (kasa): „gmial.com” → „gmail.com”.
// Tylko popularne skrzynki; adres z nieznaną domeną zostaje bez podpowiedzi (firmowe domeny są w porządku).
const DOMAINS = [
  "gmail.com", "wp.pl", "o2.pl", "onet.pl", "op.pl", "interia.pl", "interia.eu", "poczta.onet.pl", "vp.pl", "tlen.pl",
  "gazeta.pl", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com", "yahoo.com", "proton.me", "protonmail.com",
];
// Częste pomyłki, których odległość edycyjna nie łapie pewnie.
const FIX = {
  "gmail.pl": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmail.con": "gmail.com", "gmail.om": "gmail.com",
  "gmai.com": "gmail.com", "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com",
  "googlemail.pl": "gmail.com", "wp.p": "wp.pl", "wp.com": "wp.pl", "wp.pll": "wp.pl", "onet.com": "onet.pl", "onet.p": "onet.pl",
  "interia.com": "interia.pl", "o2.com": "o2.pl", "outlook.pl": "outlook.com", "hotmail.pl": "hotmail.com", "icloud.pl": "icloud.com",
  "icloud.co": "icloud.com", "yahoo.pl": "yahoo.com",
};

function dist(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // zamiana sąsiednich liter („gmial”)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j - 2] + 1);
    }
    prev.prev = undefined;
    prev = Object.assign(cur, { prevRow: prev });
  }
  return prev[n];
}

// Zwraca poprawiony adres albo "" (brak podpowiedzi).
export function suggestEmail(email) {
  const s = String(email || "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 1 || at === s.length - 1) return "";
  const local = s.slice(0, at), domain = s.slice(at + 1);
  if (DOMAINS.includes(domain)) return "";
  if (FIX[domain]) return `${local}@${FIX[domain]}`;
  if (domain.length < 5) return "";
  let best = "", bestD = 3;
  for (const d of DOMAINS) {
    const k = dist(domain, d);
    if (k < bestD) { best = d; bestD = k; }
  }
  // Krótkie domeny (wp.pl, o2.pl) tylko przy jednej literze różnicy — inaczej za dużo fałszywych podpowiedzi.
  const limit = best.length <= 6 ? 1 : 2;
  return best && bestD <= limit ? `${local}@${best}` : "";
}
