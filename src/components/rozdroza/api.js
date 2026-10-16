import { base44 } from "@/api/base44Client";

// ROZDROŻA — pobieranie opublikowanych treści z pamięcią podręczną.
// Biblioteka: same metadane (20 s w pamięci, kopia w przeglądarce na wypadek braku sieci).
// Historia: kopia powiązana z numerem wersji — przy tej samej wersji serwer nie przesyła tekstu ponownie.
const LIST_KEY = "exm_rz_list";
const snapKey = (slug) => `exm_rz_snap:${slug}`;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* pełna lub zablokowana pamięć — czytamy dalej z sesji */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};
const status = (e) => e?.response?.status || e?.status || 0;
const message = (e, fb) => e?.response?.data?.error || fb;

let list = null;
let pvList = null; // lista w podglądzie administratora (z historiami zaplanowanymi) — tylko w pamięci
const snaps = new Map();
// Czy pokazana właśnie lista pochodzi z kopii przeglądarki (odświeżenie się nie udało).
export const listMeta = { offline: false };

const call = (p) => base44.functions.invoke("rozdroza", p).then((r) => r.data);

// Podgląd administratora „jak klient” (włączany linkiem z panelu, trzyma się do zamknięcia karty).
// Serwer i tak sprawdza rolę — u klienta flaga nic nie zmienia.
const PV_KEY = "exm_rz_admin_pv";
export const adminPreview = {
  on() { try { return sessionStorage.getItem(PV_KEY) === "1"; } catch { return false; } },
  set(v) { try { if (v) sessionStorage.setItem(PV_KEY, "1"); else sessionStorage.removeItem(PV_KEY); } catch { /* */ } pvList = null; },
};

export const cachedList = () => (adminPreview.on() ? pvList?.items || null : list?.items || store.get(LIST_KEY)?.items || null);
// „w sobotę, 17 października, o 20:00” (czas polski).
const DAYS = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];
export function plWhen(iso) {
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const day = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long" }).format(d);
  return `${DAYS[wd]}, ${day}, o ${p.hour}:${p.minute}`;
}
// Data najbliższej zaplanowanej historii (bez tytułu) — tylko jeśli wciąż w przyszłości.
export const nextAt = () => { const v = (adminPreview.on() ? pvList : list || store.get(LIST_KEY))?.next_at; return v && Date.parse(v) > Date.now() ? v : null; };

export async function listStories({ fresh = false } = {}) {
  if (adminPreview.on()) {
    if (!fresh && pvList && Date.now() - pvList.at < 60000) return pvList.items;
    try {
      const d = await call({ action: "list", preview: true });
      pvList = { at: Date.now(), items: d.items || [], next_at: d.next_at || null };
      return pvList.items;
    } catch (e) { throw new Error(message(e, "Nie udało się wczytać biblioteki.")); }
  }
  if (!fresh && list && Date.now() - list.at < 20000) return list.items;
  try {
    const d = await call({ action: "list" });
    list = { at: Date.now(), items: d.items || [], next_at: d.next_at || null };
    store.set(LIST_KEY, list);
    listMeta.offline = false;
    return list.items;
  } catch (e) {
    const c = cachedList();
    if (c && status(e) !== 401) { listMeta.offline = true; return c; }
    throw new Error(status(e) === 401 ? "Sesja wygasła — zaloguj się ponownie." : message(e, "Nie udało się wczytać biblioteki. Sprawdź połączenie."));
  }
}

// Zwraca { meta, snapshot, offline? }. Przy braku sieci — ostatnia zapisana kopia tej historii.
export async function loadStory(slug) {
  const local = snaps.get(slug) || store.get(snapKey(slug));
  try {
    const d = await call({ action: "story", slug, have: local?.meta?.version || 0, ...(adminPreview.on() ? { preview: true } : {}) });
    const out = d.same && local?.snapshot ? { meta: d.meta, snapshot: local.snapshot } : { meta: d.meta, snapshot: d.snapshot };
    snaps.set(slug, out);
    store.set(snapKey(slug), out);
    return out;
  } catch (e) {
    if (status(e) === 404) { snaps.delete(slug); store.del(snapKey(slug)); throw new Error("Ta historia nie jest już dostępna."); }
    if (status(e) === 401) throw new Error("Sesja wygasła — zaloguj się ponownie.");
    if (local?.snapshot) return { ...local, offline: true };
    throw new Error(message(e, "Nie udało się wczytać historii. Sprawdź połączenie i spróbuj ponownie."));
  }
}

// Podgląd szkicu — tylko administrator (bez zapisywania w pamięci przeglądarki).
// Kopia w pamięci na minutę: karta podglądu i czytnik nie pobierają szkicu dwa razy.
const previews = new Map();
export async function loadPreview(id, { fresh = false } = {}) {
  const hit = previews.get(id);
  if (!fresh && hit && Date.now() - hit.at < 60000) return hit.data;
  try {
    const r = await base44.functions.invoke("rozdrozaAdmin", { action: "preview", id });
    const data = { meta: r.data.meta, snapshot: r.data.snapshot, preview: true };
    previews.set(id, { at: Date.now(), data });
    return data;
  } catch (e) { throw new Error(message(e, "Podgląd niedostępny.")); }
}

export const CATEGORY_LABEL = { mentalna: "Śmierć mentalna", duchowa: "Śmierć duchowa", zyciowa: "Śmierć życiowa" };