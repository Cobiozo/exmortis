// Adresy wideo (biała lista domen) i sprawdzanie wgranych plików wg sygnatury.

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;
const BUNNY_ID = /^\d{3,12}\/[A-Za-z0-9_-]{1,40}$/;

// Limity platformy dla prywatnych plików (potwierdzone w dokumentacji).
export const MAX_BYTES = { PDF: 10 * 1024 * 1024, AUDIO: 100 * 1024 * 1024 };
export const ALLOWED_EXT = { PDF: ["pdf"], AUDIO: ["mp3", "m4a"] };
// Ile bajtów pobieramy do sprawdzenia sygnatury (i skanu PDF).
export const SNIFF_BYTES = 262144;

export const MAX_MB = { PDF: 10, AUDIO: 100 };

// Zwraca {provider, id, embed} albo null. Przechowujemy znormalizowany identyfikator, nie surowy adres.
export function normalizeVideo(raw) {
  const s = String(raw || "").trim();
  if (!/^https:\/\//i.test(s)) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");

  if (["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"].includes(host)) {
    let id = "";
    if (host.endsWith("youtu.be")) id = path.slice(1).split("/")[0];
    else if (path === "/watch") id = u.searchParams.get("v") || "";
    else {
      const m = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(path);
      id = m ? m[1] : "";
    }
    if (!YT_ID.test(id)) return null;
    return { provider: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0` };
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    // Filmy niepubliczne (unlisted) mają hash prywatności: vimeo.com/{id}/{hash} albo ?h={hash}.
    const m = /^\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?$/.exec(path);
    if (!m || !VIMEO_ID.test(m[1])) return null;
    const h = m[2] || u.searchParams.get("h") || "";
    if (h && !VIMEO_HASH.test(h)) return null;
    const id = h ? `${m[1]}:${h}` : m[1];
    return { provider: "vimeo", id, embed: embedUrl("vimeo", id) };
  }
  if (["iframe.mediadelivery.net", "player.mediadelivery.net"].includes(host)) {
    const m = /^\/embed\/(\d{3,12}\/[A-Za-z0-9_-]{1,40})$/.exec(path);
    if (!m || !BUNNY_ID.test(m[1])) return null;
    return { provider: "bunny", id: m[1], embed: `https://iframe.mediadelivery.net/embed/${m[1]}` };
  }
  return null;
}

// Adres odtwarzacza z zapisanych danych (bez ponownej walidacji treści).
export function embedUrl(provider, id) {
  if (provider === "youtube") return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`;
  if (provider === "vimeo") {
    const [vid, h] = String(id || "").split(":");
    if (!VIMEO_ID.test(vid) || (h && !VIMEO_HASH.test(h))) return null;
    return `https://player.vimeo.com/video/${vid}${h ? `?h=${h}` : ""}`;
  }
  if (provider === "bunny") return `https://iframe.mediadelivery.net/embed/${id}`;
  return null;
}

export function extOf(name) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || "").trim());
  return m ? m[1].toLowerCase() : "";
}

// Sygnatura pliku: PDF „%PDF-", MP3 (ID3 albo ramka 0xFFEx), M4A („ftyp" na offsecie 4).
export function sniff(kind, b) {
  if (!b || b.length < 12) return false;
  const ascii = (o, n) => {
    let s = "";
    for (let i = o; i < o + n && i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  };
  if (kind === "PDF") return ascii(0, 5) === "%PDF-";
  if (kind === "AUDIO") {
    if (ascii(0, 3) === "ID3") return true;
    if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true;
    if (ascii(4, 4) === "ftyp") return true;
    return false;
  }
  return false;
}

// PDF z aktywną zawartością — ostrzeżenie dla administratora, nie blokada.
export function pdfHasJs(b) {
  try {
    const s = new TextDecoder("latin1").decode(b);
    return /\/JavaScript|\/JS[\s/<>[\]]/.test(s);
  } catch {
    return false;
  }
}

export async function sha256hex(input) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(input)));
  let out = "";
  for (const x of new Uint8Array(buf)) out += x.toString(16).padStart(2, "0");
  return out;
}

export const mb = (bytes) => Math.round((Number(bytes) || 0) / 1048576 * 10) / 10;