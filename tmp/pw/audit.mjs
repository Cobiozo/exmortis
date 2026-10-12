import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "https://exmortis.pl";
const START = ["/", "/1-listopada", "/1-listopada/dolacz", "/o-mnie", "/powrot", "/skarbiec", "/glos", "/test", "/spotkania",
  "/spotkania/wieczor-powrotu", "/spotkania/wieczor-powrotu/dolacz", "/obok", "/cisza", "/kontakt", "/regulamin",
  "/polityka-prywatnosci", "/polityka-cookies", "/odstapienie", "/rezerwacja/rozmowa-kwalifikacyjna", "/login",
  "/register", "/forgot-password", "/kasa", "/nie-ma-takiej-strony"];
const VIEWPORTS = (process.env.VP || "375x812").split(",").map((v) => v.split("x").map(Number));
const MAX = Number(process.env.MAX || 60);
const SHOTS = process.env.SHOTS === "1";
fs.mkdirSync("/tmp/pw/shots", { recursive: true });

const browser = await chromium.launch();
const results = [];
const seen = new Set();
const queue = [...START];

async function audit(path, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500,
    userAgent: w < 500 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" : undefined });
  // Audyt bez trybu przedpremierowego: tylko w tej przeglądarce, serwer bez zmian.
  await ctx.route(/\/functions\/(bootstrap|siteSettings)/, async (route) => {
    const r = await route.fetch();
    let body = await r.text();
    try {
      const j = JSON.parse(body);
      const fix = (o) => { if (o && o.premiera) o.premiera.wylaczony = true; };
      fix(j); fix(j.settings); fix(j.data);
      body = JSON.stringify(j);
    } catch {}
    await route.fulfill({ response: r, body });
  });
  const page = await ctx.newPage();
  const errs = [], failed = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR " + String(e.message).slice(0, 160)));
  page.on("response", (r) => { const s = r.status(); if (s >= 400 && !/favicon/.test(r.url())) failed.push(`${s} ${r.url().replace(BASE, "").slice(0, 110)}`); });
  const t0 = Date.now();
  let status = 0;
  try {
    const resp = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    status = resp ? resp.status() : 0;
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
  } catch (e) { errs.push("GOTO " + e.message.slice(0, 120)); }
  const ms = Date.now() - t0;
  const m = await page.evaluate((vw) => {
    const doc = document.documentElement;
    const over = doc.scrollWidth - doc.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" && r.right <= vw + 1) continue;
      if (r.right > vw + 1 || r.left < -1) {
        let p = el.parentElement, clipped = false;
        while (p) { const ps = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(ps.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 1 && pr.left >= -1) { clipped = true; break; } } p = p.parentElement; }
        if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}→${Math.round(r.right)}] "${(el.innerText || "").trim().slice(0, 40)}"`);
      }
    }
    const imgs = [...document.images];
    const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src.slice(-60));
    const noAlt = imgs.filter((i) => !i.hasAttribute("alt")).length;
    const small = vw < 500 ? [...document.querySelectorAll("a, button, [role=button], input, select")].filter((e) => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32) && getComputedStyle(e).visibility !== "hidden";
    }).length : 0;
    const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    const tiny = vw < 500 ? [...document.querySelectorAll("p, li, span, a, button, label")].filter((e) => {
      const r = e.getBoundingClientRect(); if (!r.width || !(e.innerText || "").trim()) return false;
      return parseFloat(getComputedStyle(e).fontSize) < 11;
    }).length : 0;
    return { over, offenders: offenders.slice(0, 4), broken, noAlt, small, tiny, links, title: document.title, h: doc.scrollHeight, finalPath: location.pathname };
  }, w).catch((e) => ({ err: e.message }));
  if (SHOTS) await page.screenshot({ path: `/tmp/pw/shots/${w}${path.replace(/\//g, "_") || "_"}.jpg`, fullPage: true, type: "jpeg", quality: 35 }).catch(() => {});
  await ctx.close();
  return { path, vp: `${w}x${h}`, status, ms, errs: [...new Set(errs)].slice(0, 4), failed: [...new Set(failed)].slice(0, 5), ...m };
}

while (queue.length && seen.size < MAX) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  seen.add(p);
  for (const [w, h] of VIEWPORTS) {
    const r = await audit(p, w, h);
    results.push(r);
    if (w === VIEWPORTS[0][0] && r.links) {
      for (const href of r.links) {
        if (!href || !href.startsWith("/") || href.startsWith("//")) continue;
        const clean = href.split("#")[0].split("?")[0];
        if (!clean || /^\/(admin|konto|api|logout)/.test(clean) || seen.has(clean) || queue.includes(clean)) continue;
        queue.push(clean);
      }
    }
    delete r.links;
  }
}
await browser.close();
fs.writeFileSync("/tmp/pw/result.json", JSON.stringify(results, null, 1));
for (const r of results) {
  const issues = [];
  if (r.status >= 400) issues.push(`HTTP ${r.status}`);
  if (r.over > 1) issues.push(`POZIOMY SCROLL +${r.over}px`);
  if (r.offenders && r.offenders.length) issues.push(`wystaje: ${r.offenders.join(" | ")}`);
  if (r.errs && r.errs.length) issues.push(`konsola: ${r.errs.join(" | ")}`);
  if (r.failed && r.failed.length) issues.push(`żądania: ${r.failed.join(" | ")}`);
  if (r.broken && r.broken.length) issues.push(`obrazy zepsute: ${r.broken.length}`);
  if (r.noAlt) issues.push(`bez alt: ${r.noAlt}`);
  if (r.small) issues.push(`małe cele dotyku: ${r.small}`);
  if (r.tiny) issues.push(`tekst <11px: ${r.tiny}`);
  if (r.finalPath && r.finalPath !== r.path) issues.push(`→ ${r.finalPath}`);
  console.log(`${r.vp} ${r.path} ${r.ms}ms ${issues.length ? "\n   " + issues.join("\n   ") : "OK"}`);
}
