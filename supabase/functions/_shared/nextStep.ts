import { runSql, escStr } from "./supabase.ts";
import { loadAppUrl } from "./settings.ts";

// „Następny krok” po zakupie: najbliższy produkt drabiny (wyższy poziom), który można już kupić i którego osoba jeszcze nie ma.
// Produkty „wkrótce” są pomijane — nie kierujemy do czegoś, czego jeszcze nie ma.
// Opis kroku = pole next_step kupionego produktu tylko wtedy, gdy mówi o tym samym produkcie; inaczej podtytuł kolejnego.
// Gdy na drabinie nie ma nic dostępnego: zachęta do bezpłatnego podcastu (i Skarbca w mailu).
const FALLBACK_TEXT = "Zanim zaczniesz czytać, posłuchaj, jak wyglądają powroty innych. Podcast exmortis jest za darmo.";
const norm = (s: unknown) => String(s || "").toLowerCase().replace(/[„”"«»]/g, "").replace(/\s+/g, " ").trim();

async function podcastStep(base44) {
  const rows = await runSql(base44, `SELECT name, slug FROM public.products
    WHERE active = TRUE AND COALESCE(status, 'dostępny') = 'dostępny' AND name ILIKE 'Podcast%' AND COALESCE(slug, '') <> ''
    ORDER BY sort_order ASC NULLS LAST LIMIT 1`, true).catch(() => []);
  const r = rows && rows[0];
  return r ? { name: r.name, slug: r.slug, text: FALLBACK_TEXT, fallback: true } : null;
}

export async function nextStep(base44, boughtIds, ownedIds = []) {
  const ids = [...new Set((boughtIds || []).filter(Boolean).map(String))];
  if (!ids.length) return null;
  const skip = [...new Set([...ids, ...(ownedIds || []).map(String)])].map(escStr).join(",");
  const rows = await runSql(base44, `
    WITH b AS (SELECT MAX(level) AS lvl, (array_agg(next_step ORDER BY level DESC NULLS LAST) FILTER (WHERE COALESCE(next_step,'') <> ''))[1] AS ns
               FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")}))
    SELECT p.name, p.slug, p.subtitle, b.ns FROM public.products p, b
    WHERE p.active = TRUE AND COALESCE(p.status, 'dostępny') = 'dostępny' AND p.id::text NOT IN (${skip})
      AND p.level IS NOT NULL AND p.level > COALESCE(b.lvl, -1)
    ORDER BY p.level ASC, p.sort_order ASC NULLS LAST LIMIT 1`, true);
  const r = rows && rows[0];
  if (!r) return await podcastStep(base44);
  // Tekst z ustawień kupionego produktu tylko, gdy wymienia produkt, do którego prowadzi przycisk.
  const ns = r.ns && norm(r.ns).includes(norm(r.name)) ? r.ns : null;
  return { name: r.name, slug: r.slug, text: ns || r.subtitle || null };
}

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function nextStepHtml(base44, step) {
  if (!step) return "";
  const site = await loadAppUrl(base44);
  const url = `${site}/skarbiec/${encodeURIComponent(step.slug)}`;
  const label = step.fallback ? "Posłuchaj podcastu" : step.name;
  const extra = step.fallback
    ? `<p style="margin:12px 0 0;line-height:1.7;color:#9A9A9A;font-size:14px;">W Skarbcu znajdziesz też bezpłatne materiały na start — <a href="${esc(`${site}/skarbiec`)}" style="color:#C9A24A;">zajrzyj do Skarbca</a>.</p>`
    : "";
  // Ciemna oprawa jak reszta maila — bez niej jasny tekst lądowałby na białym tle programu pocztowego.
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;"><div style="border-top:1px solid #3D3D3F;padding-top:20px;">
    <p style="font-size:11px;letter-spacing:.18em;color:#C9A24A;margin:0 0 8px;">NASTĘPNY KROK</p>
    ${step.text ? `<p style="line-height:1.7;color:#E2E2E2;margin:0 0 8px;">${esc(step.text)}</p>` : ""}
    <p style="margin:0;"><a href="${esc(url)}" style="color:#C9A24A;">${esc(label)} →</a></p>${extra}</div></div>`;
}
