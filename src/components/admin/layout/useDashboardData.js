import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { trackWarnings } from "@/components/admin/silence/library/libUtils";
import { surveyState } from "@/components/admin/powrot/PowrotAppCard";

// Dane pulpitu panelu — JEDNO zapytanie (adminDashboard → summary): serwer zbiera wszystko równolegle
// i trzyma wynik 60 s. Gdyby serwer nie znał jeszcze „summary” (np. tuż po publikacji strony),
// pulpit wraca do dawnych osobnych zapytań — z tym samym kształtem danych.
// Wynik zostaje też w pamięci karty na 60 s: powrót na pulpit z modułu pokazuje liczby natychmiast.
const TTL = 60000;
// Widoczność modułów biblioteki w menu zapamiętana z poprzedniej wizyty — menu nie „przeskakuje” przy wczytywaniu.
const LIB_KEY = "exm_panel_libon";
const libSaved = () => { try { const v = localStorage.getItem(LIB_KEY); return v === null ? undefined : v === "1"; } catch { return undefined; } };
let DATA = libSaved() === undefined ? {} : { libOn: libSaved() };
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

// Dawna ścieżka (zapas): te same funkcje co wcześniej, wyniki sprowadzone do kształtu „summary”.
const LEGACY = {
  stats: () => call("adminDashboard", {}, (d) => d.stats || {}),
  ready: () => call("adminDashboard", { action: "readiness" }, (d) => d),
  events: () => call("eventsAdmin", { action: "list" }, (d) => d.events || []),
  orders: () => call("adminOrders", { action: "list" }, (d) => {
    const all = d.orders || [];
    return {
      list: all.slice(0, 5),
      summary: { ...(d.summary || {}), fulfill_failed: all.filter((o) => o.status === "COMPLETED" && o.fulfill_error).length },
    };
  }),
  powrot: () => call("adminPowrot", { action: "list" }, (d) => {
    const list = d.applications || [];
    const weekAgo = Date.now() - 7 * 86400000;
    return {
      fresh: list.filter((a) => new Date(a.created_date).getTime() >= weekAgo).length,
      todo: list.filter((a) => ["none", "expired"].includes(surveyState(a).key)).length,
      done: list.filter((a) => a.survey_done_at).length,
    };
  }),
  libOn: () => call("libraryAdmin", { action: "settings" }, (d) => d.settings.library_mode !== "off" || d.settings.messages_mode !== "off"),
  bookingKeys: () => call("bookingAdmin", { action: "status" }, (d) => d.keys_ok !== false),
  podcastNew: () => base44.entities.PodcastApplication.count({ status: "nowe" }),
  todo: () => Promise.resolve({}), // liczniki „Do zrobienia” tylko ze ścieżki „summary”
  soundWarnings: () => base44.entities.SilenceTrack.filter({}, { limit: 200 })
    .then((p) => (p.items || []).reduce((n, t) => n + trackWarnings(t).length, 0)),
};

const legacy = () => Promise.allSettled(
  Object.entries(LEGACY).map(([k, load]) =>
    load()
      .then((v) => { DATA = { ...DATA, [k]: v }; emit(); })
      .catch(() => { if (!(k in DATA)) { DATA = { ...DATA, [k]: null }; emit(); } })
  )
);

const KEYS = Object.keys(LEGACY);

export function warmDashboard(force = false) {
  if (RUN) return RUN;
  if (!force && AT && Date.now() - AT < TTL) return Promise.resolve(DATA);
  RUN = base44.functions.invoke("adminDashboard", { action: "summary", fresh: force })
    .then((r) => {
      const s = r?.data;
      if (!s || !s.at) throw new Error("brak summary");
      const next = { ...DATA };
      KEYS.forEach((k) => { next[k] = s[k] === undefined ? null : s[k]; });
      DATA = next;
      if (typeof s.libOn === "boolean") { try { localStorage.setItem(LIB_KEY, s.libOn ? "1" : "0"); } catch { /* */ } }
      emit();
    })
    .catch(() => legacy())
    .then(() => { AT = Date.now(); RUN = null; emit(); return DATA; });
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
