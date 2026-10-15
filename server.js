// Serwer startowy dla hostingu cyberfolks.pl (Phusion Passenger + Node.js).
// Passenger podaje port w zmiennej PORT; lokalnie: PORT=3000 node server.js
// Wymaga wcześniejszego `npm run build` (katalog dist/).

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 3000;

const app = express();
app.disable("x-powered-by");
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