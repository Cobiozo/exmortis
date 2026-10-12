import React, { useEffect, useRef, useState } from "react";
import { X, Loader2, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Lista oczekujących produktu: kto czeka, eksport CSV i jednorazowe powiadomienie „już dostępne”.
// Wysyłka partiami po 20 (serwer), każda osoba najwyżej raz; bez działającej wysyłki e-mail serwer odmawia.
const call = (body) => base44.functions.invoke("adminProducts", body).then((r) => r.data);
const osob = (n) => (n === 1 ? "osoba" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "osoby" : "osób");
const when = (s) => (s ? new Date(s).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" }) : "");

export default function WaitlistPanel({ product, onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [run, setRun] = useState(null); // { sent, queued, failed, left, done }
  const stop = useRef(false);

  const load = () => call({ action: "waitlist", id: product.id }).then((d) => setRows(d.rows || [])).catch((e) => setErr(e?.response?.data?.error || "Nie udało się wczytać listy."));
  useEffect(() => { load(); }, []);

  const pending = (rows || []).filter((r) => !r.notified_at).length;
  const ready = product.active && (product.status || "dostępny") === "dostępny";

  const send = async () => {
    setConfirm(false); setErr(""); stop.current = false;
    const tot = { sent: 0, queued: 0, failed: 0, left: pending, done: false };
    setRun({ ...tot });
    try {
      for (let i = 0; i < 200 && !stop.current; i++) {
        const d = await call({ action: "waitlist_notify", id: product.id, note });
        tot.sent += d.sent; tot.queued += d.queued; tot.failed += d.failed; tot.left = d.left;
        setRun({ ...tot });
        if (!d.left || d.sent + d.queued + d.failed === 0) break;
      }
    } catch (e) {
      setErr(e?.response?.data?.error || "Wysyłka przerwana.");
    }
    setRun({ ...tot, done: true });
    load();
  };

  const csv = () => {
    const lines = [["email", "imie", "zapis", "powiadomiono"], ...(rows || []).map((r) => [r.email, r.first_name || "", r.created_at || "", r.notified_at || ""])];
    const blob = new Blob(["﻿" + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `lista-oczekujacych-${product.slug || product.id}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Lista oczekujących">
      <div className="absolute inset-0 bg-[#0A0A0B]/85" onClick={run && !run.done ? undefined : onClose} />
      <div className="relative w-full max-w-2xl border border-[#C9A24A]/30 bg-[#0D0D0E] p-6 md:p-8 my-8">
        <button onClick={onClose} disabled={run && !run.done} className="absolute top-4 right-4 text-foreground/40 hover:text-foreground disabled:opacity-30" aria-label="Zamknij"><X className="h-4 w-4" /></button>
        <p className="technical text-[9px] gold-text mb-2">LISTA OCZEKUJĄCYCH</p>
        <h3 className="relic-heading text-2xl mb-1">{product.name}</h3>
        <p className="text-sm text-foreground/60 mb-6">
          {rows ? `${rows.length} ${osob(rows.length)} · czeka na powiadomienie: ${pending}` : "Wczytuję…"}
        </p>

        {rows && rows.length > 0 && (
          <div className="max-h-56 overflow-y-auto border hairline mb-4 text-xs">
            {rows.map((r) => (
              <div key={r.email} className="flex flex-wrap justify-between gap-2 px-3 py-2 border-b hairline last:border-0">
                <span className="text-foreground/80 break-all">{r.first_name ? `${r.first_name} · ` : ""}{r.email}</span>
                <span className="text-foreground/45">{r.notified_at ? `powiadomiono ${when(r.notified_at)}` : `zapis ${when(r.created_at)}`}</span>
              </div>
            ))}
          </div>
        )}
        {rows && rows.length > 0 && (
          <button type="button" onClick={csv} className="technical text-[10px] text-foreground/60 hover:gold-text inline-flex items-center gap-2 mb-8 min-h-[40px]"><Download className="h-4 w-4" /> POBIERZ CSV</button>
        )}

        <p className="technical text-[10px] gold-text mb-3">POWIADOMIENIE „JUŻ DOSTĘPNE”</p>
        {!ready && <p className="text-sm text-[#E8C547] mb-4">Najpierw zmień status produktu na „dostępny” i zapisz — list prowadzi do strony, na której można kupić.</p>}
        <p className="text-xs text-foreground/55 mb-3 leading-relaxed">
          List zawiera: nazwę, podtytuł, aktualną cenę (z datą końca przedsprzedaży i następną ceną) i przycisk „Zobacz w Skarbcu”. Każda osoba dostaje go najwyżej raz.
          Darmowe Brevo wysyła do 300 maili dziennie — przy dłuższej liście reszta poczeka w kolejce poczty.
        </p>
        <label className="technical text-[9px] text-foreground/50 block mb-2">WŁASNE ZDANIA (OPCJONALNIE, BEZ HTML)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1500))} rows={4} className="w-full bg-transparent border hairline px-4 py-3 text-sm focus:border-[#C9A24A] focus:outline-none mb-4" placeholder="Np. dlaczego to napisałem albo kod rabatowy dla listy." />

        {err && <p className="text-sm blood-text mb-4" role="alert">{err}</p>}
        {run && (
          <p className="text-sm text-foreground/75 mb-4" role="status">
            {!run.done && <Loader2 className="h-4 w-4 animate-spin inline mr-2" />}
            Wysłano: {run.sent} · w kolejce poczty: {run.queued} · błędy: {run.failed} · zostało: {run.left}
            {run.done && run.failed > 0 && " — błędy sprawdzisz w Ustawienia strony → Wysyłka e-mail → Dziennik."}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {run && !run.done ? (
            <button type="button" onClick={() => { stop.current = true; }} className="btn-ghost !px-5 !py-3 text-[10px]">ZATRZYMAJ</button>
          ) : confirm ? (
            <>
              <button type="button" onClick={send} className="btn-relic !px-5 !py-3">TAK, WYŚLIJ DO {pending}</button>
              <button type="button" onClick={() => setConfirm(false)} className="btn-ghost !px-5 !py-3 text-[10px]">ANULUJ</button>
            </>
          ) : (
            <button type="button" disabled={!ready || !pending} onClick={() => setConfirm(true)} className="btn-relic !px-5 !py-3 disabled:opacity-40">
              WYŚLIJ POWIADOMIENIE ({pending})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
