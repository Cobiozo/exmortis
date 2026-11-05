import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useNoIndex } from "@/lib/useNoIndex";
import MyProducts from "@/components/account/MyProducts";
import MyOrders from "@/components/account/MyOrders";
import AccountSettings from "@/components/account/AccountSettings";
import DailyThought from "@/components/account/DailyThought";
import AccountAnnouncements from "@/components/account/announce/AccountAnnouncements";
import MySessions from "@/components/account/sessions/MySessions";
import MyEvents from "@/components/account/events/MyEvents";
import MyLibrary from "@/components/account/library/MyLibrary";
import MyMessages from "@/components/account/messages/MyMessages";
import AccountUnreadMessage from "@/components/account/messages/AccountUnreadMessage";
import AccountShell from "@/components/account/shell/AccountShell";
import { useAccountState, visibleSections, labelOf } from "@/components/account/shell/accountNav";

// Nagłówki sekcji: nazwa jak w menu; opis tylko tam, gdzie ustalony (Biblioteka — 5.11.2026).
const INTRO = {
  biblioteka: { title: "Biblioteka", text: "Nagrania, playlisty i materiały na drogę powrotu." },
};

// /konto — tylko dla zalogowanych (ProtectedRoute). Sekcja wynika z adresu (?tab=…), więc odświeżenie,
// wstecz/dalej i linki z dzwonka trafiają we właściwe miejsce. Domyślnie: Moje produkty.
// Biblioteka i Wiadomości pokazują się wyłącznie wtedy, gdy moduł jest dla tej osoby dostępny.
export default function Account() {
  useNoIndex();
  const { search } = useLocation();
  const navigate = useNavigate();
  const state = useAccountState();
  const { me, cfg } = state;
  const tab = new URLSearchParams(search).get("tab") || "produkty";
  const go = (k) => navigate(`/konto?tab=${k}`);

  // Dawny adres zakładki Rozdroża prowadzi do jej trasy.
  useEffect(() => { if (tab === "rozdroza") navigate("/konto/rozdroza", { replace: true }); }, [tab, navigate]);

  if (me?.role === "zablokowane") {
    return (
      <div className="bg-[#0A0A0B] pt-28 pb-24 min-h-screen px-5 text-center space-y-6">
        <p className="relic-heading text-3xl">Konto nieaktywne</p>
        <button onClick={() => base44.auth.logout("/")} className="btn-ghost">WYLOGUJ</button>
      </div>
    );
  }

  // Zanim przełączniki dojdą, nie przeskakujemy między sekcjami.
  const active = !cfg || visibleSections(state).some((s) => s.key === tab) ? tab : "produkty";
  const intro = INTRO[active] || { title: labelOf(active) };

  const aside = (
    <>
      {cfg?.messages && (
        <AccountUnreadMessage
          initial={(cfg?.messages_data?.items || []).find((m) => !m.read_at) || null}
          onOpen={() => go("wiadomosci")}
        />
      )}
      <AccountAnnouncements />
    </>
  );
  const band = <DailyThought hasLibrary={!!cfg?.library} onLibrary={() => go("biblioteka")} />;

  return (
    <AccountShell state={state} active={active} aside={aside} band={band}>
      <div className="mb-6">
        <h2 className="shop-heading text-2xl md:text-3xl text-[#F5EFE1]">{intro.title}</h2>
        {intro.text && <p className="text-base text-[#F5EFE1]/75 mt-1">{intro.text}</p>}
      </div>
      {active === "produkty" && <MyProducts />}
      {active === "spotkania" && <MyEvents />}
      {active === "sesje" && <MySessions />}
      {active === "biblioteka" && <MyLibrary initial={cfg?.library_data} onGoToOrders={() => go("zakupy")} />}
      {active === "wiadomosci" && <MyMessages initial={cfg?.messages_data} footer={cfg?.footer} />}
      {active === "zakupy" && <MyOrders />}
      {active === "ustawienia" && me && <AccountSettings me={me} />}
    </AccountShell>
  );
}
