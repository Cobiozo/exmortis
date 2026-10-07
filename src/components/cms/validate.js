import { TYPES, blockName } from "./blockTypes";
import { linkError } from "./links";

const strip = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();

// Walidacja przed publikacją: errors blokują publikację, warnings tylko ostrzegają.
export function validatePage(blocks, extraPaths = []) {
  const errors = [], warnings = [];
  const live = blocks.filter((b) => b.widoczny !== false);
  const heroes = live.filter((b) => b.typ === "hero").length;
  if (heroes !== 1) errors.push(heroes ? "Strona ma więcej niż jeden nagłówek strony (H1) — zostaw jeden." : "Strona nie ma bloku „Nagłówek strony” (H1).");

  for (const b of live) {
    const name = `„${blockName(b)}”`;
    const d = b.dane || {};
    const def = TYPES[b.typ];
    const check = (fields, data) => {
      for (const f of fields) {
        const v = data[f.k];
        if (f.typ === "image" && !f.noAlt && v?.url && !strip(v.alt)) errors.push(`${name}: obraz bez opisu alt.`);
        if (f.typ === "buttons") (v || []).forEach((btn) => {
          if (!strip(btn.etykieta)) errors.push(`${name}: przycisk bez etykiety.`);
          const e = linkError(btn.link, extraPaths);
          if (e) errors.push(`${name}: przycisk „${btn.etykieta || "?"}” — ${e}.`);
        });
        if (f.max && typeof v === "string" && v.replace(/\n/g, "").length > f.max) warnings.push(`${name}: ${f.label.split(" (")[0]} ma ${v.length} znaków (zalecane do ${f.max}).`);
        if (f.typ === "items") (v || []).forEach((it) => check(f.sub, it));
      }
    };
    check(def.fields, d);
    const hasContent = def.fields.some((f) => { const v = d[f.k]; return Array.isArray(v) ? v.length : typeof v === "object" ? v?.url : strip(v); });
    if (!hasContent) warnings.push(`${name}: blok jest pusty.`);
  }
  return { errors, warnings };
}