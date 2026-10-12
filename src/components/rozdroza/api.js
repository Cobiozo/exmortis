import { base44 } from "@/api/base44Client";

// ROZDROŻA — pobieranie opublikowanych treści z pamięcią podręczną.
// Biblioteka: same metadane (5 min w pamięci, kopia w przeglądarce na wypadek braku sieci).
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
const snaps = new Map();

const call = (p) => base44.functions.invoke("rozdroza", p).then((r) => r.data);

export const cachedList = () => list?.items || store.get(LIST_KEY)?.items || null;

export async function listStories({ fresh = false } = {}) {
  if (!fresh && list && Date.now() - list.at < 300000) return list.items;
  try {
    const d = await call({ action: "list" });
    list = { at: Date.now(), items: d.items || [] };
    store.set(LIST_KEY, list);
    return list.items;
  } catch (e) {
    const c = cachedList();
    if (c && status(e) !== 401) return c;
    throw new Error(status(e) === 401 ? "Sesja wygasła — zaloguj się ponownie." : message(e, "Nie udało się wczytać biblioteki. Sprawdź połączenie."));
  }
}

// Zwraca { meta, snapshot, offline? }. Przy braku sieci — ostatnia zapisana kopia tej historii.
export async function loadStory(slug) {
  const local = snaps.get(slug) || store.get(snapKey(slug));
  try {
    const d = await call({ action: "story", slug, have: local?.meta?.version || 0 });
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
export async function loadPreview(id) {
  try {
    const r = await base44.functions.invoke("rozdrozaAdmin", { action: "preview", id });
    return { meta: r.data.meta, snapshot: r.data.snapshot, preview: true };
  } catch (e) { throw new Error(message(e, "Podgląd niedostępny.")); }
}

export const CATEGORY_LABEL = { mentalna: "Śmierć mentalna", duchowa: "Śmierć duchowa", zyciowa: "Śmierć życiowa" };
