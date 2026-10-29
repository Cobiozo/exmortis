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
app.set("trust proxy", true);

// Nagłówki bezpieczeństwa na każdej odpowiedzi (bez CSP).
app.use((_req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
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
app.post("/api/media/sign", express.json({ limit: "16kb" }), requireUser, (req, res) => {
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

// /functions/<nazwa> → Supabase Edge Functions (obrazy, PayU, bilety PDF, ics, mapa strony…).
// Musi stać PRZED plikami statycznymi i fallbackiem SPA, inaczej każdy taki adres dostaje index.html.
app.all(
  /^\/functions\/[A-Za-z0-9_-]+\/?$/,
  express.raw({ type: () => true, limit: "25mb" }),
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
    }
  },
}));

// SPA: każdy adres bez kropki w ścieżce → index.html (routing Reacta po stronie przeglądarki).
app.get(/^(?!.*\.).*/, (_req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(port, () => {
  console.log(`exmortis działa na porcie ${port} (magazyn plików: ${MEDIA_DIR})`);
});