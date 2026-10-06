import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, textField, emailField } from "../../shared/supabase.ts";
import { insertOrder } from "../../shared/orders.ts";
import { addSubscriber } from "../../shared/newsletter.ts";
import { getSetting } from "../../shared/settings.ts";
import { sendMail } from "../../shared/smtp.ts";
import { grantAccess } from "../../shared/access.ts";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Zamówienie bezpłatnego materiału: zapis zgód (z datą i godziną),
// wysyłka e-maila z linkiem do pobrania pliku.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const name = textField(body, "name", { max: 100 });
    const email = emailField(body);
    const phone = textField(body, "phone", { max: 40, required: false }) || "";
    const slug = String(body.slug || "").trim();
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Brak produktu");

    const phoneConsent = body.phone_consent === true && phone !== "";
    const newsletterConsent = body.newsletter_consent === true;

    await runSql(
      base44,
      `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS file_url text`
    );
    const rows = await runSql(
      base44,
      `SELECT id, name, is_free, active, COALESCE(status, 'dostępny') AS status, file_url, product_type
       FROM public.products WHERE slug = ${escStr(slug)} LIMIT 1`,
      true
    );
    const product = rows && rows.length > 0 ? rows[0] : null;
    if (
      !product ||
      product.active === false ||
      product.status === "ukryty" ||
      product.is_free !== true
    ) {
      throw new Error("Ten materiał nie jest już dostępny");
    }

    const firstName = name.split(" ")[0] || name;
    await insertOrder(base44, {
      id: crypto.randomUUID(),
      buyerName: name,
      buyerEmail: email,
      buyerPhone: phone || null,
      note: `Bezpłatne pobranie: ${product.name}`,
      items: [{ name: product.name, quantity: 1, unitPrice: 0 }],
      total: 0,
      status: "FREE",
      phoneConsent,
      newsletterConsent,
    });

    if (newsletterConsent) {
      await addSubscriber(base44, { email, name, consentGiven: true });
    }

    // Jeśli istnieje konto na ten e-mail — materiał trafia też do „Moich produktów”.
    const hasAccount = (await base44.asServiceRole.entities.User.filter({ email: email.toLowerCase() })).length > 0;
    if (hasAccount && ["pdf", "audio", "wideo", "kurs"].includes(product.product_type)) {
      await grantAccess(base44, {
        email,
        product: { id: product.id, name: product.name, product_type: product.product_type || "pdf", access_months: null },
        source: "darmowy",
      });
    }

    const fileUrl = String(product.file_url || "").trim();
    const smtp = await getSetting(base44, "smtp");
    await sendMail(smtp, {
      to: email,
      subject: `Twój materiał: ${product.name}`,
      html: `
      <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
        <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
        <p style="color:#8A8A8C;line-height:1.7;">${escapeHtml(firstName)},</p>
        <p style="line-height:1.7;color:#E2E2E2;">dziękuję, że sięgnąłeś po <strong>${escapeHtml(
          product.name
        )}</strong>.</p>
        ${
          fileUrl
            ? `<p style="line-height:1.7;color:#E2E2E2;">Twój plik pobierzesz tutaj:<br>
               <a href="${escapeHtml(fileUrl)}" style="color:#C9A24A;">${escapeHtml(fileUrl)}</a></p>`
            : ""
        }
        <p style="line-height:1.7;color:#8A8A8C;">Powrót nie kończy się na jednym kroku — dopiero się nim zaczyna.</p>
        <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
      </div>`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}