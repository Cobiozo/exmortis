import React, { useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PowrotAppCard, { surveyState } from "./PowrotAppCard";
import PowrotDeleteDialog from "./PowrotDeleteDialog";

// Zgłoszenia POWRÓT: etap 1 z formularza na stronie, odpowiedzi pełnej ankiety i wysyłka linku.
export default function PowrotPanel() {
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [deleting, setDeleting] = useState(false);
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

  // Wejście z Bazy kontaktów: /admin/powrot?email=... od razu otwiera kartę tego zgłoszenia.
  const mailFromUrl = new URLSearchParams(window.location.search).get("email");
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !rows || !mailFromUrl) return;
    autoOpened.current = true;
    const match = rows.find((r) => String(r.email || "").toLowerCase() === mailFromUrl.toLowerCase());
    if (match) setOpenId(match.id);
  }, [rows, mailFromUrl]);

  const send = async (id) => {
    if (!id) return;
    setSendingId(id);
    setError("");
    setNotice("");
    try {
      const r = await base44.functions.invoke("adminPowrot", { action: "survey", id });
      setNotice(r.data?.mail === "wyslany" ? "Wysłane na adres z zgłoszenia." : "Mail czeka w kolejce wysyłki — wyjdzie z najbliższą partią.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || "Nie udało się wysłać ankiety.");
    } finally {
      setSendingId(null);
    }
  };

  // Usunięcie zgłoszenia (razem z odpowiedziami ankiety) — tylko ten wiersz w bazie POWRÓT.
  const del = rows?.find((r) => r.id === delId) || null;
  const remove = async () => {
    if (!del) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      await base44.functions.invoke("adminPowrot", { action: "delete", id: del.id });
      if (openId === del.id) setOpenId(null);
      setDelId(null);
      await load();
      setNotice("Zgłoszenie usunięte.");
    } catch (e) {
      setError(e?.response?.data?.error || "Nie udało się usunąć zgłoszenia.");
      setDelId(null);
    } finally {
      setDeleting(false);
    }
  };

  // Wysyłka z tabeli — bez otwierania karty, z potwierdzeniem.
  const sendRow = (row) => {
    if (!row) return;
    if (!window.confirm(`Wysłać ankietę do ${row.full_name} (${row.email})?`)) return;
    send(row.id);
  };

  if (rows === null) return <p className="text-sm text-foreground/50">Ładowanie…</p>;

  return (
    <div className="space-y-4">
      {loadError && <p className="text-sm blood-text">{loadError}</p>}
      {!open && notice && <p className="text-xs gold-text">{notice}</p>}
      {!open && error && <p className="text-xs blood-text">{error}</p>}
      {open && (
        <PowrotAppCard
          key={open.id}
          a={open}
          sending={sendingId === open.id}
          error={error}
          notice={notice}
          onSend={() => send(open.id)}
          onDelete={() => setDelId(open.id)}
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
                  <td className="p-3">
                    <p className={`text-xs ${st.key === "done" ? "gold-text" : st.key === "expired" ? "blood-text" : "text-foreground/55"}`}>{st.label}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); sendRow(r); }}
                      disabled={sendingId === r.id || st.key === "done"}
                      title={st.key === "none" ? "Wyślij ankietę" : "Wyślij ankietę ponownie"}
                      className="btn-ghost !py-1.5 !px-3 text-[9px] mt-2 whitespace-nowrap disabled:opacity-40"
                    >
                      {sendingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      {st.key === "none" ? "WYŚLIJ ANKIETĘ" : "WYŚLIJ PONOWNIE"}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {r.pilne && <span className="bg-[#BC1E22] text-[#F5EFE1] technical text-[9px] px-2 py-0.5">SPRAWDŹ PILNIE</span>}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDelId(r.id); }}
                        title="Usuń zgłoszenie"
                        aria-label="Usuń zgłoszenie"
                        className="p-1 text-foreground/40 hover:text-[#BC1E22]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="p-6 text-foreground/45">Brak zgłoszeń.</td></tr>}
          </tbody>
        </table>
      </div>
      <PowrotDeleteDialog
        app={del}
        open={!!del}
        onOpenChange={(v) => { if (!v) setDelId(null); }}
        onConfirm={remove}
        busy={deleting}
      />
    </div>
  );
}