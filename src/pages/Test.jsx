import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ShopProductCard from "@/components/exmortis/shop/ShopProductCard";
import WaitlistDialog from "@/components/exmortis/shop/WaitlistDialog";

const QUESTIONS = [
  "W niedzielę wieczorem czuję już poniedziałek.",
  "Robię swoją pracę dobrze, ale nie mam do niej serca.",
  "Po spotkaniach z ludźmi wracam wyczerpany, jakbym przebiegł maraton.",
  "Marzę o urlopie, ale wiem, że po nim wszystko wróci.",
  "Mam wszystko, co „powinno” dawać sens, a sensu nie czuję.",
  "Miejsca i praktyki, które kiedyś mnie karmiły, dziś zostawiają mnie pustym.",
  "Coraz częściej pytam siebie, po co właściwie jestem — i nie mam odpowiedzi.",
  "Trudno mi się w cokolwiek naprawdę zaangażować.",
  "Jest w moim życiu wydarzenie, po którym nic nie jest takie jak przedtem.",
  "Udaję przed innymi, że już mi przeszło.",
  "Nie wiem, kim jestem bez roli, którą straciłem.",
  "Świat oczekuje, że się już „poukładałem” — a ja wciąż jestem w środku.",
];

const SCALE = [
  { value: 0, label: "Nie dotyczy mnie" },
  { value: 1, label: "Czasem" },
  { value: 2, label: "Często" },
  { value: 3, label: "Prawie zawsze" },
];

const RESULT_TITLES = {
  Mentalna: "Śmierć mentalna",
  Duchowa: "Śmierć duchowa",
  Życiowa: "Śmierć życiowa",
  Mieszana: "Więcej niż jedna",
};

const RESULT_TEXTS = {
  Mentalna:
    "Twoja śmierć jest mentalna. Praca, która kiedyś Cię budowała, dziś zabiera Ci siebie po cichu. To nie lenistwo i nie gorszy okres — to coś, co ma nazwę i drogę wyjścia.",
  Duchowa:
    "Twoja śmierć jest duchowa. Sens, na którym stałeś, przestał wystarczać. Twoja pustka nie jest niewdzięcznością — jest sygnałem, że jesteś gotowy na sens głębszy.",
  Życiowa:
    "Twoja śmierć jest życiowa. Jedno wydarzenie rozebrało to, co znałeś. Nie chodzi o powrót do siebie sprzed — chodzi o zbudowanie domu w miejscu, w którym ten pierwszy się spalił.",
  Mieszana:
    "Niesiesz więcej niż jedną śmierć naraz. Tak jest u większości ludzi, którzy do mnie przychodzą — i dlatego warto zacząć od mapy całej drogi.",
};

const RESULT_SLUGS = {
  Mentalna: ["wracam-inny", "mini-ebook-trzy-smierci", "pusty-szczyt"],
  Duchowa: ["wracam-inny", "mini-ebook-trzy-smierci", "cisza-ktora-prowadzi"],
  Życiowa: ["wracam-inny", "mini-ebook-trzy-smierci", "3-pierwsze-ruchy"],
  Mieszana: ["wracam-inny", "mini-ebook-trzy-smierci", "3-pierwsze-ruchy"],
};

const inputCls =
  "w-full bg-transparent border hairline px-4 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors";

export default function Test() {
  const [step, setStep] = useState(0); // 0–11 pytania, 12 formularz, 13 wynik
  const [answers, setAnswers] = useState(Array(12).fill(null));
  const [form, setForm] = useState({ first_name: "", email: "", optin: true });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [products, setProducts] = useState(null);
  const [waitlistProduct, setWaitlistProduct] = useState(null);

  const answer = (value) => {
    if (answers[step] !== null) return;
    setAnswers((a) => {
      const n = [...a];
      n[step] = value;
      return n;
    });
    setTimeout(() => setStep((s) => Math.min(s + 1, 12)), 280);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await base44.functions.invoke("shopQuizSubmit", {
        first_name: form.first_name,
        email: form.email,
        answers: answers.map((a) => Number(a)),
        newsletter_optin: form.optin,
      });
      setResult(res.data);
      setStep(13);
      base44.functions
        .invoke("shopProducts", {})
        .then((r) => setProducts(r.data.products || []))
        .catch(() => setProducts([]));
    } catch {
      setError("Nie udało się zapisać wyniku. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  const matched =
    result && products
      ? RESULT_SLUGS[result.dominant]
          .map((slug) => products.find((p) => p.slug === slug))
          .filter(Boolean)
          .slice(0, 3)
      : [];

  const progress = Math.min(step, 12) / 12;

  return (
    <div className="min-h-screen bg-[#0A0A0B] pt-28 md:pt-32 pb-24 px-5">
      <div className="mx-auto max-w-3xl">
        <p className="technical text-[9px] gold-text mb-2 text-center">
          TEST · KTÓRA ŚMIERĆ JEST TWOJA?
        </p>

        {step < 12 && (
          <div key={step} className="fade-up">
            <div className="h-px bg-[#3D3D3F] mt-8 mb-12">
              <div
                className="h-px bg-[#C9A24A] transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <p className="technical text-[9px] text-foreground/30 mb-6">
              {String(step + 1).padStart(2, "0")} / 12
            </p>
            <h2 className="shop-heading text-2xl md:text-4xl text-[#F5EFE1] leading-snug mb-12">
              {QUESTIONS[step]}
            </h2>

            <div className="space-y-3">
              {SCALE.map((s) => (
                <button
                  key={s.value}
                  onClick={() => answer(s.value)}
                  className={`w-full text-left px-5 py-4 border transition-all duration-200 flex items-center justify-between ${
                    answers[step] === s.value
                      ? "border-[#C9A24A] bg-[#C9A24A]/10 text-[#F5EFE1]"
                      : "hairline text-foreground/60 hover:border-[#C9A24A]/50 hover:text-[#F5EFE1]"
                  }`}
                >
                  <span className="text-sm md:text-base">{s.label}</span>
                  <span className="technical text-[9px] text-foreground/30">{s.value}</span>
                </button>
              ))}
            </div>

            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="technical text-[9px] text-foreground/30 hover:text-foreground/60 mt-10 flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> POPRZEDNIE PYTANIE
              </button>
            )}
          </div>
        )}

        {step === 12 && (
          <form onSubmit={submit} className="fade-up space-y-6 mt-12">
            <h2 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1]">
              Gdzie wysłać Twój wynik?
            </h2>
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-3">IMIĘ</label>
              <input
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-3">E-MAIL</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.optin}
                onChange={(e) => setForm({ ...form, optin: e.target.checked })}
                className="accent-[#C9A24A] w-4 h-4 mt-0.5"
              />
              <span className="text-sm text-foreground/50 leading-relaxed">
                Zapisz mnie na Listy powrotu — jeden list w każdy poniedziałek.
              </span>
            </label>
            {error && <p className="text-sm blood-text">{error}</p>}
            <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
              {sending ? "ZAPISUJĘ..." : "POKAŻ MÓJ WYNIK"}
            </button>
          </form>
        )}

        {step === 13 && result && (
          <div className="fade-up mt-12">
            <p className="technical text-[9px] text-foreground/40 mb-6">TWÓJ WYNIK</p>
            <h2 className="shop-heading text-4xl md:text-6xl gold-text mb-8 leading-tight">
              {RESULT_TITLES[result.dominant]}
            </h2>
            <p className="text-foreground/70 text-lg leading-relaxed mb-6">
              {RESULT_TEXTS[result.dominant]}
            </p>
            <p className="technical text-[9px] text-foreground/30 mb-16">
              MENTALNA {result.scores.mentalna} · DUCHOWA {result.scores.duchowa} · ŻYCIOWA{" "}
              {result.scores.zyciowa}
            </p>

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
                  <ShopProductCard key={p.id} product={p} onWaitlist={setWaitlistProduct} />
                ))}
              </div>
            )}

            <div className="border border-[#5C1A1B]/50 bg-[#0D0D0E] p-8 md:p-12 text-center space-y-6">
              <p className="text-foreground/70 text-lg">
                Jeśli czujesz, że to Twój moment — porozmawiajmy.
              </p>
              <Link to="/powrot" className="btn-relic">
                UMÓW ROZMOWĘ KWALIFIKACYJNĄ
              </Link>
            </div>

            <p className="text-xs text-foreground/30 text-center mt-8 leading-relaxed">
              Ten test nie jest diagnozą. Jeśli jesteś w kryzysie, zadzwoń pod{" "}
              <a href="tel:116123" className="gold-text hover:underline">
                116 123
              </a>
              .
            </p>
          </div>
        )}
      </div>

      {waitlistProduct && (
        <WaitlistDialog product={waitlistProduct} onClose={() => setWaitlistProduct(null)} />
      )}
    </div>
  );
}