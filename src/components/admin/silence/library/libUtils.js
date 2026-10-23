import { base44 } from "@/api/base44Client";

export const MAX_MB = 500;
export const TRACK = base44.entities.SilenceTrack;
export const SIGNAL = base44.entities.SilenceSignal;
export const TIMES = [3, 5, 10, 15, 30, 45, 60];

export const fmt = (s) =>
  s == null ? "—" : s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

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

export function checkFile(file) {
  if (!/\.(mp3|m4a|aac)$/i.test(file.name)) return "Dozwolone formaty: MP3, M4A/AAC.";
  if (file.size > MAX_MB * 1024 * 1024)
    return `Plik ma ${Math.round(file.size / 1048576)} MB — limit to ${MAX_MB} MB. Zakoduj go mocniej (np. AAC 64–96 kb/s).`;
  return "";
}

export async function uploadAudio(file) {
  const err = checkFile(file);
  if (err) throw new Error(err);
  const [dlugosc_s, { file_url }] = await Promise.all([readDuration(file), base44.integrations.Core.UploadPublicFile({ file })]);
  return { plik: file_url, plik_nazwa: file.name, dlugosc_s };
}

export function trackWarnings(t) {
  const w = [];
  if (!t.plik) w.push("Brak pliku");
  if (t.dlugosc_s && t.dlugosc_s < 3600 && t.zapetlaj === false && !t.nastepny_id)
    w.push("Krótszy niż 60 min bez zapętlania — nie będzie dostępny dla dłuższych czasów");
  return w;
}