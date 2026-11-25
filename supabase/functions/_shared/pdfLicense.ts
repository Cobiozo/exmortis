// Biblioteka PDF ładowana leniwie — dopiero przy generowaniu pliku, nie przy starcie funkcji.
// Statyczny import (npm albo esm.sh) wywalał całą funkcję błędem BOOT_ERROR; tutaj start jest
// lekki, a gdy biblioteka się nie wczyta, błąd wychodzi tylko z tworzenia PDF.
// esm.sh konwertuje paczkę CommonJS (wraz z zależnością @pdf-lib/standard-fonts) na ESM z nazwanymi
// eksportami — npm: w Supabase Edge tego nie robi i import wywalał się na „does not provide an export named FontNames”.
// Kolejność: esm.sh, potem npm:, a gdy oba zawiodą — błąd zawierający komunikaty z obu prób.
let _pdf: any = null;
const pickPdf = (m: any) => (m?.PDFDocument ? m : m?.default);

async function pdfLib() {
  if (_pdf) return _pdf;
  const errs: string[] = [];
  try {
    const lib = pickPdf(await import("https://esm.sh/@cantoo/pdf-lib@2.4.1?bundle&target=deno"));
    if (lib?.PDFDocument) { _pdf = lib; return _pdf; }
    errs.push("esm.sh: brak PDFDocument");
  } catch (e) {
    errs.push(`esm.sh: ${String((e as any)?.message || e)}`);
  }
  try {
    const lib = pickPdf(await import("npm:@cantoo/pdf-lib@2.4.1"));
    if (lib?.PDFDocument) { _pdf = lib; return _pdf; }
    errs.push("npm: brak PDFDocument");
  } catch (e) {
    errs.push(`npm: ${String((e as any)?.message || e)}`);
  }
  throw new Error(`Nie udało się wczytać biblioteki PDF — ${errs.join(" | ")}`);
}

// Wersja oznaczeń — zmiana wymusza ponowne wygenerowanie zapisanych kopii.
export const WM_VERSION = "wm4"; // wm4 (26.11.2026): napisy niezależne od przesunięć w treści strony

// Osobista kopia PDF: napis licencji na każdej stronie, ukryte znaczniki, metadane, blokada edycji.
export async function personalizePdf(bytes: Uint8Array, o: { email: string; orderNo: string; date: string; licenseId: string; title: string }) {
  const lib = await pdfLib();
  const { PDFDocument, StandardFonts, rgb, degrees } = lib;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Treść strony bywa zostawiona z przesuniętym układem współrzędnych (brak q/Q w pliku z programu DTP) —
  // wtedy napisy dopisane na końcu lądowały częściowo poza stroną. Otaczamy oryginał parą q…Q, więc
  // napisy licencji rysują się zawsze w czystym układzie strony.
  const wrap = (page) => {
    try {
      const ctx = doc.context;
      const push = ctx.register(lib.PDFContentStream.of(ctx.obj({}), [lib.pushGraphicsState()]));
      const pop = ctx.register(lib.PDFContentStream.of(ctx.obj({}), [lib.popGraphicsState()]));
      page.node.wrapContentStreams(push, pop);
    } catch (e) {
      console.warn("pdfLicense: bez otoczenia q/Q", (e as any)?.message);
    }
  };
  // Lewy górny róg: zaczyna się od adresu e-mail osoby, która kupiła lub pobrała plik.
  const label = `${o.email} · licencja osobista · zam. ${o.orderNo} · ${o.date}`;
  const pages = doc.getPages();
  const hidden = new Set<number>();
  for (let i = 0; i < Math.min(3, pages.length); i++) hidden.add(Math.floor(Math.random() * pages.length));

  const diag = `${o.email} · ${o.orderNo}`;
  pages.forEach((page, i) => {
    wrap(page);
    const { width, height } = page.getSize();
    // Okładka (strona 1) zwykle ciemna — kolor kremowy; pozostałe szare.
    const color = i === 0 ? rgb(0.96, 0.94, 0.88) : rgb(0.45, 0.45, 0.45);
    // Uwzględnia przycięcie strony (CropBox) — napis zawsze tuż przy widocznej krawędzi, nie poza nią.
    const box = page.getCropBox ? page.getCropBox() : { x: 0, y: 0, width, height };
    // Napis wyśrodkowany i nie szerszy niż 80% widocznej strony — z zapasem po obu stronach,
    // więc nie ucina się przy krawędzi (26.11.2026: wcześniej stał 4 pt od lewej i bywał ucięty).
    const unit = Math.max(1, font.widthOfTextAtSize(label, 1));
    const fit = (max) => Math.max(4, Math.min(max, (box.width * 0.8) / unit));
    const centerX = (size) => box.x + (box.width - unit * size) / 2;
    const top = fit(7), bottom = fit(6);
    page.drawText(label, { x: centerX(top), y: box.y + box.height - 12, size: top, font, color, opacity: 0.7 });
    page.drawText(label, { x: centerX(bottom), y: box.y + 9, size: bottom, font, color, opacity: 0.45 });
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

  // TODO po premierze: przywrócić blokadę edycji (crypto-js w esm.sh).
  // Do premiery plik wychodzi ze znakiem wodnym, ale bez szyfrowania: encrypt() wywalał się na
  // „oe.default.MD5 is not a function” i pozbawiał kupującego pliku. Sam znak wodny wystarcza.
  try {
    await doc.encrypt({
      userPassword: "",
      ownerPassword: crypto.randomUUID(),
      permissions: { printing: "highResolution", copying: true, contentAccessibility: true, modifying: false, annotating: false, fillingForms: false, documentAssembly: false },
    });
  } catch (e) {
    console.warn("pdfLicense: blokada edycji pominięta (decyzja właściciela 28.10)", (e as any)?.message);
  }
  return await doc.save();
}

export function newLicenseId() {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return "EXM-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}