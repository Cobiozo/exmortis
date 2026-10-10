// Wbudowane dane spotkań na wypadek braku odpowiedzi serwera przy pierwszej wizycie. Dane z serwera mają pierwszeństwo.
const LISTOPAD = {
  title: "Ze śmierci — o powrotach, o których świat nie mówi",
  start_datetime: "2026-11-01T19:00:00Z",
  duration_minutes: 90,
  open_minutes: 15,
};
const BUILT_IN = { "1-listopada": LISTOPAD, "ze-smierci-o-powrotach-o-ktorych-swiat-nie-mowi": LISTOPAD };

export function joinFallback(key) {
  const ev = BUILT_IN[key];
  if (!ev) return null;
  const st = new Date(ev.start_datetime).getTime(), n = Date.now();
  const state = n < st - ev.open_minutes * 60000 ? "przed" : n <= st + (ev.duration_minutes + 30) * 60000 ? "otwarte" : "po";
  return { ...ev, state };
}