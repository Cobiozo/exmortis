import React, { useState } from "react";
import { ArrowRight, Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";
import RegistrationForm from "./RegistrationForm";
import TicketBuy from "./TicketBuy";

// Blok zapisu na stronie wydarzenia — zależnie od registration_type.
export default function RegistrationBlock({ event: ev }) {
  const [remindEmail, setRemindEmail] = useState("");
  const [remindSent, setRemindSent] = useState(false);
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindError, setRemindError] = useState("");

  const remind = async (e) => {
    e.preventDefault();
    if (remindBusy) return;
    setRemindBusy(true);
    setRemindError("");
    try {
      const src = new URLSearchParams(window.location.search).get("src") || "";
      await base44.functions.invoke("eventsPublic", {
        action: "remind",
        slug: ev.slug,
        email: remindEmail,
        first_name: remindEmail.split("@")[0],
        source: src,
      });
      setRemindSent(true);
    } catch {
      setRemindError("Nie udało się. Spróbuj ponownie.");
    } finally {
      setRemindBusy(false);
    }
  };

  if (ev.registration_type === "Bez zapisu") {
    return (
      <p className="text-foreground/60 leading-relaxed border-l-2 border-[#C9A24A] pl-5">
        Nie trzeba się zapisywać — po prostu przyjdź.
      </p>
    );
  }

  if (ev.registration_type === "Link zewnętrzny") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          {ev.external_url && (
            <a href={ev.external_url} target="_blank" rel="noreferrer" className="btn-relic">
              DOŁĄCZ <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
        {remindSent ? (
          <p className="text-foreground/70 leading-relaxed">Przypomnę Ci o tym spotkaniu e-mailem.</p>
        ) : (
          <form onSubmit={remind} className="flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="email"
              required
              value={remindEmail}
              onChange={(e) => setRemindEmail(e.target.value)}
              placeholder="Przypomnij mi — Twój e-mail"
              className="flex-1 bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-sm focus:border-[#C9A24A] focus:outline-none transition-colors"
            />
            <button type="submit" disabled={remindBusy} className="btn-ghost !px-5 !py-4 whitespace-nowrap disabled:opacity-60">
              <Bell className="h-4 w-4" /> {remindBusy ? "ZAPISUJĘ..." : "PRZYPOMNIJ MI"}
            </button>
          </form>
        )}
        {remindError && <p className="technical text-[10px] blood-text">{remindError}</p>}
      </div>
    );
  }

  // Wydarzenie płatne z biletami na stronie: zakup biletu zamiast formularza zapisu.
  if (ev.tickets && Number(ev.price) > 0) return <TicketBuy event={ev} />;

  return <RegistrationForm event={ev} />;
}