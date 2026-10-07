import { base44 } from "@/api/base44Client";

export const EP = base44.entities.PodcastEpisode;
export const PL = base44.entities.PodcastPlaylist;
export const GU = base44.entities.PodcastGuest;
export const inp = "w-full bg-transparent border hairline px-3 py-2 text-sm";
export const lbl = "block text-xs text-foreground/60 space-y-1.5";
export const STATUS = { szkic: "Szkic", zaplanowany: "Zaplanowany", opublikowany: "Opublikowany", ukryty: "Ukryty" };
export const FORMA = { pelne: "Imię i nazwisko", imie: "Imię", pseudonim: "Pseudonim", anonimowo: "Anonimowo" };

export const uploadImage = async (file) => (await base44.integrations.Core.UploadPublicFile({ file })).file_url;

// Zwraca listę błędów blokujących publikację.
export function publishErrors(ep, guests) {
  if (!["opublikowany", "zaplanowany"].includes(ep.status)) return [];
  const e = [];
  if (!ep.audio && !ep.spotify && !ep.youtube) e.push("Brak źródła nagrania (plik, Spotify lub YouTube).");
  if (!ep.publikacja) e.push("Ustaw datę publikacji.");
  const bad = guests.filter((g) => ep.goscie?.includes(g.id) && (g.forma === "pelne" || g.zdjecie) && g.zgoda_status !== "podpisana");
  if (bad.length) e.push(`Brak zgody gościa na publikację: ${bad.map((g) => g.nazwa).join(", ")}.`);
  return e;
}