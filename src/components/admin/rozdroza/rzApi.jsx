import React from "react";
import { base44 } from "@/api/base44Client";

// Wywołania funkcji rozdrozaAdmin (błąd z raportem walidacji, jeśli serwer go zwrócił).
export const rz = (action, p = {}) => base44.functions.invoke("rozdrozaAdmin", { action, ...p })
  .then((r) => r.data)
  .catch((e) => { const err = new Error(e?.response?.data?.error || "Nie udało się."); err.report = e?.response?.data?.report; throw err; });


export const statusBadge = (s) => s.status === "published"
  ? <span className={`technical text-[9px] px-2 py-1 border ${s.changed ? "border-[#E8C547]/60 text-[#E8C547]" : "border-[#9FD3A0]/50 text-[#9FD3A0]"}`}>{s.changed ? `OPUBLIKOWANA v${s.version} · ZMIANY CZEKAJĄ` : `OPUBLIKOWANA v${s.version}`}</span>
  : <span className="technical text-[9px] px-2 py-1 border hairline text-foreground/55">SZKIC</span>;


// Ten sam opis kadru co przy generowaniu na serwerze — do skopiowania np. do ChatGPT.
export const DEFAULT_STYLE = "cinematic photorealism, contemporary Poland, sophisticated arthouse film still, 35mm lens, human imperfect realism, rich shadow detail, muted warm gold highlights, near-black palette, natural skin, authentic interiors, no fantasy, no religious symbols, no blood, no text, no logos, no watermarks, no AI-looking faces, 16:9, no cinematic black bars";
export function composePrompt(kind, base, story) {
  const style = String(story?.image_style || DEFAULT_STYLE);
  const st = kind === "cover_portrait" ? style.replace(/\b16:9\b/g, "vertical 2:3").replace(/,?\s*no cinematic black bars/i, "") : style;
  const people = story?.visual_notes ? ` Characters (keep exactly consistent between shots): ${story.visual_notes}.` : "";
  const extra = " Natural, non-idealised people, subtle film grain, no HDR, no stock-photo look, no text or letters anywhere in the image.";
  return `${String(base || "").trim()}${people} Style: ${st}.${extra}`.replace(/\s+/g, " ").trim();
}
export const thumb = (u, w = 480) => (u && u.startsWith("/functions/media") ? `${u}&w=${w}` : u);
