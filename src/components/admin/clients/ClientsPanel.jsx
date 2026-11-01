import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib } from "@/components/admin/library/libApi";
import ClientsClassic from "./ClientsClassic";
import ClientsLibraryList from "./ClientsLibraryList";
import AccountsTab from "./AccountsTab";

// Sekcja „Klienci i dostępy": pierwsza zakładka — KONTA (konta, logowania, status),
// druga — dotychczasowa lista klientów z dostępami. Gdy którykolwiek przełącznik modułu
// biblioteki jest włączony, lista dostaje kolumnę grup, filtry i akcje zbiorcze.
export default function ClientsPanel() {
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") === "dostepy" ? "dostepy" : "konta");
  const [libOn, setLibOn] = useState(null);
  useEffect(() => {
    lib("settings")
      .then((d) => setLibOn(d.settings.library_mode !== "off" || d.settings.messages_mode !== "off"))
      .catch(() => setLibOn(false));
  }, []);
  const b = (id) => `technical text-[10px] px-4 py-2 border-b-2 ${tab === id ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/50"}`;
  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b hairline">
        <button onClick={() => setTab("konta")} className={b("konta")}>Konta</button>
        <button onClick={() => setTab("dostepy")} className={b("dostepy")}>Klienci i dostępy</button>
      </div>
      {tab === "konta" ? <AccountsTab /> : libOn === null ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : libOn ? <ClientsLibraryList /> : <ClientsClassic />}
    </div>
  );
}