// Myśli dnia — domyślne wartości (nadpisywane w panelu: Treści stron → Myśli dnia, strona „mysli”).
const START = [
  "Nie trzeba widzieć całej drogi, żeby zrobić następny krok.",
  "Powrót zaczyna się od małej decyzji, nie od wielkiego planu.",
  "To, że dziś jest ciężko, nie mówi, jak będzie jutro.",
  "Odpoczynek też jest częścią drogi.",
  "Wolne tempo to wciąż tempo.",
  "Dziś wystarczy, że oddychasz spokojniej niż wczoraj.",
  "Nie porównuj swojej drogi z cudzą mapą.",
  "Małe rzeczy zrobione codziennie zmieniają całość.",
  "Cisza nie jest pustką. Bywa początkiem.",
  "Możesz zacząć od nowa w środku dnia.",
  "Twoja historia nie skończyła się na najtrudniejszym rozdziale.",
  "Wróć do siebie choć na pięć minut.",
  "Zrób dziś jedną rzecz tylko dla siebie.",
  "Siła rośnie po cichu.",
  "Prośba o pomoc to też krok naprzód.",
  "Dziś mów do siebie łagodniej.",
  "Nie wszystko trzeba naprawić dziś.",
  "Twój oddech jest zawsze z Tobą. Wróć do niego.",
  "Powoli też się dochodzi.",
  "Jeden dobry wybór dziennie potrafi zmienić kierunek.",
  "Wdzięczność za drobiazg potrafi odmienić cały dzień.",
  "Tam, gdzie kończy się stare, robi się miejsce na nowe.",
  "Zapisz dziś jedną rzecz, która się udała.",
  "Nie jesteś sumą swoich najgorszych dni.",
  "Wracanie to umiejętność. Można się jej nauczyć.",
  "Każde „jeszcze raz” jest odwagą.",
  "Spokój też jest osiągnięciem.",
  "Ze śmierci wraca się krok po kroku.",
  "Światło nie pyta, jak długo było ciemno.",
  "Dziś wystarczy obecność.",
  "To, co przetrwane, uczy. To, co przed Tobą, czeka.",
  "Każdy poranek to kolejna szansa na początek.",
  "Nie musisz mieć dziś odpowiedzi. Wystarczy pytanie.",
  "Zatrzymaj się na chwilę. Droga poczeka.",
  "Jesteś w drodze — i to się liczy.",
];
export const DEF_LIST = START.map((t) => ({ t, on: true }));
export const DEF_SPECIAL = [
  { d: "12-24", t: "Jeśli ten wieczór jest trudny, Obok czeka na Ciebie." },
  { d: "12-25", t: "Siedem wieczorów ciszy zaczyna się dziś o 20:00." },
  { d: "12-31", t: "Nie musisz zamykać roku podsumowaniem. Wystarczy wdzięczność." },
  { d: "01-01", t: "Nowy rok nie wymaga rewolucji. Wystarczy następny krok." },
];
export const DEF_TEXTS = {
  rano: "Dzień dobry.",
  noc: "Późna pora. Jeśli nie możesz zasnąć — w {Obok} czeka nagranie na takie chwile.",
  tel: "Jeśli jest bardzo ciężko: 116 123 (całą dobę, bezpłatnie).",
};
export const MAX = 120;

const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOfYear = (d) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 86400000);

// Ta sama myśl dla wszystkich przez cały dzień: data specjalna, inaczej kolejno wg dnia roku.
export function pickThought(date, list, special) {
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const sp = special.find((s) => s.d === md && s.t);
  if (sp) return sp.t;
  const on = list.filter((x) => x.on !== false && x.t);
  return on.length ? on[dayOfYear(date) % on.length].t : "";
}

export const partOfDay = (h) => (h >= 5 && h < 11 ? "rano" : h >= 23 || h < 5 ? "noc" : "dzien");