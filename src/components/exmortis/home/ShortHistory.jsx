import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";

const PORTRAIT =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/74c8971f2_572398635_17869620246460401_6357932160691507676_n.jpg";

// To samo zdjęcie z posługi, co w sekcji „Krótka historia" na podstronie O mnie.
const PRIEST_PHOTO =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/29c863d5e_Gemini_Generated_Image_5hhwtq5hhwtq5hhw.jpeg";

// Strona główna: „Krótka historia” — zdjęcie, historia i wejście do podstrony O mnie.
export default function ShortHistory() {
  return (
    <section id="historia" className="border-t hairline bg-[#070708]">
      <div className="relative h-[55vh] md:h-[75vh] overflow-hidden">
        <Image
          src={PORTRAIT}
          alt="Dawid — exmortis"
          fittingType="fill"
          className="absolute inset-0 w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-[#070708]/20 to-[#070708]/40" />
        <p className="absolute bottom-6 left-5 md:left-10 technical text-[10px] gold-text">
          DAWID · EXMORTIS
        </p>
      </div>

      <div className="py-24 md:py-32 px-5 md:px-10">
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-4">KRÓTKA HISTORIA · 04</p>
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-12">
            Ja tam byłem.<br />
            <span className="gold-text">I wróciłem. Inny.</span>
          </h2>

          <div className="grid md:grid-cols-5 gap-12 md:gap-16 items-start">
            <div className="md:col-span-3">
              <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-foreground/70">
                <p>Byłem księdzem. Prowadziłem ludzi.</p>
                <p>
                  A potem sam znalazłem się w miejscu, którego nie było na mapie. W odrzuceniu,
                  w „trędowatości”, w braku perspektyw.
                </p>
                <p>
                  Nie zaczynałem od dna. Do dna jeszcze pukałem od spodu.{" "}
                  <strong className="text-[#E2E2E2]">Byłem niżej.</strong>
                </p>
                <p className="text-foreground/60">
                  W piosence „exmortis” zapisałem zdanie, które długo w sobie nosiłem:
                </p>
              </div>

              <blockquote className="border-l border-[#C9A24A] pl-6 md:pl-10 my-12 max-w-3xl">
                <p className="shop-heading text-2xl md:text-4xl gold-text leading-snug">
                  „Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie
                  zasadziłeś.”
                </p>
              </blockquote>

              <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-foreground/70">
                <p>To cała moja historia w jednym zdaniu. Reszta to konsekwencje.</p>
                <p>
                  Dziś rosnę — jako szczęśliwy mąż i ojciec. I tę iskrę chcę dawać dalej:
                  zamieniać „grzebanie” w „sadzenie”.
                </p>
              </div>

              <Link to="/o-mnie?src=home-historia" className="btn-ghost mt-12">
                Przeczytaj całą historię <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="md:col-span-2 border hairline">
              <Image
                src={PRIEST_PHOTO}
                alt="Dawid — posługa kapłańska"
                fittingType="fill"
                className="w-full aspect-[3/4]"
              />
              <p className="technical text-[10px] gold-text p-4 border-t hairline">
                POSŁUGA · WCZEŚNIEJSZE ŻYCIE
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}