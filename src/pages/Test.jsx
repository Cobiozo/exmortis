import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { QUESTIONS, STAGES, RESULTS, scoreTest, TEST_META } from "@/lib/quizScore";
import { setTrackingQuiet } from "@/lib/track";
import { SITE_URL } from "@/config/site";
import { nextSteps } from "@/lib/testNextSteps";
import { countCompletion } from "@/lib/testCount";
import { useAuth } from "@/lib/AuthContext";
import TestStart from "@/components/exmortis/test/TestStart";
import TestQuestion from "@/components/exmortis/test/TestQuestion";
import TestStage from "@/components/exmortis/test/TestStage";
import TestResult from "@/components/exmortis/test/TestResult";

const SHARE_URL = `${SITE_URL}/test`;
const N = QUESTIONS.length;
const S_STAGE = N + 1, S_RESULT = N + 2;
const TOTAL = N + 1;
const LOCAL_ONLY = "Odpowiedzi są przetwarzane wyłącznie w pamięci tej strony w Twojej przeglądarce. Nie wysyłamy ich na serwer ani e-mailem. Po odświeżeniu lub zamknięciu strony znikną. Do statystyki liczymy tylko, ile razy test został ukończony i z jakim wynikiem — anonimowo, bez odpowiedzi i bez danych, które pozwalałyby Cię rozpoznać.";

// Przewinięcie na początek nowego kroku — bez animacji, gdy system prosi o ograniczenie ruchu.
function scrollTop() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

// Test „Która śmierć jest Twoja?” — etap 9 (18.11.2026): wygląd i układ w systemie wizualnym exmortis.
// Pytania, skala, liczenie wyniku, treść wyników, kolejność historii i logika następnego kroku bez zmian.
// Działa WYŁĄCZNIE w przeglądarce: stan tylko w tym komponencie (bez localStorage, adresu URL, serwera,
// e-maila i analityki). Odświeżenie lub „Zacznij od nowa” czyści. Po wyniku liczymy anonimowo samo ukończenie.
export default function Test() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(Array(N).fill(null));
  const [stage, setStage] = useState(null);
  const [products, setProducts] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.functions.invoke("shopProducts", {}).then((r) => setProducts(r.data.products || [])).catch(() => setProducts([]));
  }, []);
  useEffect(() => { setTrackingQuiet(true); return () => setTrackingQuiet(false); }, []);
  useEffect(() => { if (step > 0) scrollTop(); }, [step]);

  const choose = (index, value) => setAnswers((a) => { const n = [...a]; n[index] = value; return n; });
  const go = (s) => setStep(Math.max(0, Math.min(s, S_RESULT)));

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

  return (
    <div className="bg-exm-bg pb-[var(--exm-section-y)] pt-28 md:pt-32">
      {step === 0 && <TestStart n={N} time={TEST_META.time} onStart={() => go(1)} />}

      {step >= 1 && step <= N && (
        <TestQuestion
          key={step}
          step={step}
          total={TOTAL}
          question={QUESTIONS[step - 1]}
          value={answers[step - 1]}
          onChoose={(v) => choose(step - 1, v)}
          onBack={() => go(step - 1)}
          onNext={() => go(step + 1)}
        />
      )}

      {step === S_STAGE && (
        <TestStage
          key="etap"
          step={S_STAGE}
          total={TOTAL}
          value={stage}
          onChoose={setStage}
          onBack={() => go(N)}
          onNext={() => go(S_RESULT)}
        />
      )}

      {step === S_RESULT && r && (
        <TestResult
          r={r}
          result={result}
          st={st}
          next={next}
          user={user}
          copied={copied}
          onRestart={restart}
          onChangeAnswers={() => go(1)}
          onShare={share}
          localOnly={LOCAL_ONLY}
        />
      )}
    </div>
  );
}