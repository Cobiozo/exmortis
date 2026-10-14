// PDF biletu: wzór wgrany w panelu (obraz na całą stronę) albo wzór domyślny exmortis,
// a na nim imię i nazwisko, kod QR i numer biletu — w miejscach ustawionych w panelu.
import { PDFDocument, rgb } from "npm:@cantoo/pdf-lib@2.4.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import QRCode from "npm:qrcode@1.5.4";
import { APP_URL } from "./settings.ts";

export const FONTS = { cinzel: "Cinzel-SemiBold.ttf", garamond: "EBGaramond-Medium.ttf", inter: "Inter-SemiBold.ttf", mono: "SpaceMono-Bold.ttf" };

// Domyślne położenie pól na wgranym wzorze (ułamki szerokości/wysokości strony; y = środek tekstu).
export const DEFAULT_LAYOUT = {
  name: { x: 0.36, y: 0.62, size: 0.042, color: "#F5EFE1", font: "cinzel", align: "center" },
  qr: { x: 0.74, y: 0.22, size: 0.2, dark: "#0A0A0B", light: "#FFFFFF" },
  code: { x: 0.84, y: 0.84, size: 0.024, color: "#C9A24A", font: "mono", align: "center" },
};

const cache = new Map<string, Uint8Array>();
let fontLoader: (name: string) => Promise<Uint8Array> = async (file) => {
  const url = `${APP_URL}/fonts/ticket/${file}`;
  if (cache.has(url)) return cache.get(url)!;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Czcionka biletu niedostępna (${r.status})`);
  const b = new Uint8Array(await r.arrayBuffer());
  cache.set(url, b);
  return b;
};
export const setFontLoader = (fn) => { fontLoader = fn; }; // testy

async function loadImage(src: string) {
  if (cache.has(src)) return cache.get(src)!;
  if (!/^https:\/\//.test(src)) throw new Error("Wzór biletu: niepoprawny adres obrazu");
  const r = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("Wzór biletu: nie udało się pobrać obrazu");
  const b = new Uint8Array(await r.arrayBuffer());
  if (b.length > 15 * 1024 * 1024) throw new Error("Wzór biletu jest za duży");
  if (cache.size > 30) cache.clear();
  cache.set(src, b);
  return b;
}

const hex = (h, fb = "#000000") => {
  const m = String(h || fb).match(/^#?([0-9a-f]{6})$/i) || String(fb).match(/^#?([0-9a-f]{6})$/i);
  const n = parseInt(m![1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const clamp = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };

export function cleanLayout(t) {
  const L = DEFAULT_LAYOUT;
  const txt = (o, d) => ({
    x: clamp(o?.x, 0, 1, d.x), y: clamp(o?.y, 0, 1, d.y), size: clamp(o?.size, 0.008, 0.2, d.size),
    color: /^#[0-9a-f]{6}$/i.test(o?.color) ? o.color : d.color, font: FONTS[o?.font] ? o.font : d.font,
    align: ["left", "center", "right"].includes(o?.align) ? o.align : d.align, upper: o?.upper === true,
  });
  return {
    src: typeof t?.src === "string" && /^https:\/\//.test(t.src) ? t.src.slice(0, 1000) : null,
    w: clamp(t?.w, 1, 20000, 0), h: clamp(t?.h, 1, 20000, 0),
    name: txt(t?.name, L.name), code: txt(t?.code, L.code),
    qr: { x: clamp(t?.qr?.x, 0, 1, L.qr.x), y: clamp(t?.qr?.y, 0, 1, L.qr.y), size: clamp(t?.qr?.size, 0.06, 0.6, L.qr.size),
      dark: /^#[0-9a-f]{6}$/i.test(t?.qr?.dark) ? t.qr.dark : L.qr.dark, light: /^#[0-9a-f]{6}$/i.test(t?.qr?.light) ? t.qr.light : L.qr.light },
  };
}

// Kod QR rysowany wektorowo (ostry w każdym wydruku), z białym marginesem — czytelny także na ciemnym wzorze.
function drawQr(page, text, x, yTop, size, dark, light) {
  const q = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = q.modules.size, quiet = 2;
  const cell = size / (n + quiet * 2);
  page.drawRectangle({ x, y: yTop - size, width: size, height: size, color: hex(light, "#FFFFFF") });
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!q.modules.get(r, c)) { c++; continue; }
      let e = c; while (e < n && q.modules.get(r, e)) e++;
      page.drawRectangle({ x: x + (quiet + c) * cell, y: yTop - (quiet + r + 1) * cell, width: (e - c) * cell + 0.02, height: cell + 0.02, color: hex(dark, "#000000") });
      c = e;
    }
  }
}

// Tekst w punkcie (x, środek y), z dopasowaniem wielkości do szerokości.
function drawFit(page, text, font, o, W, H, maxW) {
  const s = o.upper ? text.toUpperCase() : text;
  let size = o.size * W;
  while (size > 6 && font.widthOfTextAtSize(s, size) > maxW) size -= 0.5;
  const w = font.widthOfTextAtSize(s, size);
  const x0 = o.x * W, yc = H - o.y * H;
  const x = o.align === "center" ? x0 - w / 2 : o.align === "right" ? x0 - w : x0;
  page.drawText(s, { x, y: yc - size * 0.35, size, font, color: hex(o.color) });
}

const plWhen = (iso) => {
  const f = (o) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", ...o }).format(new Date(iso));
  return `${f({ weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${f({ hour: "2-digit", minute: "2-digit" })}`;
};

function wrap(font, text, size, maxW, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…"; }
  return lines;
}

// tickets: [{ holder_name, code (ABC-1234), qr (adres) }] — jedna strona na bilet.
export async function renderTicketsPdf(ev, template, tickets) {
  const t = cleanLayout(template);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {};
  const font = async (k) => (fonts[k] ||= await doc.embedFont(await fontLoader(FONTS[k]), { subset: true }));
  doc.setTitle(`Bilet — ${ev.title || "exmortis"}`);
  doc.setAuthor("exmortis");
  doc.setProducer("exmortis");

  let bg = null, W = 842, H = 340;
  if (t.src) {
    const bytes = await loadImage(t.src);
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    bg = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    // Strona w proporcjach wzoru; dłuższy bok = 842 pt (A4).
    const r = bg.height / bg.width;
    if (r <= 1) { W = 842; H = 842 * r; } else { H = 842; W = 842 / r; }
  }

  for (const k of tickets) {
    const page = doc.addPage([W, H]);
    if (bg) {
      page.drawImage(bg, { x: 0, y: 0, width: W, height: H });
      const q = t.qr, qs = q.size * W;
      drawQr(page, k.qr, q.x * W, H - q.y * H, qs, q.dark, q.light);
      const maxW = (o) => Math.max(40, ((o.align === "center" ? Math.min(o.x, 1 - o.x) * 2 : o.align === "right" ? o.x : 1 - o.x) - 0.04) * W);
      drawFit(page, k.holder_name, await font(t.name.font), t.name, W, H, maxW(t.name));
      drawFit(page, k.code, await font(t.code.font), t.code, W, H, maxW(t.code));
      continue;
    }
    // Wzór domyślny: czerń i złoto, część z danymi i odcinek z kodem QR.
    const gold = hex("#C9A24A"), cream = hex("#F5EFE1"), grey = hex("#8A8A8C");
    const [fc, fi, fm] = [await font("cinzel"), await font("inter"), await font("mono")];
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: hex("#0A0A0B") });
    page.drawRectangle({ x: 14, y: 14, width: W - 28, height: H - 28, borderColor: gold, borderWidth: 1, opacity: 0 });
    page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40, borderColor: gold, borderWidth: 0.4, borderOpacity: 0.4, opacity: 0 });
    const stubX = W - 250;
    for (let y = 30; y < H - 30; y += 10) page.drawLine({ start: { x: stubX, y }, end: { x: stubX, y: y + 5 }, thickness: 0.8, color: gold, opacity: 0.6 });
    page.drawText("EXMORTIS · BILET", { x: 48, y: H - 62, size: 10, font: fm, color: gold });
    const tl = wrap(fc, ev.title || "", 24, stubX - 96);
    tl.forEach((l, i) => page.drawText(l, { x: 48, y: H - 102 - i * 30, size: 24, font: fc, color: cream }));
    let y = H - 102 - tl.length * 30 - 6;
    if (ev.start_datetime) { page.drawText(`${plWhen(ev.start_datetime)} (czas polski)`, { x: 48, y, size: 11, font: fi, color: grey }); y -= 18; }
    page.drawText(ev.format === "Online" ? "Online — link w e-mailu i w Moim koncie" : String(ev.location || "Miejsce podam w e-mailu").slice(0, 90), { x: 48, y, size: 11, font: fi, color: grey });
    page.drawText("UCZESTNIK", { x: 48, y: 92, size: 9, font: fm, color: gold });
    let ns = 26;
    while (ns > 10 && fc.widthOfTextAtSize(k.holder_name, ns) > stubX - 96) ns -= 1;
    page.drawText(k.holder_name, { x: 48, y: 60, size: ns, font: fc, color: cream });
    const qs = 150, qx = stubX + (W - 20 - stubX - qs) / 2;
    drawQr(page, k.qr, qx, H - 52, qs, "#0A0A0B", "#FFFFFF");
    const cw = fm.widthOfTextAtSize(k.code, 18);
    page.drawText(k.code, { x: qx + (qs - cw) / 2, y: H - 52 - qs - 30, size: 18, font: fm, color: gold });
    const note = "Pokaż przy wejściu";
    page.drawText(note, { x: qx + (qs - fi.widthOfTextAtSize(note, 9)) / 2, y: H - 52 - qs - 48, size: 9, font: fi, color: grey });
    page.drawText("Bilet imienny · jedno wejście · exmortis.pl", { x: 48, y: 30, size: 8, font: fi, color: grey, opacity: 0.8 });
  }
  return await doc.save();
}
