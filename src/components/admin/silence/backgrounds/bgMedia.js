import { base44 } from "@/api/base44Client";

export const upload = (file) => base44.integrations.Core.UploadPublicFile({ file }).then((r) => r.file_url);

const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));

// Kompresja do WebP (Safari bez WebP → JPEG) z docelowym rozmiarem.
async function encode(c, targetKB) {
  let q = 0.86, blob;
  do {
    blob = await toBlob(c, "image/webp", q);
    if (blob.type !== "image/webp") blob = await toBlob(c, "image/jpeg", q);
    q -= 0.08;
  } while (blob.size > targetKB * 1024 && q > 0.3);
  return blob;
}

export async function compressImage(file, maxW, targetKB) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, maxW / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const blob = await encode(c, targetKB);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return { file: new File([blob], file.name.replace(/\.\w+$/, "") + "." + ext, { type: blob.type }), width: img.width, height: img.height };
}

const once = (el, ev) => new Promise((r) => el.addEventListener(ev, r, { once: true }));

// Długość, rozdzielczość, ścieżka dźwiękowa i pierwsza klatka jako poster.
export async function inspectVideo(file) {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  await once(v, "loadedmetadata");
  const info = { duration: Math.round(v.duration), width: v.videoWidth, height: v.videoHeight };
  await v.play().catch(() => {});
  await new Promise((r) => setTimeout(r, 700));
  v.pause();
  info.audio = !!(v.mozHasAudio || v.webkitAudioDecodedByteCount > 0 || v.audioTracks?.length > 0);
  v.currentTime = 0.05;
  await once(v, "seeked");
  const c = document.createElement("canvas");
  const s = Math.min(1, 1920 / v.videoWidth);
  c.width = Math.round(v.videoWidth * s);
  c.height = Math.round(v.videoHeight * s);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  const blob = await encode(c, 300);
  info.poster = new File([blob], "poster." + (blob.type === "image/webp" ? "webp" : "jpg"), { type: blob.type });
  URL.revokeObjectURL(url);
  return info;
}