import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useCart, cardAmounts } from "@/components/exmortis/CartContext";
import Logo from "@/components/exmortis/Logo";

const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} zł`;
const plDate = (ymd) => (ymd ? new Date(`${String(ymd).slice(0, 10)}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "");

// Krótka informacja o karcie w koszyku i w kasie.
export function GiftLine({ gift }) {
  if (!gift?.to_name && !gift?.message) return <p className="text-xs text-foreground/45 mt-1">Karta na {zl(gift?.amount)}</p>;
  return (
    <p className="text-xs text-foreground/50 mt-1 break-words">
      {gift.to_name ? `Dla: ${gift.to_name}` : "Karta podarunkowa"}
      {gift.message ? ` · „${gift.message.length > 60 ? gift.message.slice(0, 60) + "…" : gift.message}”` : ""}
    </p>
  );
}

// Wygląd karty — ten sam w podglądzie przy zakupie i na stronie do druku (czerń, złoto, imię i słowa darczyńcy).
export function GiftCardVisual({ amount, toName, message, code, until, compact = false }) {
  return (
    // Bez overflow-hidden: przy długich słowach karta rośnie zamiast ucinać treść (aspect-ratio to tylko minimum).
    <div className={`relative bg-[#0A0A0B] border border-[#C9A24A]/70 text-center ${compact ? "p-6" : "p-8 sm:p-12 sm:aspect-[1.6/1]"}`}>
      <div className="absolute inset-3 border border-[#C9A24A]/20 pointer-events-none" aria-hidden="true" />
      <div className="relative h-full flex flex-col items-center justify-center gap-3">
        <Logo className="h-10 w-10" glow={false} />
        <p className="technical text-[10px] gold-text tracking-[0.3em]">EXMORTIS · KARTA PODARUNKOWA</p>
        <p className={`relic-heading gold-text ${compact ? "text-4xl" : "text-5xl sm:text-6xl"}`}>{zl(amount)}</p>
        {toName && <p className="relic-heading text-xl sm:text-2xl text-[#F5EFE1] break-words">dla {toName}</p>}
        {message && <p className="italic text-foreground/75 max-w-md leading-relaxed break-words">„{message}”</p>}
        {code && (
          <p className="mt-2 font-mono text-lg sm:text-xl tracking-[0.15em] text-[#F5EFE1] border border-[#C9A24A]/50 px-4 py-2 break-all">{code}</p>
        )}
        {until && <p className="technical text-[9px] text-foreground/50">WAŻNA DO {plDate(until).toUpperCase()} · SKARBIEC NA EXMORTIS.PL</p>}
      </div>
    </div>
  );
}

// Zakup karty: kwota, imię obdarowanego i jedno zdanie (oba pola nieobowiązkowe), podgląd na żywo.
export function GiftCardBuy({ product }) {
  const { addItem } = useCart();
  const amounts = cardAmounts(product);
  const [amount, setAmount] = useState(amounts.length === 1 ? amounts[0] : amounts[Math.min(1, amounts.length - 1)]);
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);
  const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";
  if (!amounts.length) return null;
  const add = () => {
    addItem(product, 1, { amount, to_name: toName.trim(), message: message.trim() });
    setAdded(true); setToName(""); setMessage("");
    setTimeout(() => setAdded(false), 2000);
  };
  return (
    <div className="mt-auto space-y-5">
      {amounts.length > 1 && (
        <div>
          <p className="technical text-[10px] text-foreground/50 mb-3">KWOTA</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kwota karty">
            {amounts.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={amount === a} onClick={() => setAmount(a)}
                className={`py-3 border font-mono transition-colors ${amount === a ? "border-[#C9A24A] bg-[#C9A24A]/10 gold-text" : "hairline text-foreground/70 hover:border-[#C9A24A]/60"}`}>
                {zl(a)}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="block">
        <span className="technical text-[10px] text-foreground/50 block mb-2">DLA KOGO (IMIĘ, NIEOBOWIĄZKOWO)</span>
        <input value={toName} maxLength={60} onChange={(e) => setToName(e.target.value)} className={inp} />
      </label>
      <label className="block">
        <span className="technical text-[10px] text-foreground/50 block mb-2">KILKA SŁÓW OD CIEBIE (NIEOBOWIĄZKOWO)</span>
        <textarea value={message} maxLength={200} rows={2} onChange={(e) => setMessage(e.target.value)} className={inp} />
        <span className="text-[11px] text-foreground/40">{message.length}/200</span>
      </label>
      <GiftCardVisual amount={amount} toName={toName.trim()} message={message.trim()} compact />
      <button onClick={add} className="btn-relic w-full">
        {added ? "DODANO ✓" : `DO KOSZYKA — ${zl(amount)}`} {!added && <ArrowRight className="h-4 w-4" />}
      </button>
      <p className="text-xs text-foreground/50 leading-relaxed">
        Po opłaceniu dostaniesz e-mailem kartę z kodem — do wydrukowania albo zapisania jako PDF i przekazania dalej.
        Kod wpisuje się w kasie Skarbca, działa jednorazowo, ważny 6 miesięcy.
      </p>
    </div>
  );
}
