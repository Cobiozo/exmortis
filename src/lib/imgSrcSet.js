import { parseWixMediaUrl, buildTransformUrl } from "@/components/ui/image-helpers";

export const IMG_WIDTHS = [480, 960, 1600, 2000];

// Wersje WebP w kilku szerokościach dla obrazów z media.base44.com; dla innych adresów null.
export function mediaSrcSet(url) {
  let parsed = null;
  try { parsed = url ? parseWixMediaUrl(url) : null; } catch { parsed = null; }
  if (!parsed?.baseUrl) return null;
  const at = (w) => buildTransformUrl(parsed, { width: w, quality: 80 });
  return { src: at(960), srcSet: IMG_WIDTHS.map((w) => `${at(w)} ${w}w`).join(", ") };
}