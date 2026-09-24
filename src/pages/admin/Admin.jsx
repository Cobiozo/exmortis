import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";
import ProductsManager from "@/components/admin/ProductsManager";
import NewsletterManager from "@/components/admin/NewsletterManager";
import ContentManager from "@/components/admin/ContentManager";
import IntegrationsManager from "@/components/admin/IntegrationsManager";
import QuizStatsPanel from "@/components/admin/QuizStatsPanel";
import SilenceManager from "@/components/admin/SilenceManager";
import SilenceStatsPanel from "@/components/admin/SilenceStatsPanel";
import EventsManager from "@/components/admin/EventsManager";
import { ShieldAlert, Package, Mail, LogOut, LayoutList, Plug, ClipboardList, Moon, CalendarDays } from "lucide-react";

const tabBtn = (active) =>
  `inline-flex items-center gap-2 px-6 py-3 technical text-[10px] border transition-colors ${
    active ? "border-[#C9A24A] gold-text bg-[#C9A24A]/5" : "hairline text-foreground/50 hover:text-foreground"
  }`;

export default function Admin() {
  const [me, setMe] = useState(undefined);
  const [tab, setTab] = useState("produkty");

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => setMe(u))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }

  if (!me || me.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 gap-6 px-5 text-center">
        <ShieldAlert className="h-12 w-12 blood-text" />
        <p className="relic-heading text-3xl">Strefa administratora</p>
        <p className="text-foreground/50 max-w-sm">
          {me
            ? "To konto nie ma uprawnień administratora."
            : "Zaloguj się kontem administratora, by wejść do zaplecza."}
        </p>
        {!me && (
          <Link to="/login?returnTo=%2Fadmin" className="btn-relic">
            ZALOGUJ SIĘ
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] pt-24 pb-20 px-5 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-10 border-b hairline">
          <div className="flex items-center gap-4">
            <Logo className="h-14 w-14" glow={false} />
            <div>
              <p className="technical text-[10px] gold-text mb-1">ZAPLECZE</p>
              <h1 className="relic-heading text-3xl">Administrator</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="technical text-[10px] text-foreground/40">{me.email}</span>
            <button onClick={() => base44.auth.logout()} className="btn-ghost !px-4 !py-2">
              <LogOut className="h-4 w-4" /> WYLOGUJ
            </button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 mt-8 mb-10">
          <button onClick={() => setTab("produkty")} className={tabBtn(tab === "produkty")}>
            <Package className="h-4 w-4" /> PRODUKTY
          </button>
          <button onClick={() => setTab("newsletter")} className={tabBtn(tab === "newsletter")}>
            <Mail className="h-4 w-4" /> NEWSLETTER I SUBSKRYBENCI
          </button>
          <button onClick={() => setTab("testy")} className={tabBtn(tab === "testy")}>
            <ClipboardList className="h-4 w-4" /> WYNIKI TESTU
          </button>
          <button onClick={() => setTab("tresci")} className={tabBtn(tab === "tresci")}>
            <LayoutList className="h-4 w-4" /> TREŚCI STRON
          </button>
          <button onClick={() => setTab("integracje")} className={tabBtn(tab === "integracje")}>
            <Plug className="h-4 w-4" /> INTEGRACJE
          </button>
          <button onClick={() => setTab("cisza")} className={tabBtn(tab === "cisza")}>
            <Moon className="h-4 w-4" /> MINUTNIK CISZY
          </button>
          <button onClick={() => setTab("spotkania")} className={tabBtn(tab === "spotkania")}>
            <CalendarDays className="h-4 w-4" /> SPOTKANIA
          </button>
        </nav>

        {tab === "produkty" ? (
          <ProductsManager />
        ) : tab === "newsletter" ? (
          <NewsletterManager />
        ) : tab === "testy" ? (
          <QuizStatsPanel />
        ) : tab === "integracje" ? (
          <IntegrationsManager />
        ) : tab === "cisza" ? (
          <div className="space-y-16">
            <SilenceManager />
            <SilenceStatsPanel />
          </div>
        ) : tab === "spotkania" ? (
          <EventsManager />
        ) : (
          <ContentManager />
        )}
      </div>
    </div>
  );
}