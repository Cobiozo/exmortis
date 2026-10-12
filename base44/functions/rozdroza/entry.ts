import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// ROZDROŻA dla zalogowanego klienta: tylko opublikowane, sprawdzone kopie historii (nigdy szkice).
// Biblioteka dostaje same metadane; pełny tekst — dopiero po otwarciu konkretnej historii.
// Historia z zaplanowaną datą (visible_from) jest niewidoczna do tej chwili — liczone zegarem serwera przy każdym zapytaniu.
// Wybory czytelnika nie trafiają na serwer.
let LIST = { at: 0, rows: [] };
const WEEK = 7 * 24 * 3600 * 1000;

async function published(base44) {
  if (Date.now() - LIST.at < 60000) return LIST.rows;
  const rows = await base44.asServiceRole.entities.RozdrozaStory.filter({ status: "published" }, "sort_order", 200);
  LIST = {
    at: Date.now(),
    rows: rows.filter((r) => r?.published?.meta && r?.published?.snapshot?.scenes && r.published.snapshot.start)
      .map((r) => ({ p: r.published, from: r.visible_from ? Date.parse(r.visible_from) || 0 : 0 })),
  };
  return LIST.rows;
}

// Widoczne teraz + data najbliższej zaplanowanej (bez tytułu — zapowiedź nie zdradza, co to będzie).
function visible(rows) {
  const now = Date.now();
  const items = rows.filter((r) => r.from <= now).map((r) => ({ ...r.p.meta, ...(r.from && now - r.from < WEEK ? { is_new: true } : {}) }));
  const next = rows.filter((r) => r.from > now).map((r) => r.from).sort((a, b) => a - b)[0];
  return { items, next_at: next ? new Date(next).toISOString() : null };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się, żeby czytać ROZDROŻA." }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "Konto nieaktywne." }, { status: 403 });
    const body = await req.json().catch(() => ({}));

    // Podgląd administratora „jak klient”: te same dane i widok, plus historie zaplanowane (z datą publikacji).
    const adminPreview = body.preview === true && me.role === "admin";

    if (body.action === "list") {
      const rows = await published(base44);
      if (!adminPreview) return Response.json(visible(rows));
      const now = Date.now();
      const v = visible(rows);
      return Response.json({ ...v, items: rows.map((r) => ({ ...r.p.meta, ...(r.from > now ? { scheduled_at: new Date(r.from).toISOString() } : r.from && now - r.from < WEEK ? { is_new: true } : {}) })) });
    }

    if (body.action === "story") {
      const slug = String(body.slug || "").slice(0, 80);
      const r = (await published(base44)).find((x) => x.p.meta.slug === slug);
      if (!r || (r.from > Date.now() && !adminPreview)) return Response.json({ error: "Ta historia nie jest dostępna." }, { status: 404 });
      const p = r.p;
      // Czytnik ma już tę wersję w pamięci przeglądarki → bez ponownego przesyłania tekstu.
      if (Number(body.have) && Number(body.have) === Number(p.meta.version)) return Response.json({ meta: p.meta, same: true });
      return Response.json({ meta: p.meta, snapshot: p.snapshot });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    console.error("rozdroza", error?.message);
    return Response.json({ error: "Nie udało się wczytać ROZDROŻY. Spróbuj za chwilę." }, { status: 500 });
  }
}
