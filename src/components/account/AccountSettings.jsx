import React from "react";
import { base44 } from "@/api/base44Client";
import AccountDataCard from "./settings/AccountDataCard";
import ListyCard from "./settings/ListyCard";
import SecurityCard from "./settings/SecurityCard";
import YourDataCard from "./settings/YourDataCard";
import { BTN_SECONDARY } from "./settings/SettingsCard";

export default function AccountSettings({ me }) {
  return (
    <div className="max-w-2xl flex flex-col gap-4 sm:gap-6">
      <AccountDataCard me={me} />
      <ListyCard />
      <SecurityCard me={me} />
      <YourDataCard me={me} />
      <div className="pt-2">
        <button type="button" onClick={() => base44.auth.logout("/")} className={BTN_SECONDARY}>Wyloguj</button>
      </div>
    </div>
  );
}