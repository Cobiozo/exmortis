import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { track } from "@/lib/track";
import { useCrisis } from "@/components/crisis/CrisisContext";
import Section from "./Section";
import { Label, TextInput, TextArea, CheckRow } from "./PowrotFields";

// Etap 1 zgłoszenia POWRÓT: trzy dane kontaktowe, jedno pytanie i dwie zgody.
// Pełna ankieta (dotychczasowy formularz) przychodzi osobistym linkiem, gdy program będzie dla Ciebie.
const INITIAL = {
  full_name: "",
  email: "",
  phone: "",
  situation: "",
  consent_rodo: false,
  consent_adult: false,
};

export default function PowrotForm() {
  const { open: openCrisis } = useCrisis();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const setDirect = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const clearErr = (k) => setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));

  const field = (k, type = "text") => ({
    value: form[k],
    onChange: (e) => {
      setDirect(k, e.target.value);
      clearErr(k);
    },
    error: errors[k],
    type,
  });
  const check = (k) => ({
    checked: form[k],
    error: errors[k],
    onChange: (v) => {
      setDirect(k, v);
      clearErr(k);
    },
  });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = "Podaj imię i nazwisko.";
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(form.phone.trim())) errs.phone = "Podaj poprawny numer telefonu.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Podaj poprawny adres e-mail.";
    if (!form.situation.trim()) errs.situation = "Napisz kilka zdań.";
    if (!form.consent_rodo) errs.consent_rodo = "Ta zgoda jest wymagana.";
    if (!form.consent_adult) errs.consent_adult = "Program jest dla osób pełnoletnich.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Uzupełnij zaznaczone pola.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await base44.functions.invoke("createPowrotApplication", form);
      track("Lead", { content_name: "powrot" });
      setSent(true);
      if (res?.data?.pilne) openCrisis();
    } catch (err) {
      setError(err?.response?.status === 400 || err?.response?.status === 429 ? err.response.data?.error || "Sprawdź formularz." : "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Section dark id="formularz" label="ZGŁOSZENIE">
      <div className="grid md:grid-cols-2 gap-12 md:gap-20">
        <div className="min-w-0">
          <h2 lang="pl" className="relic-heading text-[clamp(2rem,8vw,2.75rem)] md:text-[clamp(2.25rem,4.2vw,3.75rem)] leading-[0.95] mb-6 break-words hyphens-auto">
            Zgłoszenie<br /><span className="gold-text">do programu</span>
          </h2>
          <p className="text-foreground/60 leading-relaxed max-w-md">
            Trzy dane i jedno pytanie. Zgłoszenia rozpatruję w kolejności napływania —
            odezwę się osobiście.
          </p>
          <p className="technical text-[10px] text-foreground/55 mt-8">
            ROZMOWA KWALIFIKACYJNA · BEZPŁATNA · BEZ ZOBOWIĄZAŃ
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-foreground/55 text-sm mb-8">
            Nie wiesz, czy to dla Ciebie? Zacznij od{" "}
            <Link to="/test?src=powrot" className="gold-text hover:underline">
              testu «Która śmierć jest Twoja?»
            </Link>
          </p>
          {sent ? (
            <div className="border border-[#C9A24A]/40 p-8 md:p-10 flex flex-col items-center justify-center text-center gap-6 h-full">
              <div className="w-14 h-14 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
                <Check className="h-7 w-7 gold-text" />
              </div>
              <p className="relic-heading text-2xl gold-text">Dziękuję</p>
              <p className="text-foreground/60 leading-relaxed">
                Dziękuję. Odezwę się osobiście — zwykle w ciągu kilku dni. Jeśli program będzie
                dla Ciebie, wyślę Ci krótką ankietę, żebyśmy mogli dobrze przygotować rozmowę.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-8">
              <div className="space-y-6">
                <TextInput label="Imię i nazwisko" required {...field("full_name")} />
                <TextInput label="E-mail" required {...field("email")} />
                <TextInput label="Telefon" required {...field("phone", "tel")} />
                <TextArea
                  label="Co sprawia, że program POWRÓT jest dla Ciebie ważny właśnie teraz?"
                  required
                  hint="Kilka zdań wystarczy — co dzieje się w Twoim życiu i czego szukasz."
                  rows={5}
                  {...field("situation")}
                />
              </div>

              <div className="space-y-4 border-t hairline pt-8">
                <CheckRow {...check("consent_rodo")}>
                  Wyrażam zgodę na przetwarzanie moich danych osobowych w celu kontaktu w sprawie
                  programu POWRÓT. Szczegóły w{" "}
                  <Link to="/polityka-prywatnosci" className="gold-text underline">polityce prywatności</Link>.
                  <span className="gold-text"> *</span>
                </CheckRow>
                <CheckRow {...check("consent_adult")}>
                  Oświadczam, że mam ukończone 18 lat. <span className="gold-text">*</span>
                </CheckRow>
                <Label>
                  Zgoda na płatność i regulamin będą w ankiecie, którą wyślę osobno.
                </Label>
              </div>

              {error && <p className="text-sm blood-text">{error}</p>}
              <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
                {sending ? "WYSYŁAM..." : "WYŚLIJ ZGŁOSZENIE"}{" "}
                {!sending && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}