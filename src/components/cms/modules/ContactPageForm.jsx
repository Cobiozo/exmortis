import React, { useState } from "react";
import { useAccountPrefill, AccountContactLine } from "@/components/common/AccountContact";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { sendForm } from "@/lib/outbox";
import useSystemText from "@/content/useSystemText";
import CompanyLines from "@/components/legal/CompanyLines";
import ContactField from "./ContactField";
import KontaktAside, { KontaktSprawy } from "./KontaktAside";
import KontaktCrisis from "./KontaktCrisis";
import { track } from "@/lib/track";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const check = (f) => ({
  name: f.name.trim() ? "" : "Wpisz swoje imię.",
  email: !f.email.trim() ? "Wpisz adres e-mail." : EMAIL_RE.test(f.email.trim()) ? "" : "Ten adres e-mail wygląda na niepełny. Sprawdź go.",
  message: f.message.trim() ? "" : "Napisz, w czym mogę pomóc.",
});

// Moduł strony Kontakt (etap 8, 18.11.2026): dwie kolumny — dane i formularz w karcie.
// Wysyłka, walidacja, ochrona przed spamem, zgody i pomiar bez zmian.
export default function ContactPageForm() {
  const [f, setF] = useState({ name: "", email: "", message: "", website: "" });
  const acc = useAccountPrefill((a) => setF((x) => ({ ...x, name: x.name || a.firstName, email: x.email || a.email })));
  const [manual, setManual] = useState(false);
  const fromAccount = acc.signedIn && !manual;
  const [errs, setErrs] = useState({});
  const [state, setState] = useState("form");
  const [msg, setMsg] = useState("");
  const t = useSystemText();
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (errs[k]) setErrs({ ...errs, [k]: "" }); };
  const submit = async (e) => {
    e.preventDefault();
    const er = check(f); setErrs(er);
    if (Object.values(er).some(Boolean)) return;
    setState("busy");
    await sendForm("createContactMessage", f).then(() => { track("Lead", { content_name: "kontakt" }); setState("done"); })
      .catch((x) => { setMsg(x?.response?.data?.error || "Nie udało się wysłać. Spróbuj ponownie."); setState("error"); });
  };
  return (
    <section className="px-5 pb-[var(--exm-section-y)] md:px-10">
      <div className="mx-auto grid w-full max-w-[var(--exm-container)] items-start gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-14">
        <KontaktAside />

        <div className="min-w-0">
        <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8">
          {state === "done" ? (
            <div className="flex flex-col items-start gap-4 py-2">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-exm-gold-line" aria-hidden="true">
                <Check className="h-6 w-6 text-exm-gold" />
              </span>
              <p className="exm-h3 text-exm-gold">{t("dz.kontakt.tytul")}</p>
              <p className="max-w-[52ch] text-[15px] leading-relaxed text-exm-muted">{t("dz.kontakt")}</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5">
              {fromAccount && <AccountContactLine email={acc.email} lead="Odpowiem na:" onChange={() => setManual(true)} />}
              {(!fromAccount || !acc.firstName || errs.name) && (
                <ContactField id="c-name" label="Imię" value={f.name} onChange={set("name")} error={errs.name} autoComplete="given-name" />
              )}
              {(!fromAccount || errs.email) && (
                <ContactField id="c-email" label="E-mail" type="email" value={f.email} onChange={set("email")} error={errs.email} autoComplete="email" />
              )}
              <ContactField id="c-msg" label="Wiadomość" textarea value={f.message} onChange={set("message")} error={errs.message} licznik={f.message.length} />
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="c-web">Strona www</label>
                <input id="c-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
              </div>

              <p className="rounded-[var(--exm-r-field)] border-l-2 border-exm-gold-line bg-exm-bg px-4 py-3 text-[13px] leading-relaxed text-exm-ivory">
                Nie wpisuj danych dotyczących zdrowia.
              </p>

              <p className="text-[13px] leading-relaxed text-exm-muted">
                Administratorem danych jest Dawid Kowalczyk (EXMORTIS). Przetwarzam je, aby odpowiedzieć na Twoją wiadomość.
                Szczegóły i Twoje prawa: <Link to="/polityka-prywatnosci" className="text-exm-gold underline decoration-exm-gold-line underline-offset-4 hover:text-exm-gold-hover">Polityka prywatności</Link>.
              </p>

              {state === "error" && <p role="alert" className="text-[13px] text-[#E8C547]">{msg}</p>}

              <button type="submit" disabled={state === "busy"} aria-busy={state === "busy" ? "true" : undefined} className="btn-relic w-full">
                {state === "busy" ? "Wysyłam…" : "Wyślij wiadomość"}
              </button>
            </form>
          )}
        </div>
        <KontaktSprawy />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[var(--exm-container)]">
        <KontaktCrisis />
        {/* Dane firmy pod formularzem (w stopce ich nie ma — decyzja 4.11.2026). */}
        <CompanyLines variant="block" className="mt-12 border-t border-exm-line pt-8 text-sm" />
      </div>
    </section>
  );
}