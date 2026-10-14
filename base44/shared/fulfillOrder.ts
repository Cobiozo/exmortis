// Realizacja opłaconego zamówienia: dostęp, kod rabatowy, karty podarunkowe, maile, pakiet sesji.
// Wspólne dla powiadomienia PayU i zamówień za 0 zł (bez bramki).
import { APP_URL } from "./settings.ts";
import { releaseCompletion } from "./orders.ts";
import { sendMail, orderEmailHtml, adminTo } from "./smtp.ts";
import { nextStep, nextStepHtml } from "./nextStep.ts";
import { issueGiftCards, giftCardsHtml } from "./giftCard.ts";
import { markCodeUsed } from "./discounts.ts";
import { issueOrderTickets, ticketsHtml, loadEvent } from "./tickets.ts";
import { runSql, rpc, escStr } from "./supabase.ts";
import { DIGITAL, grantAccess, ensureAccount } from "./access.ts";
import { randomToken, sha256hex } from "./booking.ts";

function packageEmailHtml(token) {
  const link = `${APP_URL}/rezerwacja/termin#t=${token}`;
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">
    <p style="color:#E2E2E2;margin:0 0 12px;">Płatność przyjęta. Zostało jedno: wybierz termin rozmowy.</p>
    <p style="margin:20px 0;"><a href="${link}" style="color:#C9A24A;">Wybierz termin</a></p>
    <p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Link jest jednorazowy i ważny 60 dni. Ten sam termin możesz wybrać w Moich sesjach na koncie, po zalogowaniu się tym adresem.</p>
  </div>`;
}

async function grantThresholdPackage(base44, stored) {
  const [s] = await runSql(base44, `SELECT threshold_product_id, threshold_type_id, threshold_sessions, threshold_valid_days FROM public.bk_settings WHERE id = 1`, true);
  if (!s?.threshold_product_id || !s?.threshold_type_id) return;
  const items = Array.isArray(stored.items) ? stored.items : [];
  const match = items.find((i) => String(i.product_id) === String(s.threshold_product_id));
  if (!match) return;
  const token = randomToken();
  const r = await rpc(base44, "bk_grant_package", { p: {
    order_id: String(stored.id), email: stored.buyer_email, type_id: s.threshold_type_id,
    sessions: (s.threshold_sessions || 1) * Math.max(1, Number(match.quantity) || 1),
    valid_days: s.threshold_valid_days || 60, token_hash: await sha256hex(token),
  } });
  if (r?.already || !r?.ok) return;
  await sendMail(base44, {
    kind: "pakiet", ref: stored.id, to: stored.buyer_email,
    subject: "EXMORTIS — wybierz termin rozmowy", html: packageEmailHtml(token),
  });
}

const PL_DATE = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

function accessEmailHtml(granted, consent, newAccount = false, email = "") {
  if (!granted.length) return "";
  const rows = granted
    .map((g) => `<p style="color:#E2E2E2;margin:0 0 6px;">${String(g.name).replace(/</g, "&lt;")} · Dostęp ${g.until ? `do ${PL_DATE(g.until)}` : "bezterminowo"}</p>`)
    .join("");
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">
    ${rows}
    <p style="margin:20px 0;"><a href="${APP_URL}/konto" style="color:#C9A24A;">Otwórz w Moich produktach</a></p>
    ${newAccount ? `<p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Konto założyłem na adres ${String(email).replace(/</g, "&lt;")}. Wejdź przez „Zaloguj przez Google” (jeśli to adres Gmail) albo ustaw hasło: na stronie logowania kliknij „Nie pamiętam hasła” i podaj ten adres.</p>` : ""}
    ${consent ? `<p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Potwierdzam Twoje żądanie dostarczenia treści cyfrowych przed upływem 14 dni od zawarcia umowy oraz przyjęcie do wiadomości utraty prawa odstąpienia od umowy z chwilą rozpoczęcia dostarczania.</p>` : ""}
    <p style="color:#5C5C5E;font-size:12px;line-height:1.6;">exmortis to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko: 116 123 · 800 70 2222 · w zagrożeniu życia 112.</p>
  </div>`;
}

// Wywołać po claimCompletion. Przy błędzie nadania dostępu cofa przejęcie i rzuca.
export async function fulfillOrder(base44, stored, payuOrderId) {
  const items = Array.isArray(stored.items) ? stored.items : [];
  const ids = items.map((i) => i.product_id).filter(Boolean);
  const granted = [];
  let newAccount = false;
  try {
    if (ids.length && stored.buyer_email) {
      const rows = await runSql(base44,
        `SELECT id, name, product_type, access_months FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")})`, true);
      for (const p of rows.filter((r) => DIGITAL.includes(r.product_type))) {
        const until = await grantAccess(base44, { email: stored.buyer_email, product: p, source: "zakup", orderId: stored.id });
        granted.push({ name: p.name, until });
      }
      if (granted.length) newAccount = await ensureAccount(base44, stored.buyer_email);
    }
  } catch (e) {
    await releaseCompletion(base44, payuOrderId, stored.status).catch(() => {});
    throw e;
  }

  // Kod rabatowy liczony jako użyty dopiero po opłaceniu. Bierzemy go z kolumny zamówienia, nigdy
  // z notatki — notatkę wpisuje kupujący, więc mógłby w niej podać cudzy kod karty podarunkowej
  // i wypalić go bez zakupu.
  try {
    const code = String(stored.discount_code || "").trim();
    if (code) {
      const rec = (await base44.asServiceRole.entities.DiscountCode.filter({ code }))[0];
      if (rec) await base44.asServiceRole.entities.DiscountCode.update(rec.id, { uses: (rec.uses || 0) + 1 });
      await markCodeUsed(base44, String(stored.id));
    }
  } catch { /* licznik kodu nie blokuje zamówienia */ }

  // Karty podarunkowe: powstają przed mailem, a nieudane wystawienie przerywa realizację.
  // Inaczej kupujący zapłaciłby za karty, których nie dostał, a powtórka nie miałaby czego dokończyć —
  // przejęcie cofnięte, więc PayU ponowi powiadomienie i komplet się dopełni.
  let cards = "";
  let cardIds = [];
  try {
    const cardRows = ids.length ? await runSql(base44, `SELECT id::text AS id FROM public.products WHERE product_type = 'karta' AND id::text IN (${ids.map(escStr).join(",")})`, true) : [];
    cardIds = cardRows.map((r) => String(r.id));
    if (cardIds.length) cards = giftCardsHtml(await issueGiftCards(base44, stored.id, items, cardIds, stored.buyer_email));
  } catch (e) {
    await releaseCompletion(base44, payuOrderId, stored.status).catch(() => {});
    throw e;
  }

  // Bilety na wydarzenia: numery, kody QR i zapis kupującego (niezależnie od wysyłki maila — są też w koncie).
  // Nieudane wystawienie przerywa realizację (przejęcie cofnięte, więc PayU ponowi) — inaczej kupujący
  // zapłaciłby za bilety, których nie ma, a powtórka nie miałaby czego dokończyć. Powtórka jest idempotentna
  // (numer zamówienia i numer pozycji), więc dopełnia tylko brakujące bilety.
  let issued = [];
  try {
    issued = await issueOrderTickets(base44, stored, items);
  } catch (e) {
    await releaseCompletion(base44, payuOrderId, stored.status).catch(() => {});
    throw e;
  }
  let tix = "";
  if (issued.length) {
    try {
      const evs = new Map();
      for (const id of [...new Set(issued.map((t) => t.event_id))]) evs.set(id, await loadEvent(base44, id));
      tix = ticketsHtml(issued, evs);
    } catch (e) { console.error("bilety — treść maila:", e?.message); }
  }

  if (stored.buyer_email) {
    try {
      // „Następny krok” dotyczy tego, co osoba kupiła dla siebie — karta podarunkowa go nie wyznacza,
      // a produkty, które już ma, są pomijane.
      const own = ids.map(String).filter((id) => !cardIds.includes(id) && !id.startsWith("bilet:"));
      const owned = await base44.asServiceRole.entities.Access.filter({ user_email: String(stored.buyer_email).toLowerCase() }, "-created_date", 200)
        .then((l) => l.filter((a) => !a.revoked).map((a) => String(a.product_id))).catch(() => []);
      const step = own.length ? await nextStep(base44, own, owned).then((s) => nextStepHtml(base44, s)).catch(() => "") : "";
      await sendMail(base44, {
        kind: "zamowienie", ref: stored.id, to: stored.buyer_email,
        subject: Number(stored.total) > 0 ? "EXMORTIS — płatność przyjęta" : "EXMORTIS — zamówienie przyjęte",
        html: orderEmailHtml(stored.buyer_name || "", items, stored.total, stored.id, stored.invoice || null) + accessEmailHtml(granted, !!stored.digital_consent_text, newAccount, stored.buyer_email) + tix + cards + step,
      });
    } catch { /* e-mail potwierdzenia jest opcjonalny */ }
  }
  try {
    const admin = await adminTo(base44);
    if (admin) {
      const list = items.map((i) => `${String(i.name).replace(/</g, "&lt;")} × ${Number(i.quantity) || 1}`).join("<br>");
      await sendMail(base44, {
        kind: "zamowienie_admin", ref: stored.id, to: admin,
        subject: `Nowe zamówienie: ${Number(stored.total || 0).toFixed(2).replace(".", ",")} zł`,
        html: `<p>${String(stored.buyer_name || "").replace(/</g, "&lt;")} (${String(stored.buyer_email || "").replace(/</g, "&lt;")})</p><p>${list}</p><p>Numer: ${String(stored.id).slice(0, 8).toUpperCase()}</p>${stored.invoice?.nip ? `<p><b>Faktura</b>: ${String(stored.invoice.company).replace(/</g, "&lt;")}, NIP ${String(stored.invoice.nip)}, ${String(stored.invoice.address).replace(/</g, "&lt;")}</p>` : ""}<p>Panel: Zamówienia.</p>`,
      });
    }
  } catch { /* informacja dla admina nie blokuje zamówienia */ }
  try { await grantThresholdPackage(base44, stored); } catch { /* pakiet ręcznie */ }
}