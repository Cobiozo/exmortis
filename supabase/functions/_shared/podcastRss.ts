// Import odcinków podcastu z kanału RSS (Spotify for Podcasters / Anchor).
// Wspólny moduł dla Base44 i Supabase — robi dokładnie to samo co ręczne uzupełnienie:
// dopisuje nowe odcinki, aktualizuje znane (dopasowanie po adresie nagrania, potem po tytule)
// i porządkuje listę „Wszystkie odcinki” (od najnowszego).
//
// Czego NIE rusza: pól ustawianych ręcznie w panelu — YouTube, goście, tematy, rozdziały,
// transkrypcja, cytaty, materiały, CTA, ostrzeżenia, licznik odtworzeń. Import zmienia tylko
// pola pochodzące z kanału: tytuł, numer, datę, nagranie, długość, okładkę, opisy.
// Adres (slug) istniejącego odcinka zostaje bez zmian — publikowany link nie może przestać działać.

const WATCH_ALL = "wszystkie odcinki";
const LIMIT_ITEMS = 200;
const TIMEOUT_MS = 20000;

const decode = (s: unknown) =>
  String(s == null ? "" : s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]).trim() : "";
}

function attr(block: string, name: string, attribute: string): string {
  const m = block.match(new RegExp(`<${name}\\b[^>]*?\\b${attribute}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decode(m[1]).trim() : "";
}

// Opis z RSS to HTML — na stronę idzie czysty tekst z akapitami.
function htmlToText(html: string): string {
  return decode(
    String(html || "")
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

// „00:06:20”, „6:20” albo „380” → sekundy.
function seconds(v: string): number | null {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":").map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((a, n) => a * 60 + n, 0);
}

export function podcastSlug(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function itemBlocks(xml: string): string[] {
  const out: string[] = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < LIMIT_ITEMS) out.push(m[1]);
  return out;
}

// Pola odcinka pochodzące z kanału (tylko one są zapisywane przy aktualizacji).
function fromRss(block: string, cover: string): Record<string, unknown> {
  const title = tag(block, "title");
  const notes = htmlToText(tag(block, "description") || tag(block, "itunes:summary") || tag(block, "content:encoded"));
  const pub = tag(block, "pubDate");
  const date = pub ? new Date(pub) : null;
  const known = date && !Number.isNaN(date.getTime());
  return {
    tytul: title || null,
    numer: Number(tag(block, "itunes:episode")) || null,
    publikacja: known ? date.toISOString() : null,
    audio: attr(block, "enclosure", "url") || null,
    dlugosc_s: seconds(tag(block, "itunes:duration")),
    okladka: attr(block, "itunes:image", "href") || cover || null,
    opis_krotki: notes ? notes.slice(0, 200).trim() : null,
    notatki: notes || null,
  };
}

export type RssResult = { dodane: number; zaktualizowane: number; odcinki: number; lista: string };

// base44: klient z createClientFromRequest (Base44 albo zgodny zamiennik w Supabase).
export async function importPodcastRss(base44: any): Promise<RssResult> {
  const settingsRows = await base44.entities.PodcastSettings.list("-created_date", 1);
  const settings = (Array.isArray(settingsRows) ? settingsRows[0] : null) || null;
  const feed = String((settings && (settings.rss_import || settings.rss)) || "").trim();
  if (!/^https?:\/\//i.test(feed)) throw new Error("Brak adresu RSS kanału w ustawieniach podcastu");

  const res = await fetch(feed, {
    headers: { "User-Agent": "exmortis-podcast/1.0", Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Kanał RSS odpowiedział kodem ${res.status}`);
  const xml = await res.text();
  const blocks = itemBlocks(xml);
  if (!blocks.length) throw new Error("Kanał RSS nie zawiera żadnego odcinka");

  const cover = String((settings && settings.okladka) || "");
  const spotify = String((settings && settings.spotify) || "");
  const existing: any[] = await base44.entities.PodcastEpisode.list("-created_date", 1000);
  const byAudio = new Map<string, any>();
  const byTitle = new Map<string, any>();
  const slugs = new Set<string>();
  for (const e of existing) {
    if (e.audio) byAudio.set(String(e.audio).trim(), e);
    if (e.tytul) byTitle.set(String(e.tytul).trim().toLowerCase(), e);
    if (e.slug) slugs.add(String(e.slug));
  }

  let dodane = 0;
  let zaktualizowane = 0;
  for (const block of blocks) {
    const rss = fromRss(block, cover);
    const title = String(rss.tytul || "").trim();
    if (!title) continue;
    const audio = String(rss.audio || "").trim();
    const found = (audio && byAudio.get(audio)) || byTitle.get(title.toLowerCase());

    if (found) {
      // Nadpisujemy tylko niepuste wartości z kanału — brak danych w RSS nie kasuje tego, co już jest.
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rss)) if (v !== null && v !== "" && found[k] !== v) patch[k] = v;
      if (Object.keys(patch).length) await base44.entities.PodcastEpisode.update(found.id, patch);
      zaktualizowane++;
      if (audio) byAudio.set(audio, found);
      byTitle.set(title.toLowerCase(), found);
      continue;
    }

    let slug = podcastSlug(title) || `odcinek-${dodane + zaktualizowane + 1}`;
    if (slugs.has(slug)) {
      let n = 2;
      while (slugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    const rec: Record<string, unknown> = { ...rss, tytul: title, slug, spotify: spotify || "", status: "opublikowany" };
    for (const k of Object.keys(rec)) if (rec[k] === null || rec[k] === "") delete rec[k];
    const created = await base44.entities.PodcastEpisode.create(rec);
    slugs.add(slug);
    if (created && created.audio) byAudio.set(String(created.audio).trim(), created);
    byTitle.set(title.toLowerCase(), created);
    dodane++;
  }

  // Lista „Wszystkie odcinki” — wszystkie opublikowane, od najnowszego.
  const all: any[] = await base44.entities.PodcastEpisode.list("-created_date", 1000);
  const ids = all
    .filter((e) => e.status === "opublikowany")
    .sort((a, b) => String(b.publikacja || "").localeCompare(String(a.publikacja || "")))
    .map((e) => e.id);

  const playlists: any[] = await base44.entities.PodcastPlaylist.list("-kolejnosc", 100);
  const lista = playlists.find((p) => String(p.nazwa || "").trim().toLowerCase() === WATCH_ALL);
  if (!lista) {
    await base44.entities.PodcastPlaylist.create({ nazwa: "Wszystkie odcinki", typ: "sezon", widoczna: true, kolejnosc: 1, odcinki: ids });
  } else if (JSON.stringify(lista.odcinki || []) !== JSON.stringify(ids)) {
    await base44.entities.PodcastPlaylist.update(lista.id, { odcinki: ids });
  }

  return { dodane, zaktualizowane, odcinki: ids.length, lista: lista ? "zaktualizowana" : "utworzona" };
}