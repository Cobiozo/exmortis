import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Stars } from "./Stars";

const plDate = (v) =>
  v ? new Date(v).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "";

// „1 opinia / 2 opinie / 5 opinii”.
const ile = (n) => (n === 1 ? "opinia" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "opinie" : "opinii");

// Sekcja „Opinie” na stronie produktu — pokazuje się dopiero, gdy jest co najmniej jedna opublikowana.
export default function ProductReviews({ productId }) {
  const [data, setData] = useState(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (!productId) return;
    base44.functions
      .invoke("reviews", { action: "product", product_id: productId })
      .then((r) => setData(r.data))
      .catch(() => setData({ reviews: [], count: 0, avg: null }));
  }, [productId]);

  if (!data || !data.count) return null;
  const list = data.reviews || [];
  const shown = all ? list : list.slice(0, 5);

  return (
    <section className="border-t hairline mt-16 pt-12">
      <p className="technical text-[10px] gold-text mb-5">OPINIE</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-10">
        <span className="font-mono text-3xl gold-text">{Number(data.avg || 0).toFixed(1).replace(".", ",")}</span>
        <Stars value={data.avg} className="gold-text" />
        <span className="technical text-[10px] text-foreground/55">
          {data.count} {ile(data.count)}
        </span>
      </div>

      <div className="divide-y divide-[#3D3D3F]/60 border-y hairline">
        {shown.map((r, i) => (
          <article key={i} className="py-6 space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[#F5EFE1]">{r.display_name}</span>
              <Stars value={r.rating} className="gold-text" />
              <span className="technical text-[9px] text-foreground/55">{plDate(r.published_at)}</span>
            </div>
            <p className="text-foreground/75 leading-relaxed whitespace-pre-line max-w-[70ch]">{r.body}</p>
            {r.reply && (
              <p className="border-l border-[#C9A24A]/60 pl-4 text-sm text-foreground/60 max-w-[70ch]">
                <span className="technical text-[9px] gold-text block mb-1">EXMORTIS</span>
                {r.reply}
              </p>
            )}
          </article>
        ))}
      </div>

      {!all && list.length > 5 && (
        <button onClick={() => setAll(true)} className="btn-ghost mt-8">
          POKAŻ WIĘCEJ ({list.length - 5})
        </button>
      )}

      <p className="text-xs text-foreground/55 leading-relaxed mt-10 max-w-[70ch]">
        Opinie publikujemy wyłącznie od osób, które kupiły produkt — sprawdzamy to po zamówieniu. Publikujemy
        opinie pozytywne i negatywne; nie płacimy za opinie.
      </p>
    </section>
  );
}