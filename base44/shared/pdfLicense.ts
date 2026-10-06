import { PDFDocument, StandardFonts, rgb } from "npm:@cantoo/pdf-lib@2.4.1";

// Osobista kopia PDF: napis licencji na każdej stronie, ukryte znaczniki, metadane, blokada edycji.
export async function personalizePdf(bytes: Uint8Array, o: { email: string; orderNo: string; date: string; licenseId: string; title: string }) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const label = `Licencja osobista: ${o.email} · zam. ${o.orderNo} · ${o.date}`;
  const pages = doc.getPages();
  const hidden = new Set<number>();
  for (let i = 0; i < Math.min(3, pages.length); i++) hidden.add(Math.floor(Math.random() * pages.length));

  pages.forEach((page, i) => {
    const { height } = page.getSize();
    // Okładka (strona 1) zwykle ciemna — kolor kremowy; pozostałe szare.
    const color = i === 0 ? rgb(0.96, 0.94, 0.88) : rgb(0.45, 0.45, 0.45);
    page.drawText(label, { x: 14, y: height - 14, size: 7, font, color, opacity: 0.55 });
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