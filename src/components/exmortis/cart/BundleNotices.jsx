import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Package } from "lucide-react";
import { useCart, lineKey } from "../CartContext";
import { unitPrice, zl } from "@/lib/productPrice";

// Pakiety w koszyku (26.11.2026):
// 1) produkt, który jest już w pakiecie z koszyka → komunikat i „Usuń z koszyka” (kasa i tak nie przyjmie podwójnej płatności);
// 2) dwa pakiety ze wspólnymi produktami → komunikat;
// 3) w koszyku ≥ 2 produkty z jednego pakietu → podpowiedź „w pakiecie taniej” i „Zamień na pakiet”.
let catalogPromise = null;
const loadCatalog = () => {
  if (!catalogPromise) {
    catalogPromise = base44.functions
      .invoke("shopProducts", {})
      .then((r) => r.data?.products || [])
      .catch(() => {
        catalogPromise = null;
        return [];
      });
  }
  return catalogPromise;
};

const plain = (i) => !i.kind && !i.gift;
// Nazwa w cudzysłowie bez podwójnych cudzysłowów („"Kiedy wreszcie...?"” → „Kiedy wreszcie...?”).
const q = (s) => `„${String(s || "").trim().replace(/^["„“”']+|["„“”']+$/g, "")}”`;

export default function BundleNotices({ className = "" }) {
  const { items, removeItem, addItem } = useCart();
  const [catalog, setCatalog] = useState([]);
  const hasCandidates = items.filter(plain).length >= 2 || items.some((i) => i.product_type === "pakiet");

  useEffect(() => {
    if (!hasCandidates) return undefined;
    let live = true;
    loadCatalog().then((list) => live && setCatalog(list));
    return () => { live = false; };
  }, [hasCandidates]);

  if (!hasCandidates) return null;

  const pkgs = catalog.filter((p) => p.product_type === "pakiet" && p.status !== "wkrótce" && p.bundle?.items?.length);
  const pkgById = new Map(pkgs.map((p) => [String(p.id), p]));
  const idsOf = (line) => (Array.isArray(line.bundle_ids) ? line.bundle_ids : pkgById.get(String(line.id))?.bundle?.items?.map((c) => String(c.id)) || []);

  const pkgLines = items.filter((i) => plain(i) && i.product_type === "pakiet");
  const conflicts = [];
  for (const pl of pkgLines) {
    const ids = idsOf(pl);
    for (const line of items.filter((i) => plain(i) && i.product_type !== "pakiet" && ids.includes(String(i.id)))) {
      conflicts.push({ line, pkg: pl });
    }
  }
  const overlaps = [];
  for (let a = 0; a < pkgLines.length; a++) {
    for (let b = a + 1; b < pkgLines.length; b++) {
      if (idsOf(pkgLines[a]).some((x) => idsOf(pkgLines[b]).includes(x))) overlaps.push([pkgLines[a], pkgLines[b]]);
    }
  }

  // Podpowiedź: najkorzystniejszy pakiet, z którego w koszyku są co najmniej 2 produkty (i którego jeszcze nie ma w koszyku).
  const inCart = new Set(items.filter(plain).map((i) => String(i.id)));
  let best = null;
  for (const p of pkgs) {
    if (inCart.has(String(p.id))) continue;
    const ids = p.bundle.items.map((c) => String(c.id));
    const lines = items.filter((i) => plain(i) && ids.includes(String(i.id)));
    if (lines.length < 2) continue;
    const cartSum = lines.reduce((s, i) => s + i.price * i.qty, 0);
    const price = unitPrice(p);
    const diff = Math.round((price - cartSum) * 100) / 100;
    const missing = p.bundle.items.filter((c) => !inCart.has(String(c.id)));
    if (diff >= 0 && !missing.length) continue;
    const score = diff < 0 ? -diff + 10000 : Number(p.bundle.save) || 0;
    if (!best || score > best.score) best = { p, lines, diff, missing, score };
  }

  if (!conflicts.length && !overlaps.length && !best) return null;

  const swap = () => {
    for (const l of best.lines) removeItem(lineKey(l));
    addItem(best.p, 1);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {conflicts.map(({ line, pkg }) => (
        <div key={`c-${lineKey(line)}`} role="alert" className="rounded-[var(--exm-r-field)] border border-[#E8C547]/40 px-4 py-3 text-[13px] leading-relaxed text-[#E8C547]">
          <p className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{q(line.name)} jest już w pakiecie {q(pkg.name)}. Usuń go z koszyka — zapłacisz tylko raz.</span>
          </p>
          <button type="button" onClick={() => removeItem(lineKey(line))} className="mt-2 font-medium underline underline-offset-4">
            Usuń z koszyka
          </button>
        </div>
      ))}
      {overlaps.map(([a, b]) => (
        <p key={`o-${a.id}-${b.id}`} role="alert" className="flex gap-2 rounded-[var(--exm-r-field)] border border-[#E8C547]/40 px-4 py-3 text-[13px] leading-relaxed text-[#E8C547]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Pakiety {q(a.name)} i {q(b.name)} mają wspólne produkty. Zostaw jeden z nich.</span>
        </p>
      ))}
      {best && !conflicts.length && (
        <div className="rounded-[var(--exm-r-field)] border border-exm-gold-line bg-[#C9A24A]/[0.06] px-4 py-3 text-[13px] leading-relaxed text-exm-text">
          <p className="flex gap-2">
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-exm-gold" strokeWidth={1.5} aria-hidden="true" />
            <span>
              {best.diff < 0 ? (
                <>
                  Masz w koszyku {best.lines.map((l) => q(l.name)).join(" i ")}. W pakiecie {q(best.p.name)} zapłacisz o{" "}
                  <span className="text-exm-gold">{zl(-best.diff)} mniej</span>
                  {best.missing.length ? <> i dostaniesz jeszcze: {best.missing.map((c) => c.name).join(", ")}</> : null}.
                </>
              ) : (
                <>
                  Za {zl(best.diff)} więcej dostaniesz cały pakiet {q(best.p.name)} — także: {best.missing.map((c) => c.name).join(", ")}.
                </>
              )}
            </span>
          </p>
          <button type="button" onClick={swap} className="mt-2 font-medium text-exm-gold underline underline-offset-4">
            Zamień na pakiet ({zl(unitPrice(best.p))})
          </button>
        </div>
      )}
    </div>
  );
}
