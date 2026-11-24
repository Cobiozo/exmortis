import { base44 } from "@/api/base44Client";

// Pamięć wspólnego odtwarzacza Głosu: bieżące nagranie, kolejka, pozycja i prędkość podcastu (localStorage).
// Zapisujemy tylko publiczne materiały (podcast, utwór) — nagrania z konta (np. Obok) mają linki czasowe.
const KEY = "exm_player_v1";
const RATE = "exm_pod_rate";

export const kindOf = (x) => x?.kind || (String(x?.id || "").startsWith("obok-") ? "obok" : "podcast");
export const isMusic = (x) => kindOf(x) === "utwor";
const canPersist = (x) => ["podcast", "utwor"].includes(kindOf(x));

const slim = (x) => x && {
  id: x.id, kind: kindOf(x), tytul: x.tytul, audio: x.audio, okladka: x.okladka, slug: x.slug,
  numer: x.numer, href: x.href, autor: x.autor, dlugosc_s: x.dlugosc_s,
};

export function saveState(ep, queue, pos) {
  if (!ep || !canPersist(ep)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      item: slim(ep), pos: Math.floor(pos || 0),
      queue: (queue || []).filter((q) => canPersist(q) && q.audio).slice(0, 100).map(slim),
    }));
  } catch { /* brak pamięci */ }
}
export const loadState = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
export const clearState = () => { try { localStorage.removeItem(KEY); } catch { /* */ } };

export const podRate = () => { const r = Number(localStorage.getItem(RATE)); return r >= 0.5 && r <= 3 ? r : 1; };
export const savePodRate = (r) => { try { localStorage.setItem(RATE, String(r)); } catch { /* */ } };

// Zapis po odświeżeniu może wskazywać materiał usunięty, ukryty albo bez audio — wtedy go odrzucamy.
export async function verifyItem(item) {
  try {
    if (kindOf(item) === "podcast") {
      if (!item.slug) return null;
      const r = await base44.entities.PodcastEpisode.filter(
        { slug: item.slug, status: { $in: ["opublikowany", "zaplanowany"] }, publikacja: { $lte: new Date().toISOString() } },
        { limit: 1 }
      );
      const e = r.items?.[0];
      return e?.audio ? { ...item, ...e, kind: "podcast", href: item.href } : null;
    }
    const r = await base44.entities.Utwor.filter({ widoczny: true }, { limit: 200 });
    const u = (r.items || []).find((x) => x.id === item.id);
    return u?.audio_url ? { ...item, tytul: u.tytul, audio: u.audio_url } : null;
  } catch {
    return null;
  }
}