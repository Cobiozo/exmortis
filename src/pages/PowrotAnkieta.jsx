import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNoIndex } from "@/lib/useNoIndex";
import { useCrisis } from "@/components/crisis/CrisisContext";
import {
  SectionHead,
  Label,
  TextInput,
  TextArea,
  SingleChoice,
  MultiChoice,
  CheckRow,
} from "@/components/exmortis/powrot/PowrotFields";
import {
  AGE_OPTIONS,
  RETURN_FROM,
  DURATION_OPTIONS,
  AREA_OPTIONS,
  THERAPY_OPTIONS,
  TIME_OPTIONS,
  FORM_OPTIONS,
  INVEST_OPTIONS,
  SOURCE_OPTIONS,
  CONTACT_OPTIONS,
  surveyInitial,
} from "@/components/exmortis/powrot/survey";

// Pełna ankieta POWRÓT — wyłącznie pod osobistym linkiem z maila (?t=…), jednorazowym, ważnym 14 dni.
// Strona nie jest indeksowana; bez ważnego tokena nie pokazuje żadnych danych.

const token = () => new URLSearchParams(window.location.search).get("t") || "";

const NOTICE = {
  invalid: ["Ten link jest nieaktualny", "Link mógł zostać wpisany niekompletnie albo dotyczy zgłoszenia, którego już nie ma. Odezwij się do mnie e-mailem — wyślę nowy."],
  done: ["Ankieta jest już wypełniona", "Dziękuję — odpowiedzi mam. Odezwę się osobiście, żeby umówić rozmowę."],
  expired: ["Link wygasł", "Ankiety wysyłam na 14 dni. Napisz do mnie — wyślę świeży link."],
};

export default function PowrotAnkieta() {
  useNoIndex();
  const { open: openCrisis } = useCrisis();
  const [t] = useState(token);
  const [state, setState] = useState("loading");
  const [person, setPerson] = useState({ full_name: "", email: "" });
  const [form, setForm] = useState(surveyInitial(""));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!t) { setState("invalid"); return; }
    base44.functions
      .invoke("powrotSurvey", { action: "get", t })
      .then((res) => {
        const d = res.data || {};
        if (d.state === "ok") {
          setPerson({ full_name: d.full_name || "", email: d.email || "" });
          setForm(surveyInitial(d.situation || ""));
          setState("ok");
        } else {
          setState(d.state || "invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, [t]);

  const setDirect = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const clearErr = (k) => setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));
  const toggle = (k, opt) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(opt) ? f[k].filter((o) => o !== opt) : [...f[k], opt] }));

  const field = (k) => ({ value: form[k], onChange: (e) => { setDirect(k, e.target.value); clearErr(k); }, error: errors[k] });
  const choice = (k) => ({ value: form[k], onSelect: (v) => { setDirect(k, v); clearErr(k); }, error: errors[k] });
  const multi = (k) => ({ values: form[k], onToggle: (v) => { toggle(k, v); clearErr(k); }, error: errors[k] });
  const check = (k) => ({ checked: form[k], error: errors[k], onChange: (v) => { setDirect(k, v); clearErr(k); } });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.return_from.length === 0) errs.return_from = "Wybierz co najmniej jedną odpowiedź.";
    if (!form.situation.trim()) errs.situation = "Napisz kilka zdań o swojej sytuacji.";
    if (!form.duration) errs.duration = "Wybierz jedną odpowiedź.";
    if (!form.goal.trim()) errs.goal = "Napisz, czego szukasz.";
    if (!form.readiness) errs.readiness = "Wybierz ocenę od 1 do 10.";
    if (!form.weekly_time) errs.weekly_time = "Wybierz jedną odpowiedź.";
    if (!form.investment) errs.investment = "Wybierz jedną odpowiedź.";
    if (!form.consent_health) errs.consent_health = "Ta zgoda jest wymagana.";
    if (!form.consent_terms) errs.consent_terms = "Ta zgoda jest wymagana.";
    if (!form.consent_paid) errs.consent_paid = "Ta zgoda jest wymagana.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) { setError("Uzupełnij zaznaczone pola."); return; }
    setSending(true);
    setError("");
    try {
      const res = await base44.functions.invoke("powrotSurvey", { action: "submit", t, ...form });
      setSaved(true);
      if (res?.data?.pilne) openCrisis();
    } catch (err) {
      const d = err?.response?.data;
      setError(d?.error || "Nie udało się wysłać ankiety. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  const shell = (children) => (
    <div className="bg-[#0A0A0B] min-h-screen pt-24 pb-24 px-5">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );

  if (state === "loading") {
    return shell(
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }

  if (state !== "ok" || saved) {
    const [title, text] = saved
      ? ["Ankieta przyjęta", "Dziękuję. Przeczytam odpowiedzi i odezwę się osobiście, żeby umówić rozmowę kwalifikacyjną."]
      : NOTICE[state] || NOTICE.invalid;
    return shell(
      <div className="border border-[#C9A24A]/40 p-8 md:p-12 text-center space-y-6">
        <div className="w-14 h-14 mx-auto border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
          <Check className="h-7 w-7 gold-text" />
        </div>
        <h1 className="relic-heading text-3xl text-[#F5EFE1]">{title}</h1>
        <p className="text-foreground/60 leading-relaxed">{text}</p>
        <Link to="/" className="btn-ghost inline-flex">Wróć na stronę</Link>
      </div>
    );
  }

  return shell(
    <>
      <p className="technical text-[10px] gold-text mb-3">POWRÓT · ANKIETA PRZED ROZMOWĄ</p>
      <h1 className="relic-heading text-[clamp(2rem,7vw,3rem)] leading-[0.95] mb-4">
        Ankieta <span className="gold-text">przed rozmową</span>
      </h1>
      <p className="text-foreground/60 leading-relaxed mb-3">
        {person.full_name ? `${person.full_name}, to Twoje osobiste zgłoszenie` : "Twoje osobiste zgłoszenie"}
        {person.email ? ` (${person.email})` : ""}. Odpowiedzi dopisują się do niego — nie musisz
        wypełniać zgłoszenia jeszcze raz.
      </p>
      <p className="text-foreground/55 text-sm mb-10">Zajmie około 10 minut. Link jest jednorazowy.</p>

      <form onSubmit={submit} className="space-y-12">
        <div className="space-y-6">
          <SectionHead>O Tobie</SectionHead>
          <SingleChoice label="Wiek" options={AGE_OPTIONS} {...choice("age")} />
        </div>

        <div className="space-y-6">
          <SectionHead>Twoja sytuacja</SectionHead>
          <MultiChoice label="Z czego dziś wracasz?" required options={RETURN_FROM} {...multi("return_from")} />
          {form.return_from.includes("Inne") && <TextInput label="Jakie?" {...field("return_from_other")} />}
          <TextArea
            label="Opisz krótko swoją sytuację"
            required
            hint="Kilka zdań wystarczy, bez szczegółów, jeśli nie chcesz"
            {...field("situation")}
          />
          <SingleChoice label="Od jak dawna jesteś w tym miejscu?" required options={DURATION_OPTIONS} {...choice("duration")} />
          <MultiChoice label="Który obszar życia najbardziej na tym cierpi?" options={AREA_OPTIONS} {...multi("affected_areas")} />
          <TextArea label="Co już było próbą wyjścia?" {...field("tried_before")} />
          <SingleChoice
            label="Czy korzystasz obecnie ze wsparcia terapeuty, psychologa lub lekarza?"
            options={THERAPY_OPTIONS}
            {...choice("therapy_support")}
          />
        </div>

        <div className="space-y-6">
          <SectionHead>Cel i gotowość</SectionHead>
          <TextArea label="Czego szukasz? Co chcesz, żeby było inaczej za pół roku?" required {...field("goal")} />
          <TextArea label="Co jest dziś największą przeszkodą w Twoim powrocie?" {...field("obstacle")} />
          <div>
            <Label required>Jak bardzo czujesz gotowość na zmianę teraz?</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setDirect("readiness", n); clearErr("readiness"); }}
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
            {errors.readiness && <p className="text-xs blood-text mt-2">{errors.readiness}</p>}
          </div>
          <SingleChoice
            label="Ile czasu tygodniowo możesz realnie poświęcić na pracę nad sobą?"
            required
            options={TIME_OPTIONS}
            {...choice("weekly_time")}
          />
          <SingleChoice label="Jaka forma pracy jest Ci najbliższa?" options={FORM_OPTIONS} {...choice("work_form")} />
          <SingleChoice
            label="Czy czujesz gotowość, żeby zainwestować w swój powrót, jeśli program okaże się dla Ciebie?"
            required
            options={INVEST_OPTIONS}
            {...choice("investment")}
          />
        </div>

        <div className="space-y-6">
          <SectionHead>Na koniec</SectionHead>
          <TextArea label="Czy jest coś jeszcze, co chcesz, żebym wiedział przed rozmową?" {...field("anything_else")} />
          <SingleChoice label="Skąd wiesz o exmortis?" options={SOURCE_OPTIONS} {...choice("source")} />
          <SingleChoice label="Preferowany kontakt" options={CONTACT_OPTIONS} {...choice("contact_pref")} />
        </div>

        <div className="space-y-4 border-t hairline pt-8">
          <CheckRow {...check("consent_health")}>
            Wyrażam zgodę na przetwarzanie moich danych, w tym informacji o zdrowiu, które podam
            w ankiecie, w celu kwalifikacji do programu POWRÓT. Zgodę mogę wycofać w każdej chwili.
            <span className="gold-text"> *</span>
          </CheckRow>
          <CheckRow {...check("consent_terms")}>
            Akceptuję{" "}
            <Link to="/regulamin" className="gold-text underline">regulamin</Link> i{" "}
            <Link to="/polityka-prywatnosci" className="gold-text underline">politykę prywatności</Link>.
            <span className="gold-text"> *</span>
          </CheckRow>
          <CheckRow {...check("consent_paid")}>
            Rozumiem, że program jest płatny, a o udziale decydujemy wspólnie po rozmowie.
            <span className="gold-text"> *</span>
          </CheckRow>
        </div>

        {error && <p className="text-sm blood-text">{error}</p>}
        <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
          {sending ? "WYSYŁAM..." : "WYŚLIJ ANKIETĘ"} {!sending && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </>
  );
}