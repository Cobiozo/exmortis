import { base44 } from "@/api/base44Client";

// Panel czyta odcinki i playlisty przez bramkę supabaseData (reguły na serwerze: administrator widzi wszystko).
// Zwykły odczyt tych kolekcji idzie wprost z kopii kluczem publicznym, a ten pokazuje tylko opublikowane odcinki
// i widoczne playlisty — po ukryciu playlista znikała z panelu (27.11.2026).
function adminRead(name) {
  const entity = base44.entities[name];
  const read = async (op, args) => (await base44.functions.invoke("supabaseData", { entity: name, op, args })).data?.result;
  return new Proxy(entity, {
    get(target, prop) {
      if (prop === "filter") {
        return (query = {}, opts = {}) =>
          read("filter", { query, sort: opts.sort, limit: opts.limit, cursor: opts.cursor }).catch(() => target.filter(query, opts));
      }
      if (prop === "get") return (id) => read("get", { id: String(id) }).catch(() => target.get(id));
      return target[prop];
    },
  });
}

export const EP = adminRead("PodcastEpisode");
export const PL = adminRead("PodcastPlaylist");
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