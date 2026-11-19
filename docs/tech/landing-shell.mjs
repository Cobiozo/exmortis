// Odświeżenie gotowego HTML pierwszego ekranu strony głównej (src/content/landingShell.html) — szybkość „/” na telefonie.
// Kiedy: po zmianie bloku „hero” strony głównej (napisy, zdjęcie tła, przyciski) albo menu w nagłówku.
// Plik trafia do index.html przez wtyczkę exmFastStart (vite.config.js) i jest pokazywany gościom na „/” przy szerokości
// < 768 px, zanim wczyta się aplikacja; React podmienia go identyczną treścią.
// Jak (wymaga Playwright):
//   1) zbuduj stronę do katalogu tymczasowego (np. npx vite build --outDir /tmp/exm) i uruchom ją (np. przez server.js
//      z dist → /tmp/exm albo npx vite preview --outDir /tmp/exm --port 4174),
//   2) BASE=http://localhost:4174 node docs/tech/landing-shell.mjs  → zapisze src/content/landingShell.html
//   3) zbuduj ponownie i porównaj zrzut 390 px: powłoka (bez JS) i aplikacja muszą wyglądać tak samo.
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE || "http://localhost:4174";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 412, height: 823 } });
await p.goto(BASE + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const html = await p.evaluate(() => {
  const top = [...document.getElementById("root").children].find((c) => c.querySelector("main"));
  if (!top) throw new Error("Brak <main> w aplikacji");
  const t = top.cloneNode(true);
  t.querySelector("footer")?.remove();
  [...t.children].forEach((c) => { if (!c.matches("header, main")) c.remove(); }); // bez koszyka, linku „przejdź do treści” itp.
  const host = t.querySelector("main [data-block]")?.parentElement;
  if (!host) throw new Error("Brak bloków strony");
  let first = true; // tylko pierwszy blok (nagłówek ze zdjęciem)
  [...host.children].forEach((c) => { if (first && c.matches("[data-block]")) { first = false; return; } c.remove(); });
  t.querySelectorAll('[aria-hidden="true"].invisible').forEach((e) => e.remove()); // niewidoczna kopia menu do pomiaru
  return t.outerHTML;
});
if (!/<h1/.test(html) || !/<img [^>]*fetchpriority="high"/.test(html)) throw new Error("Nie znaleziono nagłówka albo zdjęcia — plik nie został zmieniony.");
fs.writeFileSync(new URL("../../src/content/landingShell.html", import.meta.url), html);
console.log(`Zapisano src/content/landingShell.html (${html.length} znaków).`);
await b.close();
