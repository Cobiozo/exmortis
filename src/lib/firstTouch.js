// Źródło wizyty („skąd ktoś przyszedł”) zapamiętane na czas karty: ?src= / ?utm_source= z pierwszego wejścia,
// a gdy ich brak — rozpoznana strona odsyłająca (Instagram, Facebook, YouTube…). Używane przy zapisie na spotkanie,
// żeby raport źródeł działał także po przejściu na inną podstronę i bez oznaczonego linku.
const KEY = "exm_src";
const HOSTS = [
  [/(^|\.)instagram\.com$/, "instagram"], [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"], [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)tiktok\.com$/, "tiktok"], [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"], [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com)$|^(poczta|mail)\./, "email"], [/(^|\.)google\./, "google"],
];
function fromReferrer() {
  try {
    if (!document.referrer) return "";
    const h = new URL(document.referrer).hostname.toLowerCase();
    if (h === location.hostname || h.endsWith(".exmortis.pl")) return "";
    const hit = HOSTS.find(([re]) => re.test(h));
    return hit ? hit[1] : h.replace(/^www\./, "").slice(0, 60);
  } catch { return ""; }
}
try {
  if (!sessionStorage.getItem(KEY)) {
    const q = new URLSearchParams(location.search);
    const s = (q.get("src") || q.get("utm_source") || "").trim().slice(0, 60) || fromReferrer();
    if (s) sessionStorage.setItem(KEY, s);
  }
} catch { /* bez pamięci sesji */ }

export function visitSource() {
  try {
    const q = new URLSearchParams(location.search);
    return (q.get("src") || q.get("utm_source") || sessionStorage.getItem(KEY) || "").slice(0, 60);
  } catch { return ""; }
}
