import React, { useState } from "react";
import SubscribersPanel from "@/components/admin/newsletter/SubscribersPanel";
import GroupsPanel from "@/components/admin/newsletter/GroupsPanel";
import CampaignsPanel from "@/components/admin/newsletter/CampaignsPanel";
import SeriesPanel from "@/components/admin/newsletter/SeriesPanel";
import { ViewTabs } from "@/components/admin/ui/kit";

export default function NewsletterManager() {
  const [sub, setSub] = useState("subskrybenci");

  return (
    <div>
      <div className="mb-8"><ViewTabs tabs={[["subskrybenci", "Subskrybenci"], ["grupy", "Grupy"], ["seria", "Seria startowa"], ["kampanie", "Kampanie i wysyłki"]]} value={sub} onChange={setSub} label="Newsletter" /></div>
      {sub === "subskrybenci" ? (
        <SubscribersPanel />
      ) : sub === "grupy" ? (
        <GroupsPanel />
      ) : sub === "seria" ? (
        <SeriesPanel />
      ) : (
        <CampaignsPanel />
      )}
    </div>
  );
}