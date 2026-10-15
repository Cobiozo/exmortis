import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Spotkania 1:1 pod listą spotkań: POWRÓT (mentoring, najpierw rozmowa) i „Rozmowa na progu” (płatna sesja,
// po opłaceniu wybór terminu w kalendarzu). Dane i cena z produktu w Skarbcu; ukryty produkt → bez karty.
const ITEMS = [
  { slug: "powrot-mentoring", label: "MENTORING 1:1", to: "/powrot", cta: "POZNAJ POWRÓT",
    name: "POWRÓT — mentoring 1:1", text: "Kilka miesięcy wspólnej drogi przez cztery etapy powrotu. Zaczynamy od bezpłatnej rozmowy.", note: "Nie przez koszyk. Najpierw rozmawiamy." },
  { slug: "rozmowa-na-progu", label: "POJEDYNCZE SPOTKANIE 1:1", cta: "ZOBACZ I UMÓW",
    name: "Rozmowa na progu", text: "Jedna sesja, jedna decyzja, pełna uwaga. 90 minut online.", note: "Po opłaceniu sam(a) wybierasz termin w kalendarzu." },
];

const zl = (n) => `${Number(n || 0).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`;

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
    <section className="px-5 md:px-10 pb-20 md:pb-24" aria-labelledby="one-on-one-h">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[10px] text-foreground/55 mb-3">JEDEN NA JEDEN</p>
        <h2 id="one-on-one-h" className="font-display text-2xl md:text-3xl text-[#F5EFE1] mb-8">Spotkania indywidualne</h2>
        <div className="grid gap-5 min-[641px]:grid-cols-2">
          {cards.map(({ p, ...c }) => {
            const to = c.to || `/skarbiec/${p.slug}`;
            const soon = p.status === "wkrótce";
            const paid = !p.is_free && Number(p.price) > 0 && c.slug !== "powrot-mentoring";
            return (
              <Link key={c.slug} to={to}
                className="group flex flex-col gap-4 border border-[#C9A24A]/30 bg-[#0D0D0E] p-6 md:p-8 transition-colors hover:border-[#C9A24A]/70 focus:outline-none focus-visible:border-[#C9A24A]">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="technical text-[9px] gold-text">{c.label}</span>
                  {soon && <span className="technical text-[9px] text-foreground/55 border border-[#3D3D3F] px-2 py-0.5">WKRÓTCE</span>}
                </div>
                <h3 className="shop-heading text-2xl text-[#F5EFE1] leading-snug">{p.name || c.name}</h3>
                <p className="text-foreground/75 leading-relaxed">{c.text}</p>
                <div className="mt-auto pt-5 border-t hairline flex flex-wrap items-end justify-between gap-4">
                  <div>
                    {paid && <p className="text-lg text-[#F5EFE1]">{zl(p.price)}</p>}
                    <p className="text-[11px] text-foreground/55">{c.note}</p>
                  </div>
                  <span className="technical text-[10px] gold-text inline-flex items-center gap-2">
                    {c.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
