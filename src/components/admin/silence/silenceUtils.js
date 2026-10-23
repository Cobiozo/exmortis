import { base44 } from "@/api/base44Client";

export const MAX_MB = 500; // limit plików audio (Supabase Storage)
export const TIMES = [3, 5, 10, 15, 30, 45, 60];
export const SLOTS = [
  { key: "wstep", label: "WSTĘP" },
  { key: "melodia", label: "MELODIA" },
  { key: "zakonczenie", label: "ZAKOŃCZENIE" },
];
export const ST = base44.entities.SilenceSoundtrack;

export const fmt = (s) =>
  s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function readDuration(file) {
  return new Promise((resolve) => {
    const a = new Audio();
    const u = URL.createObjectURL(file);
    const done = (v) => { URL.revokeObjectURL(u); resolve(v); };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(isFinite(a.duration) ? Math.round(a.duration) : null);
    a.onerror = () => done(null);
    a.src = u;
  });
}

// Wgrywa plik i zwraca pola slotu gotowe do zapisu.
export async function uploadSlot(key, file) {
  if (!/\.(mp3|m4a)$/i.test(file.name)) throw new Error("Dozwolone formaty: MP3 i M4A.");
  if (file.size > MAX_MB * 1024 * 1024) throw new Error("Plik jest za duży — wgraj krótszą melodię i zostaw zapętlanie");
  const [dur, { file_url }] = await Promise.all([
    readDuration(file),
    base44.integrations.Core.UploadPublicFile({ file }),
  ]);
  return { [`plik_${key}`]: file_url, [`plik_${key}_nazwa`]: file.name, [`dlugosc_${key}_s`]: dur };
}

export function trackWarnings(t) {
  const w = [];
  const len = t.czas_min * 60;
  if (t.plik_wstep && t.dlugosc_wstep_s > 15) w.push("Wstęp jest dłuższy niż 15 s");
  if (t.plik_zakonczenie && t.dlugosc_zakonczenie_s != null && (t.dlugosc_zakonczenie_s < 10 || t.dlugosc_zakonczenie_s > 20))
    w.push("Zakończenie powinno trwać od 10 do 20 s");
  if (t.plik_melodia && t.dlugosc_melodia_s != null) {
    if (t.dlugosc_melodia_s < len && t.zapetlaj_melodie === false) w.push("Melodia skończy się przed czasem — włącz zapętlanie");
    if (t.dlugosc_melodia_s > len) w.push("Melodia jest dłuższa niż czas minutnika. Zostanie płynnie wyciszona na końcu");
  }
  return w;
}

export const timeWarning = (list) =>
  list.some((t) => t.aktywny !== false) ? null : "Ten czas działa w ciszy, bez dźwięku";

export function countWarnings(tracks) {
  return TIMES.reduce((n, m) => {
    const list = tracks.filter((t) => t.czas_min === m);
    return n + (timeWarning(list) ? 1 : 0) + list.reduce((k, t) => k + trackWarnings(t).length, 0);
  }, 0);
}