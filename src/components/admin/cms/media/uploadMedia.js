import { base44 } from "@/api/base44Client";
import { makeVariant } from "./webp";

export const WIDTHS = [480, 960, 1600, 2000];
export const mediaUrl = (pubId) => `/functions/media?id=${pubId}`;
const rid = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
const put = async (file) => (await base44.integrations.Core.UploadPrivateFile({ file })).file_uri;

// Wersje 480/960/1600/2000 px WebP (bez EXIF, z © w XMP) — wszystko w prywatnym magazynie.
async function buildVariants(source, watermark) {
  const bmp = await window.createImageBitmap(source);
  const widths = WIDTHS.filter((w, i) => i === 0 || w <= bmp.width || WIDTHS[i - 1] < bmp.width);
  const out = await Promise.all(widths.map((w) => makeVariant(bmp, w, watermark)));
  const uris = await Promise.all(out.map((v) => put(v.file)));
  const warianty = Object.fromEntries(widths.map((w, i) => [w, uris[i]]));
  const kb = Math.round(out[Math.min(1, out.length - 1)].file.size / 1024);
  return { warianty, szer: bmp.width, wys: bmp.height, rozmiar_kb: kb };
}

export async function uploadMedia(file) {
  const pub_id = rid();
  const [oryginal_uri, v] = await Promise.all([put(file), buildVariants(file, false)]);
  return base44.entities.MediaAsset.create({ pub_id, url: mediaUrl(pub_id), oryginal_uri, nazwa: file.name.replace(/\.[^.]+$/, ""), znak_wodny: false, ...v });
}

// Ponowne wygenerowanie wersji z oryginału (np. po włączeniu znaku wodnego).
export async function rebuildMedia(m, watermark) {
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: m.oryginal_uri, expires_in: 120 });
  const blob = await (await fetch(signed_url)).blob();
  const v = await buildVariants(blob, watermark);
  return base44.entities.MediaAsset.update(m.id, { ...v, znak_wodny: watermark });
}