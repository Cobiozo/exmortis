import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import { zl } from "@/lib/productPrice";

// Spotkania 1:1 pod listą spotkań: POWRÓT (mentoring, najpierw rozmowa) i „Rozmowa na progu" (płatna sesja,
// po opłaceniu wybór terminu w kalendarzu). Dane i cena z produktu w Skarbcu; ukryty produkt → bez karty.
const ITEMS = [
  { slug: "powrot-mentoring", label: "MENTORING 1:1", to: "/powrot", cta: "Poznaj POWRÓT",
    name: "POWRÓT — mentoring 1:1", text: "", note: "Nie przez koszyk. Najpierw rozmawiamy." },
  { slug: "rozmowa-na-progu", label: "POJEDYNCZE SPOTKANIE 1:1", cta: "ZOBACZ I UMÓW",
    name: "Rozmowa na progu", text: "", note: "Po opłaceniu wybierasz termin w kalendarzu." },
];

export default function OneOnOne() {
  const [prods, setProds] = useState(null);
  useEffect(() => {
    let off = false;
    Promise.all(ITEMS.map((i) => base44.functions.invoke("shopProducts", { slug: i.slug })
      .then((r) => r.data?.products?.[0] || null).catch(() => null)))
      .then((list) => { if (!off) setProds(list); });
    return () => { off = true; };
  }, []);
  if (!prods) return null;
  const cards = ITEMS.map((it, i) => ({ ...it, p: prods[i] })).filter((c) => c.p && c.p.active !== false);
  if (!cards.length) return null;

  return (
    <Section aria-labelledby="one-on-one-h">
      <Container>
        {/* Wąski pas: dwie karty-linki, żeby nie przesłaniały otwartych spotkań. */}
        <div className="mx-auto max-w-[900px]">
          <p className="exm-eyebrow mb-3">Jeden na jeden</p>
          <h2 id="one-on-one-h" className="exm-h2">Spotkania indywidualne</h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {cards.map(({ p, ...c }) => {
              const to = c.to || `/skarbiec/${p.slug}`;
              const soon = p.status === "wkrótce";
              // Zapowiedź: bez ceny i bez „po opłaceniu" — tak samo jak karta w Skarbcu i strona usługi.
              const paid = !soon && !p.is_free && Number(p.price) > 0 && c.slug !== "powrot-mentoring";
              const note = soon
                ? "Zapisy jeszcze nie ruszyły. Zostaw adres — dam znać, gdy będzie można umówić termin."
                : c.note;
              const cta = soon ? "Powiadom mnie o dostępności" : c.cta;
              return (
                <Link
                  key={c.slug}
                  to={to}
                  className="group flex min-w-0 flex-col gap-3 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 transition-colors hover:border-exm-gold-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-exm-gold md:p-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="exm-eyebrow">{c.label}</span>
                    {soon && (
                      <span className="technical rounded-exm-pill border border-exm-line px-2.5 py-1 text-[10px] text-exm-muted">
                        Wkrótce
                      </span>
                    )}
                  </div>
                  <h3 className="exm-h3 break-words">{p.name || c.name}</h3>
                  {p.promise && <p className="text-[15px] leading-relaxed text-exm-muted">{p.promise}</p>}
                  {p.format_details && (
                    <p className="technical text-[10px] text-exm-muted">{String(p.format_details)}</p>
                  )}

                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-exm-line pt-4">
                    <div className="min-w-0">
                      {paid && <p className="text-[17px] text-exm-ivory">{zl(p.price)}</p>}
                      <p className="text-[12px] leading-relaxed text-exm-muted">{note}</p>
                    </div>
                    <span className="technical inline-flex items-center gap-2 text-[10px] text-exm-gold">
                      {cta}
                      <ArrowRight className="h-4 w-4 transition-transform motion-reduce:transition-none group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
}