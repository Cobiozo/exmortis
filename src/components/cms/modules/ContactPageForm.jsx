import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import useSystemText from "@/content/useSystemText";
import { SELLER, CLAUSE } from "@/content/legal/seller";

const F = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";

// Moduł strony Kontakt: dane sprzedawcy (z dokumentów prawnych) i formularz.
export default function ContactPageForm() {
  const [f, setF] = useState({ name: "", email: "", message: "" });
  const [state, setState] = useState("form");
  const t = useSystemText();
  const submit = async (e) => {
    e.preventDefault(); setState("busy");
    await base44.functions.invoke("createContactMessage", f).then(() => setState("done")).catch(() => setState("error"));
  };
  return (
    <section className="px-5 md:px-10 pb-24">
      <div className="mx-auto max-w-[70ch]">
        <p className="text-foreground/75 leading-relaxed mb-2">{SELLER.company}, {SELLER.address}, NIP {SELLER.nip}</p>
        <p className="text-foreground/75 mb-2">E-mail: {SELLER.email}</p>
        <p className="text-foreground/75 mb-10">Adres do korespondencji: {SELLER.postal}</p>
        {state === "done" ? <div><p className="relic-heading text-2xl gold-text mb-3">{t("dz.kontakt.tytul")}</p><p className="text-foreground/60 leading-relaxed">{t("dz.kontakt")}</p></div> : (
          <form onSubmit={submit} className="space-y-4">
            <input required placeholder="Imię" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={F} />
            <input required type="email" placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={F} />
            <textarea required rows={5} placeholder="Wiadomość" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className={`${F} resize-none`} />
            {state === "error" && <p className="text-sm text-[#E8C547]">Nie udało się wysłać. Spróbuj ponownie.</p>}
            <button disabled={state === "busy"} className="btn-relic w-full">WYŚLIJ</button>
            <p className="text-xs text-foreground/45">{CLAUSE("odpowiedzieć na wiadomość")} Więcej: <Link to="/polityka-prywatnosci" className="underline">Polityka prywatności</Link>.</p>
          </form>
        )}
        <p className="mt-10 text-sm text-foreground/60">Chcesz odstąpić od umowy? <Link to="/odstapienie" className="gold-text underline">Odstąp od umowy tutaj</Link></p>
      </div>
    </section>
  );
}