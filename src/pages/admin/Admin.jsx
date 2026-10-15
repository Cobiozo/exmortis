import React, { Suspense, useEffect, useState } from "react";
import lazyPage from "@/lib/lazyPage";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";
const ProductsManager = lazyPage(() => import("@/components/admin/ProductsManager"));
const NewsletterManager = lazyPage(() => import("@/components/admin/NewsletterManager"));
const ContentHub = lazyPage(() => import("@/components/admin/cms/ContentHub"));
const NavEditor = lazyPage(() => import("@/components/admin/cms/nav/NavEditor"));
const IntegrationsManager = lazyPage(() => import("@/components/admin/IntegrationsManager"));
const SiteSettingsPanel = lazyPage(() => import("@/components/admin/settings/SiteSettingsPanel"));
const QuizStatsPanel = lazyPage(() => import("@/components/admin/QuizStatsPanel"));
const SilencePanel = lazyPage(() => import("@/components/admin/silence/SilencePanel"));
const SilenceStatsPanel = lazyPage(() => import("@/components/admin/SilenceStatsPanel"));
const EventsManager = lazyPage(() => import("@/components/admin/EventsManager"));
import AdminDashboard from "@/components/admin/AdminDashboard";
const ContactsTabs = lazyPage(() => import("@/components/admin/ContactsTabs"));
const PodcastAdmin = lazyPage(() => import("@/components/admin/podcast/PodcastAdmin"));
const ObokAdmin = lazyPage(() => import("@/components/admin/obok/ObokAdmin"));
const ClientsPanel = lazyPage(() => import("@/components/admin/clients/ClientsPanel"));
const SecurityPanel = lazyPage(() => import("@/components/admin/security/SecurityPanel"));
import { useNoIndex } from "@/lib/useNoIndex";
const DiscountsPanel = lazyPage(() => import("@/components/admin/DiscountsPanel"));
const PersonDataPanel = lazyPage(() => import("@/components/admin/gdpr/PersonDataPanel"));
const PlaylistManager = lazyPage(() => import("@/components/exmortis/glos/PlaylistManager"));
import { ShieldAlert, ArrowLeft } from "lucide-react";
import PanelHeaderActions from "@/components/admin/PanelHeaderActions";
import TechDashboard from "@/components/admin/TechDashboard";
const AnnouncementsAdmin = lazyPage(() => import("@/components/admin/announce/AnnouncementsAdmin"));
const BookingAdmin = lazyPage(() => import("@/components/admin/booking/BookingAdmin"));
const LibraryPanel = lazyPage(() => import("@/components/admin/library/LibraryPanel"));
const GroupsTab = lazyPage(() => import("@/components/admin/library/GroupsTab"));
const MessagesPanel = lazyPage(() => import("@/components/admin/library/MessagesPanel"));
const HistoryPanel = lazyPage(() => import("@/components/admin/library/HistoryPanel"));
const OrdersPanel = lazyPage(() => import("@/components/admin/orders/OrdersPanel"));
const RozdrozaAdmin = lazyPage(() => import("@/components/admin/rozdroza/RozdrozaAdmin"));

const SECTIONS = {
  spotkania: ["Spotkania", () => <EventsManager />],
  rezerwacje: ["Rezerwacje 1:1", () => <BookingAdmin />],
  ogloszenia: ["Ogłoszenia", () => <AnnouncementsAdmin />],
  cisza: ["Cisza", () => <SilencePanel />],
  skarbiec: ["Skarbiec", () => <ProductsManager />],
  zamowienia: ["Zamówienia", () => <OrdersPanel />],
  statystyki: ["Statystyki", () => <div className="space-y-16"><SilenceStatsPanel /><QuizStatsPanel /></div>],
  glos: ["Głos", () => <PlaylistManager onMutate={() => {}} />],
  kontakty: ["Baza kontaktów", () => <ContactsTabs />],
  podcast: ["Podcast", () => <PodcastAdmin />],
  obok: ["Obok", () => <ObokAdmin />],
  rozdroza: ["Rozdroża", () => <Suspense fallback={<div className="w-6 h-6 border-2 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />}><RozdrozaAdmin /></Suspense>],
  klienci: ["Klienci i dostępy", () => <ClientsPanel />],
  biblioteka: ["Biblioteka", () => <LibraryPanel />],
  grupy: ["Grupy", () => <GroupsTab />],
  // Sekcje modułu biblioteki i wiadomości — wyłącznie dla roli „admin".
  wiadomosci: ["Wiadomości", () => <MessagesPanel />],
  historia: ["Historia zmian", () => <HistoryPanel />],
  rabaty: ["Kody rabatowe", () => <DiscountsPanel />],
  bezpieczenstwo: ["Bezpieczeństwo", () => <SecurityPanel />],
  "dane-osoby": ["Dane osoby (RODO)", () => <PersonDataPanel />],
  newsletter: ["Newsletter i subskrybenci", () => <NewsletterManager />],
  tresci: ["Treści stron", () => <ContentHub />],
  menu: ["Menu i stopka", () => <NavEditor />],
  integracje: ["Integracje", () => <IntegrationsManager />],
  ustawienia: ["Ustawienia strony", () => <SiteSettingsPanel />],
  testy: ["Wyniki testu", () => <QuizStatsPanel />],
};

// Rola „techniczna”: ustawienia, treści, wygląd — bez danych osobowych.
const TECH = ["tresci", "menu", "ustawienia", "integracje", "cisza"];

export default function Admin() {
  useNoIndex();
  const { section } = useParams();
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }

  const tech = me?.role === "techniczna";
  if (!me || (me.role !== "admin" && !tech) || (tech && section && !TECH.includes(section))) {
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

  return (
    <div className="min-h-screen bg-[#0A0A0B] pt-16 pb-20 px-5 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-10 border-b hairline">
          <div className="flex items-center gap-4">
            <Link to="/admin" aria-label="Pulpit"><Logo className="h-14 w-14" glow={false} /></Link>
            <div>
              <p className="technical text-[10px] gold-text mb-1">ZAPLECZE</p>
              <h1 className="relic-heading text-3xl">{current ? current[0] : "Pulpit"}</h1>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <PanelHeaderActions />
            <span className="technical text-[10px] text-foreground/40">{me.email}</span>
          </div>
        </header>

        {section && (
          <Link to="/admin" className="inline-flex items-center gap-2 technical text-[10px] text-foreground/55 hover:gold-text mt-8">
            <ArrowLeft className="h-4 w-4" /> PULPIT
          </Link>
        )}

        <div className="mt-10">
          {/* Sekcje panelu ładują się osobno — telefon nie pobiera całego panelu naraz. */}
          <Suspense fallback={<div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>}>
            {!section ? (tech ? <TechDashboard sections={TECH.map((k) => [k, SECTIONS[k][0]])} /> : <AdminDashboard />) : current ? current[1]() : <p className="text-foreground/55">Nie ma takiej sekcji.</p>}
          </Suspense>
        </div>
      </div>
    </div>
  );
}