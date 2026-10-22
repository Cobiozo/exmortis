import { runSql, escStr } from "./supabase.ts";
import { loadAppUrl } from "./settings.ts";

// „Następny krok” po zakupie: najbliższy aktywny produkt drabiny (wyższy poziom), którego osoba jeszcze nie ma.
// Opis kroku = pole next_step kupionego produktu (gdy puste — podtytuł kolejnego).
export async function nextStep(base44, boughtIds, ownedIds = []) {
  const ids = [...new Set((boughtIds || []).filter(Boolean).map(String))];
  if (!ids.length) return null;
  const skip = [...new Set([...ids, ...(ownedIds || []).map(String)])].map(escStr).join(",");
  const rows = await runSql(base44, `
    WITH b AS (SELECT MAX(level) AS lvl, (array_agg(next_step ORDER BY level DESC NULLS LAST) FILTER (WHERE COALESCE(next_step,'') <> ''))[1] AS ns
               FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")}))
    SELECT p.name, p.slug, p.subtitle, b.ns FROM public.products p, b
    WHERE p.active = TRUE AND p.status IN ('dostępny','wkrótce') AND p.id::text NOT IN (${skip})
      AND p.level IS NOT NULL AND p.level > COALESCE(b.lvl, -1)
    ORDER BY p.level ASC, p.sort_order ASC NULLS LAST LIMIT 1`, true);
  const r = rows && rows[0];
  if (!r) return null;
  return { name: r.name, slug: r.slug, text: r.ns || r.subtitle || null };
}

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function nextStepHtml(base44, step) {
  if (!step) return "";
  const url = `${await loadAppUrl(base44)}/skarbiec/${encodeURIComponent(step.slug)}`;
  // Ciemna oprawa jak reszta maila — bez niej jasny tekst lądowałby na białym tle programu pocztowego.
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;"><div style="border-top:1px solid #3D3D3F;padding-top:20px;">
    <p style="font-size:11px;letter-spacing:.18em;color:#C9A24A;margin:0 0 8px;">NASTĘPNY KROK</p>
    ${step.text ? `<p style="line-height:1.7;color:#E2E2E2;margin:0 0 8px;">${esc(step.text)}</p>` : ""}
    <p style="margin:0;"><a href="${esc(url)}" style="color:#C9A24A;">${esc(step.name)} →</a></p></div></div>`;
}