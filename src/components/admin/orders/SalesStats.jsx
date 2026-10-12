import React, { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Statystyki sprzedaży (tylko opłacone zamówienia): przychód z porównaniem do poprzedniego okresu,
// przychód dzienny, produkty, kody rabatowe i skuteczność list oczekujących.
const PERIODS = [[7, "7 dni"], [30, "30 dni"], [90, "90 dni"], [365, "12 mies."]];
const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} zł`;
const BAR = "#A8873A"; // złoto przyciemnione do pasma jasności wykresów (sprawdzone na tle #0A0A0B)

function Change({ cur, prev }) {
  if (!prev && !cur) return null;
  if (!prev) return <span className="text-[11px] text-foreground/45">brak danych z poprzedniego okresu</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  return <span className="text-[11px] text-foreground/60">{d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(d)}% vs poprzedni okres</span>;
}

// Przychód dzienny: cienkie słupki z dziurami na dni bez sprzedaży, podpowiedź po najechaniu / dotknięciu.
function Daily({ rows, days }) {
  const [hover, setHover] = useState(null);
  const map = new Map((rows || []).map((r) => [r.day, r]));
  const today = new Date();
  const list = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(d);
    list.push({ day: key, revenue: map.get(key)?.revenue || 0, orders: map.get(key)?.orders || 0 });
  }
  const max = Math.max(1, ...list.map((x) => x.revenue));
  const h = hover != null ? list[hover] : null;
  const fmt = (k) => new Date(`${k}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return (
    <figure className="m-0">
      <figcaption className="technical text-[9px] text-foreground/45 mb-2">PRZYCHÓD DZIENNY</figcaption>
      <p className="text-xs text-foreground/70 h-5" aria-live="polite">{h ? `${fmt(h.day)}: ${zl(h.revenue)} · ${h.orders} zam.` : `najwyżej ${zl(max)} dziennie`}</p>
      <div className="flex items-end h-28 border-b border-[#3D3D3F]" style={{ gap: days > 90 ? 0 : 2 }} onMouseLeave={() => setHover(null)}>
        {list.map((x, i) => (
          <button key={x.day} type="button" aria-label={`${fmt(x.day)}: ${zl(x.revenue)}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)}
            className="flex-1 h-full flex items-end min-w-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A24A]">
            <span className="block w-full" style={{ height: x.revenue ? `${Math.max(3, (x.revenue / max) * 100)}%` : 0, background: BAR, borderRadius: "4px 4px 0 0", opacity: hover == null || hover === i ? 1 : 0.55 }} />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-foreground/45 mt-1"><span>{fmt(list[0].day)}</span><span>{fmt(list[list.length - 1].day)}</span></div>
    </figure>
  );
}

export default function SalesStats() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem("exm_sales_open") !== "0"; } catch { return true; } });
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return;
    setD(null); setErr("");
    base44.functions.invoke("adminOrders", { action: "stats", days }).then((r) => setD(r.data)).catch((e) => setErr(e?.response?.data?.error || "Nie udało się wczytać statystyk."));
  }, [days, open]);
  const toggle = () => { setOpen(!open); try { localStorage.setItem("exm_sales_open", open ? "0" : "1"); } catch { /* */ } };

  const c = d?.cur || {}, p = d?.prev || {};
  const aov = c.orders ? c.revenue / c.orders : 0, aovPrev = p.orders ? p.revenue / p.orders : 0;
  const paidProducts = (d?.products || []).filter((x) => x.value > 0);
  const free = (d?.products || []).filter((x) => !(x.value > 0));

  return (
    <section className="border hairline">
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full flex items-center justify-between p-4 text-left">
        <span className="technical text-[10px] gold-text">STATYSTYKI SPRZEDAŻY</span>
        <ChevronDown className={`h-4 w-4 text-foreground/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="p-4 pt-0 space-y-8">
          <div role="radiogroup" aria-label="Okres" className="flex flex-wrap gap-2">
            {PERIODS.map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={days === v} onClick={() => setDays(v)}
                className={`min-h-[36px] px-3 border technical text-[10px] ${days === v ? "border-[#C9A24A] gold-text" : "hairline text-foreground/55 hover:text-foreground"}`}>{l.toUpperCase()}</button>
            ))}
          </div>
          {err && <p className="text-sm text-[#E8C547]">{err}</p>}
          {!d && !err && <Loader2 className="h-5 w-5 animate-spin text-[#C9A24A]" aria-label="Wczytywanie" />}
          {d && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#3D3D3F]/40 border hairline">
                {[["Przychód", zl(c.revenue), c.revenue, p.revenue], ["Opłacone zamówienia", c.orders || 0, c.orders, p.orders],
                  ["Średnia wartość", zl(aov), aov, aovPrev], ["Kupujący (różni)", c.buyers || 0, c.buyers, p.buyers]].map(([k, v, a, b]) => (
                  <div key={k} className="bg-[#0A0A0B] p-4">
                    <p className="technical text-[9px] text-foreground/45">{k.toUpperCase()}</p>
                    <p className="font-mono text-xl text-[#F5EFE1] mt-1.5 whitespace-nowrap">{v}</p>
                    <Change cur={a || 0} prev={b || 0} />
                  </div>
                ))}
              </div>
              <Daily rows={d.daily} days={d.days} />
              <div className="grid lg:grid-cols-2 gap-8">
                <div>
                  <p className="technical text-[9px] text-foreground/45 mb-2">PRODUKTY (WARTOŚĆ WG CEN, PRZED RABATEM)</p>
                  {paidProducts.length ? (
                    <table className="w-full text-sm">
                      <thead><tr className="text-[10px] text-foreground/45 text-left"><th className="font-normal py-1">Produkt</th><th className="font-normal text-right">Szt.</th><th className="font-normal text-right">Wartość</th></tr></thead>
                      <tbody>{paidProducts.map((x) => (
                        <tr key={x.id} className="border-t hairline"><td className="py-2 pr-2 text-foreground/85">{x.name}</td><td className="text-right font-mono text-foreground/70">{x.units}</td><td className="text-right font-mono text-foreground/85 whitespace-nowrap">{zl(x.value)}</td></tr>
                      ))}</tbody>
                    </table>
                  ) : <p className="text-sm text-foreground/50">Brak sprzedaży w tym okresie.</p>}
                  {free.length > 0 && <p className="text-xs text-foreground/50 mt-3">Bezpłatne pobrania: {free.map((x) => `${x.name} (${x.units})`).join(", ")}.</p>}
                </div>
                <div className="space-y-8">
                  <div>
                    <p className="technical text-[9px] text-foreground/45 mb-2">KODY RABATOWE</p>
                    {(d.codes || []).length ? (d.codes.map((x) => (
                      <p key={x.code} className="flex justify-between border-t hairline py-2 text-sm"><span className="font-mono text-foreground/85">{x.code}</span><span className="text-foreground/65">{x.uses} × · rabat {zl(x.discount)}</span></p>
                    ))) : <p className="text-sm text-foreground/50">Nikt nie użył kodu w tym okresie.</p>}
                  </div>
                  <div>
                    <p className="technical text-[9px] text-foreground/45 mb-2">LISTY OCZEKUJĄCYCH (OD POCZĄTKU)</p>
                    {(d.waitlist || []).length ? (d.waitlist.map((x) => (
                      <p key={x.id} className="flex flex-wrap justify-between gap-2 border-t hairline py-2 text-sm">
                        <span className="text-foreground/85">{x.name || "—"}</span>
                        <span className="text-foreground/65">{x.total} na liście · powiadomiono {x.notified} · kupiło {x.bought}{x.notified ? ` (${Math.round((x.bought / x.notified) * 100)}%)` : ""}</span>
                      </p>
                    ))) : <p className="text-sm text-foreground/50">Nikt jeszcze nie zapisał się na listę oczekujących.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
