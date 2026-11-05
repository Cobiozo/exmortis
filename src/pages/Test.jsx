import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Share2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { QUESTIONS, SCALE, STAGES, RESULTS, DIM_LABEL, scoreTest } from "@/lib/quizScore";
import ShopProductCard from "@/components/exmortis/shop/ShopProductCard";
import { setTrackingQuiet } from "@/lib/track";
import { SITE_URL } from "@/config/site";
import { nextSteps } from "@/lib/testNextSteps";
import { countCompletion } from "@/lib/testCount";

const SHARE_URL = `${SITE_URL}/test`;
const N = QUESTIONS.length;
const LOCAL_ONLY = "Odpowiedzi są przetwarzane wyłącznie w pamięci tej strony w Twojej przeglądarce. Nie wysyłamy ich na serwer ani e-mailem. Po odświeżeniu lub zamknięciu strony znikną. Do statystyki liczymy tylko, ile razy test został ukończony i z jakim wynikiem — anonimowo, bez odpowiedzi i bez danych, które pozwalałyby Cię rozpoznać.";

function HelpInfo({ className = "" }) {
  const a = "gold-text hover:underline whitespace-nowrap";
  return (
    <div className={className}>
      <p>
        Trzy śmierci są autorskimi metaforami doświadczeń życiowych, nie kategoriami medycznymi. Test nie jest narzędziem
        diagnostycznym ani formą terapii. Jeśli potrzebujesz pomocy psychologicznej lub medycznej, zwróć się do odpowiedniego specjalisty.
      </p>
      <p className="mt-2">
        W kryzysie możesz skorzystać z bezpłatnych numerów <a href="tel:116123" className={a}>116 123</a> i{" "}
        <a href="tel:800702222" className={a}>800 70 2222</a>; w bezpośrednim zagrożeniu życia zadzwoń pod <a href="tel:112" className={a}>112</a>.
      </p>
    </div>
  );
}

const back = "technical text-[10px] text-[#F5EFE1]/70 hover:text-[#F5EFE1] mt-10 min-h-[44px] flex items-center gap-2 transition-colors";
const choice = (on) => `w-full text-left px-5 py-4 min-h-[56px] border transition-colors duration-200 flex items-center ${
  on ? "border-[#C9A24A] bg-[#C9A24A]/10 text-[#F5EFE1]" : "hairline text-[#F5EFE1]/80 hover:border-[#C9A24A]/50 hover:text-[#F5EFE1]"}`;

// Test „Która śmierć jest Twoja?” — wersja 3.1 (5.11.2026).
// Kroki: 0 otwarcie · 1–15 stwierdzenia · 16 etap · 17 wynik. Działa WYŁĄCZNIE w przeglądarce: stan tylko w tym
// komponencie (bez localStorage, adresu URL, serwera, e-maila i analityki). Odświeżenie lub „Zacznij od nowa” czyści.
// Zapytania strony: publiczna lista produktów (bez parametrów) do linków „dalej” oraz — po wyniku —
// anonimowy licznik ukończeń (sama nazwa wyniku, raz na wczytanie strony; src/lib/testCount.js, decyzja 5.11.2026).
export default function Test() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(Array(N).fill(null));
  const [stage, setStage] = useState(null);
  const [products, setProducts] = useState(null);
  const [copied, setCopied] = useState(false);
  const S_STAGE = N + 1, S_RESULT = N + 2;

  useEffect(() => {
    base44.functions.invoke("shopProducts", {}).then((r) => setProducts(r.data.products || [])).catch(() => setProducts([]));
  }, []);
  useEffect(() => { setTrackingQuiet(true); return () => setTrackingQuiet(false); }, []);
  useEffect(() => { if (step > 0) window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const answer = (value) => {
    const i = step - 1;
    const fresh = answers[i] === null;
    setAnswers((a) => { const n = [...a]; n[i] = value; return n; });
    setTimeout(() => setStep((s) => (s === step ? Math.min(s + 1, S_STAGE) : s)), fresh ? 280 : 200);
  };

  const complete = answers.every((a) => a !== null) && !!stage;
  const result = useMemo(() => (complete ? scoreTest(answers) : null), [complete, answers]);
  const r = result ? RESULTS[result.key] : null;
  useEffect(() => { if (step === S_RESULT && result) countCompletion(result.key); }, [step, result]);
  const st = STAGES.find((s) => s.key === stage);
  // Następne kroki jednakowe dla wszystkich wyników — bez oferty zależnej od punktów (decyzja 5.11.2026).
  const next = products ? nextSteps(products, { dims: [], stage: null, dominant: null, deep: true }) : null;

  const restart = () => { setAnswers(Array(N).fill(null)); setStage(null); setStep(0); };
  const share = async () => {
    try { await navigator.clipboard.writeText(SHARE_URL); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt("Skopiuj link do testu:", SHARE_URL); }
  };

  const q = step >= 1 && step <= N ? QUESTIONS[step - 1] : null;
  const progress = Math.min(step, S_STAGE) / S_STAGE;

  return (
    <div className="min-h-screen bg-[#0A0A0B] pt-24 md:pt-32 pb-24 px-5">
      <div className="mx-auto max-w-3xl">
        <p className="technical text-[10px] gold-text mb-8 md:mb-10 text-center">EXMORTIS · KTÓRA ŚMIERĆ JEST TWOJA?</p>

        {step > 0 && step < S_RESULT && (
          <div className="h-px bg-[#3D3D3F] mb-10 md:mb-12" aria-hidden="true">
            <div className="h-px bg-[#C9A24A] transition-all duration-500 motion-reduce:transition-none" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        {/* ===== OTWARCIE ===== */}
        {step === 0 && (
          <div className="fade-up">
            <h1 className="shop-heading text-4xl md:text-6xl text-[#F5EFE1] leading-tight mb-4 text-center">Która śmierć jest Twoja?</h1>
            <p className="shop-heading italic text-xl text-[#F5EFE1]/80 text-center mb-10">Piętnaście zdań. Trzy śmierci. Jedna historia — Twoja.</p>
            <div className="text-[#F5EFE1]/80 text-lg leading-relaxed max-w-xl mx-auto space-y-4">
              <p>Są rzeczy, które kończą się bez pożegnania.</p>
              <p>Nie słychać trzasku drzwi. Nikt nie ogłasza końca. Świat się nie zatrzymuje.</p>
              <p>Nadal odbierasz telefony. Idziesz do pracy. Wracasz do domu. Odpowiadasz, że wszystko w porządku.</p>
              <p>Tylko Ty wiesz, ile z dawnego życia zostało w Tobie.</p>
              <p>Może życie dla innych zajęło miejsce życia dla siebie.</p>
              <p>Może to, co przez lata nadawało Twojemu życiu kierunek, przestało prowadzić.</p>
              <p>A może wydarzyło się coś, co zabrało Ci nie tylko człowieka, miejsce lub przyszłość, która miała nadejść — ale także część dawnego świata.</p>
              <p>W EXMORTIS nazywam te doświadczenia trzema śmierciami. <strong className="text-[#F5EFE1] font-semibold">Mentalną. Duchową. Życiową.</strong></p>
              <p>Nie są chorobami. Nie są wyrokami. Są nazwami, które nadaję różnym ludzkim doświadczeniom.</p>
              <p>Przeczytasz piętnaście zdań. Nie szukaj właściwej odpowiedzi. Nie próbuj wypaść dobrze. Sprawdź tylko, które zdania mogłyby zostać zapisane w Twojej historii.</p>
            </div>
            <div className="text-center mt-12">
              <button onClick={() => setStep(1)} className="btn-relic">SPRAWDŹ SWOJĄ HISTORIĘ</button>
              <p className="technical text-[10px] text-[#F5EFE1]/70 mt-4">15 ZDAŃ · KILKA MINUT · BEZ REJESTRACJI</p>
            </div>
            <p className="text-sm text-[#F5EFE1]/70 leading-relaxed max-w-xl mx-auto mt-10 text-center">{LOCAL_ONLY}</p>
          </div>
        )}

        {/* ===== 1–15 · ZDANIA ===== */}
        {q && (
          <div key={step} className="fade-up">
            <p className="technical text-[10px] text-[#F5EFE1]/70 mb-3">{String(step).padStart(2, "0")} Z {N}</p>
            <p className="text-sm text-[#F5EFE1]/70 mb-5">Na ile odnajdujesz siebie w tym zdaniu?</p>
            <h2 className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] leading-snug mb-10 break-words">{q.text}</h2>
            <div className="space-y-3" role="radiogroup" aria-label={q.text}>
              {SCALE.map((s) => (
                <button key={s.value} role="radio" aria-checked={answers[step - 1] === s.value} onClick={() => answer(s.value)} className={choice(answers[step - 1] === s.value)}>
                  <span className="text-base">{s.label}</span>
                </button>
              ))}
            </div>
            {step === 1 && <p className="text-sm text-[#F5EFE1]/70 mt-6">Nie ma odpowiedzi dobrych ani złych. Odnieś zdanie do własnej historii i obecnego życia.</p>}
            <button onClick={() => setStep(step - 1)} className={back}><ArrowLeft className="h-3 w-3" /> WSTECZ</button>
          </div>
        )}

        {/* ===== ETAP ===== */}
        {step === S_STAGE && (
          <div className="fade-up">
            <p className="technical text-[10px] gold-text mb-3">ZATRZYMAJ SIĘ JESZCZE PRZY JEDNYM PYTANIU</p>
            <h2 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1] leading-snug mb-4">Gdzie jesteś na swojej drodze?</h2>
            <p className="text-base text-[#F5EFE1]/75 mb-8">Nie pytam, jak długo trwa Twoja historia. Pytam, w którym miejscu siebie dzisiaj odnajdujesz.</p>
            <div className="space-y-3">
              {STAGES.map((o) => (
                <button key={o.key} onClick={() => { setStage(o.key); setStep(S_RESULT); }} className={`${choice(stage === o.key)} flex-col items-start gap-1`}>
                  <span className="technical text-[10px] gold-text">{o.key.toUpperCase()}</span>
                  <span className="text-base leading-relaxed">{o.text}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(N)} className={back}><ArrowLeft className="h-3 w-3" /> WSTECZ</button>
          </div>
        )}

        {/* ===== WYNIK ===== */}
        {step === S_RESULT && r && (
          <div className="fade-up">
            <section className="mb-12">
              <p className="technical text-[10px] gold-text mb-3">TWÓJ WYNIK</p>
              <h2 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] leading-tight mb-4">To nie jest diagnoza. To lustro.</h2>
              <p className="text-base text-[#F5EFE1]/80 leading-relaxed">
                Twoje odpowiedzi nie mówią, kim jesteś. Pokazują, w których historiach rozpoznajesz dziś najwięcej siebie. Możesz odnajdywać się
                w jednej, w kilku albo w żadnej. Nie musisz dopasowywać swojego życia do kategorii — to kategorie mają służyć Tobie.
              </p>
            </section>

            <article className="border-t hairline pt-10 mb-12">
              <p className="technical text-[10px] gold-text mb-3">{r.kicker}</p>
              <h3 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] leading-tight mb-6">{r.head}</h3>
              <div className="space-y-4 text-lg text-[#F5EFE1]/85 leading-relaxed">
                {r.body.map((p) => <p key={p}>{p}</p>)}
              </div>
              {r.looks && (
                <div className="mt-8">
                  <p className="technical text-[10px] text-[#F5EFE1]/70 mb-2">JAK TO MOŻE WYGLĄDAĆ</p>
                  <p className="text-base text-[#F5EFE1]/80 leading-relaxed">{r.looks}</p>
                </div>
              )}
              <div className="mt-8">
                <p className="technical text-[10px] text-[#F5EFE1]/70 mb-2">CO MOŻE BYĆ TERAZ WAŻNE</p>
                <p className="text-base text-[#F5EFE1]/80 leading-relaxed">{r.now}</p>
              </div>
              <div className="border hairline p-6 md:p-8 mt-10">
                <p className="technical text-[10px] text-[#F5EFE1]/70 mb-3">ZOSTAWIAM CI JEDNO PYTANIE</p>
                <p className="shop-heading italic text-xl md:text-2xl text-[#F5EFE1] leading-snug">{r.question}</p>
              </div>
            </article>

            {result.key !== "zadna" && <section className="mb-12" aria-label="Trzy historie">
              <p className="technical text-[10px] text-[#F5EFE1]/70 mb-3">TRZY HISTORIE — OD NAJBLIŻSZEJ</p>
              <ol className="space-y-1 text-base text-[#F5EFE1]/85">
                {result.ranked.map((d, i) => <li key={d}>{i + 1}. {DIM_LABEL[d]}</li>)}
              </ol>
            </section>}

            {st && (
              <section className="border border-[#5C1A1B]/50 bg-[#0D0D0E] p-6 md:p-8 mb-12">
                <p className="technical text-[10px] text-[#F5EFE1]/70 mb-3">TWÓJ DZISIEJSZY ETAP</p>
                <p className="shop-heading text-2xl text-[#C9A24A] mb-3">{st.key}</p>
                <p className="text-base text-[#F5EFE1]/80 leading-relaxed">{st.result}</p>
                <p className="text-sm text-[#F5EFE1]/70 mt-4">Ten etap wybierasz samodzielnie. Nie wynika z punktów i nie mierzy, jak daleko jesteś na swojej drodze.</p>
              </section>
            )}

            <section className="border-t hairline pt-10 mb-12" aria-labelledby="test-end-h">
              <h3 id="test-end-h" className="shop-heading text-3xl text-[#F5EFE1] leading-tight mb-6">Nie wszystko, co się skończyło, trzeba odzyskać.</h3>
              <div className="space-y-4 text-lg text-[#F5EFE1]/85 leading-relaxed">
                <p>Są rzeczy, za którymi będziemy tęsknić. Są takie, których długo nie potrafimy zrozumieć. I takie, do których — choć kiedyś były całym naszym światem — nie chcemy już wracać.</p>
                <p>Nie powiem Ci, co powinno wydarzyć się dalej. Nie znam całej Twojej historii. Ale wiem, że człowieka nie da się sprowadzić do jednego wydarzenia, jednej roli ani jednego wyniku.</p>
                <p>Jeżeli chcesz dalej przyglądać się tym pytaniom, piszę o nich w <strong className="text-[#F5EFE1] font-semibold">Listach powrotu</strong>. Nie po to, żeby mówić Ci, kim masz zostać. Po to, żeby łatwiej było usłyszeć siebie.</p>
              </div>
              <Link to="/skarbiec/listy-powrotu" className="btn-relic mt-8">CZYTAJ LISTY POWROTU <ArrowRight className="h-4 w-4" /></Link>
              <p className="shop-heading italic text-lg text-[#F5EFE1]/80 mt-10">Wracam z siebie. Uczę wracać.</p>
              <p className="technical text-[10px] gold-text mt-2">EXMORTIS — ZE ŚMIERCI</p>
            </section>

            <section className="mb-12" aria-label="Dalej">
              <p className="technical text-[10px] text-[#F5EFE1]/70 mb-4">MOŻESZ TEŻ</p>
              <Link to="/skarbiec" className="flex items-center justify-between gap-4 border hairline px-5 py-5 mb-4 min-h-11 text-[#F5EFE1] hover:border-[#C9A24A]/60 transition-colors">
                <span><span className="shop-heading text-xl block">Zajrzyj do Skarbca</span><span className="text-sm text-[#F5EFE1]/75">Materiały na każdy etap drogi — bezpłatne i płatne.</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 gold-text" />
              </Link>
              {next && next.free.length > 0 && (
                <div className="grid sm:grid-cols-3 gap-4 my-6">{next.free.map((p) => <ShopProductCard key={p.id || p.slug} product={p} />)}</div>
              )}
              <Link to="/spotkania" className="flex items-center justify-between gap-4 border hairline px-5 py-5 mb-6 min-h-11 text-[#F5EFE1] hover:border-[#C9A24A]/60 transition-colors">
                <span><span className="shop-heading text-xl block">Spotkania</span><span className="text-sm text-[#F5EFE1]/75">Otwarte spotkania online i na żywo.</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 gold-text" />
              </Link>
              <p className="text-base text-[#F5EFE1]/80">
                Jeśli chcesz porozmawiać o swojej historii —{" "}
                <Link to="/skarbiec/rozmowa-na-progu" className="gold-text underline underline-offset-4">Rozmowa na progu</Link>.
              </p>
            </section>

            <div className="text-sm text-[#F5EFE1]/75 leading-relaxed mb-10 border-t hairline pt-8">
              <HelpInfo />
              <p className="mt-2">{LOCAL_ONLY}</p>
            </div>

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mb-6">
              <button type="button" onClick={() => setStep(1)} className="technical text-[10px] text-[#F5EFE1]/75 hover:gold-text underline underline-offset-4 min-h-11">ZMIEŃ ODPOWIEDZI</button>
              <button type="button" onClick={restart} className="technical text-[10px] text-[#F5EFE1]/75 hover:gold-text underline underline-offset-4 min-h-11">ZACZNIJ OD NOWA</button>
            </div>
            <div className="text-center">
              <button onClick={share} className="btn-ghost !px-5 !py-3 text-[10px]">
                {copied ? <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> SKOPIOWANO LINK</span>
                  : <span className="flex items-center gap-2"><Share2 className="h-3.5 w-3.5" /> WYŚLIJ TEST KOMUŚ BLISKIEMU</span>}
              </button>
            </div>
          </div>
        )}

        {step === 0 && <div className="text-xs text-[#F5EFE1]/70 leading-relaxed max-w-xl mx-auto mt-10 text-center"><HelpInfo /></div>}
      </div>
    </div>
  );
}
