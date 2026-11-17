import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { track } from "@/lib/track";
import { SectionHead } from "@/components/cms/parts";
import { unitPrice, kwota, priceOnRequest } from "@/lib/productPrice";
import { POWROT } from "@/lib/powrotOffer";

// „Trzy drogi” (audyt 17.11.2026, X-18): bezpłatnie · książka · rozmowa i mentoring — z cenami pobieranymi
// z tego samego źródła co Skarbiec (shopProducts), żeby nigdy nie rozjechały się z kasą.
// Kliknięcie wysyła zdarzenie z parametrem `cel` (bez danych osobowych).
const BOOK = "wracam-inny";
const TALK = "rozmowa-na-progu";

function usePrices() {
  const [p, setP] = useState({});
  useEffect(() => {
    let live = true;
    base44.functions.invoke("shopProducts", {})
      .then((r) => {
        if (!live) return;
        const list = r?.data?.products || [];
        const price = (slug) => {
          const x = list.find((q) => q.slug === slug);
          return x && !priceOnRequest(x) && unitPrice(x) > 0 ? `${kwota(unitPrice(x))} zł` : "";
        };
        setP({ book: price(BOOK), talk: price(TALK) });
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return p;
}

export default function StartPaths({ d = {}, label }) {
  const price = usePrices();
  const PATHS = [
    {
      cel: "bezplatnie",
      tytul: "Zacznij bezpłatnie",
      opis: "Test autorefleksji (około 3 minut), Minutnik ciszy, podcast i Listy powrotu. Bez zakładania konta.",
      cena: "Bezpłatnie",
      cta: "ZRÓB TEST",
      to: "/test?src=home-start",
      extra: [["Listy powrotu", "/#listy-powrotu"], ["Spotkania online", "/spotkania"], ["Wszystko bezpłatne", "/zacznij?src=home"]],
    },
    {
      cel: "ksiazka",
      tytul: "Przeczytaj „Wracam inny”",
      opis: "Moja książka o utracie sensu, kryzysie tożsamości i odwadze życia inaczej. PDF do czytania we własnym tempie.",
      cena: price.book,
      cta: "ZOBACZ KSIĄŻKĘ",
      to: `/skarbiec/${BOOK}`,
    },
    {
      cel: "rozmowa",
      tytul: "Porozmawiaj ze mną",
      opis: `Jedna rozmowa 90 minut online albo mentoring 1:1 POWRÓT: ${POWROT.months}, ${POWROT.sessionsWord}.`,
      cena: [price.talk && `Rozmowa: ${price.talk}`, `POWRÓT: ${POWROT.priceText}`].filter(Boolean).join(" · "),
      cta: "POZNAJ POWRÓT",
      to: "/powrot",
      extra: [["Rozmowa na progu", `/skarbiec/${TALK}`]],
    },
  ];
  return (
    <section className="py-16 md:py-32 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1400px]">
        <SectionHead label={label || "OD CZEGO ZACZĄĆ"} title={d.tytul || "Trzy drogi"} />
        <div className="grid gap-4 md:gap-6 md:grid-cols-3 items-stretch">
          {PATHS.map((p, i) => (
            <div key={p.cel} className="flex flex-col border hairline bg-[#070708] p-6 md:p-8">
              <p className="technical text-[11px] gold-text mb-4 md:mb-6">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="relic-heading text-2xl md:text-3xl leading-[0.98] mb-4">{p.tytul}</h3>
              <p className="text-foreground/70 leading-relaxed mb-4 flex-1">{p.opis}</p>
              <p className="font-mono text-sm gold-text mb-6 min-h-[1.25rem]">{p.cena}</p>
              <Link
                to={p.to}
                onClick={() => track("home_start_click", { cel: p.cel })}
                className="btn-ghost w-full justify-center"
              >
                {p.cta} <ArrowRight className="h-4 w-4" />
              </Link>
              {p.extra && (
                <p className="mt-4 text-sm text-foreground/60">
                  {p.extra.map(([t, to], k) => (
                    <React.Fragment key={to}>
                      {k > 0 && " · "}
                      <Link to={to} className="underline underline-offset-4 hover:text-[#C9A24A]">{t}</Link>
                    </React.Fragment>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
