import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib } from "@/components/admin/library/libApi";
import ClientsClassic from "./ClientsClassic";
import ClientsLibraryList from "./ClientsLibraryList";

// Sekcja „Klienci i dostępy". Gdy którykolwiek przełącznik modułu jest włączony,
// lista dostaje kolumnę grup, filtry i akcje zbiorcze. Przy obu „off" — widok jak dotąd.
export default function ClientsPanel() {
  const [libOn, setLibOn] = useState(null);
  useEffect(() => {
    lib("settings")
      .then((d) => setLibOn(d.settings.library_mode !== "off" || d.settings.messages_mode !== "off"))
      .catch(() => setLibOn(false));
  }, []);
  if (libOn === null) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;
  return libOn ? <ClientsLibraryList /> : <ClientsClassic />;
}