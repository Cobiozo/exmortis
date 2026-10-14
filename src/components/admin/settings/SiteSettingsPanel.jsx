import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import CompanySettings from "./CompanySettings";
import CompanyWarning from "./CompanyWarning";
import PrelaunchSettings from "./PrelaunchSettings";
import OfflineAppSettings from "./OfflineAppSettings";
import MailSettings from "@/components/admin/mail/MailSettings";
import EmailChangeToggle from "./EmailChangeToggle";
import LegalDocsSettings from "./LegalDocsSettings";
import LibrarySettingsPanel from "@/components/admin/library/LibrarySettingsPanel";
import VideoProtectionSettings from "./VideoProtectionSettings";
import ZoomFixedSettings from "./ZoomFixedSettings";
import PomiarSettings from "./PomiarSettings";
import FakturySettings from "./FakturySettings";
import BackupsPanel from "./BackupsPanel";
import { useAdminMode } from "@/components/admin/AdminModeContext";

// Ustawienia strony: dane firmy i tryb przedpremierowy.
export default function SiteSettingsPanel() {
  const [s, setS] = useState(null);
  const { isAdmin } = useAdminMode();
  useEffect(() => { base44.functions.invoke("adminSettings", { action: "get" }).then((r) => setS(r.data)); }, []);
  if (!s) return <p className="technical text-[10px] text-foreground/40">WCZYTUJĘ…</p>;
  return (
    <div className="space-y-8">
      <CompanyWarning />
      <PrelaunchSettings initial={s.premiera} />
      <OfflineAppSettings initial={s.aplikacja} />
      <CompanySettings initial={s.firma} />
      <LegalDocsSettings initial={s.dokumenty} />
      <MailSettings />
      <ZoomFixedSettings />
      <LibrarySettingsPanel />
      <VideoProtectionSettings />
      {isAdmin && <PomiarSettings initial={s.pomiar} />}
      {isAdmin && <FakturySettings initial={s.faktury} />}
      {isAdmin && <BackupsPanel />}
      <EmailChangeToggle />
    </div>
  );
}