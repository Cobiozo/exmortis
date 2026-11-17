import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";

const PORTRAIT =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/74c8971f2_572398635_17869620246460401_6357932160691507676_n.jpg";

// Strona główna bez wątku kapłańskiego (decyzja właściciela 17.11.2026) — ta historia jest tylko w O mnie.
// Zdjęcie z sekcji „Próg” na podstronie O mnie.
const SIDE_PHOTO = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/f7f7a5e2f_474783848_18188957653314489_4657498483259380055_n.jpg";

// Strona główna: „Krótka historia” — zajawka (styl jak O mnie, wersja z 6.11.2026) i wejście do pełnej historii.
export default function ShortHistory({ label } = {}) {
  return (
    <section id="historia" className="border-t hairline bg-[#070708]">
      <div className="relative h-[42vh] md:h-[75vh] overflow-hidden">
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

      <div className="py-16 md:py-32 px-5 md:px-10">
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-4">{label || "KRÓTKA HISTORIA · 04"}</p>
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-8 md:mb-12">
            Byłem tam.<br />
            <span className="gold-text">I wróciłem. Inny.</span>
          </h2>

          <div className="grid md:grid-cols-5 gap-12 md:gap-16 items-start">
            <div className="md:col-span-3">
              <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-foreground/70">
                <p>Przez lata towarzyszyłem ludziom w ich najtrudniejszych chwilach.</p>
                <p>
                  Potem sam znalazłem się w miejscu, którego nie było na mojej mapie. Straciłem wiele z tego,
                  na czym opierałem swoje życie.
                </p>
                <p className="text-foreground/60">
                  W piosence „exmortis” zapisałem zdanie, które długo w sobie nosiłem:
                </p>
              </div>

              <blockquote className="border-l border-[#C9A24A] pl-6 md:pl-10 my-8 md:my-12 max-w-3xl">
                <p className="shop-heading text-2xl md:text-4xl gold-text leading-snug">
                  „Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie
                  zasadziłeś.”
                </p>
              </blockquote>

              <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-foreground/70">
                <p>Dziś jestem mężem i ojcem.</p>
                <p>O tym, co wydarzyło się pomiędzy, opowiadam w pełnej historii.</p>
              </div>

              <Link to="/o-mnie?src=home-historia" className="btn-ghost mt-8 md:mt-12">
                Przeczytaj całą historię <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Na telefonie bez drugiego zdjęcia — portret jest wyżej (krótsza strona główna, audyt X-37). */}
            <div className="hidden md:block md:col-span-2 border hairline mx-auto w-full" style={{ maxWidth: "min(100%, calc(min(72svh, 720px) * 0.75))" }}>
              <Image
                src={SIDE_PHOTO}
                alt="Dawid — exmortis"
                fittingType="fill"
                className="w-full aspect-[3/4]"
              />
              <p className="technical text-[10px] gold-text p-4 border-t hairline">
                DZIŚ · MĄŻ, OJCIEC, MENTOR
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}