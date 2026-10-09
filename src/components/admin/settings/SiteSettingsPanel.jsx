import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import CompanySettings from "./CompanySettings";
import PrelaunchSettings from "./PrelaunchSettings";

// Ustawienia strony: dane firmy i tryb przedpremierowy.
export default function SiteSettingsPanel() {
  const [s, setS] = useState(null);
  useEffect(() => { base44.functions.invoke("adminSettings", { action: "get" }).then((r) => setS(r.data)); }, []);
  if (!s) return <p className="technical text-[10px] text-foreground/40">WCZYTUJĘ…</p>;
  return (
    <div className="space-y-8">
      <PrelaunchSettings initial={s.premiera} />
      <CompanySettings initial={s.firma} />
    </div>
  );
}