// Serwer startowy dla hostingu cyberfolks.pl (Phusion Passenger + Node.js).
// Passenger podaje port w zmiennej PORT; lokalnie: PORT=3000 node server.js
// Wymaga wcześniejszego `npm run build` (katalog dist/).

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";

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
const SUPABASE_URL = String(process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY = String(process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY || "");

const PASS_HEADERS = [
  "content-type", "authorization", "apikey", "openpayu-signature", "referer", "origin",
  "sec-fetch-site", "sec-fetch-dest", "user-agent", "accept",
];
const BACK_HEADERS = [
  "content-type", "cache-control", "content-disposition", "x-robots-tag", "location",
  "vary", "access-control-allow-origin",
];

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
  console.log(`exmortis działa na porcie ${port}`);
});