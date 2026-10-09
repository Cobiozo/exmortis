import nodemailer from "npm:nodemailer@6.9.13";
import { FIRMA } from "./settings.ts";
import { firmaFooter } from "./firma.ts";

// Wysyłka maila SMTP z ustawień zapisanych w panelu (app_settings → smtp).

export async function sendMail(smtp, { to, subject, html, attachments }) {
  if (!smtp || !smtp.host || !smtp.user || !smtp.password) {
    throw new Error("SMTP nie jest skonfigurowany");
  }
  const port = Number(smtp.port) || 587;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port,
    secure: port === 465,
    auth: { user: smtp.user, pass: smtp.password },
  });
  await transporter.sendMail({
    from: smtp.from || smtp.user,
    to,
    subject,
    html: html + firmaFooter(FIRMA),
    ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
  });
}

export function orderEmailHtml(buyerName, items, total) {
  const rows = items
    .map(
      (p) =>
        `<tr><td style="padding:8px 0;color:#E2E2E2;">${p.name} × ${p.quantity}</td><td style="padding:8px 0;text-align:right;color:#C9A24A;">${p.quantity * p.unitPrice / 100} zł</td></tr>`
    )
    .join("");
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    <h1 style="font-size:26px;letter-spacing:1px;">Próg przekroczony</h1>
    <p style="color:#8A8A8C;line-height:1.7;">${buyerName}, Twoja płatność została przyjęta.
    Dostęp i szczegóły wyślę w kolejnej wiadomości — pierwszy ruch jest już za Tobą.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${rows}
      <tr><td style="padding-top:12px;border-top:1px solid #3D3D3F;color:#8A8A8C;">RAZEM</td>
      <td style="padding-top:12px;border-top:1px solid #3D3D3F;text-align:right;color:#C9A24A;font-size:18px;">${total} zł</td></tr>
    </table>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
  </div>`;
}

// Treść kampanii newslettera opakowana w ciemną oprawę marki.
export function campaignEmailHtml(content, name) {
  const greeting = name ? `<p style="color:#8A8A8C;">${name},</p>` : "";
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    ${greeting}
    <div style="line-height:1.7;color:#E2E2E2;">${content}</div>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
    <p style="color:#3D3D3F;font-size:11px;">Nie chcesz więcej dostawać? Odpowiedz na ten list z jednym słowem: STOP.</p>
  </div>`;
}