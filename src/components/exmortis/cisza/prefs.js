// Zapamiętane ustawienia gościa: czas, głośność, wyciszenie, tło (per czas).
const KEY = "exm_cisza";

export const TIMES = [5, 10, 15, 30, 45, 60];

export const SETTINGS_DEFAULTS = {
  glosnosc_domyslna: 60,
  dzwiek_domyslnie: "wlaczony",
  wyciszanie_melodii_s: 3,
  tekst_na_koniec: "Ta cisza była Twoja.",
};

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function savePrefs(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* prywatny tryb przeglądarki */
  }
}

export const clock = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// Wybrane tło dla czasu: zapamiętane → domyślne → pierwsze → "none".
export function resolveBg(list, stored) {
  if (stored === "none") return "none";
  if (list.some((t) => t.id === stored)) return stored;
  return (list.find((t) => t.domyslny) || list[0])?.id || "none";
}