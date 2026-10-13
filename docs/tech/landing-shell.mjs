// Odświeżenie gotowego HTML strony 1 listopada (src/content/landingShell.html) — wydajność „/” do premiery.
// Kiedy: po zmianie nagłówka (hero), zdjęcia w tle albo nawigacji strony spotkania 1 listopada.
// Jak (lokalnie, wymaga Playwright):
//   1) VITE_BASE44_APP_ID=6aa08bc6318b0f886cc3b9a3 npx vite build --outDir /tmp/exm && npx vite preview --outDir /tmp/exm --port 4174
//   2) node docs/tech/landing-shell.mjs   (w drugim oknie)  → zapisze src/content/landingShell.html
//   3) opublikuj. Plik jest wstawiany do index.html przez wtyczkę exmFastStart (vite.config.js),
//      pokazywany wyłącznie gościom na „/” i „/1-listopada” do daty PRE_END i podmieniany przez Reacta tą samą treścią.
// Po premierze (1.11, 21:30) mechanizm wyłącza się sam — plik można wtedy usunąć.
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE || "http://localhost:4174";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 823 } });
const p = await ctx.newPage();
await p.goto(BASE + "/", { waitUntil: "networkidle" });
const html = await p.evaluate(() => {
  const top = document.getElementById("root").firstElementChild.cloneNode(true);
  top.querySelector("footer")?.remove();
  const wrap = top.querySelector("main")?.firstElementChild;
  if (!wrap) throw new Error("Brak <main> — czy to strona spotkania (tryb przedpremierowy, gość)?");
  [...wrap.children].slice(1).forEach((c) => c.remove()); // tylko pierwsza sekcja (nagłówek ze zdjęciem)
  return top.outerHTML;
});
if (!/<h1/.test(html) || !/srcset=/.test(html)) throw new Error("Nie znaleziono nagłówka albo zdjęcia — plik nie został zmieniony.");
fs.writeFileSync(new URL("../../src/content/landingShell.html", import.meta.url), html);
console.log(`Zapisano src/content/landingShell.html (${html.length} znaków).`);
await b.close();
