import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import FindOwner from "./FindOwner";
import ClientErrors from "./ClientErrors";

const LABEL = { blokada: "Blokada wideo", wspoldzielenie: "Podejrzenie współdzielenia konta", znak_wodny: "Naruszenie znaku wodnego", wideo_limit: "Limit żądań wideo", rabat: "Limit prób kodu" };

export default function SecurityPanel() {
  const [alerts, setAlerts] = useState(null);
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = () => base44.functions.invoke("adminClients", { action: "security" }).then((r) => setAlerts(r.data.alerts));
  useEffect(() => { load(); }, []);
  const unblock = async (id) => { await base44.functions.invoke("adminClients", { action: "unblock", log_id: id }); load(); };

  const block = async () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) { setMsg("Podaj poprawny e-mail."); return; }
    setBusy(true); setMsg("");
    const r = await base44.functions.invoke("adminClients", { action: "block", email: e, days });
    setBusy(false);
    if (r.data?.error) { setMsg(r.data.error); return; }
    setEmail("");
    setMsg(`Zablokowano odtwarzanie dla ${e}.`);
    load();
  };

  return (
    <div className="space-y-14">
      <ClientErrors />
      <FindOwner />
      <section>
        <p className="technical text-[10px] gold-text mb-3">ALERTY I BLOKADY</p>
        <div className="border hairline p-4 mb-3 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="technical text-[10px] text-foreground/45 block mb-1">E-MAIL KONTA</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ktos@example.com" className="w-full bg-transparent border hairline px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="technical text-[10px] text-foreground/45 block mb-1">NA JAK DŁUGO</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-card border hairline px-3 py-2 text-sm">
              <option value={1}>24 godziny</option>
              <option value={7}>7 dni</option>
              <option value={30}>30 dni</option>
            </select>
          </label>
          <button onClick={block} disabled={busy} className="btn-ghost !px-4 !py-2 text-[10px]">{busy ? "BLOKUJĘ…" : "ZABLOKUJ ODTWARZANIE"}</button>
        </div>
        {msg && <p className="text-xs gold-text mb-3">{msg}</p>}
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
        <p className="text-xs text-foreground/40 mt-3">Blokada wstrzymuje odtwarzanie materiałów na koncie; zdejmiesz ją przyciskiem „Odblokuj" na liście powyżej. Odebranie dostępu do produktów: sekcja „Klienci i dostępy”.</p>
      </section>
    </div>
  );
}