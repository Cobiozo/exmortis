// Lista oczekujących: list „już dostępne” i wysyłka partiami (panel i premiera o czasie).
import { runSql, escStr } from "./supabase.ts";
import { unitPrice, withSteps } from "./productPrice.ts";
import { sendMail } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";

const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const zlTxt = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} zł`;

export function waitlistHtml(p, firstName, note, url, unsubUrl = "") {
  const promo = p.price_start != null && p.promo_end_date;
  const price = p.is_free ? "bezpłatnie" : promo ? `${zlTxt(p.price_start)} (do ${new Date(`${String(p.promo_end_date).slice(0, 10)}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "Europe/Warsaw" })}, potem ${zlTxt(p.next_price?.cena ?? p.price_regular ?? p.price)})` : zlTxt(unitPrice(p));
  const noteHtml = note ? `<p style="line-height:1.7;color:#E2E2E2;">${escHtml(note).replace(/\n/g, "<br>")}</p>` : "";
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    ${firstName ? `<p style="color:#8A8A8C;">${escHtml(firstName)},</p>` : ""}
    <h1 style="font-size:24px;letter-spacing:1px;">„${escHtml(p.name)}” jest już dostępne</h1>
    ${p.subtitle ? `<p style="color:#8A8A8C;line-height:1.7;">${escHtml(p.subtitle)}</p>` : ""}
    ${noteHtml}
    <p style="color:#E2E2E2;">Cena: <span style="color:#C9A24A;">${escHtml(price)}</span></p>
    <p style="margin:28px 0;"><a href="${url}" style="background:#C9A24A;color:#0A0A0B;padding:14px 22px;text-decoration:none;letter-spacing:2px;font-size:13px;">ZOBACZ W SKARBCU</a></p>
    <p style="color:#5C5C5E;font-size:12px;line-height:1.6;">Ten adres był na liście oczekujących na „${escHtml(p.name)}” na exmortis.pl. To jedyna wiadomość w tej sprawie — nie zapisuję tego adresu do newslettera.</p>
    ${unsubUrl ? `<p style="color:#5C5C5E;font-size:12px;line-height:1.6;"><a href="${unsubUrl}" style="color:#8A8A8C;">Wypisz się z tej listy</a></p>` : ""}
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
  </div>`;
}

// Token wypisania: 64 znaki hex, losowy — nie da się go odgadnąć z adresu e-mail.
// Ten sam generator, którego używa zmiana adresu (crypto.randomUUID w runtime funkcji).
export const waitlistToken = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

// Link wypisania — zawsze z adresu aplikacji (APP_URL), nigdy ze stałej domeny.
export const waitlistUnsubUrl = (appUrl, token) =>
  `${appUrl}/functions/shopWaitlist?action=unsubscribe&t=${encodeURIComponent(token)}`;

// Jedyny mail po zapisie na listę: potwierdzenie + link wypisania.
export function waitlistJoinHtml(p, firstName, url, unsubUrl) {
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    ${firstName ? `<p style="color:#8A8A8C;">${escHtml(firstName)},</p>` : ""}
    <h1 style="font-size:24px;letter-spacing:1px;">Jesteś na liście: „${escHtml(p.name)}”</h1>
    <p style="line-height:1.7;color:#E2E2E2;">jesteś na liście oczekujących na „${escHtml(p.name)}”. Napiszę, gdy będzie dostępny — jeden mail, bez spamu.</p>
    <p style="margin:28px 0;"><a href="${url}" style="background:#C9A24A;color:#0A0A0B;padding:14px 22px;text-decoration:none;letter-spacing:2px;font-size:13px;">ZOBACZ PRODUKT</a></p>
    <p style="color:#5C5C5E;font-size:12px;line-height:1.6;">Ten adres zapisałem na listę oczekujących na „${escHtml(p.name)}”. <a href="${unsubUrl}" style="color:#8A8A8C;">Wypisz się z tej listy</a>.</p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
  </div>`;
}

// Prosta strona odpowiedzi na wypisanie — ten sam wygląd co strona odwołania zapisu w eventsCancel.
export function waitlistPage(title, lead) {
  return new Response(
    `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${title}</title>
     <style>body{background:#0A0A0B;color:#E2E2E2;font-family:Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
     .box{max-width:480px;text-align:center}.gold{color:#C9A24A;letter-spacing:4px;font-size:12px}h1{font-weight:400}
     .foot{color:#5C5C5E;font-size:11px;letter-spacing:2px;margin-top:40px}</style></head>
     <body><div class="box"><p class="gold">EXMORTIS</p><h1>${title}</h1><p>${lead}</p>
     <p class="foot">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

let cols = false;
export async function ensureWaitlistCols(base44) {
  if (cols) return;
  await runSql(base44, `ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS notified_at timestamptz`);
  // Token wypisania z listy (link w mailach: potwierdzenie zapisu i premiera).
  await runSql(base44, `ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS unsubscribe_token text`);
  // Lista w panelu liczy zapisanych dla każdego produktu osobno — bez indeksu to skan całej tabeli na produkt.
  await runSql(base44, `CREATE INDEX IF NOT EXISTS waitlist_product_idx ON public.waitlist (product_id)`);
  await runSql(base44, `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS release_at timestamptz, ADD COLUMN IF NOT EXISTS release_note text, ADD COLUMN IF NOT EXISTS release_notify boolean DEFAULT false`);
  cols = true;
}

// Jedna partia (do `limit` osób); każda osoba najwyżej raz. Rzuca, gdy produkt nie jest do kupienia.
export async function notifyBatch(base44, id, note, limit = 20) {
  await ensureWaitlistCols(base44);
  const [raw] = await runSql(base44, `SELECT id, name, slug, subtitle, active, is_free, COALESCE(status, 'dostępny') AS status,
      price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
      promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps
    FROM public.products p WHERE id = ${escStr(id)}`, true);
  if (!raw) throw new Error("Nie ma takiego produktu");
  if (!raw.active || raw.status !== "dostępny") throw new Error("Najpierw ustaw produkt jako aktywny i „Dostępny” — lista dostaje link do strony, którą można kupić.");
  const p = withSteps(raw);
  const appUrl = await loadAppUrl(base44);
  const url = `${appUrl}/skarbiec/${encodeURIComponent(p.slug)}`;
  const batch = await runSql(base44, `SELECT email, first_name, unsubscribe_token FROM public.waitlist
    WHERE product_id = ${escStr(id)} AND notified_at IS NULL ORDER BY created_at ASC LIMIT ${Number(limit) || 20}`, true);
  let sent = 0, queued = 0, failed = 0;
  for (const r of batch) {
    try {
      const unsub = r.unsubscribe_token ? waitlistUnsubUrl(appUrl, r.unsubscribe_token) : "";
      const res = await sendMail(base44, { to: r.email, subject: `EXMORTIS · „${p.name}” jest już dostępne`, html: waitlistHtml(p, r.first_name, note, url, unsub), kind: "lista_oczekujacych", ref: id });
      if (res === "wyslany") sent++; else queued++;
    } catch { failed++; }
    // Oznaczamy także błędy (zostają w dzienniku poczty) — nikt nie dostanie listu dwa razy.
    await runSql(base44, `UPDATE public.waitlist SET notified_at = now() WHERE product_id = ${escStr(id)} AND email = ${escStr(r.email)}`);
  }
  const [left] = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.waitlist WHERE product_id = ${escStr(id)} AND notified_at IS NULL`, true);
  return { sent, queued, failed, left: left?.n || 0 };
}

// Ile osób czeka jeszcze na powiadomienie (bez wysyłki) — liczba do komunikatu w panelu.
export async function waitlistPending(base44, id) {
  const [r] = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.waitlist WHERE product_id = ${escStr(id)} AND notified_at IS NULL`, true);
  return r?.n || 0;
}

// Cała lista produktu partiami po 20 (premiera „wkrótce” → „dostępny”): każda osoba najwyżej raz,
// krótka przerwa między partiami. Limit partii chroni funkcję przed zjedzeniem całego czasu.
export async function notifyAll(base44, id, note = "", maxBatches = 20) {
  const sum = { sent: 0, queued: 0, failed: 0, batches: 0 };
  for (let i = 0; i < maxBatches; i++) {
    const r = await notifyBatch(base44, id, note);
    sum.sent += r.sent;
    sum.queued += r.queued;
    sum.failed += r.failed;
    sum.batches++;
    if (!r.left || r.sent + r.queued + r.failed === 0) break; // koniec listy albo nic nie poszło — bez zapętlenia
    await new Promise((res) => setTimeout(res, 700));
  }
  return sum;
}