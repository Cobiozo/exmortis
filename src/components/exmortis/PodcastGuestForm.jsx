import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const EMPTY = { name: "", email: "", phone: "", smierc: "", story: "", today: "", forma: "", social: "", consent_adult: false, consent_art9: false };
const inp = "w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors";
const SMIERC = [["mentalna", "Mentalna (wypalenie, wyczerpanie)"], ["duchowa", "Duchowa (utrata sensu, wiary)"], ["zyciowa", "Życiowa (strata, rozstanie, koniec czegoś ważnego)"], ["trudno", "Trudno powiedzieć"]];
const FORMA = [["pelne", "Imię i nazwisko"], ["imie", "Samo imię"], ["pseudonim", "Pseudonim"], ["anonimowo", "Anonimowo (głos bez danych)"]];

const L = ({ t, hint, children }) => (
  <label className="block">
    <span className="technical text-[10px] text-foreground/50 block mb-3">{t}{hint && <span className="normal-case tracking-normal text-foreground/35"> — {hint}</span>}</span>
    {children}
  </label>
);

export default function PodcastGuestForm() {
  const [f, setF] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (f.story.trim().length < 200) return setError("Opowiedz swoją drogę w co najmniej 200 znakach.");
    setSending(true); setError("");
    try {
      await base44.functions.invoke("createPodcastApplication", f);
      setSent(true);
    } catch (x) {
      setError(x.response?.data?.error || "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
    } finally { setSending(false); }
  };

  if (sent) {
    return (
      <div className="border border-[#C9A24A]/40 p-10 flex items-center justify-center text-center">
        <p className="shop-heading text-2xl text-[#F5EFE1] leading-relaxed">Dziękuję. Przeczytam Twoją historię uważnie. Odpowiem w ciągu 14 dni.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 min-w-0">
      <div className="grid sm:grid-cols-2 gap-6">
        <L t="IMIĘ LUB PSEUDONIM"><input required maxLength={120} value={f.name} onChange={set("name")} className={inp} /></L>
        <L t="ADRES E-MAIL"><input required type="email" value={f.email} onChange={set("email")} className={inp} /></L>
      </div>
      <L t="NUMER TELEFONU" hint="opcjonalnie, jeśli wolisz rozmowę telefoniczną"><input type="tel" value={f.phone} onChange={set("phone")} className={inp} /></L>
      <L t="TWOJA ŚMIERĆ">
        <select required value={f.smierc} onChange={set("smierc")} className={`${inp} bg-[#070708]`}>
          <option value="">Wybierz…</option>
          {SMIERC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </L>
      <L t="OPOWIEDZ KRÓTKO SWOJĄ DROGĘ" hint="co się stało i jak wracałeś(-aś)">
        <textarea required rows={7} minLength={200} maxLength={2000} value={f.story} onChange={set("story")} className={`${inp} resize-none`} />
        <span className={`block text-right text-xs mt-1 ${f.story.length < 200 ? "text-foreground/35" : "gold-text"}`}>{f.story.length} / 2000 (min. 200)</span>
      </L>
      <L t="GDZIE JESTEŚ DZIŚ?"><textarea required rows={3} maxLength={500} value={f.today} onChange={set("today")} className={`${inp} resize-none`} /></L>
      <L t="JAK CHCESZ WYSTĄPIĆ">
        <select required value={f.forma} onChange={set("forma")} className={`${inp} bg-[#070708]`}>
          <option value="">Wybierz…</option>
          {FORMA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </L>
      <L t="LINK DO TWOJEGO PROFILU W SOCIAL MEDIACH" hint="opcjonalnie"><input type="url" value={f.social} onChange={set("social")} className={inp} /></L>
      <label className="flex gap-3 text-sm text-foreground/65"><input required type="checkbox" checked={f.consent_adult} onChange={set("consent_adult")} className="mt-1 accent-[#C9A24A]" />Mam ukończone 18 lat.</label>
      <label className="flex gap-3 text-sm text-foreground/65 leading-relaxed"><input required type="checkbox" checked={f.consent_art9} onChange={set("consent_art9")} className="mt-1 accent-[#C9A24A]" />Wyrażam wyraźną zgodę na przetwarzanie informacji, które opisałem(-am) — w tym dotyczących mojego zdrowia, samopoczucia i przekonań — w celu rozpatrzenia zgłoszenia do podcastu. Wiem, że mogę ją wycofać w każdej chwili.</label>
      {error && <p className="text-sm blood-text">{error}</p>}
      <button disabled={sending} className="btn-relic w-full sm:w-auto">{sending && <Loader2 className="h-4 w-4 animate-spin" />}Wyślij zgłoszenie</button>
      <p className="text-xs text-foreground/40 leading-relaxed">
        Administratorem danych jest [NAZWA FIRMY]. Zgłoszenia, które nie zakończą się nagraniem, usuwam po 6 miesiącach. Więcej: <Link to="/polityka-prywatnosci" className="underline hover:gold-text">Polityka prywatności</Link>.
      </p>
    </form>
  );
}