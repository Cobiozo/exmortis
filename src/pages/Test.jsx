import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Share2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import useSystemText from "@/content/useSystemText";
import ShopProductCard from "@/components/exmortis/shop/ShopProductCard";

const SHARE_URL = "https://exmortis-return-path.base44.app/test?src=polecenie";

// Stwierdzenia w przemieszanej kolejności; f = forma kobieca (brak = ta sama).
const QUESTIONS = [
  { m: "W niedzielę wieczorem czuję już poniedziałek." },
  { m: "Mam wszystko, co „powinno” dawać sens — a sensu nie czuję." },
  { m: "Jest w moim życiu wydarzenie, po którym nic nie jest takie jak przedtem." },
  { m: "Robię swoją pracę dobrze, ale nie mam do niej serca." },
  { m: "Miejsca i praktyki, które kiedyś mnie karmiły, dziś zostawiają mnie pustym.", f: "Miejsca i praktyki, które kiedyś mnie karmiły, dziś zostawiają mnie pustą." },
  { m: "Udaję przed innymi, że już mi przeszło." },
  { m: "Po spotkaniach z ludźmi wracam wyczerpany, jakbym przebiegł maraton.", f: "Po spotkaniach z ludźmi wracam wyczerpana, jakbym przebiegła maraton." },
  { m: "Coraz częściej pytam siebie, po co właściwie jestem — i nie znajduję odpowiedzi." },
  { m: "Nie wiem, kim jestem bez roli, którą straciłem.", f: "Nie wiem, kim jestem bez roli, którą straciłam." },
  { m: "Marzę o urlopie, ale wiem, że po nim wszystko wróci." },
  { m: "Trudno mi się w cokolwiek naprawdę zaangażować — w pracę, w rozmowę, w człowieka." },
  { m: "Świat oczekuje, że już się poukładałem — a ja wciąż jestem w środku.", f: "Świat oczekuje, że już się poukładałam — a ja wciąż jestem w środku." },
];

const SCALE = [
  { value: 0, label: "Nie dotyczy mnie" },
  { value: 1, label: "Czasem" },
  { value: 2, label: "Często" },
  { value: 3, label: "Prawie zawsze" },
];

const STAGE_OPTIONS = [
  { stage: "Śmierć", m: "Wiem, że coś jest nie tak, ale jeszcze tego nie nazwałem.", f: "Wiem, że coś jest nie tak, ale jeszcze tego nie nazwałam." },
  { stage: "Próg", m: "Wiem, co umarło. Stoję przed decyzją, którą odkładam." },
  { stage: "Powrót", m: "Decyzja zapadła. Buduję coś nowego, ale łatwo mi się cofnąć." },
  { stage: "Inny", m: "Wróciłem. Chcę utrzymać to, co się we mnie zmieniło.", f: "Wróciłam. Chcę utrzymać to, co się we mnie zmieniło." },
];

const LOW_TEXT =
  "Twoje wyniki są niskie. To może znaczyć, że jesteś w dobrym miejscu — albo że jeszcze nie pozwalasz sobie tego zobaczyć. Wróć do tego testu za miesiąc.";

const resultText = (dominant, isF) => {
  if (dominant === "Mentalna")
    return "Praca, która kiedyś Cię budowała, dziś zabiera Ci siebie po cichu. To nie lenistwo i nie „gorszy okres”. Największa pułapka tego miejsca brzmi: „muszę się bardziej postarać”. Nie musisz bardziej. Musisz się zatrzymać i zapytać, po co to wszystko robisz.";
  if (dominant === "Duchowa")
    return isF
      ? "Sens, na którym stałaś, przestał wystarczać. Twoja pustka nie jest niewdzięcznością — jest sygnałem, że jesteś gotowa na sens głębszy niż ten, który miałaś. Sensu się nie znajduje. Sens się buduje."
      : "Sens, który dotąd wystarczał, przestał wystarczać. Twoja pustka nie jest niewdzięcznością — jest sygnałem gotowości na sens głębszy niż dotychczasowy. Sensu się nie znajduje. Sens się buduje.";
  if (dominant === "Życiowa")
    return isF
      ? "Jedno wydarzenie rozebrało to, co znałaś. Nie masz opóźnienia — świat ma zbyt krótką pamięć. Nie chodzi o powrót do siebie sprzed. Chodzi o zbudowanie nowego domu w miejscu, w którym ten pierwszy się spalił."
      : "Jedno wydarzenie rozebrało to, co znane. Nie masz opóźnienia — świat ma zbyt krótką pamięć. Nie chodzi o powrót do siebie sprzed. Chodzi o zbudowanie nowego domu w miejscu, w którym ten pierwszy się spalił.";
  return "Tak jest u większości ludzi, którzy do mnie przychodzą. Jedna śmierć uruchamia drugą, druga maskuje trzecią. Dlatego warto zacząć od mapy całej drogi, a nie od jednego fragmentu.";
};

const stageText = (stage, isF) => {
  if (stage === "Śmierć") return "Jesteś na początku drogi. Tu nie trzeba jeszcze nic zmieniać — trzeba zobaczyć i nazwać.";
  if (stage === "Próg") return "Wiesz już, co umarło. Teraz liczy się jedna rzecz: decyzja, nie deklaracja.";
  if (stage === "Powrót") return "Budujesz coś nowego. To najdłuższy etap — i ten, w którym najłatwiej wrócić do starego.";
  return isF ? "Wróciłaś. Teraz zadanie na całe życie: nie wrócić do śmierci." : "Powrót się wydarzył. Teraz zadanie na całe życie: nie wrócić do śmierci.";
};

const inputCls =
  "w-full bg-transparent border hairline px-4 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors";

// Kroki: 0 wstęp · 1–12 stwierdzenia · 13 etap · 14 zdanie · 15 formularz · 16 wynik
// Moduł testu; d.tytul i d.tekst (wstęp) pochodzą z edytora stron.
export default function Test({ d = {} }) {
  const t = useSystemText();
  const [step, setStep] = useState(0);
  const [formOfAddress, setFormOfAddress] = useState(null);
  const [answers, setAnswers] = useState(Array(12).fill(null));
  const [stage, setStage] = useState(null);
  const [openAnswer, setOpenAnswer] = useState("");
  const [lead, setLead] = useState({ first_name: "", email: "", consent: false, newsletter: false });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [products, setProducts] = useState(null);
  const [copied, setCopied] = useState(false);
  const [source, setSource] = useState("");

  const isF = formOfAddress === "Kobieta";

  useEffect(() => {
    setSource(new URLSearchParams(window.location.search).get("src") || "");
    base44.functions
      .invoke("shopProducts", {})
      .then((r) => setProducts(r.data.products || []))
      .catch(() => setProducts([]));
  }, []);

  const answer = (value) => {
    if (answers[step - 1] !== null) return;
    setAnswers((a) => {
      const n = [...a];
      n[step - 1] = value;
      return n;
    });
    setTimeout(() => setStep((s) => Math.min(s + 1, 13)), 280);
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
      setResult(res.data);
      setStep(16);
    } catch {
      setError("Nie udało się zapisać wyniku. Spróbuj ponownie.");
    } finally {
      setSending(false);
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

  const q = step >= 1 && step <= 12 ? QUESTIONS[step - 1] : null;
  const qText = q ? (isF && q.f ? q.f : q.m) : "";
  const progress = Math.min(step, 15) / 15;
  const lowIntensity =
    result && result.scores.mentalna < 4 && result.scores.duchowa < 4 && result.scores.zyciowa < 4;

  const matched =
    result && products
      ? result.recommended.map((r) => products.find((p) => p.slug === r.slug)).filter(Boolean)
      : [];

  return (
    <div className="min-h-screen bg-[#0A0A0B] pt-28 md:pt-32 pb-24 px-5">
      <div className="mx-auto max-w-3xl">
        <p className="technical text-[9px] gold-text mb-10 text-center">
          TEST · KTÓRA ŚMIERĆ JEST TWOJA?
        </p>

        {step > 0 && step < 16 && (
          <div className="h-px bg-[#3D3D3F] mb-12">
            <div
              className="h-px bg-[#C9A24A] transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {/* ===== 0 · WSTĘP ===== */}
        {step === 0 && (
          <div className="fade-up text-center">
            <h1 className="shop-heading text-4xl md:text-6xl text-[#F5EFE1] leading-tight mb-8">
              {d.tytul || "Która śmierć jest Twoja?"}
            </h1>
            {d.tekst ? (
              <div className="rich-content text-foreground/60 text-lg leading-relaxed max-w-xl mx-auto mb-16" dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.tekst) }} />
            ) : (
              <p className="text-foreground/60 text-lg leading-relaxed max-w-xl mx-auto mb-16">
                Każdy z nas ma za sobą przynajmniej jedną śmierć — mentalną, duchową albo życiową.
                Ten test nie jest diagnozą. Jest lustrem. Dwanaście stwierdzeń, trzy minuty,
                odpowiadaj pierwszą myślą.
              </p>
            )}
            <p className="shop-heading text-xl text-[#F5EFE1] mb-8">Jak mam się do Ciebie zwracać?</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => { setFormOfAddress("Mężczyzna"); setStep(1); }} className="btn-ghost">
                JAK DO MĘŻCZYNY
              </button>
              <button onClick={() => { setFormOfAddress("Kobieta"); setStep(1); }} className="btn-ghost">
                JAK DO KOBIETY
              </button>
            </div>
          </div>
        )}

        {/* ===== 1–12 · STWIERDZENIA ===== */}
        {q && (
          <div key={step} className="fade-up">
            <p className="technical text-[9px] text-foreground/30 mb-8">
              {String(step).padStart(2, "0")} Z 12
            </p>
            <h2 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1] leading-snug mb-12">
              {qText}
            </h2>

            <div className="space-y-3">
              {SCALE.map((s) => (
                <button
                  key={s.value}
                  onClick={() => answer(s.value)}
                  className={`w-full text-left px-5 py-5 md:py-4 border transition-all duration-200 flex items-center justify-between ${
                    answers[step - 1] === s.value
                      ? "border-[#C9A24A] bg-[#C9A24A]/10 text-[#F5EFE1]"
                      : "hairline text-foreground/60 hover:border-[#C9A24A]/50 hover:text-[#F5EFE1]"
                  }`}
                >
                  <span className="text-base md:text-base">{s.label}</span>
                  <span className="technical text-[9px] text-foreground/30">{s.value}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(step - 1)}
              className="technical text-[9px] text-foreground/30 hover:text-foreground/60 mt-10 flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> WSTECZ
            </button>
          </div>
        )}

        {/* ===== 13 · ETAP ===== */}
        {step === 13 && (
          <div className="fade-up">
            <h2 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1] leading-snug mb-12">
              Jeszcze jedno. Który opis jest Ci dziś najbliższy?
            </h2>
            <div className="space-y-3">
              {STAGE_OPTIONS.map((o) => (
                <button
                  key={o.stage}
                  onClick={() => { setStage(o.stage); setStep(14); }}
                  className={`w-full text-left px-5 py-5 border transition-all duration-200 ${
                    stage === o.stage
                      ? "border-[#C9A24A] bg-[#C9A24A]/10 text-[#F5EFE1]"
                      : "hairline text-foreground/60 hover:border-[#C9A24A]/50 hover:text-[#F5EFE1]"
                  }`}
                >
                  <span className="text-base leading-relaxed">{isF && o.f ? o.f : o.m}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(12)}
              className="technical text-[9px] text-foreground/30 hover:text-foreground/60 mt-10 flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> WSTECZ
            </button>
          </div>
        )}

        {/* ===== 14 · JEDNO ZDANIE ===== */}
        {step === 14 && (
          <div className="fade-up">
            <h2 className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] leading-snug mb-6">
              Jeśli chcesz — dokończ jednym zdaniem:
            </h2>
            <p className="italic text-foreground/50 text-lg mb-6">«Ostatnio umarło we mnie…»</p>
            <textarea
              value={openAnswer}
              onChange={(e) => setOpenAnswer(e.target.value)}
              rows={4}
              maxLength={2000}
              className={inputCls}
              placeholder="…"
            />
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <button onClick={() => setStep(15)} className="btn-relic">DALEJ</button>
              <button onClick={() => { setOpenAnswer(""); setStep(15); }} className="btn-ghost">
                POMIŃ
              </button>
            </div>
            <button
              onClick={() => setStep(13)}
              className="technical text-[9px] text-foreground/30 hover:text-foreground/60 mt-10 flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> WSTECZ
            </button>
          </div>
        )}

        {/* ===== 15 · GDZIE WYSŁAĆ WYNIK ===== */}
        {step === 15 && (
          <form onSubmit={submit} className="fade-up space-y-6">
            <h2 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1]">
              Twój wynik jest gotowy. Gdzie mam go wysłać?
            </h2>
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-3">IMIĘ</label>
              <input
                required
                value={lead.first_name}
                onChange={(e) => setLead({ ...lead, first_name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-3">E-MAIL</label>
              <input
                required
                type="email"
                value={lead.email}
                onChange={(e) => setLead({ ...lead, email: e.target.value })}
                className={inputCls}
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={lead.consent}
                onChange={(e) => setLead({ ...lead, consent: e.target.checked })}
                className="accent-[#C9A24A] w-4 h-4 mt-0.5"
              />
              <span className="text-sm text-foreground/50 leading-relaxed">
                Zgadzam się na przetwarzanie danych w celu przesłania wyniku.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lead.newsletter}
                onChange={(e) => setLead({ ...lead, newsletter: e.target.checked })}
                className="accent-[#C9A24A] w-4 h-4 mt-0.5"
              />
              <span className="text-sm text-foreground/50 leading-relaxed">
                Chcę też dostawać „Listy powrotu” — jeden list w każdy poniedziałek.
              </span>
            </label>
            {error && <p className="text-sm blood-text">{error}</p>}
            <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
              {sending ? "ZAPISUJĘ..." : "POKAŻ MÓJ WYNIK"}
            </button>
            <p className="text-xs text-foreground/30 text-center">
              Nie wysyłam spamu. Wypiszesz się jednym kliknięciem.
            </p>
          </form>
        )}

        {/* ===== 16 · WYNIK ===== */}
        {step === 16 && result && (
          <div className="fade-up">
            <p className="technical text-[10px] gold-text mb-10">{t("dz.test")}</p>
            <div className="space-y-5 mb-16">
              {[
                { label: "MENTALNA", v: result.scores.mentalna },
                { label: "DUCHOWA", v: result.scores.duchowa },
                { label: "ŻYCIOWA", v: result.scores.zyciowa },
              ].map((s) => (
                <div key={s.label}>
                  <p className="technical text-[9px] text-foreground/40 mb-2">{s.label}</p>
                  <div className="h-1 bg-[#1F1F21]">
                    <div
                      className="h-1 bg-[#C9A24A] transition-all duration-700"
                      style={{ width: `${(s.v / 12) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <h2 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] leading-tight mb-8">
              {result.dominant === "Mieszana"
                ? `${lead.first_name}, niesiesz więcej niż jedną śmierć.`
                : `${lead.first_name}, Twoja śmierć jest ${result.dominant.toLowerCase()}.`}
            </h2>
            <p className="text-foreground/70 text-lg leading-relaxed mb-6">
              {resultText(result.dominant, isF)}
            </p>
            {lowIntensity && (
              <p className="text-foreground/50 text-base leading-relaxed border-l-2 border-[#C9A24A] pl-4 mb-6">
                {LOW_TEXT}
              </p>
            )}

            <div className="border border-[#5C1A1B]/50 bg-[#0D0D0E] p-8 md:p-10 mb-16">
              <p className="technical text-[9px] text-foreground/40 mb-3">TWÓJ ETAP</p>
              <p className="shop-heading text-2xl text-[#C9A24A] mb-4">{stage}</p>
              <p className="text-foreground/60 leading-relaxed">{stageText(stage, isF)}</p>
            </div>

            <h3 className="shop-heading text-2xl text-[#F5EFE1] mb-8">Od czego zacząć</h3>
            {products === null ? (
              <div className="grid sm:grid-cols-3 gap-4 mb-16">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-[#0D0D0E] border hairline animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-4 mb-16">
                {matched.map((p) => (
                  <ShopProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            <div className="border border-[#5C1A1B]/50 bg-[#0D0D0E] p-8 md:p-12 text-center space-y-6 mb-10">
              <p className="text-foreground/70 text-lg leading-relaxed">
                Jeśli czujesz, że to Twój moment — porozmawiajmy. Trzydzieści minut, bezpłatnie,
                bez zobowiązań.
              </p>
              <Link to="/powrot" className="btn-relic">
                UMÓW ROZMOWĘ KWALIFIKACYJNĄ
              </Link>
            </div>

            <p className="text-xs text-foreground/30 text-center leading-relaxed mb-10">
              Ten test nie jest diagnozą i nie zastępuje pomocy specjalisty. Jeśli jesteś w
              kryzysie, zadzwoń pod bezpłatny numer{" "}
              <a href="tel:116123" className="gold-text hover:underline">116 123</a> albo{" "}
              <a href="tel:112" className="gold-text hover:underline">112</a>.
            </p>

            <div className="text-center">
              <button onClick={share} className="btn-ghost !px-5 !py-3 text-[10px]">
                {copied ? (
                  <span className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5" /> SKOPIOWANO LINK
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Share2 className="h-3.5 w-3.5" /> WYŚLIJ TEST KOMUŚ BLIISKIEMU
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}