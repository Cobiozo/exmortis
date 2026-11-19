import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Share2 } from "lucide-react";
import { BrandButton, Container } from "@/components/exmortis/ui";
import { DIM_LABEL } from "@/lib/quizScore";
import TestHelp from "./TestHelp";
import TestNextStep from "./TestNextStep";

// Wynik testu: nazwa wyniku z danych, objaśnienie, nota o ograniczeniach, jeden rekomendowany krok
// i bezpłatne możliwości. Treść wyników, kolejność historii i logika „dalej” bez zmian.
const ROZDROZA = "/konto/rozdroza/biblioteka";
const LISTY = "/#listy-powrotu";
const link = "text-exm-gold underline decoration-exm-gold-line underline-offset-4 hover:text-exm-gold-hover";

export default function TestResult({ r, result, st, next, user, copied, onRestart, onChangeAnswers, onShare, localOnly }) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return (
    <Container narrow>
      <p className="exm-eyebrow">{r.kicker}</p>
      <h1 ref={heading} tabIndex={-1} className="exm-h2 mt-3 focus:outline-none">{r.head}</h1>

      <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-exm-text">
        {r.body.map((p) => <p key={p}>{p}</p>)}
      </div>

      {r.looks && (
        <div className="mt-8">
          <p className="exm-eyebrow">Jak to może wyglądać</p>
          <p className="mt-2 text-[15px] leading-relaxed text-exm-muted">{r.looks}</p>
        </div>
      )}
      <div className="mt-6">
        <p className="exm-eyebrow">Co może być teraz ważne</p>
        <p className="mt-2 text-[15px] leading-relaxed text-exm-muted">{r.now}</p>
      </div>

      <div className="mt-8 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 md:p-8">
        <p className="exm-eyebrow">Zostawiam Ci jedno pytanie</p>
        <p className="mt-3 font-exm-serif text-[clamp(1.25rem,3vw,1.6rem)] italic leading-snug text-exm-ivory">{r.question}</p>
      </div>

      <section className="mt-8 rounded-[var(--exm-r-card)] border border-exm-line p-6 md:p-8" aria-labelledby="test-nota">
        <h2 id="test-nota" className="exm-h3">To nie jest diagnoza. To lustro.</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-exm-muted">
          Twoje odpowiedzi nie mówią, kim jesteś. Pokazują, w których historiach rozpoznajesz dziś najwięcej siebie. Możesz odnajdywać się
          w jednej, w kilku albo w żadnej. Nie musisz dopasowywać swojego życia do kategorii — to kategorie mają służyć Tobie.
        </p>
        <p className="mt-3 text-[13px] font-medium text-exm-ivory">Autorefleksja, nie diagnoza.</p>
      </section>

      {result.key !== "zadna" && (
        <section className="mt-10" aria-label="Trzy historie">
          <p className="exm-eyebrow">Trzy historie — od najbliższej</p>
          <ol className="mt-3 space-y-1 text-[15px] text-exm-text">
            {result.ranked.map((d, i) => <li key={d}>{i + 1}. {DIM_LABEL[d]}</li>)}
          </ol>
        </section>
      )}

      {st && (
        <section className="mt-10 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface-2 p-6 md:p-8" aria-labelledby="test-etap">
          <p className="exm-eyebrow">Twój dzisiejszy etap</p>
          <h2 id="test-etap" className="exm-h3 mt-3 text-exm-gold">{st.key}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-exm-muted">{st.result}</p>
          <p className="mt-4 text-[13px] leading-relaxed text-exm-muted">
            Ten etap wybierasz samodzielnie. Nie wynika z punktów i nie mierzy, jak daleko jesteś na swojej drodze.
          </p>
        </section>
      )}

      <TestNextStep main={next?.main || null} free={next?.free || []} />

      <section className="mt-[var(--exm-section-y)] border-t border-exm-line pt-10" aria-labelledby="test-koniec">
        <h2 id="test-koniec" className="exm-h2">Nie wszystko, co się skończyło, trzeba odzyskać.</h2>
        <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-exm-text">
          <p>Są rzeczy, za którymi będziemy tęsknić. Są takie, których długo nie potrafimy zrozumieć. I takie, do których — choć kiedyś były całym naszym światem — nie chcemy już wracać.</p>
          <p>Nie powiem Ci, co powinno wydarzyć się dalej. Nie znam całej Twojej historii. Ale wiem, że człowieka nie da się sprowadzić do jednego wydarzenia, jednej roli ani jednego wyniku.</p>
          <p>
            Jeżeli chcesz dalej przyglądać się tym pytaniom, piszę o nich w{" "}
            <Link to={LISTY} className="font-semibold text-exm-ivory underline decoration-exm-gold-line underline-offset-4 hover:text-exm-gold">Listach powrotu</Link>.
            {" "}Nie po to, żeby mówić Ci, kim masz zostać. Po to, żeby łatwiej było usłyszeć siebie.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <BrandButton variant="secondary" to={LISTY}>Zapisz się na Listy powrotu<ArrowRight className="h-4 w-4" aria-hidden="true" /></BrandButton>
          <BrandButton variant="secondary" to="/glos?src=test-wynik">Posłuchaj: muzyka i podcast<ArrowRight className="h-4 w-4" aria-hidden="true" /></BrandButton>
          <BrandButton variant="secondary" to="/skarbiec">Zajrzyj do Skarbca<ArrowRight className="h-4 w-4" aria-hidden="true" /></BrandButton>
        </div>
        <p className="mt-10 font-exm-serif text-lg italic text-exm-ivory">Wracam z siebie. Uczę wracać.</p>
        <p className="exm-eyebrow mt-2">Exmortis — ze śmierci</p>
      </section>

      <section className="mt-[var(--exm-section-y)]" aria-label="Możesz też">
        <p className="exm-eyebrow">Możesz też</p>

        <div className="mt-4 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 md:p-6">
          <h2 className="exm-h3">Rozdroża</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-exm-muted">
            Interaktywne historie, w których to Ty podejmujesz decyzje i widzisz, dokąd prowadzą. Bezpłatnie, po zalogowaniu.
          </p>
          <div className="mt-4">
            {user ? (
              <BrandButton variant="secondary" to={ROZDROZA}>Otwórz Rozdroża<ArrowRight className="h-4 w-4" aria-hidden="true" /></BrandButton>
            ) : (
              <BrandButton variant="secondary" to={`/register?returnTo=${encodeURIComponent(ROZDROZA)}`}>Załóż darmowe konto<ArrowRight className="h-4 w-4" aria-hidden="true" /></BrandButton>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-3">
          <Link
            to="/spotkania?src=test-wynik"
            className="flex min-h-[64px] items-center justify-between gap-4 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface px-5 py-4 transition-colors hover:border-exm-gold-line"
          >
            <span className="min-w-0">
              <span className="exm-h3 block">Spotkania</span>
              <span className="mt-1 block text-[15px] leading-relaxed text-exm-muted">Otwarte spotkania online i na żywo.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-exm-gold" aria-hidden="true" />
          </Link>
          <Link
            to="/skarbiec/rozmowa-na-progu?src=test-wynik"
            className="flex min-h-[64px] items-center justify-between gap-4 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface px-5 py-4 transition-colors hover:border-exm-gold-line"
          >
            <span className="min-w-0">
              <span className="exm-h3 block">Rozmowa na progu</span>
              <span className="mt-1 block text-[15px] leading-relaxed text-exm-muted">90 minut indywidualnej rozmowy o Twojej historii. Online, jednorazowo, bez zobowiązań.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-exm-gold" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-5 text-[15px] leading-relaxed text-exm-muted">
          Jeśli myślisz o dłuższej pracy, zobacz program <Link to="/powrot?src=test-wynik" className={link}>POWRÓT</Link>: osiem sesji przez cztery do sześciu miesięcy.
        </p>
      </section>

      <div className="mt-10 border-t border-exm-line pt-8">
        <TestHelp />
        <p className="mt-3 text-[13px] leading-relaxed text-exm-muted">{localOnly}</p>
      </div>

      <div className="mt-8 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-8">
        <BrandButton variant="link" onClick={onChangeAnswers}>Zmień odpowiedzi</BrandButton>
        <BrandButton variant="link" onClick={onRestart}>Zacznij od nowa</BrandButton>
      </div>

      <div className="mt-4">
        <BrandButton variant="secondary" onClick={onShare}>
          {copied ? (
            <><Check className="h-4 w-4" aria-hidden="true" /> Skopiowano link</>
          ) : (
            <><Share2 className="h-4 w-4" aria-hidden="true" /> Wyślij test komuś bliskiemu</>
          )}
        </BrandButton>
        <p role="status" className="sr-only">{copied ? "Link do testu skopiowany." : ""}</p>
      </div>
    </Container>
  );
}