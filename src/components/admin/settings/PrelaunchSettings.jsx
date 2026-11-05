import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Wrench } from "lucide-react";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { NO_END, hasEnd } from "@/lib/usePrelaunch";
import { isoToWarsawLocal, warsawLocalToIso, fmtWarsaw } from "@/lib/warsawTime";
import DisableConfirm from "./DisableConfirm";

const inp = "dt-input relative bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";

// Przerwa techniczna (ustawienie „premiera”: do, wylaczony). Goście widzą stronę przerwy,
// zalogowani klienci i administrator — pełną stronę. Koniec o podanej godzinie albo ręcznie.
export default function PrelaunchSettings({ initial }) {
  const [p, setP] = useState(initial);
  const active = !p.wylaczony && new Date() < new Date(p.do);
  const [local, setLocal] = useState(active && hasEnd(p.do) ? isoToWarsawLocal(p.do) : "");
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { setMode } = useAdminMode();

  const endIso = () => (local ? warsawLocalToIso(local) : NO_END);
  const save = async (next, text) => {
    if (!next.wylaczony && new Date(next.do) <= new Date()) { setMsg({ ok: false, text: "Godzina końca musi być w przyszłości." }); return; }
    await base44.functions.invoke("adminSettings", { action: "save", target: "premiera", data: next })
      .then(() => { setP(next); setMsg({ ok: true, text }); qc.invalidateQueries({ queryKey: ["siteSettings"] }); })
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się zapisać." }));
  };
  const preview = () => { setMode("guest"); navigate("/"); };
  const status = active
    ? `Włączona${hasEnd(p.do) ? ` do ${fmtWarsaw(p.do)}` : " bez godziny końca"}. Goście widzą stronę przerwy; zalogowani klienci i Ty — pełną stronę.`
    : "Wyłączona. Wszyscy widzą pełną stronę.";

  return (
    <section className="border hairline p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2"><Wrench className="h-5 w-5 gold-text" /><h2 className="relic-heading text-xl">Przerwa techniczna</h2></div>
      <p className={`text-sm mb-6 ${active ? "gold-text" : "text-foreground/50"}`}>{status}</p>
      <label className="block technical text-[10px] text-foreground/60 mb-2">Koniec przerwy (czas polski, opcjonalnie — puste: kończysz ręcznie)</label>
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} className={inp} />
        {active && <button onClick={() => save({ ...p, do: endIso(), wylaczony: false }, local ? "Zapisano godzinę końca. Przerwa skończy się sama." : "Przerwa trwa do czasu, aż ją zakończysz.")} className="btn-ghost">ZAPISZ GODZINĘ KOŃCA</button>}
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        {active
          ? <button onClick={() => save({ ...p, wylaczony: true }, "Przerwa zakończona. Wszyscy widzą pełną stronę.")} className="btn-relic">ZAKOŃCZ PRZERWĘ TERAZ</button>
          : <button onClick={() => setConfirm(true)} className="btn-blood">WŁĄCZ PRZERWĘ TECHNICZNĄ</button>}
        <button onClick={preview} className="btn-ghost">PODGLĄD: JAK WIDZI TO GOŚĆ</button>
      </div>
      <p className="text-sm text-foreground/55 leading-relaxed">
        Otwarte dla gości także w czasie przerwy: logowanie i rejestracja, Kontakt, dokumenty prawne oraz linki z maili (bilety, karty,
        rezerwacje, potwierdzenia, powrót z płatności). Płatności PayU, maile i zadania w tle działają bez zmian.{" "}
        <Link to="/admin/tresci?tab=teksty&strona=system" className="gold-text underline underline-offset-4">Teksty strony przerwy</Link>
      </p>
      {msg && <p className={`text-sm mt-6 ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</p>}
      <DisableConfirm open={confirm} onOpenChange={setConfirm} until={local ? fmtWarsaw(endIso()) : null}
        onConfirm={() => save({ ...p, do: endIso(), wylaczony: false }, "Przerwa techniczna włączona. Goście widzą stronę przerwy.")} />
    </section>
  );
}
