import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, MessageSquare, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { track } from "@/lib/track";
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

// Wygląd od 17.11.2026: karty jak w Moim koncie (zaokrąglenie, cienka ramka, ikona, cena w etykiecie),
// trzecia droga wyróżniona złotą poświatą. Droga 01 prowadzi do /zacznij — test jest już w nagłówku strony.
const CARD = "rounded-2xl border hairline bg-[#111113] p-6 md:p-7 flex flex-col gap-4 min-w-0";
const BTN_LINE = "inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-[10px] border border-white/15 text-sm text-[#F5EFE1] hover:border-[#C9A24A]/60 transition-colors";
const BTN_GOLD = "inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-[10px] bg-[#C9A24A] text-[#0A0A0B] text-sm font-semibold hover:bg-[#E2C27A] transition-colors";

export default function StartPaths({ d = {}, label }) {
  const price = usePrices();
  const PATHS = [
    {
      cel: "bezplatnie", Icon: Sparkles, krok: "NA POCZĄTEK",
      tytul: "Zacznij bezpłatnie",
      opis: "Test autorefleksji, Minutnik ciszy, podcast i Listy powrotu. Bez zakładania konta.",
      chip: ["Bezpłatnie", "bg-[#4E8A5F]/20 text-[#9FD0AA]"],
      cta: [["Zobacz bezpłatne materiały", "/zacznij?src=home-start", BTN_LINE]],
    },
    {
      cel: "ksiazka", Icon: BookOpen, krok: "WE WŁASNYM TEMPIE",
      tytul: "Przeczytaj „Wracam inny”",
      opis: "Moja książka o utracie sensu, kryzysie tożsamości i odwadze życia inaczej. 228 stron w PDF.",
      chip: price.book ? [price.book, "bg-[#C9A24A]/15 text-[#E2C27A]"] : null,
      cta: [["Zobacz książkę", `/skarbiec/${BOOK}`, BTN_LINE]],
    },
    {
      cel: "rozmowa", Icon: MessageSquare, krok: "OSOBIŚCIE, 1:1", wyroznij: true,
      tytul: "Porozmawiaj ze mną",
      opis: [price.talk ? `Rozmowa na progu: 90 minut online, ${price.talk}.` : "Rozmowa na progu: 90 minut online.",
        `Mentoring POWRÓT: ${POWROT.months}, ${POWROT.sessionsWord}, ${POWROT.priceText}.`].join(" "),
      chip: price.talk ? [`od ${price.talk}`, "bg-[#C9A24A]/15 text-[#E2C27A]"] : null,
      cta: [["Poznaj POWRÓT", "/powrot", BTN_GOLD], ["Rozmowa na progu", `/skarbiec/${TALK}`, BTN_LINE]],
    },
  ];
  return (
    <section className="exm-soft py-16 md:py-24 px-4 sm:px-5 md:px-10 border-t hairline bg-[#0C0C0D]">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-6 mb-8 md:mb-10">
          <div>
            <p className="technical text-[11px] gold-text">{label || "OD CZEGO ZACZĄĆ"}</p>
            <h2 className="shop-heading text-[32px] md:text-[44px] leading-[1.1] text-[#F5EFE1] mt-2">{d.tytul || "Trzy drogi"}</h2>
          </div>
          <Link to="/zacznij?src=home" className="text-sm gold-text hover:underline underline-offset-4 inline-flex items-center gap-1 shrink-0">Wszystko bezpłatne <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid gap-4 md:gap-5 md:grid-cols-3 items-stretch">
          {PATHS.map((p, i) => (
            <article key={p.cel} className={`${CARD} ${p.wyroznij ? "!border-[#C9A24A]/40" : ""}`}
              style={p.wyroznij ? { background: "radial-gradient(120% 120% at 100% 0%, rgba(201,162,74,.14), #111113 60%)" } : undefined}>
              <div className="flex items-start justify-between gap-3">
                <span className={`h-[52px] w-[52px] shrink-0 rounded-xl border bg-[#0F0F10] flex items-center justify-center ${p.wyroznij ? "border-[#C9A24A]/45" : "hairline"}`} aria-hidden="true">
                  <p.Icon className="h-6 w-6 gold-text" strokeWidth={1.25} />
                </span>
                {p.chip && <span className={`inline-flex items-center h-7 px-3 rounded-full text-[13px] ${p.chip[1]}`}>{p.chip[0]}</span>}
              </div>
              <p className={`technical text-[10px] ${p.wyroznij ? "gold-text" : "text-[#F5EFE1]/60"}`}>{String(i + 1).padStart(2, "0")} · {p.krok}</p>
              <h3 className="shop-heading text-[26px] md:text-[28px] leading-[1.15] text-[#F5EFE1] -mt-2">{p.tytul}</h3>
              <p className="text-[15px] leading-relaxed text-[#F5EFE1]/70">{p.opis}</p>
              <div className={`mt-auto pt-2 grid gap-2 ${p.cta.length > 1 ? "grid-cols-2" : ""}`}>
                {p.cta.map(([t, to, cls]) => (
                  <Link key={to} to={to} onClick={() => track("home_start_click", { cel: p.cel, cta: t })} className={cls}>{t}</Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
