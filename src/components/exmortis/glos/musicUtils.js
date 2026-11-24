import { extractVideoId } from "./youtube";

// Wspólne reguły utworów (strona /glos i panel). Stare wpisy bez statusu: widoczny → opublikowany, ukryty → ukryty.
export const statusOf = (s) => s?.status || (s?.widoczny === false ? "ukryty" : "opublikowany");
export const isPublic = (s) => s?.widoczny !== false && statusOf(s) === "opublikowany";
export const hasAudio = (s) => /^https?:\/\//i.test(String(s?.audio_url || ""));
export const ytId = (s) => extractVideoId(s?.youtube_url || "") || "";

// Źródło utworu: własne audio, tylko YouTube albo brak dostępnego źródła.
export const sourceOf = (s) => (hasAudio(s) ? "audio" : ytId(s) ? "youtube" : "brak");
export const SOURCE_LABEL = { audio: "Własne audio", youtube: "Tylko YouTube", brak: "Brak dostępnego audio" };

// Utwór jako pozycja wspólnego odtwarzacza.
export const songItem = (s) => ({
  id: s.id, kind: "utwor", tytul: s.tytul, autor: s.autor || "EXMORTIS", audio: s.audio_url,
  okladka: s.okladka || "", href: "/glos#muzyka", dlugosc_s: s.dlugosc_s || 0,
});