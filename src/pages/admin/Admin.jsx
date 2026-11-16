import React, { Suspense, useEffect } from "react";
import lazyPage from "@/lib/lazyPage";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import MfaGate from "@/components/admin/MfaGate";
import { useNoIndex } from "@/lib/useNoIndex";
import { ShieldAlert, RefreshCw } from "lucide-react";
import AdminDashboard from "@/components/admin/AdminDashboard";
import TechDashboard from "@/components/admin/TechDashboard";
import AdminShell from "@/components/admin/layout/AdminShell";
import useDashboardData, { warmDashboard, markAdminBrowser, isKnownAdminBrowser } from "@/components/admin/layout/useDashboardData";
import { surveyState } from "@/components/admin/powrot/PowrotAppCard";

// Moduły ładowane na żądanie (telefon nie pobiera całego panelu naraz).
// Najechanie na pozycję menu zaczyna pobierać moduł zawczasu — po kliknięciu otwiera się od razu.
const LOAD = {
  spotkania: () => import("@/components/admin/EventsManager"),
  rezerwacje: () => import("@/components/admin/booking/BookingAdmin"),
  ogloszenia: () => import("@/components/admin/announce/AnnouncementsAdmin"),
  cisza: () => import("@/components/admin/silence/SilencePanel"),
  skarbiec: () => import("@/components/admin/ProductsManager"),
  zamowienia: () => import("@/components/admin/orders/OrdersPanel"),
  funnel: () => import("@/components/admin/stats/FunnelPanel"),
  free: () => import("@/components/admin/stats/FreeMaterialsPanel"),
  silenceStats: () => import("@/components/admin/SilenceStatsPanel"),
  testy: () => import("@/components/admin/TestCountPanel"),
  glos: () => import("@/components/exmortis/glos/PlaylistManager"),
  kontakty: () => import("@/components/admin/ContactsTabs"),
  powrot: () => import("@/components/admin/powrot/PowrotPanel"),
  podcast: () => import("@/components/admin/podcast/PodcastAdmin"),
  obok: () => import("@/components/admin/obok/ObokAdmin"),
  rozdroza: () => import("@/components/admin/rozdroza/RozdrozaAdmin"),
  klienci: () => import("@/components/admin/clients/ClientsPanel"),
  biblioteka: () => import("@/components/admin/library/LibraryPanel"),
  grupy: () => import("@/components/admin/library/GroupsTab"),
  wiadomosci: () => import("@/components/admin/library/MessagesPanel"),
  historia: () => import("@/components/admin/library/HistoryPanel"),
  rabaty: () => import("@/components/admin/DiscountsPanel"),
  bezpieczenstwo: () => import("@/components/admin/security/SecurityPanel"),
  "dane-osoby": () => import("@/components/admin/gdpr/PersonDataPanel"),
  newsletter: () => import("@/components/admin/NewsletterManager"),
  tresci: () => import("@/components/admin/cms/ContentHub"),
  menu: () => import("@/components/admin/cms/nav/NavEditor"),
  integracje: () => import("@/components/admin/IntegrationsManager"),
  ustawienia: () => import("@/components/admin/settings/SiteSettingsPanel"),
};
const C = Object.fromEntries(Object.entries(LOAD).map(([k, f]) => [k, lazyPage(f)]));
const PRELOAD = { statystyki: ["funnel", "free", "silenceStats", "testy"] };
const preloaded = new Set();
const preload = (key) => {
  (PRELOAD[key] || [key]).forEach((k) => {
    if (preloaded.has(k) || !LOAD[k]) return;
    preloaded.add(k);
    LOAD[k]().catch(() => preloaded.delete(k));
  });
};

const SECTIONS = {
  spotkania: ["Spotkania", () => <C.spotkania />],
  rezerwacje: ["Rezerwacje 1:1", () => <C.rezerwacje />],
  ogloszenia: ["Ogłoszenia", () => <C.ogloszenia />],
  cisza: ["Cisza", () => <C.cisza />],
  skarbiec: ["Skarbiec", () => <C.skarbiec />],
  zamowienia: ["Zamówienia", () => <C.zamowienia />],
  statystyki: ["Statystyki", () => <div className="space-y-16"><C.funnel /><C.free /><C.silenceStats /><C.testy /></div>],
  glos: ["Głos", () => <C.glos onMutate={() => {}} />],
  kontakty: ["Baza kontaktów", () => <C.kontakty />],
  powrot: ["Zgłoszenia POWRÓT", () => <C.powrot />],
  podcast: ["Podcast", () => <C.podcast />],
  obok: ["Obok", () => <C.obok />],
  rozdroza: ["Rozdroża", () => <C.rozdroza />],
  klienci: ["Klienci i dostępy", () => <C.klienci />],
  biblioteka: ["Biblioteka", () => <C.biblioteka />],
  grupy: ["Grupy", () => <C.grupy />],
  // Sekcje modułu biblioteki i wiadomości — wyłącznie dla roli „admin".
  wiadomosci: ["Wiadomości", () => <C.wiadomosci />],
  historia: ["Historia zmian", () => <C.historia />],
  rabaty: ["Kody rabatowe", () => <C.rabaty />],
  bezpieczenstwo: ["Bezpieczeństwo", () => <C.bezpieczenstwo />],
  "dane-osoby": ["Dane osoby (RODO)", () => <C["dane-osoby"] />],
  newsletter: ["Newsletter i subskrybenci", () => <C.newsletter />],
  tresci: ["Treści stron", () => <C.tresci />],
  menu: ["Menu i stopka", () => <C.menu />],
  integracje: ["Integracje", () => <C.integracje />],
  ustawienia: ["Ustawienia strony", () => <C.ustawienia />],
  testy: ["Ukończenia testu", () => <C.testy />],
};

// Rola „techniczna”: ustawienia, treści, wygląd — bez danych osobowych.
const TECH = ["tresci", "menu", "ustawienia", "integracje", "cisza"];

const Spinner = () => (
  <div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>
);
const hhmm = (t) => new Date(t).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });

export default function Admin() {
  useNoIndex();
  const { section } = useParams();
  const { user: me, isLoadingAuth, authChecked } = useAuth();
  const isAdmin = me?.role === "admin";

  // Przeglądarka, w której panel był już otwierany: dane pulpitu zaczynają się pobierać od razu,
  // równolegle ze sprawdzaniem logowania (serwer i tak sprawdza uprawnienia przy każdym zapytaniu).
  useEffect(() => { if (isKnownAdminBrowser()) warmDashboard(); }, []);
  useEffect(() => { if (isAdmin) markAdminBrowser(); }, [isAdmin]);
  const { d, at, refresh, refreshing } = useDashboardData({ enabled: isAdmin });

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B]">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }

  const tech = me?.role === "techniczna";
  if (!me || (!isAdmin && !tech) || (tech && section && !TECH.includes(section))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-5 text-center">
        <ShieldAlert className="h-12 w-12 blood-text" />
        <p className="relic-heading text-3xl">Nie masz dostępu</p>
        <p className="text-foreground/55 max-w-sm">Ta część strony jest dostępna tylko dla administratora.</p>
        <Link to="/" className="btn-relic">STRONA GŁÓWNA</Link>
      </div>
    );
  }

  const current = section ? SECTIONS[section] : null;
  const pc = d.powrot ? d.powrot.filter((a) => ["none", "expired"].includes(surveyState(a).key)).length : 0;
  const badges = isAdmin ? {
    powrot: pc,
    zamowienia: d.stats?.invoices_todo || 0,
    kontakty: d.podcastNew || 0,
  } : {};

  const today = new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" });
  const actions = !section && isAdmin ? (
    <div className="flex items-center gap-3">
      <span className="hidden sm:inline text-xs text-foreground/50">
        {refreshing && !at ? "Wczytuję…" : at ? `${today} · zaktualizowano ${hhmm(at)}` : today}
      </span>
      <button type="button" onClick={refresh} disabled={refreshing}
        className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-md border hairline text-sm text-foreground/80 hover:border-[#C9A24A] disabled:opacity-60">
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Odśwież
      </button>
    </div>
  ) : null;

  return (
    <AdminShell me={me} tech={tech} techKeys={TECH} libOn={!!d.libOn} badges={badges}
      active={section || ""} title={current ? current[0] : "Pulpit"} actions={actions} onPreload={preload}>
      <MfaGate>
        <Suspense fallback={<Spinner />}>
          {!section
            ? (tech ? <TechDashboard sections={TECH.map((k) => [k, SECTIONS[k][0]])} /> : <AdminDashboard d={d} />)
            : current ? current[1]() : <p className="text-foreground/55">Nie ma takiej sekcji.</p>}
        </Suspense>
      </MfaGate>
    </AdminShell>
  );
}
