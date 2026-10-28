// Biblioteka PDF z gotowej paczki ESM (esm.sh). Wersja przez npm nie startuje na Supabase
// (funkcja kończy się błędem BOOT_ERROR) — ten sam kod, ta sama wersja 2.4.1, gotowy moduł.
import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/@cantoo/pdf-lib@2.4.1?target=deno";

// Wersja oznaczeń — zmiana wymusza ponowne wygenerowanie zapisanych kopii.
export const WM_VERSION = "wm3";

// Osobista kopia PDF: napis licencji na każdej stronie, ukryte znaczniki, metadane, blokada edycji.
export async function personalizePdf(bytes: Uint8Array, o: { email: string; orderNo: string; date: string; licenseId: string; title: string }) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Lewy górny róg: zaczyna się od adresu e-mail osoby, która kupiła lub pobrała plik.
  const label = `${o.email} · licencja osobista · zam. ${o.orderNo} · ${o.date}`;
  const pages = doc.getPages();
  const hidden = new Set<number>();
  for (let i = 0; i < Math.min(3, pages.length); i++) hidden.add(Math.floor(Math.random() * pages.length));

  const diag = `${o.email} · ${o.orderNo}`;
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    // Okładka (strona 1) zwykle ciemna — kolor kremowy; pozostałe szare.
    const color = i === 0 ? rgb(0.96, 0.94, 0.88) : rgb(0.45, 0.45, 0.45);
    // Uwzględnia przycięcie strony (CropBox) — napis zawsze tuż przy widocznej krawędzi, nie poza nią.
    const box = page.getCropBox ? page.getCropBox() : { x: 0, y: 0, width, height };
    page.drawText(label, { x: box.x + 4, y: box.y + box.height - 8, size: 7, font, color, opacity: 0.7 });
    page.drawText(label, { x: 14, y: 8, size: 6, font, color, opacity: 0.45 });
    // Znak wodny po przekątnej przez środek strony — adres zamawiającego, trudny do wycięcia.
    const size = Math.max(14, Math.min(28, (Math.hypot(width, height) * 0.7) / Math.max(1, diag.length) * 1.9));
    const tw = font.widthOfTextAtSize(diag, size);
    const ang = Math.atan2(height, width);
    const cx = width / 2 - (Math.cos(ang) * tw) / 2 + (Math.sin(ang) * size) / 2;
    const cy = height / 2 - (Math.sin(ang) * tw) / 2 - (Math.cos(ang) * size) / 2;
    page.drawText(diag, { x: cx, y: cy, size, font, color: i === 0 ? rgb(1, 1, 1) : rgb(0.5, 0.5, 0.5), opacity: i === 0 ? 0.1 : 0.08, rotate: degrees((ang * 180) / Math.PI) });
    if (hidden.has(i)) page.drawText(`LIC ${o.licenseId}`, { x: 20, y: 20, size: 1, font, color: rgb(1, 1, 1) });
  });

  doc.setAuthor(`exmortis · licencja ${o.licenseId}`);
  doc.setSubject(`Zamówienie ${o.orderNo} · licencja ${o.licenseId}`);
  doc.setKeywords(["exmortis", `order:${o.orderNo}`, `license:${o.licenseId}`]);
  doc.setTitle(o.title);
  doc.setProducer("exmortis");

  await doc.encrypt({
    userPassword: "",
    ownerPassword: crypto.randomUUID(),
    permissions: { printing: "highResolution", copying: true, contentAccessibility: true, modifying: false, annotating: false, fillingForms: false, documentAssembly: false },
  });
  return await doc.save();
}

export function newLicenseId() {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return "EXM-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}