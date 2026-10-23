import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../../shared/rateLimit.ts";
import { insertOrder } from "../../shared/orders.ts";
import { addSubscriber } from "../../shared/newsletter.ts";
import { getSetting } from "../../shared/settings.ts";
import { sendMail, adminTo } from "../../shared/smtp.ts";
import { grantAccess } from "../../shared/access.ts";
import { expandBundles } from "../../shared/bundles.ts";
import { personalizePdf, newLicenseId } from "../../shared/pdfLicense.ts";

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

    const rows = await runSql(
      base44,
      `SELECT id, name, is_free, active, COALESCE(status, 'dostępny') AS status, file_url, private_file_uri, product_type, access_months
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

    // Materiał idzie e-mailem na podany adres — limit chroni przed wysyłką na cudze adresy seriami.
    if (!(await ipAllowed(base44, clientIp(req), "darmowy", 5, 3600000, slug))) return Response.json({ error: TOO_MANY }, { status: 429 });

    const firstName = name.split(" ")[0] || name;
    const orderId = crypto.randomUUID();
    await insertOrder(base44, {
      id: orderId,
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

    // Jeśli istnieje konto na ten e-mail — materiał trafia też do „Moich produktów” (pakiet: jego składniki).
    const hasAccount = (await base44.asServiceRole.entities.User.filter({ email: email.toLowerCase() })).length > 0;
    if (hasAccount) {
      if (product.product_type === "pakiet") {
        for (const it of await expandBundles(base44, [product])) {
          await grantAccess(base44, { email, product: it, source: "darmowy" });
        }
      } else if (["pdf", "audio", "wideo", "kurs"].includes(product.product_type)) {
        await grantAccess(base44, {
          email,
          product: { id: product.id, name: product.name, product_type: product.product_type || "pdf", access_months: null },
          source: "darmowy",
        });
      }
    }

    // PDF: osobista kopia ze znakiem wodnym (e-mail pobierającego w lewym górnym rogu każdej strony),
    // wysyłana podpisanym linkiem ważnym 7 dni. Surowy plik nie trafia do maila.
    let fileUrl = String(product.file_url || "").trim();
    let linkDays = 0;
    const src = product.private_file_uri || fileUrl;
    if (src && (product.product_type === "pdf" || /\.pdf(\?|$)/i.test(src))) {
      try {
        const sr = base44.asServiceRole;
        const { signed_url } = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: src, expires_in: 300 });
        const orig = new Uint8Array(await (await fetch(signed_url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
        const out = await personalizePdf(orig, {
          email, orderNo: orderId.slice(0, 8).toUpperCase(), licenseId: newLicenseId(), title: product.name,
          date: new Date().toISOString().slice(0, 10),
        });
        const safe = String(product.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "material";
        const { file_uri } = await sr.integrations.Core.UploadPrivateFile({ file: new File([out], `${safe}_exmortis.pdf`, { type: "application/pdf" }) });
        fileUrl = (await sr.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 604800 })).signed_url;
        linkDays = 7;
        await sr.entities.SecurityLog.create({ type: "pdf", user_email: email, ip: clientIp(req), details: `darmowy: ${product.name}` }).catch(() => {});
      } catch (e) {
        // Bez kopii ze znakiem wodnym nie wysyłamy surowego pliku — mail informuje, że plik dojdzie osobno.
        console.error("orderFree: znak wodny", e?.message || e);
        fileUrl = "";
        await sendMail(base44, { kind: "alert", to: await adminTo(base44).catch(() => null), subject: `Darmowy PDF nie wysłany: ${product.name}`,
          html: `<p>Nie udało się przygotować kopii ze znakiem wodnym dla ${escapeHtml(email)} (${escapeHtml(String(e?.message || e).slice(0, 200))}). Wyślij plik ręcznie.</p>` }).catch(() => {});
      }
    }
    await sendMail(base44, {
      kind: "zamowienie",
      to: email,
      subject: `Twój materiał: ${product.name}`,
      html: `
      <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
        <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
        <p style="color:#8A8A8C;line-height:1.7;">${escapeHtml(firstName)},</p>
        <p style="line-height:1.7;color:#E2E2E2;">dziękuję za sięgnięcie po <strong>${escapeHtml(
          product.name
        )}</strong>.</p>
        ${
          fileUrl
            ? `<p style="line-height:1.7;color:#E2E2E2;">Twój plik jest gotowy do pobrania.</p>
               <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="background:#C9A24A;">
                 <a href="${escapeHtml(fileUrl)}" style="display:inline-block;padding:14px 30px;color:#0A0A0B;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:3px;font-weight:bold;">POBIERZ PLIK</a>
               </td></tr></table>${linkDays ? `<p style="font-size:12px;color:#8A8A8C;line-height:1.6;">Link jest ważny ${linkDays} dni. Plik jest Twoją osobistą kopią — oznaczoną Twoim adresem e-mail.</p>` : ""}`
            : `<p style="line-height:1.7;color:#E2E2E2;">Przygotowuję Twoją osobistą kopię — wyślę ją w osobnej wiadomości.</p>`
        }
        <p style="line-height:1.7;color:#8A8A8C;">Powrót nie kończy się na jednym kroku — dopiero się nim zaczyna.</p>
        <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
      </div>`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    // Błąd danych z formularza = 400, reszta = 500.
    const bad = /^(Brak pola|Pole .* jest zbyt długie|Niepoprawny adres e-mail|Brak produktu|Ten materiał)/.test(String(error?.message || ""));
    return Response.json({ error: error.message }, { status: bad ? 400 : 500 });
  }
}