import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNoIndex } from "@/lib/useNoIndex";
import MyProducts from "@/components/account/MyProducts";
import MyOrders from "@/components/account/MyOrders";
import SeriesTiles from "@/components/obok/SeriesTiles";
import ObokNotifications from "@/components/obok/ObokNotifications";
import AccountSettings from "@/components/account/AccountSettings";

const TABS = [["produkty", "Moje produkty"], ["obok", "Obok"], ["zakupy", "Zakupy"], ["ustawienia", "Ustawienia"]];

// /konto — tylko dla zalogowanych (ProtectedRoute).
export default function Account() {
  useNoIndex();
  const [tab, setTab] = useState("produkty");
  const [me, setMe] = useState(null);
  useEffect(() => { base44.auth.me().then(setMe); }, []);
  if (me?.role === "zablokowane") {
    return (
      <div className="bg-[#0A0A0B] pt-28 pb-24 min-h-screen px-5 text-center space-y-6">
        <p className="relic-heading text-3xl">Konto nieaktywne</p>
        <button onClick={() => base44.auth.logout("/")} className="btn-ghost">WYLOGUJ</button>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0B] pt-28 pb-24 min-h-screen">
      <div className="mx-auto max-w-[1200px] px-5 md:px-10">
        <p className="technical text-[10px] gold-text mb-4">MOJE KONTO</p>
        <h1 className="shop-heading text-4xl md:text-5xl text-[#F5EFE1]">
          {me ? `Dobrze, że jesteś${me.imie ? `, ${me.imie}` : ""}.` : "Twoje miejsce"}
        </h1>
        <div className="flex gap-8 mt-12 mb-10 border-b hairline overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`pb-4 -mb-px technical text-[10px] whitespace-nowrap border-b ${tab === k ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/45 hover:text-[#F5EFE1]"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {tab === "produkty" && <MyProducts />}
        {tab === "obok" && <><SeriesTiles /><div className="mt-14"><ObokNotifications /></div></>}
        {tab === "zakupy" && <MyOrders />}
        {tab === "ustawienia" && me && <AccountSettings me={me} />}
      </div>
    </div>
  );
}