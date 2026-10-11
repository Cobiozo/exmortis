import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";
import ProductsManager from "@/components/admin/ProductsManager";
import NewsletterManager from "@/components/admin/NewsletterManager";
import ContentHub from "@/components/admin/cms/ContentHub";
import NavEditor from "@/components/admin/cms/nav/NavEditor";
import IntegrationsManager from "@/components/admin/IntegrationsManager";
import SiteSettingsPanel from "@/components/admin/settings/SiteSettingsPanel";
import QuizStatsPanel from "@/components/admin/QuizStatsPanel";
import SilencePanel from "@/components/admin/silence/SilencePanel";
import SilenceStatsPanel from "@/components/admin/SilenceStatsPanel";
import EventsManager from "@/components/admin/EventsManager";
import AdminDashboard from "@/components/admin/AdminDashboard";
import ContactsTabs from "@/components/admin/ContactsTabs";
import PodcastAdmin from "@/components/admin/podcast/PodcastAdmin";
import ObokAdmin from "@/components/admin/obok/ObokAdmin";
import ClientsPanel from "@/components/admin/clients/ClientsPanel";
import SecurityPanel from "@/components/admin/security/SecurityPanel";
import { useNoIndex } from "@/lib/useNoIndex";
import DiscountsPanel from "@/components/admin/DiscountsPanel";
import PersonDataPanel from "@/components/admin/gdpr/PersonDataPanel";
import PlaylistManager from "@/components/exmortis/glos/PlaylistManager";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import PanelHeaderActions from "@/components/admin/PanelHeaderActions";
import TechDashboard from "@/components/admin/TechDashboard";
import AnnouncementsAdmin from "@/components/admin/announce/AnnouncementsAdmin";
import BookingAdmin from "@/components/admin/booking/BookingAdmin";
import LibraryPanel from "@/components/admin/library/LibraryPanel";
import GroupsTab from "@/components/admin/library/GroupsTab";
import MessagesPanel from "@/components/admin/library/MessagesPanel";
import HistoryPanel from "@/components/admin/library/HistoryPanel";

const SECTIONS = {
  spotkania: ["Spotkania", () => <EventsManager />],
  rezerwacje: ["Rezerwacje 1:1", () => <BookingAdmin />],
  ogloszenia: ["Ogłoszenia", () => <AnnouncementsAdmin />],
  cisza: ["Cisza", () => <SilencePanel />],
  skarbiec: ["Skarbiec", () => <ProductsManager />],
  statystyki: ["Statystyki", () => <div className="space-y-16"><SilenceStatsPanel /><QuizStatsPanel /></div>],
  glos: ["Głos", () => <PlaylistManager onMutate={() => {}} />],
  kontakty: ["Baza kontaktów", () => <ContactsTabs />],
  podcast: ["Podcast", () => <PodcastAdmin />],
  obok: ["Obok", () => <ObokAdmin />],
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
        <p className="text-foreground/50 max-w-sm">Ta część strony jest dostępna tylko dla administratora.</p>
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
          <Link to="/admin" className="inline-flex items-center gap-2 technical text-[10px] text-foreground/50 hover:gold-text mt-8">
            <ArrowLeft className="h-4 w-4" /> PULPIT
          </Link>
        )}

        <div className="mt-10">
          {!section ? (tech ? <TechDashboard sections={TECH.map((k) => [k, SECTIONS[k][0]])} /> : <AdminDashboard />) : current ? current[1]() : <p className="text-foreground/50">Nie ma takiej sekcji.</p>}
        </div>
      </div>
    </div>
  );
}