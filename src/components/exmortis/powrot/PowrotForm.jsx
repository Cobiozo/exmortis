import React, { useEffect, useRef, useState } from "react";
import { useAccountPrefill, AccountContactLine } from "@/components/common/AccountContact";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { track } from "@/lib/track";
import { FUNNEL } from "@/lib/funnelEvents";
import { useCrisis } from "@/components/crisis/CrisisContext";
import Section from "./Section";
import { Label, TextInput, TextArea, CheckRow } from "./PowrotFields";
import { POWROT } from "@/lib/powrotOffer";

// Etap 1 zgłoszenia POWRÓT (master prompt v2, 18.11.2026): dane kontaktowe, jedno pytanie,
// potwierdzenie znajomości ceny i zasad oraz pełnoletności. Telefon opcjonalny.
// Szczegółowa ankieta przychodzi osobistym linkiem, jeśli po zgłoszeniu widzę sens dalszej rozmowy.
const DRAFT_KEY = "exm_powrot_draft_v1";
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") || {}; } catch { return {}; } };
const saveDraft = (f) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ full_name: f.full_name, email: f.email, phone: f.phone, situation: f.situation })); } catch { /* bez szkicu */ } };
const dropDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* bez szkicu */ } };
const INITIAL = {
  full_name: "",
  email: "",
  phone: "",
  situation: "",
  // Pole zostaje dla zgodności z serwerem: oznacza przekazanie informacji o przetwarzaniu (podstawa: działania
  // przed zawarciem umowy, art. 6 ust. 1 lit. b RODO), a nie osobną zgodę.
  consent_rodo: true,
  consent_paid: false,
  consent_adult: false,
};

export default function PowrotForm() {
  const { open: openCrisis } = useCrisis();
  const [form, setForm] = useState(() => ({ ...INITIAL, ...readDraft() }));
  const [errors, setErrors] = useState({});
  const acc = useAccountPrefill((a) => setForm((x) => ({ ...x, full_name: x.full_name || a.name, email: x.email || a.email })));
  const [manual, setManual] = useState(false);
  const fromAccount = acc.signedIn && !manual;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const setDirect = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  // Szkic w przeglądarce: odpowiedzi nie giną po przypadkowym zamknięciu karty.
  useEffect(() => { if (!sent) saveDraft(form); }, [form, sent]);
  const clearErr = (k) => setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));
  // Pierwsza interakcja z formularzem — jedno zdarzenie na wizytę.
  const started = useRef(false);
  const markStart = () => { if (!started.current) { started.current = true; track(FUNNEL.powrotFormStart); } };

  const field = (k, type = "text") => ({
    value: form[k],
    onChange: (e) => {
      markStart();
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
      markStart();
      setDirect(k, v);
      clearErr(k);
    },
  });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = "Podaj imię i nazwisko.";
    if (form.phone.trim() && !/^\+?[0-9\s\-()]{7,20}$/.test(form.phone.trim())) errs.phone = "Sprawdź numer telefonu albo zostaw to pole puste.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Podaj poprawny adres e-mail.";
    if (!form.situation.trim()) errs.situation = "Napisz kilka zdań.";
    if (!form.consent_paid) errs.consent_paid = "Potwierdź, że znasz cenę i zasady kwalifikacji.";
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
      dropDraft();
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
          <h2 lang="pl" className="relic-heading text-[clamp(2rem,8vw,2.75rem)] md:text-[clamp(2.25rem,4.2vw,3.75rem)] leading-[0.95] mb-6 break-words">
            Zgłoszenie<br /><span className="gold-text">do programu</span>
          </h2>
          <p className="text-foreground/60 leading-relaxed max-w-md">
            Kilka danych i jedno pytanie, około 2 minut. Każde zgłoszenie czytam osobiście
            i odpowiadam w ciągu {POWROT.responseHours} godzin.
          </p>
          <p className="text-foreground/60 leading-relaxed max-w-md mt-4">
            Jeśli zobaczę sens dalszej rozmowy, wyślę Ci link do szczegółowej ankiety, a po niej
            zaproszenie na bezpłatną rozmowę wstępną.
          </p>
          <p className="technical text-[10px] text-foreground/55 mt-8">
            ZGŁOSZENIE BEZPŁATNE · BEZ ZOBOWIĄZAŃ
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-foreground/55 text-sm mb-4">
            Nie wiesz, czy to dla Ciebie? Zacznij od{" "}
            <Link to="/test?src=powrot" className="gold-text hover:underline">
              testu «Która śmierć jest Twoja?»
            </Link>
          </p>
          <p className="text-sm text-foreground/75 mb-8">
            Inwestycja: <span className="gold-text">{POWROT.priceFull}</span>
            <span className="block text-xs text-foreground/55 mt-1">{POWROT.installments}</span>
          </p>
          {sent ? (
            <div className="border border-[#C9A24A]/40 p-8 md:p-10 flex flex-col items-center justify-center text-center gap-6 h-full">
              <div className="w-14 h-14 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
                <Check className="h-7 w-7 gold-text" />
              </div>
              <p className="relic-heading text-2xl gold-text">Dziękuję</p>
              <p className="text-foreground/60 leading-relaxed">
                Przeczytam Twoje zgłoszenie osobiście i odpowiem w ciągu {POWROT.responseHours} godzin.
                Jeśli zobaczę sens dalszej rozmowy, wyślę Ci link do szczegółowej ankiety.
                Potwierdzenie przyszło też na Twój e-mail.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-8">
              <div className="space-y-6">
                <TextInput label="Imię i nazwisko" required {...field("full_name")} />
                {fromAccount && !errors.email
                  ? <AccountContactLine email={acc.email} lead="Odpowiem na:" onChange={() => setManual(true)} />
                  : <TextInput label="E-mail" required {...field("email")} />}
                <TextInput label="Telefon (opcjonalnie)" {...field("phone", "tel")} />
                <TextArea
                  label="Co sprawia, że program POWRÓT jest dla Ciebie ważny właśnie teraz?"
                  required
                  hint="Kilka zdań wystarczy — co dzieje się w Twoim życiu i czego szukasz. Nie opisuj tu stanu zdrowia — jeśli będzie potrzebne, zapytam w ankiecie, za osobną zgodą."
                  rows={5}
                  {...field("situation")}
                />
              </div>

              <div className="space-y-4 border-t hairline pt-8">
                <p className="text-xs text-foreground/60 leading-relaxed">
                  Administratorem danych jest Dawid Kowalczyk (EXMORTIS). Przetwarzam je, aby odpowiedzieć na zgłoszenie
                  i ocenić, czy program może odpowiadać Twoim oczekiwaniom. Decyzję podejmuję osobiście, nie automat.
                  Szczegóły i Twoje prawa:{" "}
                  <Link to="/polityka-prywatnosci" className="gold-text underline">Polityka prywatności</Link>.
                </p>
                <CheckRow {...check("consent_paid")}>
                  Znam cenę programu ({POWROT.priceText}, {POWROT.installmentsShort}) i wiem, że zgłoszenie
                  nie oznacza automatycznego przyjęcia. <span className="gold-text">*</span>
                </CheckRow>
                <CheckRow {...check("consent_adult")}>
                  Oświadczam, że mam ukończone 18 lat. <span className="gold-text">*</span>
                </CheckRow>
              </div>

              {error && <p className="text-sm blood-text">{error}</p>}
              <p className="text-xs text-foreground/60 leading-relaxed">
                Zgłoszenie jest bezpłatne i nie zobowiązuje do zakupu. Jeśli jest Ci teraz bardzo ciężko,
                nie czekaj na moją odpowiedź: 116 123, 800 70 2222, w zagrożeniu życia 112.
              </p>
              <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
                {sending ? "Wysyłam…" : "Wyślij zgłoszenie"}{" "}
                {!sending && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}