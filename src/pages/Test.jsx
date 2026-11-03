import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Share2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import useSystemText from "@/content/useSystemText";
import ShopProductCard from "@/components/exmortis/shop/ShopProductCard";
import { track } from "@/lib/track";
import { FUNNEL } from "@/lib/funnelEvents";
import { SITE_URL } from "@/config/site";

const SHARE_URL = `${SITE_URL}/test?src=polecenie`;
const N = 15;

// Wersja 2: 15 stwierdzeń o ostatnich czterech tygodniach, po 5 na obszar, w kolejności M, D, Ż.
// Wynik (poziom w każdym obszarze, teksty, pytania) liczy serwer — strona i e-mail mówią to samo.
const QUESTIONS = [
  "Zmęczenie nie mija, nawet po odpoczynku albo wolnym weekendzie.",
  "Mam w życiu to, co „powinno” dawać sens — a sensu nie czuję.",
  "Wracam myślami do wydarzenia, po którym moje życie podzieliło się na „przed” i „po”.",
  "Działam na autopilocie: robię, co trzeba, ale bez obecności i bez zaangażowania.",
  "Nie wiem, w którą stronę idzie moje życie ani dokąd chcę dojść.",
  "Trudno mi powiedzieć, kim jestem bez roli, relacji albo miejsca, których już nie ma.",
  "Rzeczy, które kiedyś dawały mi energię albo radość, dziś są mi obojętne.",
  "Wartości i przekonania, które kiedyś mnie prowadziły, przestały mnie nieść.",
  "Otoczenie oczekuje, że to już za mną — a ja wciąż jestem w środku.",
  "Na myśl o kolejnym dniu obowiązków czuję ciężar, zanim cokolwiek się zacznie.",
  "Pytam siebie „po co to wszystko?” i nie znajduję odpowiedzi, która by mnie uspokoiła.",
  "Codzienne sprawy przypominają mi o tym, czego zabrakło, i odbierają siły na resztę dnia.",
  "Trudniej mi się skupić, podjąć decyzję albo zapamiętać to, co kiedyś przychodziło łatwo.",
  "Patrzę na świat z dystansem albo cynizmem, który nie jest do mnie podobny.",
  "Odkładam decyzje o przyszłości, bo dawny porządek się skończył, a nowego jeszcze nie ma.",
];

const SCALE = [
  { value: 0, label: "Wcale" },
  { value: 1, label: "Czasami" },
  { value: 2, label: "Często" },
  { value: 3, label: "Prawie cały czas" },
];

const STAGE_OPTIONS = [
  { stage: "Śmierć", text: "Czuję, że coś się we mnie skończyło, ale jeszcze nie umiem tego nazwać." },
  { stage: "Próg", text: "Wiem, co się skończyło. Stoję przed decyzją, którą odkładam." },
  { stage: "Powrót", text: "Decyzja zapadła. Buduję coś nowego, ale łatwo mi wrócić do starego." },
  { stage: "Inny", text: "Najtrudniejsze mam za sobą. Chcę utrzymać to, co się we mnie zmieniło." },
];

const NOT_DIAGNOSIS = "Ten test nie jest diagnozą i nie zastępuje rozmowy z lekarzem, psychologiem ani psychoterapeutą. To narzędzie do zatrzymania się i przyjrzenia sobie.";

function CrisisLine({ className = "" }) {
  const a = "gold-text hover:underline whitespace-nowrap";
  return (
    <p className={className}>
      Jeśli jesteś w kryzysie albo myślisz o odebraniu sobie życia, zadzwoń: <a href="tel:116123" className={a}>116 123</a> (bezpłatny
      telefon zaufania dla dorosłych), <a href="tel:800702222" className={a}>800 70 2222</a> (Centrum Wsparcia, całą dobę), a w sytuacji
      zagrożenia życia <a href="tel:112" className={a}>112</a>.
    </p>
  );
}

const inputCls =
  "w-full bg-transparent border hairline px-4 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors";
const back = "technical text-[9px] text-foreground/55 hover:text-foreground/60 mt-10 flex items-center gap-2 transition-colors";

// Kroki: 0 wstęp · 1–15 stwierdzenia · 16 etap · 17 zdanie · 18 liczenie (albo dawny formularz) · 19 wynik
// Przepływ „v3” (od 3.11.2026): wynik bez imienia i e-maila; wysyłka e-mailem opcjonalna, pod wynikiem.
// Dopóki funkcja serwera nie zna nowego przepływu (ping), działa dawny: forma zwracania się + formularz.
// Moduł testu; d.tytul i d.tekst (wstęp) pochodzą z edytora stron.
export default function Test({ d = {} }) {
  const t = useSystemText();
  const [step, setStep] = useState(0);
  const [formOfAddress, setFormOfAddress] = useState(null);
  const [answers, setAnswers] = useState(Array(N).fill(null));
  const [stage, setStage] = useState(null);
  const [openAnswer, setOpenAnswer] = useState("");
  const [lead, setLead] = useState({ first_name: "", email: "", consent: false, newsletter: false });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [products, setProducts] = useState(null);
  const [copied, setCopied] = useState(false);
  const [source, setSource] = useState("");
  const started = useRef(false);
  const clickedRec = useRef(new Set());
  const [flow, setFlow] = useState(null); // null = sprawdzam · "v3" · "legacy"
  const [resultKey, setResultKey] = useState(null);
  const completed = useRef(false);
  const [mail, setMail] = useState({ email: "", consent: false, newsletter: false, shareOpen: false, sending: false, done: null, error: "" });

  const S_STAGE = N + 1, S_OPEN = N + 2, S_FORM = N + 3, S_RESULT = N + 4;

  useEffect(() => {
    base44.functions.invoke("shopQuizSubmit", { action: "ping" })
      .then((r) => setFlow(r?.data?.flow === 3 ? "v3" : "legacy"))
      .catch(() => setFlow("legacy"));
    setSource(new URLSearchParams(window.location.search).get("src") || "");
    base44.functions
      .invoke("shopProducts", {})
      .then((r) => setProducts(r.data.products || []))
      .catch(() => setProducts([]));
  }, []);

  // Wynik na górze ekranu — na telefonie zostawał w połowie przewiniętej strony.
  useEffect(() => { if (step > 0) window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const answer = (value) => {
    if (!started.current) { started.current = true; track(FUNNEL.testStart); }
    const i = step - 1;
    const fresh = answers[i] === null;
    setAnswers((a) => { const n = [...a]; n[i] = value; return n; });
    // Pierwsza odpowiedź przechodzi dalej sama; poprawka po „Wstecz” — też, ale nigdy nie przeskakuje dwóch kroków.
    setTimeout(() => setStep((s) => (s === step ? Math.min(s + 1, S_STAGE) : s)), fresh ? 280 : 200);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await base44.functions.invoke("shopQuizSubmit", {
        first_name: lead.first_name,
        email: lead.email,
        form_of_address: formOfAddress,
        answers: answers.map((a) => Number(a)),
        stage,
        open_answer: openAnswer || null,
        newsletter_consent: lead.newsletter,
        source: source || null,
      });
      track("Lead", { content_name: "test" });
      setResult(res.data);
      // Bez wyniku testu w analityce: kategoria opisuje stan osoby — zostaje tylko w bazie (panel).
      track(FUNNEL.testComplete);
      setStep(S_RESULT);
    } catch (e2) {
      setError(e2?.response?.status === 429 ? e2.response.data.error : "Nie udało się zapisać wyniku. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  // v3: wynik bez danych kontaktowych. Zmiana odpowiedzi po wyniku nadpisuje ten sam anonimowy zapis.
  const compute = async () => {
    setError("");
    setSending(true);
    setStep(S_FORM);
    try {
      const res = await base44.functions.invoke("shopQuizSubmit", {
        action: "wynik", answers: answers.map((a) => Number(a)), stage, source: source || null, result_key: resultKey,
      });
      setResult(res.data);
      if (res.data?.result_key) {
        if (res.data.result_key !== resultKey) setMail((m) => ({ ...m, done: null, error: "" }));
        setResultKey(res.data.result_key);
      }
      // Bez wyniku, odpowiedzi i zdania w analityce — tylko fakt ukończenia (raz).
      if (!completed.current) { completed.current = true; track(FUNNEL.testComplete); }
      setStep(S_RESULT);
    } catch (e2) {
      setError(e2?.response?.data?.error || "Nie udało się policzyć wyniku. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  // v3: opcjonalna wysyłka wyniku — sukces dopiero po potwierdzeniu serwera; przy błędzie dane zostają.
  const sendResult = async (e) => {
    e.preventDefault();
    if (mail.sending) return;
    if (!mail.consent) { setMail((m) => ({ ...m, error: "Zaznacz zgodę na wysłanie wyniku." })); return; }
    setMail((m) => ({ ...m, sending: true, error: "" }));
    try {
      const res = await base44.functions.invoke("shopQuizSubmit", {
        action: "wyslij", result_key: resultKey, email: mail.email.trim(), consent: true,
        newsletter_consent: mail.newsletter, share_open: mail.shareOpen && !!openAnswer.trim(),
        open_answer: mail.shareOpen && openAnswer.trim() ? openAnswer.trim() : null,
      });
      track("Lead", { content_name: "test" });
      setMail((m) => ({ ...m, sending: false, done: res.data?.delivery || "wyslany" }));
    } catch (e2) {
      setMail((m) => ({ ...m, sending: false, error: e2?.response?.data?.error || "Nie udało się wysłać. Spróbuj ponownie." }));
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Skopiuj link do testu:", SHARE_URL);
    }
  };

  const qText = step >= 1 && step <= N ? QUESTIONS[step - 1] : null;
  const progress = Math.min(step, S_FORM) / S_FORM;
  const matched =
    result && products
      ? (result.recommended || []).map((r) => products.find((p) => p.slug === r.slug)).filter(Boolean)
          // Bardzo wysoki wynik: bez programu POWRÓT (pierwszeństwo ma rozmowa ze specjalistą).
          .filter((p) => !(result.deep && p.slug === "powrot-mentoring"))
      : [];

  return (
    <div className="min-h-screen bg-[#0A0A0B] pt-28 md:pt-32 pb-24 px-5">
      <div className="mx-auto max-w-3xl">
        <p className="technical text-[9px] gold-text mb-10 text-center">
          TEST · KTÓRA ŚMIERĆ JEST TWOJA?
        </p>

        {step > 0 && step < S_RESULT && (
          <div className="h-px bg-[#3D3D3F] mb-12">
            <div className="h-px bg-[#C9A24A] transition-all duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        {/* ===== 0 · WSTĘP ===== */}
        {step === 0 && (
          <div className="fade-up text-center">
            <h1 className="shop-heading text-4xl md:text-6xl text-[#F5EFE1] leading-tight mb-8">
              {d.tytul || "Która śmierć jest Twoja?"}
            </h1>
            {d.tekst ? (
              <div className="rich-content text-foreground/60 text-lg leading-relaxed max-w-xl mx-auto mb-10" dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.tekst) }} />
            ) : (
              <div className="text-foreground/60 text-lg leading-relaxed max-w-xl mx-auto mb-10 space-y-4">
                <p>
                  15 stwierdzeń o ostatnich czterech tygodniach, potem wybór etapu drogi i — jeśli zechcesz —
                  jedno zdanie refleksji. Kilka minut.
                </p>
                <p>Odpowiadaj pierwszą myślą.</p>
              </div>
            )}
            {flow === "v3" && <p className="text-foreground/75 max-w-xl mx-auto mb-6">Wynik zobaczysz od razu — bez podawania imienia i adresu e-mail.</p>}
            <p className="text-xs text-foreground/55 leading-relaxed max-w-xl mx-auto mb-14">{NOT_DIAGNOSIS}</p>
            {flow === "legacy" ? (
              <>
                <p className="shop-heading text-xl text-[#F5EFE1] mb-8">Jak mam się do Ciebie zwracać?</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button onClick={() => { setFormOfAddress("Mężczyzna"); setStep(1); }} className="btn-ghost">
                    JAK DO MĘŻCZYZNY
                  </button>
                  <button onClick={() => { setFormOfAddress("Kobieta"); setStep(1); }} className="btn-ghost">
                    JAK DO KOBIETY
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => setStep(1)} disabled={!flow} className="btn-relic disabled:opacity-60">
                {flow ? "ZACZNIJ TEST" : "CHWILĘ…"}
              </button>
            )}
          </div>
        )}

        {/* ===== 1–15 · STWIERDZENIA ===== */}
        {qText && (
          <div key={step} className="fade-up">
            <p className="technical text-[9px] text-foreground/55 mb-3">
              {String(step).padStart(2, "0")} Z {N}
            </p>
            <p className="text-sm text-foreground/55 mb-6">W ciągu ostatnich czterech tygodni…</p>
            <h2 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1] leading-snug mb-12 break-words">{qText}</h2>

            <div className="space-y-3" role="radiogroup" aria-label={qText}>
              {SCALE.map((s) => (
                <button
                  key={s.value}
                  role="radio"
                  aria-checked={answers[step - 1] === s.value}
                  onClick={() => answer(s.value)}
                  className={`w-full text-left px-5 py-5 md:py-4 border transition-all duration-200 flex items-center justify-between ${
                    answers[step - 1] === s.value
                      ? "border-[#C9A24A] bg-[#C9A24A]/10 text-[#F5EFE1]"
                      : "hairline text-foreground/60 hover:border-[#C9A24A]/50 hover:text-[#F5EFE1]"
                  }`}
                >
                  <span className="text-base">{s.label}</span>
                  <span className="technical text-[9px] text-foreground/55">{s.value}</span>
                </button>
              ))}
            </div>

            <button onClick={() => setStep(step - 1)} className={back}>
              <ArrowLeft className="h-3 w-3" /> WSTECZ
            </button>
          </div>
        )}

        {/* ===== ETAP ===== */}
        {step === S_STAGE && (
          <div className="fade-up">
            <h2 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1] leading-snug mb-4">
              Jeszcze jedno. Który opis jest Ci dziś najbliższy?
            </h2>
            <p className="text-sm text-foreground/55 mb-10">Droga ma cztery etapy: Śmierć, Próg, Powrót, Inny. Wybierz ten, w którym jest więcej prawdy niż nadziei.</p>
            <div className="space-y-3">
              {STAGE_OPTIONS.map((o) => (
                <button
                  key={o.stage}
                  onClick={() => { setStage(o.stage); setStep(S_OPEN); }}
                  className={`w-full text-left px-5 py-5 border transition-all duration-200 ${
                    stage === o.stage
                      ? "border-[#C9A24A] bg-[#C9A24A]/10 text-[#F5EFE1]"
                      : "hairline text-foreground/60 hover:border-[#C9A24A]/50 hover:text-[#F5EFE1]"
                  }`}
                >
                  <span className="text-base leading-relaxed">{o.text}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(N)} className={back}>
              <ArrowLeft className="h-3 w-3" /> WSTECZ
            </button>
          </div>
        )}

        {/* ===== JEDNO ZDANIE ===== */}
        {step === S_OPEN && (
          <div className="fade-up">
            <h2 className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] leading-snug mb-6">
              Jeśli chcesz — dokończ jednym zdaniem:
            </h2>
            <p className="italic text-foreground/55 text-lg mb-6">«Ostatnio umarło we mnie…»</p>
            <textarea value={openAnswer} onChange={(e) => setOpenAnswer(e.target.value)} rows={4} maxLength={2000} className={inputCls} placeholder="…" />
            {flow === "v3" ? (
              <p className="text-xs text-foreground/55 mt-3">To zdanie zostaje w Twojej przeglądarce i nie jest zapisywane. Wyślesz je tylko wtedy, gdy pod wynikiem zdecydujesz się przesłać je razem z wynikiem.</p>
            ) : (
              <p className="text-xs text-foreground/55 mt-3">Przeczytam to tylko ja. Nie musisz pisać nic, czego nie chcesz.</p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <button onClick={() => (flow === "v3" ? compute() : setStep(S_FORM))} className="btn-relic">{flow === "v3" ? "POKAŻ MÓJ WYNIK" : "DALEJ"}</button>
              <button onClick={() => { setOpenAnswer(""); if (flow === "v3") compute(); else setStep(S_FORM); }} className="btn-ghost">POMIŃ</button>
            </div>
            <button onClick={() => setStep(S_STAGE)} className={back}>
              <ArrowLeft className="h-3 w-3" /> WSTECZ
            </button>
          </div>
        )}

        {/* ===== LICZENIE WYNIKU (v3) ===== */}
        {step === S_FORM && flow === "v3" && (
          <div className="fade-up text-center space-y-6" role="status" aria-live="polite">
            {sending && <p className="shop-heading text-2xl text-[#F5EFE1]">Liczę Twój wynik…</p>}
            {!sending && error && (
              <>
                <p className="text-sm blood-text" role="alert">{error}</p>
                <button onClick={compute} className="btn-relic">SPRÓBUJ PONOWNIE</button>
                <button type="button" onClick={() => setStep(S_OPEN)} className={`${back} mx-auto`}>
                  <ArrowLeft className="h-3 w-3" /> WSTECZ
                </button>
              </>
            )}
          </div>
        )}

        {/* ===== GDZIE WYSŁAĆ WYNIK (dawny przepływ) ===== */}
        {step === S_FORM && flow !== "v3" && (
          <form onSubmit={submit} className="fade-up space-y-6">
            <h2 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] break-words">
              Twój wynik jest gotowy. Gdzie mam go wysłać?
            </h2>
            <div>
              <label className="technical text-[10px] text-foreground/55 block mb-3">IMIĘ</label>
              <input required maxLength={200} value={lead.first_name} onChange={(e) => setLead({ ...lead, first_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="technical text-[10px] text-foreground/55 block mb-3">E-MAIL</label>
              <input required type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} className={inputCls} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" required checked={lead.consent} onChange={(e) => setLead({ ...lead, consent: e.target.checked })} className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/55 leading-relaxed">Zgadzam się na przetwarzanie danych w celu przesłania wyniku.</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={lead.newsletter} onChange={(e) => setLead({ ...lead, newsletter: e.target.checked })} className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/55 leading-relaxed">Chcę też dostawać „Listy powrotu” — jeden list w każdy poniedziałek.</span>
            </label>
            {error && <p className="text-sm blood-text" role="alert">{error}</p>}
            <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
              {sending ? "ZAPISUJĘ..." : "POKAŻ MÓJ WYNIK"}
            </button>
            <p className="text-xs text-foreground/55 text-center">Nie wysyłam spamu. Wypiszesz się jednym kliknięciem.</p>
            <button type="button" onClick={() => setStep(S_OPEN)} className={back}>
              <ArrowLeft className="h-3 w-3" /> WSTECZ
            </button>
          </form>
        )}

        {/* ===== WYNIK ===== */}
        {step === S_RESULT && result && (
          <div className="fade-up">
            <p className="technical text-[10px] gold-text mb-8">{flow === "v3" ? "TWÓJ WYNIK" : t("dz.test")}</p>

            <h2 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] leading-tight mb-8 break-words">
              {result.headline || "Twój wynik"}
            </h2>
            {result.body && <p className="text-foreground/75 text-lg leading-relaxed mb-14">{result.body}</p>}

            {Array.isArray(result.dims) && (
              <section className="mb-14">
                <p className="technical text-[9px] text-foreground/55 mb-6">TRZY OBSZARY · NA ILE KAŻDA ŚMIERĆ JEST DZIŚ OBECNA</p>
                <div className="space-y-8">
                  {result.dims.map((s) => (
                    <div key={s.key}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
                        <p className="technical text-[10px] text-[#F5EFE1]">{s.label.toUpperCase()}</p>
                        <p className="technical text-[9px] gold-text">{s.level_label.toUpperCase()} · {s.score}/{s.max}</p>
                      </div>
                      <div className="h-1 bg-[#1F1F21]" role="img" aria-label={`${s.label}: ${s.score} z ${s.max}, ${s.level_label}`}>
                        <div className="h-1 bg-[#C9A24A] transition-all duration-700" style={{ width: `${(s.score / s.max) * 100}%` }} />
                      </div>
                      <p className="text-foreground/60 leading-relaxed mt-3">{s.text}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-foreground/55 mt-6">Skala w każdym obszarze: 0–3 brak wyraźnych oznak · 4–7 pierwsze sygnały · 8–11 wyraźnie obecna · 12–15 głęboko obecna.</p>
              </section>
            )}

            {result.deep && (
              <div className="border border-[#5C1A1B] bg-[#140B0B] p-6 md:p-8 mb-14 space-y-3" role="note">
                <p className="technical text-[9px] text-[#E8C547]">WAŻNE</p>
                <p className="text-foreground/80 leading-relaxed">
                  Przynajmniej w jednym obszarze Twoje odpowiedzi są bardzo wysokie. To dużo do niesienia. Dobrze jest
                  porozmawiać o tym z kimś zaufanym i ze specjalistą — lekarzem, psychologiem albo psychoterapeutą.
                </p>
                <CrisisLine className="text-foreground/70 leading-relaxed" />
              </div>
            )}

            {Array.isArray(result.questions) && (
              <div className="border hairline p-8 md:p-10 mb-14">
                <p className="technical text-[9px] text-foreground/55 mb-6">PYTANIA DO ZABRANIA ZE SOBĄ</p>
                <ul className="space-y-4">
                  {result.questions.map((q) => (
                    <li key={q} className="shop-heading text-xl md:text-2xl text-[#F5EFE1] leading-snug">{q}</li>
                  ))}
                </ul>
                <p className="text-sm text-foreground/55 mt-6">Nie odpowiadaj od razu. Zapisz je i wróć do nich za kilka dni.</p>
              </div>
            )}

            <div className="border border-[#5C1A1B]/50 bg-[#0D0D0E] p-8 md:p-10 mb-16">
              <p className="technical text-[9px] text-foreground/55 mb-3">TWÓJ ETAP</p>
              <p className="shop-heading text-2xl text-[#C9A24A] mb-4">{stage}</p>
              <p className="text-foreground/60 leading-relaxed">{result.stage_text}</p>
            </div>

            <h3 className="shop-heading text-2xl text-[#F5EFE1] mb-3">Twój następny krok</h3>
            {matched[0] && <p className="text-foreground/60 mb-8">Na początek: <span className="text-[#F5EFE1]">{matched[0].name}</span>. Poniżej także inne możliwości.</p>}
            {products === null ? (
              <div className="grid sm:grid-cols-3 gap-4 mb-16">
                {[...Array(3)].map((_, i) => <div key={i} className="aspect-[3/4] bg-[#0D0D0E] border hairline animate-pulse" />)}
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-4 mb-16">
                {matched.map((p) => (
                  // Kliknięcie poleconego materiału: tylko slug produktu, raz na produkt.
                  <div key={p.id} className="contents" onClickCapture={() => {
                    if (clickedRec.current.has(p.slug)) return;
                    clickedRec.current.add(p.slug);
                    track(FUNNEL.testResultCta, { cel: p.slug });
                  }}>
                    <ShopProductCard product={p} />
                  </div>
                ))}
              </div>
            )}

            {!result.deep && (
              <div className="border border-[#5C1A1B]/50 bg-[#0D0D0E] p-8 md:p-12 text-center space-y-6 mb-10">
                <p className="text-foreground/70 text-lg leading-relaxed">
                  Jeśli czujesz, że to Twój moment — porozmawiajmy. Trzydzieści minut, bezpłatnie, bez zobowiązań.
                </p>
                <Link to="/powrot" onClick={() => track(FUNNEL.testResultCta, { cel: "powrot" })} className="btn-relic">
                  UMÓW ROZMOWĘ KWALIFIKACYJNĄ
                </Link>
              </div>
            )}

            {flow === "v3" && (
              <section className="border hairline bg-[#0D0D0E] p-6 md:p-8 mb-10" aria-labelledby="test-mail-h">
                <p className="technical text-[10px] gold-text mb-3">OPCJONALNIE</p>
                <h3 id="test-mail-h" className="shop-heading text-2xl text-[#F5EFE1] mb-3">Chcesz mieć ten wynik u siebie?</h3>
                {mail.done ? (
                  <p className="text-foreground/75 leading-relaxed" role="status">
                    {mail.done === "kolejka"
                      ? "Wynik jest w drodze — mail wyjdzie w ciągu najbliższych godzin. Sprawdź też folder Spam lub Oferty."
                      : "Wysłałem wynik na podany adres. Jeśli nie widzisz wiadomości, sprawdź folder Spam lub Oferty."}
                  </p>
                ) : (
                  <form onSubmit={sendResult} className="space-y-5" noValidate>
                    <p className="text-sm text-foreground/60">Mogę wysłać Ci wynik e-mailem. Nie musisz tego robić — wynik masz powyżej.</p>
                    <div>
                      <label htmlFor="test-mail" className="technical text-[10px] text-foreground/55 block mb-3">E-MAIL</label>
                      <input id="test-mail" type="email" autoComplete="email" value={mail.email}
                        onChange={(e) => setMail({ ...mail, email: e.target.value, error: "" })} className={inputCls} />
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={mail.consent} onChange={(e) => setMail({ ...mail, consent: e.target.checked, error: "" })} className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/60 leading-relaxed">Zgadzam się na przetwarzanie adresu e-mail w celu wysłania wyniku.</span>
                    </label>
                    {openAnswer.trim() && (
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={mail.shareOpen} onChange={(e) => setMail({ ...mail, shareOpen: e.target.checked })} className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground/60 leading-relaxed">Prześlij też moje zdanie „Ostatnio umarło we mnie…” — przeczytam je tylko ja.</span>
                      </label>
                    )}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={mail.newsletter} onChange={(e) => setMail({ ...mail, newsletter: e.target.checked })} className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/60 leading-relaxed">Chcę też dostawać „Listy powrotu” — jeden list w każdy poniedziałek.</span>
                    </label>
                    {mail.error && <p className="text-sm blood-text" role="alert">{mail.error}</p>}
                    <button type="submit" disabled={mail.sending || !mail.email.trim()} className="btn-ghost w-full disabled:opacity-60">
                      {mail.sending ? "WYSYŁAM..." : "WYŚLIJ WYNIK NA MÓJ E-MAIL"}
                    </button>
                  </form>
                )}
              </section>
            )}

            <div className="text-xs text-foreground/55 text-center leading-relaxed mb-10 space-y-2 max-w-xl mx-auto">
              <p>{NOT_DIAGNOSIS}</p>
              {flow === "v3" && (
                <p>Co zapisuję: same punkty, poziomy i wybrany etap — bez imienia, adresu e-mail i Twojego zdania (anonimowa statystyka testu). Adres i zdanie trafiają do mnie tylko wtedy, gdy zdecydujesz się wysłać wynik.</p>
              )}
              <CrisisLine />
              {result.email_sent === false && <p className="text-foreground/55">Wyniku nie udało się teraz wysłać e-mailem — zapisz go albo zrób zrzut ekranu.</p>}
            </div>

            {flow === "v3" && (
              <div className="text-center mb-8">
                <button type="button" onClick={() => setStep(1)} className="technical text-[10px] text-foreground/60 hover:gold-text underline underline-offset-4 min-h-11">
                  ZMIEŃ ODPOWIEDZI
                </button>
              </div>
            )}

            <div className="text-center">
              <button onClick={share} className="btn-ghost !px-5 !py-3 text-[10px]">
                {copied ? (
                  <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> SKOPIOWANO LINK</span>
                ) : (
                  <span className="flex items-center gap-2"><Share2 className="h-3.5 w-3.5" /> WYŚLIJ TEST KOMUŚ BLISKIEMU</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}