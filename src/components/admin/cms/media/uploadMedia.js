import { base44 } from "@/api/base44Client";

// Zmniejsza do max 2400 px i zapisuje jako WebP, potem wgrywa i dodaje do biblioteki.
async function toWebp(file) {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return { blob: file, w: 0, h: 0 };
  const bmp = await window.createImageBitmap(file);
  const s = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.82));
  return { blob: blob && blob.size < file.size ? blob : file, w, h };
}

export async function uploadMedia(file) {
  const { blob, w, h } = await toWebp(file);
  const name = file.name.replace(/\.[^.]+$/, "");
  const out = blob === file ? file : new File([blob], `${name}.webp`, { type: "image/webp" });
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: out });
  return base44.entities.MediaAsset.create({ url: file_url, nazwa: name, szer: w, wys: h, rozmiar_kb: Math.round(out.size / 1024) });
}