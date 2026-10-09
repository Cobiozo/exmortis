import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Search, Download, Trash2 } from "lucide-react";
import PersonDeleteBox from "./PersonDeleteBox";

// RODO art. 15 i 17 — jedno miejsce dla obu baz (Supabase i baza aplikacji).
export default function PersonDataPanel() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [found, setFound] = useState(null);
  const [error, setError] = useState("");

  const call = async (action, extra = {}) => {
    setBusy(action); setError("");
    const r = await base44.functions.invoke("gdprPerson", { action, email: email.trim(), ...extra })
      .catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setBusy("");
    if (r.data.error) setError(r.data.error);
    return r.data;
  };
  const find = async () => { const d = await call("find"); if (!d.error) setFound(d); };
  const exportData = async () => {
    const d = await call("export");
    if (d.error) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
    a.download = `dane-${email.trim()}.json`;
    a.click();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-foreground/60">Wpisz adres e-mail osoby, która prosi o wydanie lub usunięcie danych. Wyszukiwanie obejmuje Supabase i bazę aplikacji.</p>
      <div className="flex flex-wrap gap-3">
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFound(null); }} placeholder="adres@e-mail.pl"
          className="flex-1 min-w-[240px] bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none" />
        <button onClick={find} disabled={!email || !!busy} className="btn-relic !py-3">{busy === "find" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} ZNAJDŹ</button>
      </div>
      {error && <p role="alert" className="text-sm text-[#E8C547]">{error}</p>}
      {found && (
        <div className="border hairline p-5 space-y-4">
          {found.summary.length === 0 ? <p className="text-foreground/60">Brak danych dla tego adresu w obu bazach.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="technical text-[10px] text-foreground/50 text-left"><th className="py-2">Baza</th><th>Zbiór</th><th>Rekordy</th><th>Przy usuwaniu</th></tr></thead>
              <tbody>{found.summary.map((s) => (
                <tr key={s.baza + s.zbior} className="border-t hairline"><td className="py-2">{s.baza}</td><td>{s.zbior}</td><td>{s.liczba}</td><td className={s.zostaje ? "gold-text" : ""}>{s.zostaje ? "zostaje (obowiązek prawny / dowód)" : "usuwane"}</td></tr>
              ))}</tbody>
            </table>
          )}
          <div className="flex flex-wrap gap-3">
            <button onClick={exportData} disabled={!!busy} className="btn-ghost !py-3">{busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} EKSPORTUJ (JSON)</button>
          </div>
          {found.summary.length > 0 && <PersonDeleteBox email={email.trim()} busy={busy === "delete"} onDelete={(confirm) => call("delete", { confirm })} onDone={find} icon={Trash2} />}
        </div>
      )}
    </div>
  );
}