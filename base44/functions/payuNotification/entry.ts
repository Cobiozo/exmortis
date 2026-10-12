import { createHash } from "node:crypto";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getSetting, loadAppUrl, APP_URL } from "../../shared/settings.ts";
import { getOrderByPayuId, updateOrderStatus, claimCompletion, releaseCompletion } from "../../shared/orders.ts";
import { sendMail, orderEmailHtml, adminTo } from "../../shared/smtp.ts";
import { runSql, rpc, escStr } from "../../shared/supabase.ts";
import { DIGITAL, grantAccess, ensureAccount } from "../../shared/access.ts";
import { randomToken, sha256hex } from "../../shared/booking.ts";

// KROK 2: „Rozmowa na progu” — zakup produktu wskazanego w panelu zakłada pakiet sesji.
// Idempotentnie po numerze zamówienia; każde wywołanie w try/catch, żeby błąd pakietu
// nigdy nie zepsuł obsługi samego zamówienia.
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

// Webhook powiadomień PayU — wywoływany z serwerów PayU bez sesji użytkownika.
// Autentyczność weryfikowana podpisem OpenPayU (MD5: treść + drugi klucz).

export default async function (req) {
  try {
    const raw = await req.text();
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);

    const payu = await getSetting(base44, "payu");
    if (!payu || !payu.secondKey) {
      return new Response("PayU not configured", { status: 400 });
    }

    const sigHeader = req.headers.get("openpayu-signature") || "";
    const parts = Object.fromEntries(
      sigHeader.split(";").map((p) => p.split("=")).filter((p) => p.length === 2)
    );
    // Algorytm z nagłówka (MD5 domyślnie; PayU może podpisywać też SHA-256).
    const algo = String(parts.algorithm || "MD5").toUpperCase().replace("-", "");
    const hashName = algo === "SHA256" ? "sha256" : algo === "SHA1" || algo === "SHA" ? "sha1" : "md5";
    const expected = createHash(hashName).update(raw + payu.secondKey).digest("hex");
    if (!parts.signature || parts.signature.toLowerCase() !== expected) {
      return new Response("Invalid signature", { status: 400 });
    }

    const body = JSON.parse(raw);
    const order = body.order || {};
    const payuOrderId = String(order.orderId || "");
    const status = String(order.status || "");
    if (!payuOrderId || !status) return Response.json({ ok: true });

    const stored = await getOrderByPayuId(base44, payuOrderId);
    if (!stored) return Response.json({ ok: true });
    if (status !== "COMPLETED") {
      await updateOrderStatus(base44, payuOrderId, status);
      return Response.json({ ok: true });
    }
    // Pierwsze COMPLETED przejmuje dokładnie jedno wywołanie — powtórki PayU nie dublują dostępu ani maili.
    if (!(await claimCompletion(base44, payuOrderId))) return Response.json({ ok: true });

    const items = Array.isArray(stored.items) ? stored.items : [];
    const granted = [];
    let newAccount = false;
    try {
      // Dostęp nadawany dopiero po potwierdzeniu płatności przez PayU (idempotentnie po numerze zamówienia).
      const ids = items.map((i) => i.product_id).filter(Boolean);
      if (ids.length && stored.buyer_email) {
        const rows = await runSql(
          base44,
          `SELECT id, name, product_type, access_months FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")})`,
          true
        );
        for (const p of rows.filter((r) => DIGITAL.includes(r.product_type))) {
          const until = await grantAccess(base44, { email: stored.buyer_email, product: p, source: "zakup", orderId: stored.id });
          granted.push({ name: p.name, until });
        }
        if (granted.length) newAccount = await ensureAccount(base44, stored.buyer_email);
      }
    } catch (e) {
      // Bez dostępu nie potwierdzamy — cofamy przejęcie, PayU ponowi powiadomienie.
      await releaseCompletion(base44, payuOrderId, stored.status).catch(() => {});
      throw e;
    }

    // Kod rabatowy liczony jako użyty dopiero po opłaceniu (porzucona płatność nie zużywa kodu).
    try {
      const m = [...String(stored.note || "").matchAll(/Kod rabatowy: (\S+) \(−/g)].pop();
      if (m) {
        const rec = (await base44.asServiceRole.entities.DiscountCode.filter({ code: m[1] }))[0];
        if (rec) await base44.asServiceRole.entities.DiscountCode.update(rec.id, { uses: (rec.uses || 0) + 1 });
      }
    } catch {
      // licznik kodu nie blokuje zamówienia
    }

    if (stored.buyer_email) {
      try {
        await sendMail(base44, {
          kind: "zamowienie", ref: stored.id,
          to: stored.buyer_email,
          subject: "EXMORTIS — płatność przyjęta",
          html: orderEmailHtml(stored.buyer_name || "", items, stored.total, stored.id, stored.invoice || null) + accessEmailHtml(granted, !!stored.digital_consent_text, newAccount, stored.buyer_email),
        });
      } catch {
        // e-mail potwierdzenia jest opcjonalny — nie blokuj ack dla PayU
      }
    }
    // Powiadomienie dla prowadzącego o opłaconym zamówieniu.
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
    } catch {
      // informacja dla admina nie blokuje zamówienia
    }
    // KROK 2: pakiet „Rozmowa na progu” — po obecnej logice, w try/catch.
    try {
      await grantThresholdPackage(base44, stored);
    } catch {
      // pakiet założymy ręcznie — zamówienie i tak jest obsłużone
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}