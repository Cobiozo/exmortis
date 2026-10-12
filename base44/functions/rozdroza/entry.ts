import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// ROZDROŻA dla zalogowanego klienta: tylko opublikowane, sprawdzone kopie historii (nigdy szkice).
// Biblioteka dostaje same metadane; pełny tekst — dopiero po otwarciu konkretnej historii.
// Wybory czytelnika nie trafiają na serwer.
let LIST = { at: 0, items: [], full: new Map() };

async function published(base44) {
  if (Date.now() - LIST.at < 60000) return LIST;
  const rows = await base44.asServiceRole.entities.RozdrozaStory.filter({ status: "published" }, "sort_order", 200);
  const ok = rows.filter((r) => r?.published?.meta && r?.published?.snapshot?.scenes && r.published.snapshot.start);
  LIST = {
    at: Date.now(),
    items: ok.map((r) => r.published.meta),
    full: new Map(ok.map((r) => [r.published.meta.slug, r.published])),
  };
  return LIST;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się, żeby czytać ROZDROŻA." }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "Konto nieaktywne." }, { status: 403 });
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const l = await published(base44);
      return Response.json({ items: l.items });
    }

    if (body.action === "story") {
      const slug = String(body.slug || "").slice(0, 80);
      const l = await published(base44);
      const p = l.full.get(slug);
      if (!p) return Response.json({ error: "Ta historia nie jest dostępna." }, { status: 404 });
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
