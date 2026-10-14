import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { GiftCardVisual } from "@/components/exmortis/shop/GiftCard";

// Karta podarunkowa do wydruku albo zapisania jako PDF (link z e-maila: /karta#t=…).
// Klucz jest w części po „#”, więc nie trafia do logów serwera ani do nagłówka Referer.
const PRINT_CSS = `
@page { size: A4 landscape; margin: 12mm; }
@media print {
  html, body { background: #0A0A0B !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body * { visibility: hidden !important; }
  .karta-print, .karta-print * { visibility: visible !important; }
  .karta-print { position: absolute; left: 0; top: 0; width: 100%; }
  .karta-noprint { display: none !important; }
}`;

export default function Karta() {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t") || "";
    document.title = "Karta podarunkowa · exmortis";
    const robots = document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    const missing = "Nie ma takiej karty. Sprawdź, czy link jest pełny.";
    if (!token) { setState({ error: "Brak klucza karty w linku. Otwórz link z e-maila jeszcze raz." }); return () => robots.remove(); }
    if (!/^[A-Za-z0-9]{24,64}$/.test(token)) { setState({ error: missing }); return () => robots.remove(); }
    base44.functions.invoke("giftCardView", { token })
      .then((r) => setState(r.data?.code ? { card: r.data } : { error: missing }))
      .catch((e) => {
        const st = e?.response?.status ?? e?.status;
        setState({ error: st === 404 ? missing : "Nie udało się wczytać karty. Spróbuj za chwilę." });
      });
    return () => robots.remove();
  }, []);

  const c = state.card;
  return (
    <main className="min-h-[100svh] bg-[#0A0A0B] text-foreground px-4 py-10 sm:py-16">
      <style>{PRINT_CSS}</style>
      <div className="max-w-3xl mx-auto">
        {state.loading && <p className="text-foreground/55 text-center">Ładowanie…</p>}
        {state.error && (
          <div className="text-center space-y-6">
            <p className="text-foreground/70">{state.error}</p>
            <Link to="/" className="technical text-[10px] gold-text">EXMORTIS.PL</Link>
          </div>
        )}
        {c && (
          <>
            <div className="karta-print">
              <GiftCardVisual amount={c.value} toName={c.to_name} message={c.message} code={c.code} until={c.until} />
            </div>
            <div className="karta-noprint mt-8 space-y-5 text-center">
              {(c.used || c.expired) && (
                <p className="technical text-[10px] text-[#C9A24A]">{c.used ? "TEN KOD ZOSTAŁ JUŻ WYKORZYSTANY" : "TERMIN WAŻNOŚCI KARTY MINĄŁ"}</p>
              )}
              <button type="button" onClick={() => window.print()} className="btn-relic inline-flex">
                <Printer className="h-4 w-4" /> DRUKUJ ALBO ZAPISZ JAKO PDF
              </button>
              <p className="text-sm text-foreground/55 leading-relaxed max-w-xl mx-auto">
                Kod wpisuje się w kasie Skarbca na exmortis.pl, w polu „kod rabatowy”. Działa jednorazowo —
                niewykorzystana część kwoty przepada. Żeby zapisać PDF, wybierz w oknie drukowania „Zapisz jako PDF”.
              </p>
              <p className="text-xs text-foreground/55">Kto ma ten link, widzi kod. Przekaż go tylko osobie obdarowanej.</p>
              <Link to="/skarbiec" className="technical text-[10px] gold-text inline-block">PRZEJDŹ DO SKARBCA</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}