import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Section from "./Section";
import {
  SectionHead,
  Label,
  TextInput,
  TextArea,
  SingleChoice,
  MultiChoice,
  CheckRow,
} from "./PowrotFields";

const AGE_OPTIONS = ["18–25", "26–35", "36–45", "46–55", "56+"];
const RETURN_FROM = [
  "Wypalenie, zmęczenie, życie na autopilocie",
  "Utrata sensu, pustka, kryzys wiary lub wartości",
  "Rozstanie, rozwód, kryzys w relacji",
  "Żałoba lub strata",
  "Kryzys finansowy lub zawodowy",
  "Choroba (własna lub bliskiej osoby)",
  "Inne",
];
const DURATION_OPTIONS = ["Mniej niż 3 miesiące", "3–12 miesięcy", "1–3 lata", "Dłużej niż 3 lata"];
const AREA_OPTIONS = [
  "Zdrowie i energia",
  "Relacje i rodzina",
  "Praca i finanse",
  "Duchowość i sens",
  "Poczucie własnej wartości",
];
const THERAPY_OPTIONS = ["Tak", "Nie", "Wolę nie odpowiadać"];
const TIME_OPTIONS = ["Do 1 h", "1–3 h", "Powyżej 3 h"];
const FORM_OPTIONS = ["W grupie", "Indywidualnie", "Samodzielnie ze wsparciem", "Jeszcze nie wiem"];
const INVEST_OPTIONS = ["Tak", "Potrzebuję więcej informacji", "Nie w tej chwili"];
const SOURCE_OPTIONS = ["Facebook", "Instagram", "Newsletter «Listy powrotu»", "Polecenie", "Webinar", "Inne"];
const CONTACT_OPTIONS = ["E-mail", "Telefon", "Obojętnie"];

const INITIAL = {
  full_name: "",
  email: "",
  phone: "",
  age: "",
  return_from: [],
  return_from_other: "",
  situation: "",
  duration: "",
  affected_areas: [],
  tried_before: "",
  therapy_support: "",
  goal: "",
  obstacle: "",
  readiness: null,
  weekly_time: "",
  work_form: "",
  investment: "",
  anything_else: "",
  source: "",
  contact_pref: "",
  consent_rodo: false,
  consent_paid: false,
};

export default function PowrotForm() {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const setDirect = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const clearErr = (k) => setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));
  const toggle = (k, opt) =>
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(opt) ? f[k].filter((o) => o !== opt) : [...f[k], opt],
    }));

  const field = (k, type = "text") => ({
    value: form[k],
    onChange: (e) => {
      setDirect(k, e.target.value);
      clearErr(k);
    },
    error: errors[k],
    type,
  });
  const choice = (k) => ({
    value: form[k],
    onSelect: (v) => {
      setDirect(k, v);
      clearErr(k);
    },
    error: errors[k],
  });
  const multi = (k) => ({
    values: form[k],
    onToggle: (v) => {
      toggle(k, v);
      clearErr(k);
    },
    error: errors[k],
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
    if (!form.full_name.trim()) errs.full_name = "Podaj imię.";
    if (!form.phone.trim()) errs.phone = "Podaj numer telefonu.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = "Podaj poprawny adres e-mail.";
    if (form.return_from.length === 0) errs.return_from = "Wybierz co najmniej jedną odpowiedź.";
    if (!form.situation.trim()) errs.situation = "Napisz kilka zdań o swojej sytuacji.";
    if (!form.duration) errs.duration = "Wybierz jedną odpowiedź.";
    if (!form.goal.trim()) errs.goal = "Napisz, czego szukasz.";
    if (!form.readiness) errs.readiness = "Wybierz ocenę od 1 do 10.";
    if (!form.weekly_time) errs.weekly_time = "Wybierz jedną odpowiedź.";
    if (!form.investment) errs.investment = "Wybierz jedną odpowiedź.";
    if (!form.consent_rodo) errs.consent_rodo = "Ta zgoda jest wymagana.";
    if (!form.consent_paid) errs.consent_paid = "Ta zgoda jest wymagana.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Uzupełnij zaznaczone pola.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await base44.functions.invoke("createPowrotApplication", form);
      setSent(true);
    } catch {
      setError("Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Section dark id="formularz" label="ZGŁOSZENIE">
      <div className="grid md:grid-cols-2 gap-12 md:gap-20">
        <div>
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-6">
            Formularz<br /><span className="gold-text">kwalifikacyjny</span>
          </h2>
          <p className="text-foreground/60 leading-relaxed max-w-md">
            Kilka pytań zadasz sobie sam. Zgłoszenia rozpatruję
            w kolejności napływania — odezwę się osobiście.
          </p>
          <p className="technical text-[10px] text-foreground/40 mt-8">
            ROZMOWA KWALIFIKACYJNA · BEZPŁATNA · BEZ ZOBOWIĄZAŃ
          </p>
        </div>
        <div>
          <p className="text-foreground/50 text-sm mb-8">
            Nie wiesz, czy to dla Ciebie? Zacznij od{" "}
            <Link to="/test?src=powrot" className="gold-text hover:underline">
              testu «Która śmierć jest Twoja?»
            </Link>
          </p>
          {sent ? (
            <div className="border border-[#C9A24A]/40 p-10 flex flex-col items-center justify-center text-center gap-6 h-full">
              <div className="w-14 h-14 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
                <Check className="h-7 w-7 gold-text" />
              </div>
              <p className="relic-heading text-2xl gold-text">Zgłoszenie przyjęte</p>
              <p className="text-foreground/60 leading-relaxed">
                Dziękuję za zaufanie. Każdy powrót zaczyna się od pierwszego kroku — właśnie go
                zrobiłeś/aś. Odezwę się w ciągu kilku dni.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-12">
              <p className="text-foreground/60 text-sm leading-relaxed border-l-2 border-[#C9A24A]/60 pl-4">
                Kilka pytań o to, z czego wracasz i czego szukasz. Nie ma tu złych odpowiedzi —
                pisz tyle, ile chcesz. Po zgłoszeniu odezwę się, żeby umówić krótką rozmowę.
              </p>

              {/* ===== O TOBIE ===== */}
              <div className="space-y-6">
                <SectionHead>O Tobie</SectionHead>
                <TextInput label="Imię i nazwisko" required {...field("full_name")} />
                <TextInput label="E-mail" required {...field("email")} />
                <TextInput label="Telefon" required {...field("phone")} />
                <SingleChoice label="Wiek" options={AGE_OPTIONS} {...choice("age")} />
              </div>

              {/* ===== TWOJA SYTUACJA ===== */}
              <div className="space-y-6">
                <SectionHead>Twoja sytuacja</SectionHead>
                <MultiChoice
                  label="Z czego dziś wracasz?"
                  required
                  options={RETURN_FROM}
                  {...multi("return_from")}
                />
                {form.return_from.includes("Inne") && (
                  <TextInput label="Jakie?" {...field("return_from_other")} />
                )}
                <TextArea
                  label="Opisz krótko swoją sytuację"
                  required
                  hint="Kilka zdań wystarczy, bez szczegółów, jeśli nie chcesz"
                  {...field("situation")}
                />
                <SingleChoice
                  label="Od jak dawna jesteś w tym miejscu?"
                  required
                  options={DURATION_OPTIONS}
                  {...choice("duration")}
                />
                <MultiChoice
                  label="Który obszar życia najbardziej na tym cierpi?"
                  options={AREA_OPTIONS}
                  {...multi("affected_areas")}
                />
                <TextArea
                  label="Co już próbowałeś/aś zrobić, żeby z tego wyjść?"
                  {...field("tried_before")}
                />
                <SingleChoice
                  label="Czy korzystasz obecnie ze wsparcia terapeuty, psychologa lub lekarza?"
                  options={THERAPY_OPTIONS}
                  {...choice("therapy_support")}
                />
              </div>

              {/* ===== CEL I GOTOWOŚĆ ===== */}
              <div className="space-y-6">
                <SectionHead>Cel i gotowość</SectionHead>
                <TextArea
                  label="Czego szukasz? Co chcesz, żeby było inaczej za pół roku?"
                  required
                  {...field("goal")}
                />
                <TextArea
                  label="Co jest dziś największą przeszkodą w Twoim powrocie?"
                  {...field("obstacle")}
                />
                <div>
                  <Label required>Jak bardzo jesteś gotowy/a na zmianę teraz?</Label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setDirect("readiness", n);
                          clearErr("readiness");
                        }}
                        className={`h-10 w-10 flex items-center justify-center border font-mono text-sm transition-colors ${
                          form.readiness === n
                            ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10"
                            : "hairline text-foreground/60 hover:border-[#C9A24A]/60"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {errors.readiness && (
                    <p className="text-xs blood-text mt-2">{errors.readiness}</p>
                  )}
                </div>
                <SingleChoice
                  label="Ile czasu tygodniowo możesz realnie poświęcić na pracę nad sobą?"
                  required
                  options={TIME_OPTIONS}
                  {...choice("weekly_time")}
                />
                <SingleChoice
                  label="Jaka forma pracy jest Ci najbliższa?"
                  options={FORM_OPTIONS}
                  {...choice("work_form")}
                />
                <SingleChoice
                  label="Czy jesteś gotowy/a zainwestować w swój powrót, jeśli program okaże się dla Ciebie?"
                  required
                  options={INVEST_OPTIONS}
                  {...choice("investment")}
                />
              </div>

              {/* ===== NA KONIEC ===== */}
              <div className="space-y-6">
                <SectionHead>Na koniec</SectionHead>
                <TextArea
                  label="Czy jest coś jeszcze, co chcesz, żebym wiedział przed rozmową?"
                  {...field("anything_else")}
                />
                <SingleChoice
                  label="Skąd dowiedziałeś/aś się o exmortis?"
                  options={SOURCE_OPTIONS}
                  {...choice("source")}
                />
                <SingleChoice
                  label="Preferowany kontakt"
                  options={CONTACT_OPTIONS}
                  {...choice("contact_pref")}
                />
              </div>

              {/* ===== ZGODY ===== */}
              <div className="space-y-4 border-t hairline pt-8">
                <CheckRow {...check("consent_rodo")}>
                  Wyrażam zgodę na przetwarzanie moich danych osobowych w celu kontaktu w sprawie
                  programu POWRÓT (RODO). <span className="gold-text">*</span>
                </CheckRow>
                <CheckRow {...check("consent_paid")}>
                  Rozumiem, że program jest płatny, a o udziale decydujemy wspólnie po rozmowie.{" "}
                  <span className="gold-text">*</span>
                </CheckRow>
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