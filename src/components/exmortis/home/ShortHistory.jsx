import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";

const PORTRAIT =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/74c8971f2_572398635_17869620246460401_6357932160691507676_n.jpg";

// To samo zdjęcie z posługi, co w sekcji „Krótka historia" na podstronie O mnie (prawdziwe, na hostingu strony).
const PRIEST_PHOTO = "/img/dawid-posluga.jpg";

// Strona główna: „Krótka historia” — zajawka (styl jak O mnie, wersja z 6.11.2026) i wejście do pełnej historii.
export default function ShortHistory({ label } = {}) {
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
          <p className="technical text-[11px] gold-text mb-4">{label || "KRÓTKA HISTORIA · 04"}</p>
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-12">
            Byłem tam.<br />
            <span className="gold-text">I wróciłem. Inny.</span>
          </h2>

          <div className="grid md:grid-cols-5 gap-12 md:gap-16 items-start">
            <div className="md:col-span-3">
              <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-foreground/70">
                <p>Byłem księdzem katolickim. Towarzyszyłem ludziom w ich najtrudniejszych chwilach.</p>
                <p>
                  Potem sam znalazłem się w miejscu, którego nie było na mojej mapie. Straciłem wiele z tego,
                  na czym opierałem swoje życie.
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
                <p>Dziś jestem mężem i ojcem.</p>
                <p>O tym, co wydarzyło się pomiędzy, opowiadam w pełnej historii.</p>
              </div>

              <Link to="/o-mnie?src=home-historia" className="btn-ghost mt-12">
                Przeczytaj całą historię <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="md:col-span-2 border hairline">
              <Image
                src={PRIEST_PHOTO}
                alt="Dawid podczas posługi kapłańskiej"
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