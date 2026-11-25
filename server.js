// Serwer startowy dla hostingu cyberfolks.pl (Phusion Passenger + Node.js).
// Passenger podaje port w zmiennej PORT; lokalnie: PORT=3000 node server.js
// Wymaga wcześniejszego `npm run build` (katalog dist/).
//
// Magazyn plików: wszystko, co wgrywa panel (zdjęcia, okładki, PDF-y, audio, wideo), leży na TYM hostingu
// w katalogu ./media (public/ i private/) — zapis przez multer, odczyt przez /media/... poniżej.
// Pliki prywatne wychodzą wyłącznie pod linkiem podpisanym (MEDIA_SECRET), ważnym tyle, ile trzeba.

import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";
// multer wczytywany dopiero przy pierwszym wgraniu (niżej) — brak pakietu nie zatrzymuje startu strony.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 3000;

const app = express();
app.disable("x-powered-by");
// Jeden zaufany pośrednik (LiteSpeed na CyberFolks): req.ip = adres dopisany przez niego na końcu X-Forwarded-For.
// Wcześniej `true` brało pierwszy adres z nagłówka, który podaje sam klient — dało się podrobić IP i obejść limity (25.11.2026).
app.set("trust proxy", 1);

// Adres z www → ten sam adres bez www (301). Tylko dokładnie www.exmortis.pl, więc bez ryzyka pętli.
app.use((req, res, next) => {
  if (String(req.hostname || "").toLowerCase() === "www.exmortis.pl") return res.redirect(301, `https://exmortis.pl${req.originalUrl}`);
  next();
});

// Zmienione adresy stron (stary → nowy, 301 — wyszukiwarki przenoszą pozycję na nowy adres).
const MOVED = { "/skarbiec/kiedy-kto-bliski-ga-nie-mini": "/skarbiec/kiedy-ktos-bliski-gasnie-mini" };
app.use((req, res, next) => {
  const to = MOVED[req.path.replace(/\/+$/, "")];
  if (to) return res.redirect(301, to + (req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : ""));
  next();
});

// CSP w trybie wymuszania od 19.11.2026 (audyt techniczny 18.11, A-02). Wcześniej od 17.11 ten sam zestaw działał
// tylko w trybie raportowania; przegląd 19.11 (ok. 40 wczytań stron publicznych, bez zgody i z pełną zgodą na cookies,
// razem z GA/Meta, YouTube i Spotify) nie wykazał żadnego naruszenia. Nowa usługa zewnętrzna (skrypt, ramka, połączenie)
// wymaga dopisania jej adresu tutaj — inaczej przeglądarka ją zablokuje (komunikat „Content Security Policy” w konsoli).
const CSP = [
  "default-src 'self'",
  // www.youtube.com: IFrame API odtwarzacza muzyki w Głosie (kolejny utwór po zakończeniu poprzedniego).
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://www.youtube.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://base44.app https://*.base44.app https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://iframe.mediadelivery.net https://open.spotify.com https://wideo.exmortis.pl https://www.facebook.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

// Nagłówki bezpieczeństwa na każdej odpowiedzi.
app.use((_req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Content-Security-Policy", CSP);
  next();
});

// .env z katalogu repo — zapas, gdy Passenger nie podaje zmiennych środowiskowych.
function readEnvFile() {
  const out = {};
  try {
    const txt = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  } catch {}
  return out;
}

const fileEnv = readEnvFile();
const env = (key) => String(process.env[key] || fileEnv[key] || "");
const SUPABASE_URL = env("VITE_SUPABASE_URL").replace(/\/+$/, "");
const ANON_KEY = env("VITE_SUPABASE_ANON_KEY");

const PASS_HEADERS = [
  "content-type", "authorization", "apikey", "openpayu-signature", "referer", "origin",
  "sec-fetch-site", "sec-fetch-dest", "user-agent", "accept",
];
const BACK_HEADERS = [
  "content-type", "cache-control", "content-disposition", "x-robots-tag", "location",
  "vary", "access-control-allow-origin",
];

// Strony HTML zwracane przez funkcje (linki z maili otwierane w przeglądarce):
// shopWaitlist — wypisanie z listy oczekujących, eventsCancel — odwołanie zapisu na spotkanie,
// eventShare — strona udostępniania spotkania (og:image dla Facebooka/WhatsApp).
// Tylko te funkcje; ICS, PDF, JSON i obrazy zostają bez zmian.
const HTML_PAGES = ["shopWaitlist", "eventsCancel", "eventShare"];

// Supabase Edge Functions wymuszają na domyślnej domenie Content-Type: text/plain dla odpowiedzi HTML.
// Link z maila idzie przez /functions/<nazwa>, więc strona otwierała się jako surowy kod z krzakami
// zamiast polskich liter. Rozpoznajemy stronę po treści, nie po nagłówku, i poprawiamy typ.
const looksHtml = (buf) => /^\s*(?:<!doctype\s+html|<html)/i.test(buf.subarray(0, 512).toString("utf8"));

// ---- MAGAZYN PLIKÓW (multer) -------------------------------------------------
// Katalog można przenieść poza repozytorium zmienną MEDIA_DIR (np. /home/konto/media).
const MEDIA_DIR = path.resolve(env("MEDIA_DIR") || path.join(__dirname, "media"));
const MEDIA_PUBLIC = path.join(MEDIA_DIR, "public");
const MEDIA_PRIVATE = path.join(MEDIA_DIR, "private");
// Klucz do podpisywania linków do plików prywatnych. Ten sam musi być w Supabase (MEDIA_SECRET w secrets funkcji).
const MEDIA_SECRET = env("MEDIA_SECRET") || env("BOOKING_HMAC_KEY");
const MAX_FILE = 500 * 1024 * 1024; // audio, wideo, zdjęcia
const MAX_PDF = 100 * 1024 * 1024; // dokumenty PDF

for (const dir of [MEDIA_PUBLIC, MEDIA_PRIVATE]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error(`Magazyn plików: nie udało się utworzyć ${dir} (${e.message})`);
  }
}
if (!MEDIA_SECRET) console.warn("Magazyn plików: brak MEDIA_SECRET — pliki prywatne nie dostaną linków.");

const MIME_EXT = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif",
  "application/pdf": ".pdf", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/ogg": ".ogg", "audio/wav": ".wav",
  "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
};
// Sprawdzenie sygnatury pliku zaraz po zapisie — zła treść pod innym rozszerzeniem jest odrzucana.
// Te same zasady co w panelu biblioteki (PDF „%PDF-", MP3 ID3/0xFFEx, MP4 „ftyp", WebM 1A 45 DF A3).
const SNIFF_BYTES = 262144;
const sniffKind = (ext, b) => {
  const ascii = (o, n) => b.toString("latin1", o, o + n);
  if (b.length < 12) return false;
  if (ext === ".pdf") return ascii(0, 5) === "%PDF-";
  if (ext === ".mp3" || ext === ".m4a") {
    if (ascii(0, 3) === "ID3") return true;
    if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true;
    return ascii(4, 4) === "ftyp";
  }
  if (ext === ".mp4" || ext === ".m4v") return ascii(4, 4) === "ftyp";
  if (ext === ".webm") return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  return true;
};
const pdfHasJs = (b) => /\/JavaScript|\/JS[\s/<>[\]]/.test(b.toString("latin1"));

// Pierwsze kilobajty pliku — do sygnatury i skanu PDF.
function headOf(file, want = SNIFF_BYTES) {
  const len = Math.min(file.size, want);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(file.path, "r");
  try { fs.readSync(fd, buf, 0, len, 0); } finally { fs.closeSync(fd); }
  return buf;
}

// Obsługiwane pliki: zdjęcia, PDF-y, e-booki (epub/mobi), paczki zip, audio i wideo.
const ALLOWED_MIME = /^(image\/|audio\/|video\/|application\/pdf$|application\/epub\+zip$|application\/zip$|application\/x-mobipocket-ebook$)/;
const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|avif|pdf|epub|mobi|zip|mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac|mp4|webm|mov|m4v)$/i;

let uploader = null;
// Wgrywanie plików wymaga pakietu multer — wczytujemy go dopiero przy pierwszym zapisie.
// Dzięki temu deploy bez `npm install` nie wywraca strony (i panel nie widzi jej jako niedostępnej).
async function getUpload() {
  if (uploader) return uploader;
  const multer = await import("multer").then((m) => m.default || m).catch(() => null);
  if (!multer) return null;
  uploader = multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => cb(null, req.query.scope === "private" ? MEDIA_PRIVATE : MEDIA_PUBLIC),
      filename: (_req, file, cb) => {
        const own = path.extname(String(file.originalname || "")).toLowerCase().replace(/[^a-z0-9.]/g, "");
        const ext = own.length <= 6 && own ? own : MIME_EXT[file.mimetype] || "";
        cb(null, `${crypto.randomBytes(8).toString("hex")}${ext}`);
      },
    }),
    limits: { fileSize: MAX_FILE, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ok = ALLOWED_MIME.test(String(file.mimetype || "")) || ALLOWED_EXT.test(String(file.originalname || ""));
      if (!ok) {
        cb(new Error("Ten typ pliku nie jest obsługiwany (zdjęcia, PDF, e-booki, audio, wideo)."));
        return;
      }
      cb(null, true);
    },
  });
  return uploader;
}

// Zalogowany użytkownik aplikacji (token sesji Supabase) — wgrywać może tylko konto zalogowane.
async function requireUser(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Zaloguj się ponownie, żeby wgrać plik." });
  if (!SUPABASE_URL) return res.status(503).json({ error: "Magazyn plików: brak VITE_SUPABASE_URL." });
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  const user = r && r.ok ? await r.json().catch(() => null) : null;
  if (!user || !user.id) return res.status(401).json({ error: "Sesja wygasła — zaloguj się ponownie." });
  req.user = user;
  next();
}

// Tylko zespół exmortis (rola „admin" albo „techniczna" w profilu exm_user) może wgrywać pliki.
async function requireStaff(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const email = String(req.user?.email || "").toLowerCase();
  if (!email) return res.status(403).json({ error: "Wgrywanie plików jest dostępne tylko dla zespołu exmortis." });
  if (!SUPABASE_URL) return res.status(503).json({ error: "Sprawdzenie uprawnień: brak VITE_SUPABASE_URL." });
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/exm_user?data->>email=eq.${encodeURIComponent(email)}&select=data&limit=1`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) },
  ).catch(() => null);
  if (!r || !r.ok) return res.status(503).json({ error: "Nie udało się sprawdzić uprawnień konta — spróbuj ponownie." });
  const rows = await r.json().catch(() => null);
  if (!Array.isArray(rows)) return res.status(503).json({ error: "Nie udało się sprawdzić uprawnień konta — spróbuj ponownie." });
  const role = rows[0]?.data?.role;
  if (role !== "admin" && role !== "techniczna") {
    return res.status(403).json({ error: "Wgrywanie plików jest dostępne tylko dla zespołu exmortis." });
  }
  next();
}

// Nazwa pliku z żądania — tylko bezpieczne znaki, bez katalogów.
const mediaName = (v) => {
  const s = String(v || "").replace(/^cf\//, "").replace(/^(private|public)\//, "");
  return /^[A-Za-z0-9._-]{1,160}$/.test(s) ? s : "";
};
const mediaSig = (name, exp) => crypto.createHmac("sha256", MEDIA_SECRET).update(`${name}.${exp}`).digest("hex");

// Zapis pliku. ?scope=private → magazyn prywatny (link tylko podpisany), bez → publiczny.
app.post("/api/media/upload", requireUser, requireStaff, async (req, res) => {
  const upload = await getUpload();
  if (!upload) return res.status(503).json({ error: "Magazyn plików: brak pakietu multer — uruchom npm install na serwerze." });
  upload.single("file")(req, res, (err) => {
    if (err) {
      const big = err.code === "LIMIT_FILE_SIZE";
      return res.status(413).json({ error: big ? "Plik jest większy niż limit magazynu (500 MB)." : String(err.message || err) });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nie wybrano pliku." });
    if (file.mimetype === "application/pdf" && file.size > MAX_PDF) {
      fs.unlink(file.path, () => {});
      return res.status(413).json({ error: "PDF może mieć najwyżej 100 MB." });
    }
    const name = path.basename(file.path);
    const ext = path.extname(name).toLowerCase();
    const head = headOf(file);
    if (!sniffKind(ext, head)) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: "Sygnatura pliku nie zgadza się z rozszerzeniem — plik odrzucony." });
    }
    const pdf_js = ext === ".pdf" ? pdfHasJs(head) : false;
    const meta = { name, size: file.size, pdf_js };
    if (req.query.scope === "private") return res.json({ ...meta, file_uri: `cf/private/${name}` });
    return res.json({ ...meta, file_url: `/media/public/${name}` });
  });
});

// Link do pliku prywatnego (podpis + termin) — tworzony na żądanie zalogowanego konta.
app.post("/api/media/sign", express.json({ limit: "16kb", inflate: false }), requireUser, (req, res) => {
  if (!MEDIA_SECRET) return res.status(503).json({ error: "Magazyn plików: brak MEDIA_SECRET w konfiguracji serwera." });
  const name = mediaName(req.body?.file_uri);
  if (!name) return res.status(400).json({ error: "Nieznany plik." });
  const ttl = Math.max(60, Math.min(Number(req.body?.expires_in) || 300, 604800));
  const exp = Math.floor(Date.now() / 1000) + ttl;
  return res.json({ signed_url: `${appBase(req)}/media/private/${encodeURIComponent(name)}?e=${exp}&s=${mediaSig(name, exp)}` });
});

const appBase = (req) => `${req.protocol}://${req.get("host")}`;

// Odczyt: publiczne pliki — długi cache przeglądarki; prywatne — tylko z ważnym podpisem.
// Typ pliku według rozszerzenia — audio i wideo muszą mieć poprawny Content-Type,
// inaczej Safari/iOS nie odtwarza pliku (a m4a bez audio/mp4 trafia do pobrania).
const MEDIA_TYPE = {
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".oga": "audio/ogg",
  ".opus": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac",
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".gif": "image/gif", ".avif": "image/avif", ".pdf": "application/pdf",
};

// Wysyłka pliku z magazynu. acceptRanges → obsługa nagłówka Range (przewijanie audio i wideo,
// odtwarzanie na iPhonie), sendFile sam odpowiada wtedy 206 Partial Content.
const sendMedia = (res, dir, name, cache) => {
  const type = MEDIA_TYPE[path.extname(name).toLowerCase()];
  res.sendFile(path.join(dir, name), {
    dotfiles: "deny",
    acceptRanges: true,
    headers: { "Cache-Control": cache, "X-Content-Type-Options": "nosniff", ...(type ? { "Content-Type": type } : {}) },
  }, (e) => { if (e && !res.headersSent) res.status(404).end(); });
};

app.get("/media/public/:name", (req, res) => {
  const name = mediaName(req.params.name);
  if (!name) return res.status(404).end();
  sendMedia(res, MEDIA_PUBLIC, name, "public, max-age=31536000, immutable");
});

app.get("/media/private/:name", (req, res) => {
  const name = mediaName(req.params.name);
  const exp = Number(req.query.e) || 0;
  const sig = String(req.query.s || "");
  if (!name || !MEDIA_SECRET || exp < Math.floor(Date.now() / 1000)) return res.status(403).end();
  const want = Buffer.from(mediaSig(name, exp));
  const have = Buffer.from(sig);
  if (have.length !== want.length || !crypto.timingSafeEqual(have, want)) return res.status(403).end();
  sendMedia(res, MEDIA_PRIVATE, name, "private, no-store");
});

// /pliki/<kosz>/<ścieżka>?token=… → podpisany plik z magazynu Supabase, pod adresem exmortis.pl.
// Tylko odczyt podpisanych obiektów (bez tokenu Supabase zwraca 400). ?download=nazwa → zapis na dysk.
app.get(/^\/pliki\/(.+)$/, async (req, res) => {
  if (!SUPABASE_URL) return res.status(502).end();
  const rest = req.path.slice("/pliki/".length);
  if (!/^[A-Za-z0-9._\-/%]+$/.test(rest) || rest.includes("..") || !req.query.token) return res.status(404).end();
  const qi = req.originalUrl.indexOf("?");
  try {
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${rest}${req.originalUrl.slice(qi)}`, {
      headers: req.headers.range ? { range: req.headers.range } : {}, signal: AbortSignal.timeout(120000),
    });
    res.status(up.status);
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition", "etag", "last-modified"]) {
      const v = up.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader("cache-control", "private, no-store");
    if (!up.body) return res.end();
    const { Readable } = await import("stream");
    Readable.fromWeb(up.body).on("error", () => res.end()).pipe(res);
  } catch {
    if (!res.headersSent) res.status(502).end(); else res.end();
  }
});

// /functions/<nazwa> → Supabase Edge Functions (obrazy, PayU, bilety PDF, ics, mapa strony…).
// Musi stać PRZED plikami statycznymi i fallbackiem SPA, inaczej każdy taki adres dostaje index.html.
app.all(
  /^\/functions\/[A-Za-z0-9_-]+\/?$/,
  // inflate: false — skompresowane ciało żądania (Content-Encoding) dostaje 415 zamiast rozpakowania
  // (podatność body-parser GHSA-27r3-jxmh-p828; przeglądarki, PayU i panel nigdy nie kompresują wysyłanych danych).
  express.raw({ type: () => true, limit: "25mb", inflate: false }),
  async (req, res) => {
    if (!SUPABASE_URL) {
      res.status(502).json({ error: "Brak SUPABASE_URL (VITE_SUPABASE_URL)" });
      return;
    }
    const name = req.path.match(/^\/functions\/([A-Za-z0-9_-]+)/)[1];
    const qi = req.originalUrl.indexOf("?");
    const query = qi >= 0 ? req.originalUrl.slice(qi) : "";

    const headers = {};
    for (const h of PASS_HEADERS) {
      const v = req.headers[h];
      if (typeof v === "string") headers[h] = v;
    }
    if (!headers.apikey && ANON_KEY) headers.apikey = ANON_KEY;
    if (!headers.authorization && ANON_KEY) headers.authorization = `Bearer ${ANON_KEY}`;
    if (req.ip) {
      headers["true-client-ip"] = req.ip;
      headers["x-real-ip"] = req.ip;
    }

    const method = String(req.method || "GET").toUpperCase();
    const body = method !== "GET" && method !== "HEAD" && Buffer.isBuffer(req.body) ? req.body : undefined;

    try {
      const upstream = await fetch(`${SUPABASE_URL}/functions/v1/${name}${query}`, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(60000),
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      // Strona HTML z funkcji z HTML_PAGES: nadpisujemy text/plain z Supabase, inaczej przeglądarka
      // pokazuje surowy kod. Pozostałe odpowiedzi (ICS, PDF, JSON, obrazy) przechodzą nietknięte.
      const asHtml = method === "GET" && HTML_PAGES.includes(name) && looksHtml(buf);
      res.status(upstream.status);
      for (const h of BACK_HEADERS) {
        const v = upstream.headers.get(h);
        if (v && !(asHtml && h === "content-type")) res.setHeader(h, v);
      }
      if (asHtml) res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(buf);
    } catch (e) {
      res.status(502).json({ error: String(e?.message || e) });
    }
  },
);

app.use(compression());

// Pliki statyczne z builda (assets, fonts, manifest, sw.js).
app.use(express.static(dist, {
  index: false, // obsługę "/" załatwia fallback do index.html
  maxAge: "1h",
  setHeaders(res, file) {
    // Service worker i manifest zawsze świeże — inaczej PWA po zobaczy zmian.
    if (file.endsWith("sw.js") || file.endsWith(".webmanifest") || file.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache");
    } else if (file.includes(`${path.sep}assets${path.sep}`)) {
      // Pliki z builda mają skrót treści w nazwie — nowa wersja = nowa nazwa, więc mogą zostać w przeglądarce na rok.
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
}));

// SPA: każdy adres bez kropki w ścieżce → index.html (routing Reacta po stronie przeglądarki).
// Dla znanych stron publicznych (dist/seo-pages.json z builda) serwer wstawia od razu właściwy tytuł,
// opis, og:title/og:description, og:url i adres kanoniczny — podglądy linków i roboty bez JavaScriptu
// widzą opis tej strony, nie ogólny. Brak pliku albo błąd → zwykły index.html (jak dotychczas).
const SEO_PRIVATE = new Set(["/konto", "/kasa", "/login", "/register", "/forgot-password", "/reset-password", "/listy/potwierdz", "/zmiana-adresu"]);
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const seoCache = { mtime: 0, html: "", pages: {}, routes: null };
function seoLoad() {
  const idx = path.join(dist, "index.html");
  const m = fs.statSync(idx).mtimeMs;
  if (m !== seoCache.mtime) {
    seoCache.html = fs.readFileSync(idx, "utf8");
    try { seoCache.pages = JSON.parse(fs.readFileSync(path.join(dist, "seo-pages.json"), "utf8")); } catch { seoCache.pages = {}; }
    seoCache.routes = routesLoad();
    seoCache.mtime = m;
  }
  return seoCache;
}
function seoHtml(req, dyn) {
  const { html, pages } = seoLoad();
  const p = (req.path.replace(/\/+$/, "") || "/");
  const meta = dyn || pages[p];
  if (!meta || !meta.t) return null;
  const t = escAttr(meta.t), d = escAttr(meta.d || "");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const url = host ? `https://${host}${p === "/" ? "/" : p}` : "";
  const canon = host && dyn?.canon ? `https://${host}${dyn.canon}` : url;
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`);
  // Na stronie spotkania (/1-listopada) zostaje tytuł spotkania z buildu; gdzie indziej — tytuł strony.
  if (p !== "/1-listopada") {
    out = out
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`);
  }
  // Okładka produktu, spotkania albo odcinka zamiast grafiki marki. Wymiary nieznane, więc bez og:image:width/height.
  const img = dyn?.img && host ? (dyn.img.startsWith("/") ? `https://${host}${dyn.img}` : dyn.img) : "";
  if (/^https:\/\/[^\s"<>]+$/.test(img)) {
    out = out
      .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${escAttr(img)}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${escAttr(img)}$2`)
      .replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${t}$2`)
      .replace(/(<meta name="twitter:image:alt" content=")[^"]*(")/, `$1${t}$2`)
      .replace(/\s*<meta property="og:image:(?:width|height)" content="[^"]*" \/>/g, "");
  }
  if (url) {
    const extra = (SEO_PRIVATE.has(p) ? "" : `<link rel="canonical" id="exm-canonical" href="${escAttr(canon)}" />`) + `<meta property="og:url" content="${escAttr(canon)}" />`;
    out = out.replace("</head>", `${extra}</head>`);
  }
  return out;
}

// ---- TRASY APLIKACJI (kod 404) -------------------------------------------------
// dist/routes.json powstaje przy budowie z src/App.jsx (vite.config.js, exm-seo-json). Adres spoza listy tras dostaje
// kod 404 — treść ta sama (aplikacja pokazuje „Nie ma takiej strony”), ale roboty nie indeksują pustych adresów.
// Brak pliku albo błąd → każdy adres jak dotąd 200 (bezpieczny powrót do poprzedniego zachowania).
function routesLoad() {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(dist, "routes.json"), "utf8"))?.routes;
    if (!Array.isArray(list) || list.length < 10) return null;
    return list.map((r) => new RegExp("^" + String(r).replace(/\/+$/, "").split("/").map((seg) => (
      seg === "*" ? "\u0000" : seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )).join("/").replace("/\u0000", "(?:/.*)?") + "/?$", "i"));
  } catch { return null; }
}
function knownRoute(p) {
  const routes = seoLoad().routes;
  return !routes || routes.some((re) => re.test(p));
}

// ---- PODGLĄDY LINKÓW: PRODUKTY, SPOTKANIA, ODCINKI -------------------------------
// Tytuł, opis i okładka z tych samych publicznych źródeł, z których korzysta strona (shopProducts, eventsPublic,
// odcinki podcastu przez REST z kluczem anon). Pamięć: 10 min (potem odświeżenie w tle, najdłużej 24 h starej wartości),
// brak rekordu — 2 min. Błąd lub przekroczony czas (2,5 s) → zwykła strona z kodem 200, nigdy 404 z powodu awarii.
const DYN = [
  { re: /^\/skarbiec\/([A-Za-z0-9-]{1,100})$/, kind: "produkt" },
  { re: /^\/spotkania\/([A-Za-z0-9-]{1,100})$/, kind: "spotkanie" },
  { re: /^\/glos\/([A-Za-z0-9-]{1,100})$/, kind: "odcinek" },
];
// Spotkania z własną stroną zapisu — adres kanoniczny jak w src/pages/EventDetail.jsx (LANDINGS).
const DYN_LANDINGS = { "ze-smierci-o-powrotach-o-ktorych-swiat-nie-mowi": "/1-listopada", "1-listopada": "/1-listopada" };
const dynCache = new Map();
const dynPending = new Map();
const DYN_FRESH = 10 * 60000, DYN_STALE = 24 * 3600000, DYN_MISS = 2 * 60000, DYN_MAX = 500, DYN_PARALLEL = 8;
const plainText = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function clip(s, n = 200) {
  const t = plainText(s);
  if (t.length <= n) return t;
  const c = t.slice(0, n);
  return c.slice(0, Math.max(c.lastIndexOf(" "), n - 40)).replace(/[\s,.;:—–-]+$/, "") + "…";
}
async function dynFetch(kind, slug) {
  const headers = { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}`, "content-type": "application/json" };
  const signal = AbortSignal.timeout(2500);
  if (kind === "odcinek") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/exm_podcastepisode?select=data&data->>slug=eq.${encodeURIComponent(slug)}&limit=1`, { headers, signal });
    if (!r.ok) throw new Error(`odcinek ${r.status}`);
    const ep = (await r.json())?.[0]?.data;
    if (!ep || !["opublikowany", "zaplanowany"].includes(ep.status) || !(Date.parse(ep.publikacja) <= Date.now())) return null;
    return { t: `${ep.tytul} — Podcast exmortis${ep.numer != null ? ` #${ep.numer}` : ""}`, d: clip(ep.opis_krotki || ep.notatki || ep.tytul), img: ep.okladka || "", canon: `/glos/${slug}` };
  }
  const fn = kind === "produkt" ? "shopProducts" : "eventsPublic";
  const body = kind === "produkt" ? { slug } : { action: "get", slug };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: "POST", headers, body: JSON.stringify(body), signal });
  if (kind === "spotkanie" && r.status === 404) return null;
  if (!r.ok) throw new Error(`${fn} ${r.status}`);
  const data = await r.json();
  if (kind === "produkt") {
    if (!Array.isArray(data?.products)) throw new Error("shopProducts: brak listy");
    const pr = data.products.find((x) => x.slug === slug) || data.products[0];
    if (!pr?.name) return null;
    return { t: `${pr.name} — Skarbiec | exmortis`, d: clip(pr.subtitle || pr.promise || pr.description), img: pr.cover_image || pr.image_url || "", canon: `/skarbiec/${pr.slug || slug}` };
  }
  const ev = data?.event;
  if (!ev?.title) throw new Error("eventsPublic: brak spotkania");
  return { t: `${ev.title} — Spotkania | exmortis`, d: clip(ev.subtitle || ev.description), img: ev.cover_image || "", canon: DYN_LANDINGS[slug] || `/spotkania/${slug}` };
}
// Zwraca { val } (val === null → rekordu nie ma) albo null (trasa nie jest dynamiczna lub dane niedostępne).
async function dynMeta(p) {
  const hitRoute = DYN.map((d) => [d, p.match(d.re)]).find(([, m]) => m);
  if (!hitRoute || !SUPABASE_URL || !ANON_KEY) return null;
  const [{ kind }, m] = hitRoute;
  const key = `${kind}:${m[1]}`;
  const hit = dynCache.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  const load = () => {
    if (dynPending.has(key)) return dynPending.get(key);
    if (dynPending.size >= DYN_PARALLEL) return Promise.resolve(null);
    const job = dynFetch(kind, m[1])
      .then((val) => {
        dynCache.delete(key);
        dynCache.set(key, { at: Date.now(), val });
        if (dynCache.size > DYN_MAX) dynCache.delete(dynCache.keys().next().value);
        return { val };
      })
      .catch((e) => { console.error("podgląd:", key, String(e?.message || e).slice(0, 120)); return null; })
      .finally(() => dynPending.delete(key));
    dynPending.set(key, job);
    return job;
  };
  if (hit && age < (hit.val ? DYN_FRESH : DYN_MISS)) return { val: hit.val };
  if (hit?.val && age < DYN_STALE) { load(); return { val: hit.val }; }
  return load();
}
// Przerwa techniczna (Ustawienia → Przerwa techniczna, zapis „premiera”): dokumenty HTML zamkniętych adresów
// dostają kod 503 z Retry-After — roboty wyszukiwarek wiedzą, że to chwilowe, i nie usuwają stron z wyników.
// Treść odpowiedzi to ta sama aplikacja, więc zalogowani klienci korzystają normalnie (stronę przerwy widzą tylko goście).
// Stan odświeżany w tle co 60 s z siteSettings; błąd albo brak odpowiedzi → zwykłe 200 (bez blokowania strony).
const PAUSE_OPEN = new Set(["/kontakt", "/regulamin", "/polityka-prywatnosci", "/polityka-cookies", "/odstapienie", "/login", "/register",
  "/forgot-password", "/reset-password", "/listy/potwierdz", "/listy/wypis", "/zmiana-adresu", "/karta", "/bilet", "/rezerwacja/termin", "/rezerwacja/zarzadzaj"]);
const pause = { at: 0, until: 0, busy: false };
function pauseRefresh() {
  if (pause.busy || Date.now() - pause.at < 60000 || !SUPABASE_URL || !ANON_KEY) return;
  pause.busy = true;
  pause.at = Date.now();
  fetch(`${SUPABASE_URL}/functions/v1/siteSettings`, {
    method: "POST",
    headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}`, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(5000),
  })
    .then(async (r) => {
      const p = r.ok ? (await r.json())?.premiera || {} : {};
      const until = Date.parse(p.do);
      pause.until = r.ok && !p.wylaczony && until > Date.now() ? until : 0;
    })
    .catch(() => { pause.until = 0; })
    .finally(() => { pause.busy = false; });
}
function pauseRetryAfter(req) {
  pauseRefresh();
  if (!(pause.until > Date.now())) return 0;
  const p = req.path.replace(/\/+$/, "") || "/";
  if (PAUSE_OPEN.has(p) || p.endsWith("/dolacz") || p.startsWith("/admin") || p.startsWith("/konto") || p === "/skaner") return 0;
  if (p === "/kasa" && "payu" in (req.query || {})) return 0;
  return Math.max(60, Math.min(86400, Math.round((pause.until - Date.now()) / 1000)));
}
pauseRefresh();

// Kod odpowiedzi: 503 (przerwa techniczna) > 404 (nieznany adres albo brak produktu/spotkania/odcinka) > 200.
app.get(/^(?!.*\.).*/, async (req, res) => {
  const retry = pauseRetryAfter(req);
  let status = retry ? 503 : 200, out = null;
  try {
    const p = req.path.replace(/\/+$/, "") || "/";
    const dyn = await dynMeta(p);
    if (dyn?.val) out = seoHtml(req, dyn.val);
    else if (dyn) { if (!retry) status = 404; }
    else {
      out = seoHtml(req);
      if (!out && !retry && !DYN.some((d) => d.re.test(p)) && !knownRoute(p)) status = 404;
    }
  } catch (e) {
    console.error("seo:", String(e?.message || e).slice(0, 200));
  }
  if (res.headersSent) return;
  if (retry) res.setHeader("Retry-After", String(retry));
  if (status === 404) res.setHeader("X-Robots-Tag", "noindex");
  if (out || status !== 200) {
    res.setHeader("Cache-Control", "no-cache");
    try { return res.status(status).type("html").send(out || seoLoad().html); } catch { /* niżej zwykły plik */ }
  }
  res.status(status).sendFile(path.join(dist, "index.html"));
});

// Błędy odczytu treści żądania (body-parser: skompresowane ciało, za duże, zły JSON) — krótka odpowiedź JSON
// zamiast domyślnej strony błędu Express. Pozostałe błędy idą dalej, jak dotąd.
app.use((err, _req, res, next) => {
  if (!err?.type || res.headersSent || !["encoding.unsupported", "entity.too.large", "entity.parse.failed", "charset.unsupported"].includes(err.type)) return next(err);
  res.status(err.status || 400).json({ error: err.type === "entity.too.large" ? "Za duża treść żądania" : "Nieprawidłowa treść żądania" });
});

app.listen(port, () => {
  console.log(`exmortis działa na porcie ${port} (magazyn plików: ${MEDIA_DIR})`);
});