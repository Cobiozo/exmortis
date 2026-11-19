import { track } from "@/lib/track";

// Statystyka odtworzeń (19.11.2026): każdy start odcinka podcastu i utworu liczy się w anonimowym liczniku
// panelu (site_hit, sumy dzienne, bez cookies i danych osoby) jako zdarzenie „pod_<odcinek>” albo „muz_<utwór>”.
// Panel (Statystyki → Odtworzenia) zamienia klucze z powrotem na tytuły — widzi to tylko administrator.
export const playKey = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 34) || "bez_nazwy";

export const countPlay = (kind, nameOrSlug) => track(kind, { content_name: playKey(nameOrSlug) });
