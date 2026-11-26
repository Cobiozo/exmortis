import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Package } from "lucide-react";
import { zl } from "@/lib/productPrice";

// Składnik pakietu: ramka „W pakiecie taniej” (26.11.2026) — z czym, za ile i ile się oszczędza.
export default function InBundleLink({ product }) {
  const list = product?.in_packages;
  if (!list?.length) return null;
  return (
    <div className="mt-6 space-y-3">
      {list.map((b) => {
        const save = Number(b.save) || 0;
        const pct = Number(b.separately) > 0 ? Math.round((save / Number(b.separately)) * 100) : 0;
        const others = Array.isArray(b.others) ? b.others : [];
        return (
          <Link
            key={b.slug}
            to={`/skarbiec/${b.slug}`}
            className="group block rounded-[var(--exm-r-field)] border border-exm-gold-line bg-[#C9A24A]/[0.06] p-4 transition-colors hover:bg-[#C9A24A]/10"
          >
            <span className="flex items-start gap-3">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-exm-gold" strokeWidth={1.5} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="technical block text-[10px] text-exm-gold">
                  W PAKIECIE TANIEJ{save > 0 ? ` · OSZCZĘDZASZ ${zl(save).toUpperCase()}${pct ? ` (${pct}%)` : ""}` : ""}
                </span>
                <span className="mt-1 block text-[15px] text-exm-text [overflow-wrap:anywhere]">{b.name}</span>
                {others.length > 0 && (
                  <span className="mt-1 block text-[13px] leading-relaxed text-exm-muted">
                    Razem z: {others.join(", ")}
                  </span>
                )}
                <span className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
                  {Number(b.price) > 0 && <span className="text-exm-text">Pakiet {zl(b.price)}</span>}
                  {Number(b.separately) > 0 && <span className="text-exm-muted">osobno {zl(b.separately)}</span>}
                  <span className="inline-flex items-center gap-1 text-exm-gold group-hover:underline">
                    Zobacz pakiet <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
