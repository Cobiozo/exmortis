import React, { useState } from "react";
import SubscribersPanel from "@/components/admin/newsletter/SubscribersPanel";
import GroupsPanel from "@/components/admin/newsletter/GroupsPanel";
import CampaignsPanel from "@/components/admin/newsletter/CampaignsPanel";

const subBtn = (active) =>
  `px-5 py-2 technical text-[10px] border transition-colors ${
    active ? "border-[#C9A24A] gold-text bg-[#C9A24A]/5" : "hairline text-foreground/50 hover:text-foreground"
  }`;

export default function NewsletterManager() {
  const [sub, setSub] = useState("subskrybenci");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8">
        <button onClick={() => setSub("subskrybenci")} className={subBtn(sub === "subskrybenci")}>
          SUBSKRYBENCI
        </button>
        <button onClick={() => setSub("grupy")} className={subBtn(sub === "grupy")}>
          GRUPY
        </button>
        <button onClick={() => setSub("kampanie")} className={subBtn(sub === "kampanie")}>
          KAMPANIE I WYSYŁKI
        </button>
      </div>
      {sub === "subskrybenci" ? (
        <SubscribersPanel />
      ) : sub === "grupy" ? (
        <GroupsPanel />
      ) : (
        <CampaignsPanel />
      )}
    </div>
  );
}