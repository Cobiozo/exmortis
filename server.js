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

// Nazwa pliku z żądania — tylko bezpieczne znaki, bez katalogów.
const mediaName = (v) => {
  const s = String(v || "").replace(/^cf\//, "").replace(/^(private|public)\//, "");
  return /^[A-Za-z0-9._-]{1,160}$/.test(s) ? s : "";
};
const mediaSig = (name, exp) => crypto.createHmac("sha256", MEDIA_SECRET).update(`${name}.${exp}`).digest("hex");

// Zapis pliku. ?scope=private → magazyn prywatny (link tylko podpisany), bez → publiczny.
app.post("/api/media/upload", requireUser, async (req, res) => {
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
    if (req.query.scope === "private") return res.json({ file_uri: `cf/private/${name}`, name });
    return res.json({ file_url: `/media/public/${name}`, name });
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
app.get("/media/public/:name", (req, res) => {
  const name = mediaName(req.params.name);
  if (!name) return res.status(404).end();
  res.sendFile(path.join(MEDIA_PUBLIC, name), {
    dotfiles: "deny",
    headers: { "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  }, (e) => { if (e && !res.headersSent) res.status(404).end(); });
});

app.get("/media/private/:name", (req, res) => {
  const name = mediaName(req.params.name);
  const exp = Number(req.query.e) || 0;
  const sig = String(req.query.s || "");
  if (!name || !MEDIA_SECRET || exp < Math.floor(Date.now() / 1000)) return res.status(403).end();
  const want = Buffer.from(mediaSig(name, exp));
  const have = Buffer.from(sig);
  if (have.length !== want.length || !crypto.timingSafeEqual(have, want)) return res.status(403).end();
  res.sendFile(path.join(MEDIA_PRIVATE, name), {
    dotfiles: "deny",
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  }, (e) => { if (e && !res.headersSent) res.status(404).end(); });
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
      res.status(upstream.status);
      for (const h of BACK_HEADERS) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      res.end(Buffer.from(await upstream.arrayBuffer()));
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