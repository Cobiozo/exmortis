import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendForm } from "@/lib/outbox";
import useSystemText from "@/content/useSystemText";
import { clause } from "@/lib/firma";
import { useFirma } from "@/lib/useSiteSettings";
import CompanyLines from "@/components/legal/CompanyLines";
import ContactField from "./ContactField";
import { track } from "@/lib/track";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const check = (f) => ({
  name: f.name.trim() ? "" : "Wpisz swoje imię.",
  email: !f.email.trim() ? "Wpisz adres e-mail." : EMAIL_RE.test(f.email.trim()) ? "" : "Ten adres e-mail wygląda na niepełny. Sprawdź go.",
  message: f.message.trim() ? "" : "Napisz, w czym mogę pomóc.",
});

// Moduł strony Kontakt: dane firmy (z Ustawień strony) i formularz.
export default function ContactPageForm() {
  const [f, setF] = useState({ name: "", email: "", message: "", website: "" });
  const [errs, setErrs] = useState({});
  const [state, setState] = useState("form");
  const [msg, setMsg] = useState("");
  const [agree, setAgree] = useState(false);
  const [agreeErr, setAgreeErr] = useState(false);
  const t = useSystemText();
  const firma = useFirma();
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (errs[k]) setErrs({ ...errs, [k]: "" }); };
  const submit = async (e) => {
    e.preventDefault();
    const er = check(f); setErrs(er);
    if (!agree) setAgreeErr(true);
    if (Object.values(er).some(Boolean) || !agree) return;
    setState("busy");
    await sendForm("createContactMessage", f).then(() => { track("Lead", { content_name: "kontakt" }); setState("done"); })
      .catch((x) => { setMsg(x?.response?.data?.error || "Nie udało się wysłać. Spróbuj ponownie."); setState("error"); });
  };
  return (
    <section className="px-5 md:px-10 pb-24">
      <div className="mx-auto max-w-[70ch]">
        <CompanyLines variant="block" className="mb-10" />
        {state === "done" ? <div><p className="relic-heading text-2xl gold-text mb-3">{t("dz.kontakt.tytul")}</p><p className="text-foreground/60 leading-relaxed">{t("dz.kontakt")}</p></div> : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <ContactField id="c-name" label="Imię" value={f.name} onChange={set("name")} error={errs.name} autoComplete="given-name" />
            <ContactField id="c-email" label="E-mail" type="email" value={f.email} onChange={set("email")} error={errs.email} autoComplete="email" />
            <ContactField id="c-msg" label="Wiadomość" textarea value={f.message} onChange={set("message")} error={errs.message} />
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="c-web">Strona www</label>
              <input id="c-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer py-2 min-h-[44px]">
              <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); if (e.target.checked) setAgreeErr(false); }}
                aria-required="true" aria-invalid={agreeErr} className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" />
              <span className="text-sm text-foreground/80 leading-relaxed">
                Akceptuję <Link to="/polityka-prywatnosci" className="gold-text underline">politykę prywatności</Link>.
              </span>
            </label>
            {agreeErr && <p role="alert" className="-mt-3 text-sm text-[#E8C547]">Zaznacz, żeby wysłać wiadomość.</p>}
            {state === "error" && <p role="alert" className="text-sm text-[#E8C547]">{msg}</p>}
            <button disabled={state === "busy"} className="btn-relic w-full">{state === "busy" ? "WYSYŁAM…" : "WYŚLIJ"}</button>
          </form>
        )}
        <p className="mt-10 text-sm text-foreground/60">Chcesz odstąpić od umowy? <Link to="/odstapienie" className="gold-text underline">Odstąp od umowy tutaj</Link></p>
      </div>
    </section>
  );
}