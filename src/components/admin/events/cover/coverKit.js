import { base44 } from "@/api/base44Client";

// Kadry generowane z jednego pliku (punkt skupienia) + docelowe rozmiary plików.
export const CROPS = [
  { key: "wide", label: "16:9 · nagłówek komputer", w: 1920, h: 1080, kb: 350, type: "image/webp" },
  { key: "tall", label: "4:5 · nagłówek telefon", w: 1080, h: 1350, kb: 250, type: "image/webp" },
  { key: "tile", label: "3:2 · kafelek", w: 900, h: 600, kb: 120, type: "image/webp" },
  { key: "og", label: "1200×630 · udostępnianie", w: 1200, h: 630, kb: 200, type: "image/webp" },
  { key: "mail", label: "1200×600 · e-mail", w: 1200, h: 600, kb: 150, type: "image/jpeg" },
];
export const SOCIAL = [
  { key: "post", label: "Post 1080×1350", w: 1080, h: 1350 },
  { key: "story", label: "Relacja 1080×1920", w: 1080, h: 1920 },
  { key: "fb", label: "Wydarzenie FB 1920×1005", w: 1920, h: 1005 },
];
export const LOGO = "/exmortis-logo-okladka.jpg";

export const loadImg = (src) => new Promise((ok, no) => {
  const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => no(new Error("Nie udało się wczytać obrazu.")); i.src = src;
});

// Rysuje obraz „cover” wokół punktu skupienia.
export function drawCover(ctx, img, w, h, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  const x = Math.min(0, Math.max(w - dw, w / 2 - fx * dw));
  const y = Math.min(0, Math.max(h - dh, h / 2 - fy * dh));
  ctx.drawImage(img, x, y, dw, dh);
}

const toBlob = (c, type, q) => new Promise((ok) => c.toBlob(ok, type, q));
async function compress(canvas, type, kb) {
  let q = 0.86, b = await toBlob(canvas, type, q);
  while (b.size > kb * 1024 && q > 0.4) { q -= 0.08; b = await toBlob(canvas, type, q); }
  return b;
}

export async function makeCrops(img, fx, fy, onProgress) {
  const out = {};
  for (let i = 0; i < CROPS.length; i++) {
    const c = CROPS[i];
    const cv = Object.assign(document.createElement("canvas"), { width: c.w, height: c.h });
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#0A0A0B"; ctx.fillRect(0, 0, c.w, c.h);
    drawCover(ctx, img, c.w, c.h, fx, fy);
    const blob = await compress(cv, c.type, c.kb);
    const file = new File([blob], `okladka-${c.key}.${c.type === "image/jpeg" ? "jpg" : "webp"}`, { type: c.type });
    out[c.key] = (await base44.integrations.Core.UploadPublicFile({ file })).file_url;
    onProgress?.((i + 1) / CROPS.length);
  }
  return out;
}

// Średnia jasność (0–1) środkowo-dolnej części obrazu, gdzie leży tekst.
export function lumaOf(img) {
  const cv = Object.assign(document.createElement("canvas"), { width: 64, height: 36 });
  const ctx = cv.getContext("2d");
  drawCover(ctx, img, 64, 36);
  const d = ctx.getImageData(0, 12, 64, 24).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    s += 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return s / (d.length / 4);
}

// Kontrast kremowego tekstu (#F5EFE1, L≈0.87) na tle po przyciemnieniu.
export const contrastFor = (luma, dim) => (0.87 + 0.05) / (luma * (1 - dim / 100) + 0.05);
// Minimalne przyciemnienie (%) dające 4,5:1.
export const minDimFor = (luma) => Math.max(0, Math.min(80, Math.ceil((1 - (0.92 / 4.5 - 0.05) / Math.max(luma, 0.001)) * 100)));