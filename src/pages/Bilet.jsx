import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import QRCode from "qrcode";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";

// Bilet na telefonie (link z e-maila albo z kodu QR: /bilet#t=…). Klucz jest po „#”, więc nie trafia do logów serwera.
const when = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const hhmm = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function Bilet() {
  const [state, setState] = useState({ loading: true });
  const [qr, setQr] = useState("");
  useEffect(() => {
    document.title = "Bilet · exmortis";
    const robots = document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t") || "";
    if (!/^[A-Za-z0-9]{24,64}$/.test(token)) { setState({ error: "Nie ma takiego biletu. Otwórz link z e-maila jeszcze raz." }); return () => robots.remove(); }
    base44.functions.invoke("tickets", { action: "view", token })
      .then(async (r) => {
        const t = r.data?.ticket;
        if (!t) throw new Error("brak");
        setState({ ticket: t });
        setQr(await QRCode.toDataURL(t.qr, { errorCorrectionLevel: "M", margin: 2, width: 560, color: { dark: "#0A0A0B", light: "#FFFFFF" } }));
      })
      .catch((e) => setState({ error: (e?.response?.status ?? e?.status) === 404 ? "Nie ma takiego biletu. Sprawdź, czy link jest pełny." : "Nie udało się wczytać biletu. Spróbuj za chwilę." }));
    return () => robots.remove();
  }, []);

  const t = state.ticket;
  return (
    <main className="min-h-[100svh] bg-[#0A0A0B] text-foreground px-4 py-8 sm:py-14">
      <div className="max-w-md mx-auto">
        {state.loading && <p className="text-foreground/50 text-center">Ładowanie…</p>}
        {state.error && (
          <div className="text-center space-y-6">
            <p className="text-foreground/70">{state.error}</p>
            <Link to="/" className="technical text-[10px] gold-text">EXMORTIS.PL</Link>
          </div>
        )}
        {t && (
          <div className="border border-[#C9A24A]/60 bg-[#0D0D0E]">
            <div className="p-6 text-center border-b border-dashed border-[#C9A24A]/40">
              <Logo className="h-9 w-9 mx-auto" glow={false} />
              <p className="technical text-[10px] gold-text tracking-[0.3em] mt-3">EXMORTIS · BILET</p>
              <h1 className="shop-heading text-2xl text-[#F5EFE1] mt-3 leading-snug break-words">{t.event.title}</h1>
              {t.event.start_datetime && <p className="text-sm text-foreground/60 mt-2">{when(t.event.start_datetime)} (czas polski)</p>}
              <p className="text-sm text-foreground/50 mt-1">{t.event.format === "Online" ? "Online" : t.event.location || ""}</p>
            </div>
            <div className="p-6 text-center">
              <p className="technical text-[10px] text-foreground/55">UCZESTNIK</p>
              <p className="shop-heading text-2xl text-[#F5EFE1] mt-1 break-words">{t.holder_name}</p>
              {t.status === "anulowany" ? (
                <p className="mt-6 technical text-[11px] text-[#E8676A]">TEN BILET ZOSTAŁ ANULOWANY</p>
              ) : (
                <>
                  <div className={`mt-6 mx-auto w-full max-w-[280px] bg-white p-2 ${t.status === "wykorzystany" ? "opacity-40" : ""}`}>
                    {qr ? <img src={qr} alt={`Kod QR biletu ${t.code}`} className="w-full h-auto block" /> : <div className="aspect-square" />}
                  </div>
                  <p className="font-mono text-2xl tracking-[0.2em] gold-text mt-4">{t.code}</p>
                  {t.status === "wykorzystany"
                    ? <p className="technical text-[10px] text-[#E8C547] mt-3">WEJŚCIE ZAREJESTROWANE{t.checked_at ? ` · ${hhmm(t.checked_at).toUpperCase()}` : ""}</p>
                    : <p className="text-xs text-foreground/50 mt-3">Pokaż ten kod przy wejściu. Podkręć jasność ekranu.</p>}
                </>
              )}
            </div>
            {t.status !== "anulowany" && (
              <div className="p-6 pt-0 space-y-3">
                <a href={t.pdf} className="btn-relic w-full"><Download className="h-4 w-4" /> POBIERZ PDF</a>
                {t.event.slug && <Link to={`/spotkania/${t.event.slug}`} className="btn-ghost w-full">STRONA WYDARZENIA</Link>}
              </div>
            )}
          </div>
        )}
        {t && <p className="text-xs text-foreground/55 text-center mt-5 leading-relaxed">Bilet jest imienny i ważny na jedno wejście. Kto ma ten link, ma bilet — przekaż go tylko osobie, dla której jest.</p>}
      </div>
    </main>
  );
}