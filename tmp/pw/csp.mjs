import { chromium } from "playwright";
const BASE = process.env.BASE || "https://exmortis.pl";
const pages = ["/", "/skarbiec", "/skarbiec/wracam-inny", "/powrot", "/spotkania", "/glos", "/o-mnie", "/kontakt", "/test", "/cisza", "/login", "/register", "/kasa", "/regulamin", "/1-listopada", "/rozmowa-na-progu", "/konto", "/listy/potwierdz", "/nie-ma-takiej-strony"];
const consentModes = (process.env.MODES || "none,all").split(",");
const browser = await chromium.launch();
const out = {};
for (const mode of consentModes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36 exm-csp-check" });
  // Bez zanieczyszczania analityki: zbieranie trafień GA/Meta jest przerywane (CSP sprawdza adres przed wysłaniem).
  await ctx.route(/google-analytics\.com\/(g\/)?collect|analytics\.google\.com\/g\/collect|facebook\.com\/tr/, (r) => r.abort());
  await ctx.addInitScript((m) => {
    if (m === "all") localStorage.setItem("exm_cookie_consent", JSON.stringify({ v: "2.0", at: Date.now(), analytics: true, marketing: true, external: true }));
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.disposition} ${e.effectiveDirective} ${e.blockedURI} @${(e.sourceFile || "").slice(0, 80)}:${e.lineNumber}`));
  }, mode);
  const list = [...pages];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const page = await ctx.newPage();
    const cons = [];
    page.on("console", (m) => { if (m.type() === "error" || /Content.Security/i.test(m.text())) cons.push(m.text().slice(0, 200)); });
    let status = 0;
    try {
      const r = await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 45000 });
      status = r?.status() || 0;
      for (let y = 0; y < 8; y++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(350); }
      await page.waitForTimeout(1500);
      if (mode === consentModes[0] && (p === "/spotkania" || p === "/glos" || p === "/skarbiec")) {
        const re = p === "/skarbiec" ? /^\/skarbiec\/[^/]+$/ : new RegExp(`^${p}/[^/]+$`);
        const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => new URL(a.href).pathname));
        const extra = [...new Set(hrefs.filter((h) => re.test(h)))].slice(0, 2);
        for (const h of extra) if (!list.includes(h)) list.push(h);
      }
    } catch (e) { cons.push("NAV " + String(e.message).slice(0, 120)); }
    const csp = await page.evaluate(() => window.__csp).catch(() => []);
    out[`${mode} ${p}`] = { status, csp: [...new Set(csp)], cons: [...new Set(cons)].filter((c) => !/net::ERR_FAILED/.test(c)).slice(0, 6) };
    await page.close();
  }
  await ctx.close();
}
await browser.close();
for (const [k, v] of Object.entries(out)) {
  console.log(`${k} [${v.status}] csp=${v.csp.length}`);
  for (const c of v.csp) console.log("   CSP " + c);
  for (const c of v.cons) console.log("   ERR " + c);
}
