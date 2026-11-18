import React, { useState } from "react";
import { ArrowRight, Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";
import RegistrationForm from "./RegistrationForm";
import TicketBuy from "./TicketBuy";

// Blok zapisu na stronie wydarzenia — zależnie od registration_type. Logika zapisu bez zmian.
const FIELD =
  "min-h-[48px] w-full rounded-exm-field border border-exm-line bg-exm-bg px-4 py-3 text-[16px] text-exm-text placeholder:text-exm-muted focus:border-exm-gold focus:outline-none";

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
      <p className="border-l-2 border-exm-gold pl-5 leading-relaxed text-exm-muted">
        Nie trzeba się zapisywać — po prostu przyjdź.
      </p>
    );
  }

  if (ev.registration_type === "Link zewnętrzny") {
    return (
      <div className="space-y-6">
        {ev.external_url && (
          <a href={ev.external_url} target="_blank" rel="noreferrer" className="btn-relic w-full">
            Dołącz <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
        {remindSent ? (
          <p className="leading-relaxed text-exm-muted">Przypomnę Ci o tym spotkaniu e-mailem.</p>
        ) : (
          <form onSubmit={remind} className="flex flex-col gap-3">
            <label htmlFor="remind-email" className="block">
              <span className="technical mb-2 block text-[10px] text-exm-muted">Przypomnienie e-mailem</span>
              <input
                id="remind-email"
                type="email"
                required
                value={remindEmail}
                onChange={(e) => setRemindEmail(e.target.value)}
                placeholder="Twój e-mail"
                className={FIELD}
              />
            </label>
            <button type="submit" disabled={remindBusy} className="btn-ghost w-full">
              <Bell className="h-4 w-4" aria-hidden="true" /> {remindBusy ? "Zapisuję…" : "Przypomnij mi"}
            </button>
          </form>
        )}
        {remindError && <p role="alert" className="text-sm leading-relaxed text-exm-error">{remindError}</p>}
      </div>
    );
  }

  // Wydarzenie płatne z biletami na stronie: zakup biletu zamiast formularza zapisu.
  if (ev.tickets && Number(ev.price) > 0) return <TicketBuy event={ev} />;

  return <RegistrationForm event={ev} />;
}