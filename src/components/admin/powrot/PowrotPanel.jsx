import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PowrotAppCard, { surveyState } from "./PowrotAppCard";

// Zgłoszenia POWRÓT: etap 1 z formularza na stronie, odpowiedzi pełnej ankiety i wysyłka linku.
export default function PowrotPanel() {
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = () =>
    base44.functions
      .invoke("adminPowrot", { action: "list" })
      .then((r) => { setRows(r.data.applications || []); setLoadError(""); })
      .catch((e) => { setRows([]); setLoadError(e?.response?.data?.error || "Nie udało się wczytać zgłoszeń."); });

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = rows?.find((r) => r.id === openId) || null;

  const send = async () => {
    if (!open) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const r = await base44.functions.invoke("adminPowrot", { action: "survey", id: open.id });
      setNotice(r.data?.mail === "wyslany" ? "Wysłane na adres z zgłoszenia." : "Mail czeka w kolejce wysyłki — wyjdzie z najbliższą partią.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || "Nie udało się wysłać ankiety.");
    } finally {
      setSending(false);
    }
  };

  if (rows === null) return <p className="text-sm text-foreground/50">Ładowanie…</p>;

  return (
    <div className="space-y-4">
      {loadError && <p className="text-sm blood-text">{loadError}</p>}
      {open && (
        <PowrotAppCard
          key={open.id}
          a={open}
          sending={sending}
          error={error}
          notice={notice}
          onSend={send}
          onClose={() => { setOpenId(null); setNotice(""); setError(""); }}
        />
      )}
      <div className="overflow-x-auto border hairline">
        <table className="w-full text-sm">
          <thead className="technical text-[9px] text-foreground/40 text-left">
            <tr>
              <th className="p-3">DATA</th>
              <th className="p-3">OSOBA</th>
              <th className="p-3">KONTAKT</th>
              <th className="p-3">PEŁNA ANKIETA</th>
              <th className="p-3">OZNACZENIA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = surveyState(r);
              return (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="border-t hairline cursor-pointer hover:bg-[#121212]">
                  <td className="p-3 text-foreground/50 whitespace-nowrap">{new Date(r.created_date).toLocaleDateString("pl-PL")}</td>
                  <td className="p-3">{r.full_name}</td>
                  <td className="p-3 text-foreground/60">{r.email}{r.phone ? <span className="block text-xs text-foreground/40">{r.phone}</span> : null}</td>
                  <td className={`p-3 text-xs ${st.key === "done" ? "gold-text" : st.key === "expired" ? "blood-text" : "text-foreground/55"}`}>{st.label}</td>
                  <td className="p-3">
                    {r.pilne && <span className="bg-[#BC1E22] text-[#F5EFE1] technical text-[9px] px-2 py-0.5">SPRAWDŹ PILNIE</span>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="p-6 text-foreground/45">Brak zgłoszeń.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}