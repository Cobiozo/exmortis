import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";

// „Kto prowadzi” na stronie każdego spotkania — jak na stronie 1 listopada, w skrócie.
// Teksty i zdjęcie wyłącznie z zakładki „O mnie”; pełna historia pod linkiem.
const PHOTO = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/76a96cdf4_686174507_17893800810460401_1310148896120990981_n.jpg";

export default function WhoLeads() {
  return (
    <section aria-labelledby="kto-prowadzi" className="mt-12 border hairline bg-[#0D0D0E] p-5 sm:p-7">
      <div className="grid gap-6 sm:grid-cols-[140px_1fr] items-start">
        {/* Przez komponent Image (przetworzony adres) — surowy adres pliku z media.base44.com zwraca 404. */}
        <div className="relative w-28 sm:w-full aspect-[4/5] overflow-hidden bg-[#070708]">
          <Image src={PHOTO} alt="Dawid — exmortis" fittingType="fill" className="absolute inset-0 w-full h-full" />
        </div>
        <div className="min-w-0">
          <p className="technical text-[10px] gold-text mb-3">KTO PROWADZI</p>
          <h2 id="kto-prowadzi" className="shop-heading text-2xl text-[#F5EFE1]">Byłem tam. I wróciłem. Inny.</h2>
          <p className="mt-4 text-foreground/70 leading-relaxed">
            Nazywam się Dawid. Przez lata towarzyszyłem ludziom w trudnych chwilach, a potem sam znalazłem się w miejscu, którego nie było na mapie.
            Wracałem krok po kroku, bez skrótów. Dziś jestem szczęśliwym mężem i ojcem — i mentorem powrotu.
          </p>
          <p className="mt-3 text-foreground/70 leading-relaxed">
            Nie jestem coachem ani terapeutą. Idę kawałek obok, bo szedłem tą drogą wcześniej. Zostawiam kompas, nie kierunek.
          </p>
          <Link to="/o-mnie" className="mt-5 inline-flex items-center gap-2 technical text-[11px] gold-text hover:underline">
            WIĘCEJ O MNIE <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
