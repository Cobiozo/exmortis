import React from "react";
import { base44 } from "@/api/base44Client";

// Wywołania funkcji rozdrozaAdmin (błąd z raportem walidacji, jeśli serwer go zwrócił).
export const rz = (action, p = {}) => base44.functions.invoke("rozdrozaAdmin", { action, ...p })
  .then((r) => r.data)
  .catch((e) => {
    const d = e?.response?.data || {};
    const err = new Error(d.error || "Nie udało się.");
    err.report = d.report; err.needsConfirm = !!d.needs_confirm;
    throw err;
  });


// Zaplanowana = opublikowana, ale z datą „widoczna od” w przyszłości (klienci jej jeszcze nie widzą).
export const isScheduled = (s) => !!s.visible_from && Date.parse(s.visible_from) > Date.now();
export const fmtWhen = (iso) => new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export const statusBadge = (s) => {
  if (s.status !== "published") return <span className="technical text-[9px] px-2 py-1 border hairline text-foreground/55">{s.visible_from ? `SZKIC · TERMIN ${fmtWhen(s.visible_from).toUpperCase()}` : "SZKIC"}</span>;
  const sched = isScheduled(s);
  const cls = s.changed ? "border-[#E8C547]/60 text-[#E8C547]" : sched ? "border-[#C9A24A]/60 gold-text" : "border-[#9FD3A0]/50 text-[#9FD3A0]";
  const label = sched ? `ZAPLANOWANA · ${fmtWhen(s.visible_from).toUpperCase()}` : `OPUBLIKOWANA v${s.version}`;
  return <span className={`technical text-[9px] px-2 py-1 border ${cls}`}>{label}{s.changed ? " · ZMIANY CZEKAJĄ" : ""}</span>;
};


// Ten sam opis kadru co przy generowaniu na serwerze (base44/shared/rozdrozaGraph.ts) — do skopiowania np. do ChatGPT.
export const DEFAULT_STYLE = "cinematic photorealism, contemporary Poland, sophisticated arthouse film still, 35mm lens, human imperfect realism, rich shadow detail, muted warm gold highlights, near-black palette, natural skin, authentic interiors, no fantasy, no religious symbols, no blood, no text, no logos, no watermarks, no AI-looking faces, 16:9, no cinematic black bars";
export function characterNotes(kind, story) {
  const cover = kind !== "scene";
  if (cover && String(story?.cover_visual_notes_en || "").trim()) return String(story.cover_visual_notes_en).trim();
  return String(story?.visual_notes_en || story?.visual_notes || "").trim();
}
export function composePrompt(kind, base, story) {
  const style = String(story?.image_style || DEFAULT_STYLE);
  const st = kind === "cover_portrait" ? style.replace(/\b16:9\b/g, "vertical 2:3").replace(/,?\s*no cinematic black bars/i, "") : style;
  const notes = characterNotes(kind, story);
  const people = notes
    ? ` Character reference (apply only to the people who actually appear in this shot; never change their age, clothing or facial features between shots): ${notes}.`
    : "";
  const only = kind === "scene"
    ? " Show only the people this shot describes; do not add anyone else."
    : " Promotional cover: show only the people this shot describes (or nobody, if none are described); no other characters.";
  const extra = " Nobody looks like a posing advertising model: natural, non-idealised frame, subtle film grain, no HDR, no stock-photo look, no text or letters anywhere in the image.";
  return `${String(base || "").trim()}${people}${only} Style: ${st}.${extra}`.replace(/\s+/g, " ").trim();
}
export const START_SCENE_NUMBERS = [1, 2, 5, 7, 11, 15, 17];
export const isStartScene = (key) => { const m = /(\d+)\s*$/.exec(String(key || "")); return !!m && START_SCENE_NUMBERS.includes(Number(m[1])); };
export const thumb = (u, w = 480) => (u && u.startsWith("/functions/media") ? `${u}&w=${w}` : u);
