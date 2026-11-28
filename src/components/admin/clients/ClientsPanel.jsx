import React, { useEffect, useState } from "react";
import { ViewTabs, SkeletonList } from "@/components/admin/ui/kit";
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
  return (
    <div className="space-y-6">
      <ViewTabs tabs={[["konta", "Konta"], ["dostepy", "Klienci i dostępy"]]} value={tab} onChange={setTab} label="Widok klientów" />
      {tab === "konta" ? <AccountsTab /> : libOn === null ? <SkeletonList /> : libOn ? <ClientsLibraryList /> : <ClientsClassic />}
    </div>
  );
}