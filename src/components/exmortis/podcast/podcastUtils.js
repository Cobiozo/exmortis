import { base44 } from "@/api/base44Client";

export const TEMATY = [["mentalna", "Śmierć mentalna"], ["duchowa", "Śmierć duchowa"], ["zyciowa", "Śmierć życiowa"], ["inne", "Inne"]];
export const TRUDNE = ["samobójstwo", "samookaleczenie", "przemoc", "żałoba po dziecku", "uzależnienie", "inne"];

export const fmtT = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
};
export const parseT = (t) => (t ? String(t).split(":").reduce((a, v) => a * 60 + (Number(v) || 0), 0) : 0);

// „mm:ss — tytuł” w każdej linii.
export const parseChapters = (txt) =>
  (txt || "").split("\n").map((l) => l.match(/^\s*(\d{1,2}(?::\d{2}){1,2})\s*[—–-]\s*(.+)$/)).filter(Boolean).map((m) => ({ t: parseT(m[1]), title: m[2].trim() }));

export async function loadPublished() {
  const now = new Date().toISOString();
  const p = await base44.entities.PodcastEpisode.filter(
    { status: { $in: ["opublikowany", "zaplanowany"] }, publikacja: { $lte: now } },
    { sort: "-publikacja", limit: 200, fields: ["numer", "tytul", "slug", "opis_krotki", "publikacja", "dlugosc_s", "okladka", "gosc_nazwa", "tematy", "audio", "transkrypcja"] }
  );
  return p.items;
}

export async function loadSettings() {
  const p = await base44.entities.PodcastSettings.filter({}, { limit: 1 });
  return p.items[0] || { nazwa: "Podcast exmortis" };
}

export const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);