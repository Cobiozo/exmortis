import React, { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";

// Wejście tylko dla zapisanych: e-mail podany przy zapisie (albo osobisty link z maila).
export default function JoinGate({ state, error, onSubmit }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    await onSubmit(email.trim());
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="mt-8 border border-[#C9A24A]/40 bg-[#0D0D0E] p-6 space-y-4">
      <p className="text-[#F5EFE1] leading-relaxed">
        {state === "po" ? "Nagranie jest dostępne dla osób zapisanych na spotkanie." : "Pokój jest otwarty dla osób zapisanych na spotkanie."}
        {" "}Wpisz adres e-mail podany przy zapisie.
      </p>
      <div>
        <label htmlFor="join-email" className="technical text-[10px] text-foreground/50 block mb-2">E-MAIL Z ZAPISU</label>
        <input id="join-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-transparent border hairline px-4 py-3.5 focus:border-[#C9A24A] focus:outline-none" />
      </div>
      {error && <p className="text-sm text-[#E8C547]" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="btn-relic w-full disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{state === "po" ? "POKAŻ NAGRANIE" : "WEJDŹ NA SPOTKANIE"} <ArrowRight className="h-4 w-4" /></>}
      </button>
      <p className="text-xs text-foreground/50 leading-relaxed">Szybciej: otwórz osobisty link z e-maila potwierdzającego zapis. Nie masz zapisu? Zapisy zamykają się 15 minut przed startem.</p>
    </form>
  );
}
