// Tworzy wersje WebP z płótna (ponowne kodowanie usuwa EXIF/GPS) i dopisuje XMP z prawami autorskimi.
const COPY = "© exmortis.pl — wszelkie prawa zastrzeżone";
const xmp = () => new TextEncoder().encode(
  `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${COPY}</rdf:li></rdf:Alt></dc:rights><xmpRights:Marked>True</xmpRights:Marked></rdf:Description></rdf:RDF></x:xmpmeta>`);

const chunk = (tag, data) => {
  const pad = data.length % 2;
  const out = new Uint8Array(8 + data.length + pad);
  out.set(new TextEncoder().encode(tag), 0);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
};

function addXmp(buf, w, h) {
  const src = new Uint8Array(buf);
  if (new TextDecoder().decode(src.slice(12, 16)) === "VP8X") return src;
  const body = src.slice(12); // VP8 / VP8L
  const isLossless = new TextDecoder().decode(body.slice(0, 4)) === "VP8L";
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x04 | (isLossless ? 0 : 0); // flaga XMP
  const W = w - 1, H = h - 1;
  vp8x.set([W & 255, (W >> 8) & 255, (W >> 16) & 255, H & 255, (H >> 8) & 255, (H >> 16) & 255], 4);
  const parts = [chunk("VP8X", vp8x), body, chunk("XMP ", xmp())];
  const size = parts.reduce((n, p) => n + p.length, 4);
  const out = new Uint8Array(8 + size);
  out.set(new TextEncoder().encode("RIFF"), 0);
  new DataView(out.buffer).setUint32(4, size, true);
  out.set(new TextEncoder().encode("WEBP"), 8);
  let o = 12;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function stamp(ctx, w, h) {
  const fs = Math.max(11, Math.round(w / 55));
  ctx.font = `${fs}px Inter, Arial, sans-serif`;
  ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillText("exmortis.pl", w - fs + 1, h - fs * 0.6 + 1);
  ctx.fillStyle = "rgba(226,226,226,0.45)"; ctx.fillText("exmortis.pl", w - fs, h - fs * 0.6);
}

export async function makeVariant(bmp, width, watermark) {
  const s = Math.min(1, width / bmp.width);
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  if (watermark) stamp(ctx, w, h);
  const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.82));
  const bytes = addXmp(await blob.arrayBuffer(), w, h);
  return { file: new File([bytes], `${w}.webp`, { type: "image/webp" }), w, h };
}