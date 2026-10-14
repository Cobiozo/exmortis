import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import FindOwner from "./FindOwner";
import ClientErrors from "./ClientErrors";

const LABEL = { blokada: "Blokada wideo", wspoldzielenie: "Podejrzenie współdzielenia konta", znak_wodny: "Naruszenie znaku wodnego", wideo_limit: "Limit żądań wideo", rabat: "Limit prób kodu" };

export default function SecurityPanel() {
  const [alerts, setAlerts] = useState(null);
  const load = () => base44.functions.invoke("adminClients", { action: "security" }).then((r) => setAlerts(r.data.alerts));
  useEffect(() => { load(); }, []);
  const unblock = async (id) => { await base44.functions.invoke("adminClients", { action: "unblock", log_id: id }); load(); };

  return (
    <div className="space-y-14">
      <ClientErrors />
      <FindOwner />
      <section>
        <p className="technical text-[10px] gold-text mb-3">ALERTY I BLOKADY</p>
        {!alerts ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : alerts.length === 0 ? <p className="text-sm text-foreground/50">Brak alertów.</p> : (
          <div className="border hairline divide-y divide-[#3D3D3F]/60">
            {alerts.map((a) => {
              const activeBlock = a.type === "blokada" && !a.resolved && a.until > new Date().toISOString();
              return (
                <div key={a.id} className="p-4 flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex-1 min-w-[240px]">
                    <p className={activeBlock ? "blood-text" : ""}>{LABEL[a.type]} · {a.user_email}</p>
                    <p className="text-xs text-foreground/45">{new Date(a.created_date).toLocaleString("pl-PL")} · {a.ip} · {a.details}</p>
                  </div>
                  {activeBlock && <button onClick={() => unblock(a.id)} className="btn-ghost !px-3 !py-1.5 text-[10px]">ODBLOKUJ</button>}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-foreground/40 mt-3">Odebranie dostępu: sekcja „Klienci i dostępy”.</p>
      </section>
    </div>
  );
}