import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";

// „Kto prowadzi" na stronie każdego spotkania — jak na stronie 1 listopada, w skrócie.
// Teksty i zdjęcie wyłącznie z zakładki „O mnie"; pełna historia pod linkiem.
const PHOTO = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/76a96cdf4_686174507_17893800810460401_1310148896120990981_n.jpg";

export default function WhoLeads() {
  return (
    <section
      aria-labelledby="kto-prowadzi"
      className="mt-10 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 sm:p-7"
    >
      <div className="grid items-start gap-6 sm:grid-cols-[140px_1fr]">
        {/* Przez komponent Image (przetworzony adres) — surowy adres pliku z media.base44.com zwraca 404. */}
        <div className="relative aspect-[4/5] w-28 overflow-hidden rounded-[var(--exm-r-field)] bg-exm-surface-2 sm:w-full">
          <Image src={PHOTO} alt="Dawid — exmortis" fittingType="fill" className="absolute inset-0 h-full w-full" />
        </div>
        <div className="min-w-0">
          <p className="exm-eyebrow mb-3">Kto prowadzi</p>
          <h2 id="kto-prowadzi" className="exm-h3">Byłem tam. I wróciłem. Inny.</h2>
          <p className="mt-4 leading-relaxed text-exm-muted">
            Nazywam się Dawid. Przez lata towarzyszyłem ludziom w trudnych chwilach, a potem sam znalazłem się w miejscu, którego nie było na mapie.
            Wracałem krok po kroku, bez skrótów. Dziś jestem szczęśliwym mężem i ojcem — i mentorem powrotu.
          </p>
          <p className="mt-3 leading-relaxed text-exm-muted">
            Nie jestem coachem ani terapeutą. Idę kawałek obok, bo szedłem tą drogą wcześniej. Zostawiam kompas, nie kierunek.
          </p>
          <Link to="/o-mnie" className="btn-link mt-4">
            Więcej o mnie <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}