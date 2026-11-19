// Odświeżenie gotowego HTML pierwszego ekranu (powłoki) — szybkość na telefonie (< 768 px, gość bez sesji):
//   src/content/landingShell.html  — strona główna „/” (nagłówek ze zdjęciem),
//   src/content/productShell.html  — karta „/skarbiec/wracam-inny” (okładka, tytuł, opis; BEZ ceny i przycisków).
// Kiedy: po zmianie bloku „hero” strony głównej, menu w nagłówku, okładki albo opisu książki.
// Pliki trafiają do index.html przez wtyczkę exmFastStart (vite.config.js); React podmienia je identyczną treścią.
// Jak (wymaga Playwright):
//   1) zbuduj stronę do katalogu tymczasowego (npx vite build --outDir /tmp/exm) i uruchom ją
//      (np. server.js z dist → /tmp/exm albo npx vite preview --outDir /tmp/exm --port 4174),
//   2) BASE=http://localhost:4174 node docs/tech/landing-shell.mjs  → zapisze oba pliki,
//   3) zbuduj ponownie i porównaj zrzuty 390 px: powłoka (bez JS) i aplikacja muszą wyglądać tak samo.
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE || "http://localhost:4174";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 412, height: 823 } });
const ready = async () => {
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!document.querySelector('main img[fetchpriority="high"]')?.complete)); i++) await p.waitForTimeout(500);
  await p.waitForTimeout(1000);
};
const base = () => {
  const top = [...document.getElementById("root").children].find((c) => c.querySelector("main"));
  if (!top) throw new Error("Brak <main> w aplikacji");
  const t = top.cloneNode(true);
  t.querySelector("footer")?.remove();
  [...t.children].forEach((c) => { if (!c.matches("header, main")) c.remove(); }); // bez koszyka, linku „przejdź do treści” itp.
  t.querySelectorAll('[aria-hidden="true"].invisible').forEach((e) => e.remove()); // niewidoczna kopia menu do pomiaru
  return t;
};

// 1. Strona główna: tylko pierwszy blok (nagłówek ze zdjęciem).
await p.goto(BASE + "/", { waitUntil: "load" });
await ready();
const home = await p.evaluate(`(() => {
  const t = (${base})();
  const host = t.querySelector("main [data-block]")?.parentElement;
  if (!host) throw new Error("Brak bloków strony");
  let first = true;
  [...host.children].forEach((c) => { if (first && c.matches("[data-block]")) { first = false; return; } c.remove(); });
  return t.outerHTML;
})()`);
if (!/<h1/.test(home) || !/<img [^>]*fetchpriority="high"/.test(home)) throw new Error("Strona główna: brak nagłówka albo zdjęcia — pliki bez zmian.");

// 2. Karta książki: pierwsza sekcja (okładka + opis); od bloku z ceną w dół nic (cena zmienia się wg drabinki).
await p.goto(BASE + "/skarbiec/wracam-inny", { waitUntil: "load" });
await ready();
const product = await p.evaluate(`(() => {
  const t = (${base})();
  const img = t.querySelector('main img[fetchpriority="high"]');
  if (!img) throw new Error("Brak okładki");
  const grid = img.closest(".grid");
  const section = grid.closest('[class*="py-[var(--exm-section-y)]"]');
  [...section.parentElement.children].forEach((c) => { if (c !== section) c.remove(); });
  let cut = false;
  [...grid.children[1].children].forEach((c) => { if (!cut && /zł/.test(c.textContent)) cut = true; if (cut) c.remove(); });
  if (/zł/.test(t.textContent)) throw new Error("W powłoce została cena");
  return t.outerHTML;
})()`);
if (!/<h1/.test(product)) throw new Error("Karta książki: brak nagłówka — pliki bez zmian.");

fs.writeFileSync(new URL("../../src/content/landingShell.html", import.meta.url), home);
fs.writeFileSync(new URL("../../src/content/productShell.html", import.meta.url), product);
console.log(`Zapisano landingShell.html (${home.length}) i productShell.html (${product.length}).`);
await b.close();
