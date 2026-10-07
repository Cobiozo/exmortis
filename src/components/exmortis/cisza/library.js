// Biblioteka utworów ciszy: dostępność dla czasu, punkt startu, parametry odtwarzania.
export const CATS = [
  { id: "muzyka", label: "Muzyka" },
  { id: "natura", label: "Natura" },
  { id: "dzwieki", label: "Dźwięki" },
];

export const dbGain = (db) => Math.pow(10, (Number(db) || 0) / 20);

// Utwór dostępny dla czasu: wybrany czas + (pętla / następny utwór / dość długi).
export const available = (tracks, min) =>
  tracks.filter(
    (t) => t.plik && (!t.czasy?.length || t.czasy.includes(min)) &&
      (t.zapetlaj !== false || t.nastepny_id || !t.dlugosc_s || t.dlugosc_s >= min * 60)
  );

export const pickSignal = (signals, typ, id) => {
  const l = signals.filter((s) => s.typ === typ && s.plik);
  return l.find((s) => s.id === id) || l.find((s) => s.domyslny) || l[0] || null;
};

// Miejsce w pliku: punkt startu + upływ sesji (tak, jakby utwór grał od początku).
export function offsetFor(t, elapsedS = 0) {
  const d = t.dlugosc_s || 0;
  let base = 0;
  if (t.start_tryb === "losowe") base = d > 60 ? Math.random() * (d - 60) : 0;
  else if (t.start_tryb === "minuta") base = (t.start_minuta || 0) * 60;
  const o = base + elapsedS;
  if (!d) return o;
  return t.zapetlaj !== false ? o % d : Math.min(o, Math.max(0, d - 1));
}

export function toPlay(t, all) {
  if (!t?.plik) return null;
  return {
    url: t.plik,
    k: dbGain(t.korekta_db),
    loop: t.zapetlaj !== false,
    xfade: Math.max(2, Math.min(8, t.przenikanie_s || 4)),
    next: () => toPlay(all.find((x) => x.id === t.nastepny_id), all),
  };
}

// Podgląd 10 s z łagodnym wejściem i wyjściem; nowy podgląd zatrzymuje poprzedni.
let cur = null;
export function stopPreview() {
  if (!cur) return;
  clearInterval(cur.timer);
  cur.a.pause();
  cur.a.removeAttribute("src");
  cur.a.load();
  cur.done?.();
  cur = null;
}
export function preview(t, done) {
  stopPreview();
  const a = new Audio();
  a.preload = "auto";
  a.volume = 0;
  const d = t.dlugosc_s || 0;
  const at = t.start_tryb === "minuta" ? (t.start_minuta || 0) * 60 : t.start_tryb === "poczatek" ? 0 : d / 2;
  a.src = `${t.plik}#t=${Math.floor(at)}`;
  const me = { a, done, timer: null };
  cur = me;
  const t0 = performance.now();
  me.timer = setInterval(() => {
    const s = (performance.now() - t0) / 1000;
    a.volume = Math.max(0, Math.min(1, s < 1.5 ? s / 1.5 : s > 8.5 ? (10 - s) / 1.5 : 1)) * 0.8;
    if (s >= 10 && cur === me) stopPreview();
  }, 50);
  a.play().catch(() => cur === me && stopPreview());
}