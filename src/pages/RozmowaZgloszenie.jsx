import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNoIndex } from "@/lib/useNoIndex";
import { useCart } from "@/components/exmortis/CartContext";
import { SectionHead, TextInput, TextArea, SingleChoice, CheckRow } from "@/components/exmortis/powrot/PowrotFields";

// Rozmowa na progu (18.11.2026): zgłoszenie z krótką ankietą → płatność → wybór terminu → spotkanie → podsumowanie.
// Płatność jest możliwa tylko z osobistym linkiem ze zgłoszenia (?t=…), ważnym 7 dni.
const SLUG = "rozmowa-na-progu";
export const PROG_TOKEN_KEY = "exm_prog_token";
const OBSZARY = ["praca", "relacje", "ważna decyzja", "zmiana życiowa", "poczucie kierunku", "inne"];
const SCOPE =
  "Rozumiem, że Rozmowa na progu jest spotkaniem mentoringowym. Nie jest psychoterapią, diagnozą ani pomocą w kryzysie. Jeśli potrzebuję pilnej pomocy, skorzystam z numerów 116 123, 800 70 2222 albo 112.";
const STEPS = ["Zgłoszenie", "Płatność", "Termin", "Spotkanie"];

const empty = { full_name: "", email: "", phone: "", sprawa: "", dlaczego_teraz: "", zrozumiec: "", obszar: "", bez_tematow: "",
  podsumowanie_chce: true, consent_adult: false, consent_scope: false };

function Steps({ at }) {
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2 mb-10" aria-label="Etapy">
      {STEPS.map((s, i) => (
        <li key={s} className={`technical text-[10px] flex items-center gap-2 ${i === at ? "gold-text" : i < at ? "text-foreground/70" : "text-foreground/40"}`}
          aria-current={i === at ? "step" : undefined}>
          <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${i <= at ? "border-[#C9A24A]" : "border-foreground/30"}`}>
            {i < at ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          {s.toUpperCase()}
        </li>
      ))}
    </ol>
  );
}

function Terminy({ av }) {
  if (!av) return null;
  if (!av.count) return (
    <p className="text-sm text-[#E8C547]">
      W ciągu najbliższych 60 dni nie ma teraz wolnych terminów. Napisz do mnie przez stronę <Link to="/kontakt" className="underline">Kontakt</Link>, a podam przewidywany termin, zanim cokolwiek zapłacisz.
    </p>
  );
  return <p className="text-sm text-foreground/65">Najbliższe wolne dni: <span className="gold-text">{av.dni.join(", ")}</span>. Termin wybierasz po płatności.</p>;
}

export default function RozmowaZgloszenie() {
  useNoIndex();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items, setOpen } = useCart();
  const [t, setT] = useState(() => new URLSearchParams(window.location.search).get("t") || "");
  const [state, setState] = useState(t ? "loading" : "form");
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [av, setAv] = useState(null);

  useEffect(() => {
    base44.functions.invoke("progZgloszenie", { action: "availability" }).then((r) => setAv(r.data)).catch(() => setAv(null));
  }, []);
  useEffect(() => {
    if (user) setF((x) => ({ ...x, full_name: x.full_name || user.full_name || "", email: x.email || user.email || "" }));
  }, [user]);
  useEffect(() => {
    if (!t) return;
    base44.functions.invoke("progZgloszenie", { action: "status", t })
      .then((r) => setState(r.data?.state === "ok" ? "pay" : r.data?.state || "invalid"))
      .catch(() => setState("invalid"));
  }, [t]);

  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const field = (k) => ({ value: f[k], onChange: set(k), error: errors[k] });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.full_name.trim()) errs.full_name = "Podaj imię i nazwisko.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errs.email = "Podaj poprawny adres e-mail.";
    if (!f.sprawa.trim()) errs.sprawa = "Napisz kilka słów o sprawie.";
    if (!f.dlaczego_teraz.trim()) errs.dlaczego_teraz = "Odpowiedz, proszę.";
    if (!f.zrozumiec.trim()) errs.zrozumiec = "Odpowiedz, proszę.";
    if (!f.obszar) errs.obszar = "Wybierz jeden obszar.";
    if (!f.consent_adult) errs.consent_adult = "Potwierdź, proszę.";
    if (!f.consent_scope) errs.consent_scope = "Potwierdź, proszę.";
    setErrors(errs);
    if (Object.keys(errs).length) { setError("Uzupełnij zaznaczone pola."); return; }
    setBusy(true); setError("");
    try {
      const r = await base44.functions.invoke("progZgloszenie", {
        action: "submit", full_name: f.full_name, email: f.email, phone: f.phone,
        consent_adult: true, consent_scope: true, podsumowanie_chce: f.podsumowanie_chce,
        ankieta: { sprawa: f.sprawa, dlaczego_teraz: f.dlaczego_teraz, zrozumiec: f.zrozumiec, obszar: f.obszar, bez_tematow: f.bez_tematow },
      });
      const tok = r.data?.token || "";
      if (r.data?.availability) setAv(r.data.availability);
      setT(tok);
      window.history.replaceState(null, "", `/rozmowa-na-progu/zgloszenie?t=${tok}`);
      setState("pay");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
    } finally { setBusy(false); }
  };

  const toPayment = async () => {
    setBusy(true); setError("");
    try {
      const r = await base44.functions.invoke("shopProducts", { slug: SLUG });
      const p = r.data?.products?.[0];
      if (!p) throw new Error("Produkt jest chwilowo niedostępny.");
      try { localStorage.setItem(PROG_TOKEN_KEY, t); } catch { /* bez pamięci — kasa poprosi o link ponownie */ }
      if (!items.some((i) => !i.key && i.id === p.id)) addItem(p, 1);
      setOpen(false);
      navigate("/kasa");
    } catch (err) {
      setError(err?.message || "Nie udało się przejść do płatności.");
      setBusy(false);
    }
  };

  const shell = (children) => (
    <div className="bg-[#0A0A0B] min-h-screen pt-24 pb-24 px-5">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );

  if (state === "loading") return shell(<div className="py-24 flex justify-center"><div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>);

  if (["invalid", "expired", "done"].includes(state)) {
    const [title, text] = {
      invalid: ["Ten link jest nieaktualny", "Wypełnij zgłoszenie ponownie — otrzymasz nowy link do płatności w wiadomości e-mail."],
      expired: ["Link do płatności wygasł", "Link jest ważny 7 dni. Wypełnij zgłoszenie ponownie — otrzymasz nowy link."],
      done: ["To zgłoszenie jest już opłacone", "Termin wybierzesz z linku w wiadomości e-mail albo w swoim koncie, w zakładce „Moje sesje”."],
    }[state];
    return shell(
      <div className="border border-[#C9A24A]/40 p-8 md:p-12 text-center space-y-6">
        <h1 className="relic-heading text-3xl text-[#F5EFE1]">{title}</h1>
        <p className="text-foreground/60 leading-relaxed">{text}</p>
        {state === "done"
          ? <Link to="/konto?tab=rozmowa" className="btn-ghost inline-flex">Przejdź do konta</Link>
          : <button onClick={() => { setT(""); setState("form"); window.history.replaceState(null, "", "/rozmowa-na-progu/zgloszenie"); }} className="btn-relic inline-flex">Wypełnij zgłoszenie</button>}
      </div>
    );
  }

  if (state === "pay") return shell(
    <>
      <Steps at={1} />
      <p className="technical text-[10px] gold-text mb-3">ROZMOWA NA PROGU</p>
      <h1 className="relic-heading text-[clamp(2rem,7vw,3rem)] leading-[0.95] mb-6">Zgłoszenie <span className="gold-text">przyjęte</span></h1>
      <div className="space-y-4 text-foreground/70 leading-relaxed mb-8">
        <p>Dziękuję. Twoje odpowiedzi pomogą mi przygotować się do spotkania. Link do płatności otrzymasz także w wiadomości e-mail — jest ważny 7 dni.</p>
        <p>Kolejny krok to płatność <span className="gold-text">799 zł</span>. Po płatności otrzymasz wiadomość e-mail z linkiem do kalendarza i wybierzesz termin spotkania (90 minut, online).</p>
        <Terminy av={av} />
      </div>
      {error && <p className="text-sm blood-text mb-4" role="alert">{error}</p>}
      <button onClick={toPayment} disabled={busy || (av && !av.count)} className="btn-relic w-full disabled:opacity-60">
        {busy ? "Przechodzę do kasy…" : "Przejdź do płatności"} {!busy && <ArrowRight className="h-4 w-4" />}
      </button>
      <p className="text-xs text-foreground/55 mt-4 leading-relaxed">
        Płatność przez PayU. Masz 14 dni na odstąpienie od umowy na zasadach z <Link to="/regulamin" className="underline">Regulaminu</Link>.
      </p>
    </>
  );

  return shell(
    <>
      <Steps at={0} />
      <p className="technical text-[10px] gold-text mb-3">ROZMOWA NA PROGU · ZGŁOSZENIE</p>
      <h1 className="relic-heading text-[clamp(2rem,7vw,3rem)] leading-[0.95] mb-4">Zanim się <span className="gold-text">spotkamy</span></h1>
      <p className="text-foreground/60 leading-relaxed mb-6">
        Kilka pytań, dzięki którym przygotuję się do naszej rozmowy. Zajmie to około 5 minut. Nie musisz opisywać całej historii — wystarczy kilka zdań.
      </p>
      <div className="border hairline rounded-2xl p-5 md:p-6 mb-10 text-sm text-foreground/65 leading-relaxed space-y-2">
        <p>Odpowiedzi czytam wyłącznie ja, Dawid Kowalczyk (EXMORTIS), administrator danych. Służą mi do przygotowania spotkania. Szczegóły i Twoje prawa: <Link to="/polityka-prywatnosci" className="gold-text underline">Polityka prywatności</Link>.</p>
        <p>Nie musisz podawać informacji o zdrowiu ani leczeniu. Jeśli jest Ci teraz bardzo ciężko: 116 123, 800 70 2222, w zagrożeniu życia 112.</p>
      </div>

      <form onSubmit={submit} className="space-y-12" noValidate>
        <div className="space-y-6">
          <SectionHead>Twoje dane</SectionHead>
          <TextInput label="Imię i nazwisko" required {...field("full_name")} />
          <TextInput label="Adres e-mail" type="email" required {...field("email")} />
          <TextInput label="Telefon (nieobowiązkowo)" type="tel" {...field("phone")} />
        </div>

        <div className="space-y-6">
          <SectionHead>Przygotowanie do spotkania</SectionHead>
          <TextArea label="Z jaką główną sprawą przychodzisz na spotkanie?" required {...field("sprawa")} />
          <TextArea label="Co sprawia, że chcesz porozmawiać o niej właśnie teraz?" required {...field("dlaczego_teraz")} />
          <TextArea label="Co chcesz lepiej zrozumieć po naszym spotkaniu?" required {...field("zrozumiec")} />
          <SingleChoice label="Który obszar najlepiej opisuje Twoją sytuację?" required options={OBSZARY} value={f.obszar} onSelect={(v) => setF({ ...f, obszar: v })} error={errors.obszar} />
          <TextArea label="Czy są tematy, których nie chcesz poruszać?" hint="Nieobowiązkowe." rows={3} {...field("bez_tematow")} />
          <SingleChoice label="Czy chcesz otrzymać pisemne podsumowanie spotkania?" options={["Tak, chcę", "Nie, dziękuję"]}
            value={f.podsumowanie_chce ? "Tak, chcę" : "Nie, dziękuję"} onSelect={(v) => setF({ ...f, podsumowanie_chce: v === "Tak, chcę" })} />
          <p className="text-xs text-foreground/55 -mt-3">Podsumowanie przygotowuję w ciągu 48 godzin po spotkaniu i udostępniam w Twoim koncie na exmortis.pl.</p>
        </div>

        <div className="space-y-4 border-t hairline pt-8">
          <CheckRow checked={f.consent_adult} onChange={(v) => setF({ ...f, consent_adult: v })} error={errors.consent_adult}>
            Mam ukończone 18 lat.<span className="gold-text"> *</span>
          </CheckRow>
          <CheckRow checked={f.consent_scope} onChange={(v) => setF({ ...f, consent_scope: v })} error={errors.consent_scope}>
            {SCOPE}<span className="gold-text"> *</span>
          </CheckRow>
        </div>

        <Terminy av={av} />
        {error && <p className="text-sm blood-text" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="btn-relic w-full disabled:opacity-60">
          {busy ? "Wysyłam…" : "Wyślij zgłoszenie"} {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
        <p className="text-xs text-foreground/55 leading-relaxed">Zgłoszenie nie zobowiązuje do zakupu. Po jego wysłaniu przejdziesz do płatności 799 zł, a po płatności wybierzesz termin.</p>
      </form>
    </>
  );
}
