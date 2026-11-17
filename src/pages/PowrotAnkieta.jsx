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
  EXPECT_OPTIONS,
  START_OPTIONS,
  TIME_OPTIONS,
  INVEST_OPTIONS,
  INVEST_LABEL,
  DECISION_OPTIONS,
  THERAPY_OPTIONS,
  SOURCE_OPTIONS,
  CONTACT_OPTIONS,
  surveyInitial,
} from "@/components/exmortis/powrot/survey";
import { POWROT } from "@/lib/powrotOffer";

// Pełna ankieta POWRÓT — wyłącznie pod osobistym linkiem z maila (?t=…), jednorazowym, ważnym 14 dni.
// Strona nie jest indeksowana; bez ważnego tokena nie pokazuje żadnych danych.

const token = () => new URLSearchParams(window.location.search).get("t") || "";
const draftKey = (t) => `exm_powrot_ankieta_${String(t).slice(0, 16)}`;
const PRIVATE = ["consent_health", "therapy_support", "zdrowie_uwagi"];
const readDraft = (t) => { try { return JSON.parse(localStorage.getItem(draftKey(t)) || "null"); } catch { return null; } };
const saveDraft = (t, f) => { try { const x = { ...f }; PRIVATE.forEach((k) => delete x[k]); localStorage.setItem(draftKey(t), JSON.stringify(x)); } catch { /* bez szkicu */ } };
const dropDraft = (t) => { try { localStorage.removeItem(draftKey(t)); } catch { /* bez szkicu */ } };

const NOTICE = {
  invalid: ["Ten link jest nieaktualny", "Link mógł zostać wpisany niekompletnie albo dotyczy zgłoszenia, którego już nie ma. Napisz do mnie e-mailem — prześlę nowy link."],
  done: ["Ankieta jest już wypełniona", "Dziękuję — odpowiedzi mam. Przeczytam je osobiście i odezwę się z dalszym krokiem."],
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
          const draft = readDraft(t);
          setForm({ ...surveyInitial(d.situation || ""), ...(draft || {}) });
          setState("ok");
        } else {
          setState(d.state || "invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, [t]);

  const setDirect = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => { if (state === "ok" && !saved) saveDraft(t, form); }, [form, state, saved, t]);
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
    if (!form.goal.trim()) errs.goal = "Napisz, co chcesz zmienić.";
    if (form.oczekiwania.length === 0) errs.oczekiwania = "Wybierz co najmniej jedną odpowiedź.";
    if (!form.start_kiedy) errs.start_kiedy = "Wybierz jedną odpowiedź.";
    if (!form.weekly_time) errs.weekly_time = "Wybierz jedną odpowiedź.";
    if (!form.investment) errs.investment = "Wybierz jedną odpowiedź.";
    if (!form.decyzja) errs.decyzja = "Wybierz jedną odpowiedź.";
    if (!form.consent_paid) errs.consent_paid = "Potwierdź, proszę.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) { setError("Uzupełnij zaznaczone pola."); return; }
    setSending(true);
    setError("");
    try {
      const payload = form.consent_health ? form : { ...form, therapy_support: "", zdrowie_uwagi: "" };
      const res = await base44.functions.invoke("powrotSurvey", { action: "submit", t, ...payload });
      setSaved(true);
      dropDraft(t);
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
      ? ["Ankieta przyjęta", `Dziękuję. Przeczytam Twoje odpowiedzi osobiście. Jeśli zobaczę sens dalszej rozmowy, wyślę Ci zaproszenie na bezpłatną rozmowę wstępną (20 minut) z linkiem do wyboru terminu.`]
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
      <p className="technical text-[10px] gold-text mb-3">POWRÓT · SZCZEGÓŁOWA ANKIETA</p>
      <h1 className="relic-heading text-[clamp(2rem,7vw,3rem)] leading-[0.95] mb-4">
        Ankieta <span className="gold-text">przed rozmową</span>
      </h1>
      <p className="text-foreground/60 leading-relaxed mb-3">
        {person.full_name ? `${person.full_name}, to Twoje osobiste zgłoszenie` : "Twoje osobiste zgłoszenie"}
        {person.email ? ` (${person.email})` : ""}. Odpowiedzi dopisują się do niego — nie musisz
        wypełniać zgłoszenia jeszcze raz.
      </p>
      <p className="text-foreground/55 text-sm mb-6">Zajmie około 8–10 minut. Odpowiedzi zapisują się w tej przeglądarce, dopóki ich nie wyślesz.</p>
      <div className="border hairline rounded-2xl p-5 md:p-6 mb-10 text-sm text-foreground/65 leading-relaxed space-y-2">
        <p>Odpowiedzi czytam wyłącznie ja, Dawid Kowalczyk (EXMORTIS), administrator danych. Służą mi do oceny, czy program może odpowiadać Twoim oczekiwaniom. Decyzję podejmuję osobiście, nie automat.</p>
        <p>Jeśli nie rozpoczniemy współpracy, usuwam zgłoszenie i ankietę po 6 miesiącach. Szczegóły i Twoje prawa: <Link to="/polityka-prywatnosci" className="gold-text underline">Polityka prywatności</Link>.</p>
        <p>Nie musisz opisywać stanu zdrowia ani trudnych doświadczeń. To mentoring, nie terapia. Jeśli jest Ci teraz bardzo ciężko: 116 123, 800 70 2222, w zagrożeniu życia 112.</p>
      </div>

      <form onSubmit={submit} className="space-y-12">
        <div className="space-y-6">
          <SectionHead>Twoja sytuacja</SectionHead>
          <MultiChoice label="Z jakim obszarem życia chcesz teraz pracować?" required options={RETURN_FROM} {...multi("return_from")} />
          {form.return_from.includes("Inna sytuacja") && <TextInput label="Jaka?" {...field("return_from_other")} />}
          <TextArea
            label="Co sprawia, że rozważasz mentoring właśnie teraz?"
            required
            hint="Kilka zdań wystarczy. Możesz zmienić to, co napisałeś(-aś) w zgłoszeniu."
            {...field("situation")}
          />
          <SingleChoice label="Od jak dawna to trwa?" required options={DURATION_OPTIONS} {...choice("duration")} />
          <TextArea label="Co chcesz zmienić w swoim życiu w najbliższych sześciu miesiącach?" required {...field("goal")} />
          <TextArea label="Co już udało się zrobić w tej sprawie i co z tego wynikło?" hint="Nieobowiązkowe." {...field("tried_before")} />
        </div>

        <div className="space-y-6">
          <SectionHead>Oczekiwania i możliwości</SectionHead>
          <MultiChoice label="Czego oczekujesz od współpracy z mentorem?" required options={EXPECT_OPTIONS} {...multi("oczekiwania")} />
          <SingleChoice label="Kiedy realnie chcesz zacząć?" required options={START_OPTIONS} {...choice("start_kiedy")} />
          <SingleChoice label="Czy możesz poświęcić w tygodniu około 1–2 godzin na pracę między sesjami?" required options={TIME_OPTIONS} {...choice("weekly_time")} />
          <SingleChoice label={INVEST_LABEL} required options={INVEST_OPTIONS} {...choice("investment")} />
          <SingleChoice label="Czy decyzja o zgłoszeniu jest Twoja?" required options={DECISION_OPTIONS} {...choice("decyzja")} />
        </div>

        <div className="space-y-6">
          <SectionHead>Na koniec</SectionHead>
          <TextArea label="Czy jest coś jeszcze, co chcesz, żebym wiedział przed rozmową?" hint="Nieobowiązkowe. Nie musisz podawać informacji o zdrowiu — na to jest osobna, nieobowiązkowa część poniżej." {...field("anything_else")} />
          <SingleChoice label="Przedział wieku (nieobowiązkowe)" options={AGE_OPTIONS} {...choice("age")} />
          <SingleChoice label="Skąd wiesz o exmortis?" options={SOURCE_OPTIONS} {...choice("source")} />
          <SingleChoice label="Preferowany kontakt" options={CONTACT_OPTIONS} {...choice("contact_pref")} />
        </div>

        <div className="space-y-6 border hairline rounded-2xl p-5 md:p-6">
          <SectionHead>Część nieobowiązkowa: wsparcie, z którego korzystasz</SectionHead>
          <p className="text-sm text-foreground/60 leading-relaxed">
            Możesz pominąć tę część bez żadnego wpływu na rozpatrzenie zgłoszenia. Jeśli chcesz ją wypełnić,
            potrzebuję Twojej wyraźnej zgody, bo chodzi o informacje o zdrowiu.
          </p>
          <CheckRow {...check("consent_health")}>
            Wyrażam wyraźną zgodę na przetwarzanie informacji o moim zdrowiu oraz przekonaniach religijnych lub
            światopoglądowych, które podam w tej ankiecie, w celu oceny dopasowania do programu POWRÓT. Wiem, że zgoda
            jest dobrowolna i mogę ją wycofać w każdej chwili, pisząc do Dawida.
          </CheckRow>
          {form.consent_health && (
            <div className="space-y-6">
              <SingleChoice
                label="Czy obecnie korzystasz z pomocy psychologa, psychoterapeuty lub psychiatry?"
                options={THERAPY_OPTIONS}
                {...choice("therapy_support")}
              />
              <TextArea
                label="Czy jest coś dotyczącego Twojego zdrowia, o czym powinienem wiedzieć, żeby bezpiecznie prowadzić rozmowę?"
                hint="Nieobowiązkowe. Nie podawaj diagnoz ani nazw leków."
                {...field("zdrowie_uwagi")}
              />
            </div>
          )}
        </div>

        <div className="space-y-4 border-t hairline pt-8">
          <CheckRow {...check("consent_paid")}>
            Wiem, że program kosztuje {POWROT.priceText} i że o udziale decydujemy wspólnie po rozmowie wstępnej.
            Ankieta nie zobowiązuje mnie do zakupu.
            <span className="gold-text"> *</span>
          </CheckRow>
        </div>

        {error && <p className="text-sm blood-text" role="alert">{error}</p>}
        <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
          {sending ? "Wysyłam…" : "Wyślij ankietę"} {!sending && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </>
  );
}