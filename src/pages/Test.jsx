import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Share2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { scoreV2, DOMINANT, STAGE_TEXT } from "@/lib/quizScore";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import ShopProductCard from "@/components/exmortis/shop/ShopProductCard";
import { setTrackingQuiet } from "@/lib/track";
import { SITE_URL } from "@/config/site";
import { nextSteps, OFFER } from "@/lib/testNextSteps";

const SHARE_URL = `${SITE_URL}/test`;
const N = 15;

// Wersja 2: 15 stwierdzeń o ostatnich czterech tygodniach, po 5 na obszar, w kolejności M, D, Ż.
// Wynik liczy wyłącznie ta strona w przeglądarce (src/lib/quizScore.js) — nic nie trafia na serwer.
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

const NOT_DIAGNOSIS = "Test służy autorefleksji. Nie jest narzędziem diagnostycznym ani oceną stanu zdrowia i nie zastępuje konsultacji ze specjalistą.";
const LOCAL_ONLY = "Odpowiedzi i wynik są przetwarzane wyłącznie w pamięci tej strony w Twojej przeglądarce. Nie wysyłamy ich na serwer ani e-mailem. Po odświeżeniu lub zamknięciu strony znikną.";

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

const back = "technical text-[9px] text-foreground/55 hover:text-foreground/60 mt-10 flex items-center gap-2 transition-colors";

// Kroki: 0 wstęp · 1–15 stwierdzenia · 16 etap · 17 wynik.
// Od 4.11.2026 test działa WYŁĄCZNIE w przeglądarce: odpowiedzi, punkty, wynik i etap są tylko w stanie
// tego komponentu (bez localStorage/sessionStorage/cookies/adresu URL), bez wywołań serwera, bez wysyłki
// e-mailem i bez zdarzeń analitycznych. Odświeżenie strony lub „Zacznij od nowa” czyści wszystko.
// Jedyne zapytanie strony to publiczna lista produktów (bez parametrów) do sekcji „następny krok”.
// Moduł testu; d.tytul i d.tekst (wstęp) pochodzą z edytora stron.
export default function Test({ d = {} }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(Array(N).fill(null));
  const [stage, setStage] = useState(null);
  const [products, setProducts] = useState(null);
  const [copied, setCopied] = useState(false);

  const S_STAGE = N + 1, S_RESULT = N + 2;

  useEffect(() => {
    base44.functions
      .invoke("shopProducts", {})
      .then((r) => setProducts(r.data.products || []))
      .catch(() => setProducts([]));
  }, []);

  // Na czas testu: żadnej analityki ani pikseli, także po zgodzie w banerze cookies.
  useEffect(() => { setTrackingQuiet(true); return () => setTrackingQuiet(false); }, []);

  // Wynik na górze ekranu — na telefonie zostawał w połowie przewiniętej strony.
  useEffect(() => { if (step > 0) window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const answer = (value) => {
    const i = step - 1;
    const fresh = answers[i] === null;
    setAnswers((a) => { const n = [...a]; n[i] = value; return n; });
    // Pierwsza odpowiedź przechodzi dalej sama; poprawka po „Wstecz” — też, ale nigdy nie przeskakuje dwóch kroków.
    setTimeout(() => setStep((s) => (s === step ? Math.min(s + 1, S_STAGE) : s)), fresh ? 280 : 200);
  };

  // Wynik liczony na bieżąco z odpowiedzi w pamięci strony — zmiana odpowiedzi od razu go przelicza.
  const complete = answers.every((a) => a !== null) && !!stage;
  const result = useMemo(() => {
    if (!complete) return null;
    const r = scoreV2(answers);
    const t = DOMINANT[r.dominant] || DOMINANT.Mieszana;
    return { ...r, headline: t.head(""), body: t.body, questions: t.questions, stage_text: STAGE_TEXT[stage] };
  }, [complete, answers, stage]);

  const restart = () => {
    setAnswers(Array(N).fill(null));
    setStage(null);
    setStep(0);
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
  const progress = Math.min(step, S_STAGE) / S_STAGE;
  // Następne kroki (decyzja 4.11.2026): Listy powrotu → Skarbiec → bezpłatne → Spotkania → oferta, gdy wynika z testu.
  // Linki prowadzą do zwykłych stron (bez wyniku i bez identyfikatora w adresie).
  const next = result && products ? nextSteps(products, { ...result, stage }) : null;

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
                  Dwa kroki: 15 stwierdzeń o ostatnich czterech tygodniach, potem wybór etapu drogi. Kilka minut.
                </p>
                <p>Odpowiadaj pierwszą myślą.</p>
              </div>
            )}
            <p className="text-foreground/75 max-w-xl mx-auto mb-6">Wynik zobaczysz od razu — bez konta, imienia i adresu e-mail.</p>
            <p className="text-sm text-foreground/65 leading-relaxed max-w-xl mx-auto mb-4">{LOCAL_ONLY}</p>
            <p className="text-xs text-foreground/55 leading-relaxed max-w-xl mx-auto mb-14">{NOT_DIAGNOSIS}</p>
            <button onClick={() => setStep(1)} className="btn-relic">ZACZNIJ TEST</button>
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
                  className={`w-full text-left px-5 py-5 md:py-4 border transition-all duration-200 flex items-center ${
                    answers[step - 1] === s.value
                      ? "border-[#C9A24A] bg-[#C9A24A]/10 text-[#F5EFE1]"
                      : "hairline text-foreground/60 hover:border-[#C9A24A]/50 hover:text-[#F5EFE1]"
                  }`}
                >
                  <span className="text-base">{s.label}</span>
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
                  onClick={() => { setStage(o.stage); setStep(S_RESULT); }}
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

        {/* ===== WYNIK ===== */}
        {step === S_RESULT && result && (
          <div className="fade-up">
            <p className="technical text-[10px] gold-text mb-3">TWÓJ WYNIK</p>
            <p className="text-sm text-foreground/55 mb-8">Podsumowanie tego, co zaznaczasz — zaproszenie do refleksji, nie ocena.</p>

            <h2 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] leading-tight mb-8 break-words">
              {result.headline || "Twój wynik"}
            </h2>
            {result.body && <p className="text-foreground/75 text-lg leading-relaxed mb-14">{result.body}</p>}

            {Array.isArray(result.dims) && (
              <section className="mb-14">
                <p className="technical text-[9px] text-foreground/55 mb-6">TRZY OBSZARY · CO POKAZUJĄ ZAZNACZONE ODPOWIEDZI</p>
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

            <section className="mb-16" aria-labelledby="test-next-h">
              <h3 id="test-next-h" className="shop-heading text-2xl text-[#F5EFE1] mb-3">Twój następny krok</h3>
              {next === null ? (
                <div className="aspect-[3/1] bg-[#0D0D0E] border hairline animate-pulse" />
              ) : (
                <>
                  {next.main && (
                    <>
                      <p className="text-foreground/60 mb-8">
                        Na początek zapisz się na <span className="text-[#F5EFE1]">{next.main.name}</span> — jeden list w każdy poniedziałek.
                      </p>
                      <div className="grid sm:grid-cols-3 gap-4 mb-14">
                        <ShopProductCard product={next.main} />
                      </div>
                    </>
                  )}

                  <p className="technical text-[9px] text-foreground/55 mb-4">INNE MOŻLIWOŚCI</p>
                  <Link to="/skarbiec" className="flex items-center justify-between gap-4 border hairline px-5 py-5 mb-10 min-h-11 text-[#F5EFE1] hover:border-[#C9A24A]/60 transition-colors">
                    <span><span className="shop-heading text-xl block">Zajrzyj do Skarbca</span><span className="text-sm text-foreground/60">Materiały na każdy etap drogi — bezpłatne i płatne.</span></span>
                    <ArrowRight className="h-4 w-4 shrink-0 gold-text" />
                  </Link>

                  {next.free.length > 0 && (
                    <>
                      <p className="technical text-[9px] text-foreground/55 mb-4">BEZPŁATNIE</p>
                      <div className="grid sm:grid-cols-3 gap-4 mb-10">
                        {next.free.map((p) => <ShopProductCard key={p.id || p.slug} product={p} />)}
                      </div>
                    </>
                  )}

                  <Link to="/spotkania" className="flex items-center justify-between gap-4 border hairline px-5 py-5 mb-10 min-h-11 text-[#F5EFE1] hover:border-[#C9A24A]/60 transition-colors">
                    <span><span className="shop-heading text-xl block">Spotkania</span><span className="text-sm text-foreground/60">Otwarte spotkania online i na żywo.</span></span>
                    <ArrowRight className="h-4 w-4 shrink-0 gold-text" />
                  </Link>

                  {next.offer && (
                    <div className="border border-[#5C1A1B]/50 bg-[#0D0D0E] p-6 md:p-8">
                      <p className="technical text-[9px] text-foreground/55 mb-3">JEŚLI CHCESZ PRACOWAĆ ZE MNĄ</p>
                      <p className="text-foreground/70 leading-relaxed mb-6">
                        {next.offer.slug === OFFER.powrot
                          ? "Jeśli czujesz, że to Twój moment, zacznij od bezpłatnej rozmowy kwalifikacyjnej. Trzydzieści minut, bez zobowiązań."
                          : "Pojedyncza rozmowa 1:1 — 90 minut online."}
                      </p>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <ShopProductCard product={next.offer} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            <div className="text-xs text-foreground/55 text-center leading-relaxed mb-10 space-y-2 max-w-xl mx-auto">
              <p>{NOT_DIAGNOSIS}</p>
              <p>{LOCAL_ONLY}</p>
              <p>
                Nie zapisuję odpowiedzi ani wyniku i nie wysyłam ich e-mailem. Podczas testu nie działają narzędzia
                analityczne ani reklamowe. Jak przy każdej stronie, serwer hostingu może zapisać techniczny log wejścia
                (np. adres IP i czas) — bez odpowiedzi i wyniku.
              </p>
              <CrisisLine />
            </div>

            <div className="text-center mb-8">
                <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
                  <button type="button" onClick={() => setStep(1)} className="technical text-[10px] text-foreground/60 hover:gold-text underline underline-offset-4 min-h-11">
                    ZMIEŃ ODPOWIEDZI
                  </button>
                  <button type="button" onClick={restart} className="technical text-[10px] text-foreground/60 hover:gold-text underline underline-offset-4 min-h-11">
                    ZACZNIJ OD NOWA
                  </button>
                </div>
            </div>

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