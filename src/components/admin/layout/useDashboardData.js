import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { trackWarnings } from "@/components/admin/silence/library/libUtils";

// Dane pulpitu panelu: wszystkie zapytania startują RAZEM (równolegle), a każdy wynik
// pokazuje się od razu, gdy przyjdzie — bez czekania na resztę.
// Wynik zostaje w pamięci karty na 60 s: powrót na pulpit z modułu pokazuje liczby natychmiast,
// a świeże dociągają się w tle. Serwer bez zmian — te same funkcje, co dotąd.
const TTL = 60000;
let DATA = {};
let AT = 0;
let RUN = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f({ ...DATA }));

// Flaga „ta przeglądarka otwierała już panel jako admin” — pozwala zacząć pobieranie,
// zanim skończy się sprawdzanie logowania (oszczędza ok. 1–1,5 s). Bez flagi czekamy na rolę.
const FLAG = "exm_panel_admin";
export const markAdminBrowser = () => { try { localStorage.setItem(FLAG, "1"); } catch { /* */ } };
export const isKnownAdminBrowser = () => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; } };

const call = (fn, body, pick) => base44.functions.invoke(fn, body).then((r) => pick(r.data));

const SOURCES = {
  stats: () => call("adminDashboard", {}, (d) => d.stats || {}),
  ready: () => call("adminDashboard", { action: "readiness" }, (d) => d),
  events: () => call("eventsAdmin", { action: "list" }, (d) => d.events || []),
  orders: () => call("adminOrders", { action: "list" }, (d) => (d.orders || []).slice(0, 50)),
  powrot: () => call("adminPowrot", { action: "list" }, (d) => d.applications || []),
  libOn: () => call("libraryAdmin", { action: "settings" }, (d) => d.settings.library_mode !== "off" || d.settings.messages_mode !== "off"),
  bookingKeys: () => call("bookingAdmin", { action: "status" }, (d) => d.keys_ok !== false),
  podcastNew: () => base44.entities.PodcastApplication.count({ status: "nowe" }),
  soundWarnings: () => base44.entities.SilenceTrack.filter({}, { limit: 200 })
    .then((p) => (p.items || []).reduce((n, t) => n + trackWarnings(t).length, 0)),
};

export function warmDashboard(force = false) {
  if (RUN) return RUN;
  if (!force && AT && Date.now() - AT < TTL) return Promise.resolve(DATA);
  RUN = Promise.allSettled(
    Object.entries(SOURCES).map(([k, load]) =>
      load()
        .then((v) => { DATA = { ...DATA, [k]: v }; emit(); })
        .catch(() => { if (!(k in DATA)) { DATA = { ...DATA, [k]: null }; emit(); } })
    )
  ).then(() => { AT = Date.now(); RUN = null; emit(); return DATA; });
  return RUN;
}

export default function useDashboardData({ enabled = true } = {}) {
  const [d, setD] = useState(() => ({ ...DATA }));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    subs.add(setD);
    warmDashboard();
    return () => { subs.delete(setD); };
  }, [enabled]);
  const refresh = () => {
    setBusy(true);
    warmDashboard(true).finally(() => setBusy(false));
  };
  return { d, at: AT, refresh, refreshing: busy || !!RUN };
}
