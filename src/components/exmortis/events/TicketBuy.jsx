import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Minus, Plus, Ticket } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/components/exmortis/CartContext";

const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} zł`;
const inp = "w-full bg-transparent border hairline px-4 py-3 text-base text-foreground placeholder:text-foreground/55 focus:border-[#C9A24A] focus:outline-none";

// Osoby na biletach — w koszyku i w kasie.
export function TicketLine({ holders }) {
  if (!Array.isArray(holders) || !holders.length) return null;
  return <p className="text-xs text-foreground/50 mt-1 break-words">Na bilecie: {holders.join(", ")}</p>;
}

// Zakup biletów na stronie wydarzenia: liczba osób, imię i nazwisko każdej, przejście do kasy (PayU).
export default function TicketBuy({ event: ev }) {
  const { addTickets, items } = useCart();
  const navigate = useNavigate();
  const inCart = items.find((i) => i.kind === "bilet" && i.id === ev.id);
  const [av, setAv] = useState(null);
  const [names, setNames] = useState(() => inCart?.holders?.length ? inCart.holders : [""]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    base44.functions.invoke("tickets", { action: "availability", slug: ev.slug })
      .then((r) => live && setAv(r.data))
      .catch(() => live && setAv({ on_sale: true, price: ev.price, left: null, max: 10 }));
    return () => { live = false; };
  }, [ev.slug, ev.price]);

  const max = Math.max(1, av?.max ?? 10);
  const setCount = (n) => setNames((p) => { const c = Math.min(max, Math.max(1, n)); return c > p.length ? [...p, ...Array(c - p.length).fill("")] : p.slice(0, c); });
  const price = Number(av?.price ?? ev.price) || 0;

  const buy = (e) => {
    e.preventDefault();
    setErr("");
    const list = names.map((n) => n.replace(/\s+/g, " ").trim());
    const i = list.findIndex((n) => n.length < 3 || !/\S+\s+\S+/.test(n));
    if (i >= 0) { setErr(`Wpisz imię i nazwisko osoby ${list.length > 1 ? `nr ${i + 1}` : ""} — tak będzie na bilecie.`); document.getElementById(`tk-name-${i}`)?.focus(); return; }
    addTickets({ ...ev, price }, list);
    navigate("/kasa");
  };

  if (av && !av.on_sale) {
    return (
      <div className="border hairline p-6 text-center">
        <p className="shop-heading text-xl text-[#F5EFE1]">{av.reason || "Sprzedaż biletów jest zamknięta."}</p>
      </div>
    );
  }

  return (
    <form onSubmit={buy} className="space-y-5" noValidate>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="technical text-[10px] text-foreground/50 mb-1">BILET</p>
          <p className="font-mono text-2xl gold-text">{zl(price)}</p>
          {av?.left != null && <p className="text-xs text-foreground/50 mt-1">{av.left <= 10 ? `Zostało miejsc: ${av.left}` : "Liczba miejsc ograniczona"}</p>}
        </div>
        <div>
          <p className="technical text-[10px] text-foreground/50 mb-2" id="tk-count-l">LICZBA BILETÓW</p>
          <div className="flex items-center border hairline" role="group" aria-labelledby="tk-count-l">
            <button type="button" onClick={() => setCount(names.length - 1)} disabled={names.length <= 1} aria-label="Mniej biletów" className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground/70 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
            <span className="px-4 font-mono" aria-live="polite">{names.length}</span>
            <button type="button" onClick={() => setCount(names.length + 1)} disabled={names.length >= max} aria-label="Więcej biletów" className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground/70 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {names.map((n, i) => (
          <label key={i} className="block" htmlFor={`tk-name-${i}`}>
            <span className="technical text-[10px] text-foreground/60 block mb-2">{names.length > 1 ? `BILET ${i + 1} — ` : ""}IMIĘ I NAZWISKO (BĘDZIE NA BILECIE)</span>
            <input id={`tk-name-${i}`} value={n} maxLength={80} autoComplete={i === 0 ? "name" : "off"} required
              onChange={(e) => setNames((p) => p.map((x, j) => (j === i ? e.target.value : x)))} className={inp} placeholder="np. Anna Kowalska" />
          </label>
        ))}
      </div>

      {err && <p role="alert" className="text-sm text-[#E8C547]">{err}</p>}
      <button type="submit" className="btn-relic w-full">
        <Ticket className="h-4 w-4" /> KUPUJĘ — {zl(price * names.length)} <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-xs text-foreground/50 leading-relaxed">
        Płatność przez PayU. Po opłaceniu dostaniesz e-mailem bilety w PDF — każdy z imieniem i nazwiskiem, numerem i kodem QR do pokazania przy wejściu.
        Bilety będą też w Moim koncie (zakładka Spotkania), po zalogowaniu adresem podanym przy zakupie.
      </p>
    </form>
  );
}