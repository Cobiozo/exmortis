import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNoIndex } from "@/lib/useNoIndex";
import MyProducts from "@/components/account/MyProducts";
import MyOrders from "@/components/account/MyOrders";
import SeriesTiles from "@/components/obok/SeriesTiles";
import ObokNotifications from "@/components/obok/ObokNotifications";
import AccountSettings from "@/components/account/AccountSettings";
import DailyThought from "@/components/account/DailyThought";
import AccountAnnouncements from "@/components/account/announce/AccountAnnouncements";
import MySessions from "@/components/account/sessions/MySessions";
import { obok } from "@/components/obok/obokApi";
import { libBundle } from "@/components/account/library/libApi";
import MyLibrary from "@/components/account/library/MyLibrary";
import MyMessages from "@/components/account/messages/MyMessages";
import AccountUnreadMessage from "@/components/account/messages/AccountUnreadMessage";

const HEAD = [["produkty", "Moje produkty"], ["sesje", "Moje sesje"]];
const TAIL = [["obok", "Obok"], ["zakupy", "Zakupy"], ["ustawienia", "Ustawienia"]];

// /konto — tylko dla zalogowanych (ProtectedRoute). Zakładki biblioteki i wiadomości
// pokazują się wyłącznie wtedy, gdy moduł jest dla tej osoby dostępny (jeden lekki odczyt).
export default function Account() {
  useNoIndex();
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "produkty");
  const [me, setMe] = useState(null);
  const [hasObok, setHasObok] = useState(false);
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    // Wszystko równolegle: konto, Obok i jedno wejście do modułu (przełączniki + biblioteka + wiadomości).
    base44.auth.me().then(setMe);
    obok("home").then((d) => setHasObok(!!d.tiles?.length)).catch(() => {});
    libBundle().then(setCfg).catch(() => setCfg({ library: false, messages: false }));
  }, []);

  if (me?.role === "zablokowane") {
    return (
      <div className="bg-[#0A0A0B] pt-28 pb-24 min-h-screen px-5 text-center space-y-6">
        <p className="relic-heading text-3xl">Konto nieaktywne</p>
        <button onClick={() => base44.auth.logout("/")} className="btn-ghost">WYLOGUJ</button>
      </div>
    );
  }

  const TABS = [
    ...HEAD,
    ...(cfg?.library ? [["biblioteka", "Moja biblioteka"]] : []),
    ...(cfg?.messages ? [["wiadomosci", "Wiadomości"]] : []),
    ...TAIL,
  ];
  // Zanim przełączniki dojdą, nie przeskakujemy między zakładkami.
  const active = !cfg || TABS.some(([k]) => k === tab) ? tab : "produkty";

  return (
    <div className="bg-[#0A0A0B] pt-28 pb-24 min-h-screen">
      <div className="mx-auto max-w-[1200px] px-5 md:px-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="technical text-[10px] gold-text mb-4">MOJE KONTO</p>
            <h1 className="shop-heading text-4xl md:text-5xl text-[#F5EFE1]">
              {me ? `Dobrze, że jesteś${me.imie ? `, ${me.imie}` : ""}.` : "Twoje miejsce"}
            </h1>
          </div>
          <div className="w-full lg:max-w-[380px] flex flex-col gap-4">
            {cfg?.messages && (
              <AccountUnreadMessage
                initial={(cfg?.messages_data?.items || []).find((m) => !m.read_at) || null}
                onOpen={() => setTab("wiadomosci")}
              />
            )}
            <AccountAnnouncements />
            <DailyThought hasObok={hasObok} onObok={() => setTab("obok")} />
          </div>
        </div>
        <div className="flex gap-8 mt-12 mb-10 border-b hairline overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`pb-4 -mb-px technical text-[10px] whitespace-nowrap border-b ${active === k ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/45 hover:text-[#F5EFE1]"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {active === "produkty" && <MyProducts />}
        {active === "sesje" && <MySessions />}
        {active === "biblioteka" && <MyLibrary initial={cfg?.library_data} onGoToOrders={() => setTab("zakupy")} />}
        {active === "wiadomosci" && <MyMessages initial={cfg?.messages_data} footer={cfg?.footer} />}
        {active === "obok" && <><SeriesTiles /><div className="mt-14"><ObokNotifications /></div></>}
        {active === "zakupy" && <MyOrders />}
        {active === "ustawienia" && me && <AccountSettings me={me} />}
      </div>
    </div>
  );
}