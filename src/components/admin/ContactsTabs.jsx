import React, { useState } from "react";
import ContactsPanel from "./ContactsPanel";
import ApplicationsTab from "./applications/ApplicationsTab";

export default function ContactsTabs() {
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") === "podcast" ? "podcast" : "all");
  const b = (id) => `technical text-[10px] px-4 py-2 border-b-2 ${tab === id ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/50"}`;
  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b hairline">
        <button onClick={() => setTab("all")} className={b("all")}>Wszystkie kontakty</button>
        <button onClick={() => setTab("podcast")} className={b("podcast")}>Zgłoszenia do podcastu</button>
      </div>
      {tab === "all" ? <ContactsPanel /> : <ApplicationsTab />}
    </div>
  );
}