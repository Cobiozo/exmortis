// Tła wizualne ciszy — wspólne pomocnicze.
export const BLACK = { id: "czern", nazwa: "Czerń", typ: "kolor", kolor: "#0A0A0A", systemowe: true, przyciemnienie: 0, rozmycie: 0 };

// „Czerń” zawsze pierwsza.
export function orderBackdrops(list) {
  const sys = list.find((b) => b.systemowe) || BLACK;
  return [sys, ...list.filter((b) => !b.systemowe)];
}

export function resolveBackdrop(list, stored) {
  return list.find((b) => b.id === stored) || list.find((b) => b.domyslne) || list[0] || BLACK;
}

export const bgCss = (b) => {
  if (b.typ === "gradient") {
    const cols = (b.kolory || []).filter(Boolean);
    if (cols.length >= 2) return `linear-gradient(${b.kierunek ?? 180}deg, ${cols.join(", ")})`;
    return cols[0] || "#0A0A0A";
  }
  if (b.typ === "kolor") return b.kolor || "#0A0A0A";
  return "#0A0A0A";
};

export const imageOf = (b, portrait) =>
  b.typ === "zdjecie" ? (portrait && b.zdjecie_pionowe) || b.zdjecie_szerokie || b.zdjecie_pionowe : b.typ === "wideo" ? b.poster : null;

export const isPortrait = () => typeof window !== "undefined" && window.matchMedia("(orientation: portrait)").matches;

// Save-Data albo wolne łącze → bez wideo.
export function lowData() {
  const c = typeof navigator !== "undefined" && navigator.connection;
  return !!(c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || "")));
}

const norm = (s) => (s || "").trim().toLowerCase();
export const matchTrack = (bg, tracks, bgId) =>
  bg?.dzwiek_nazwa ? tracks.find((t) => norm(t.nazwa) === norm(bg.dzwiek_nazwa) && t.id !== bgId) || null : null;