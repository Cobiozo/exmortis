import { TYPES, blockName } from "@/components/cms/blockTypes";

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const fieldLabel = (typ, k) => TYPES[typ]?.fields.find((f) => f.k === k)?.label || k;

// Lista różnic między dwiema wersjami bloków (przed → po).
export function blockDiff(before = [], after = []) {
  const out = [];
  const prev = new Map(before.map((b, i) => [b.id, { b, i }]));
  const nextIds = new Set(after.map((b) => b.id));
  before.forEach((b) => { if (!nextIds.has(b.id)) out.push({ typ: "usuniety", tekst: `Usunięto blok „${blockName(b)}”` }); });
  after.forEach((b, i) => {
    const p = prev.get(b.id);
    const name = `„${blockName(b)}”`;
    if (!p) return out.push({ typ: "dodany", tekst: `Dodano blok ${name} (pozycja ${i + 1})` });
    if (p.i !== i) out.push({ typ: "zmiana", tekst: `Przesunięto blok ${name}: pozycja ${p.i + 1} → ${i + 1}` });
    if ((p.b.widoczny !== false) !== (b.widoczny !== false)) out.push({ typ: "zmiana", tekst: `Blok ${name} jest teraz ${b.widoczny === false ? "ukryty" : "widoczny"}` });
    const keys = new Set([...Object.keys(p.b.dane || {}), ...Object.keys(b.dane || {})]);
    const changed = [...keys].filter((k) => !same(p.b.dane?.[k], b.dane?.[k])).map((k) => fieldLabel(b.typ, k));
    if (changed.length) out.push({ typ: "zmiana", tekst: `Blok ${name}: zmieniono ${changed.join(", ")}` });
    if (!same(p.b.uklad, b.uklad)) out.push({ typ: "zmiana", tekst: `Blok ${name}: zmieniono układ (tło, szerokość lub odstępy)` });
  });
  return out;
}