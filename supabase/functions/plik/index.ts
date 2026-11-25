// Plik klienta pod adresem exmortis.pl (25.11.2026): /functions/plik?p=<kosz/ścieżka>&token=<podpis>[&d=<nazwa>]
// server.js przekazuje /functions/* tutaj, więc klient widzi tylko adres exmortis.pl — bez adresu magazynu.
// Funkcja niczego nie podpisuje sama: przyjmuje wyłącznie podpisany, krótko ważny token wydany przez accessFile.ts
// (magazyn sprawdza go i odrzuca nieważny), więc nie da się nią pobrać niczego poza plikiem z ważnego linku.
//  d — nazwa pliku: „zapisz jako” (attachment); bez d — otwarcie w przeglądarce (inline, np. czytnik PDF).
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");

const fail = (status: number, msg: string) =>
  new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

// Nazwa w nagłówku: wersja ASCII (stare przeglądarki) + pełna UTF-8 (RFC 5987).
const disposition = (kind: "inline" | "attachment", name: string) => {
  const clean = String(name || "plik").replace(/[\r\n"\\/]/g, " ").trim().slice(0, 150) || "plik";
  const ascii = clean.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").replace(/[^\x20-\x7E]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
};

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return fail(405, "Tylko pobieranie.");
  if (!SUPABASE_URL) return fail(502, "Brak konfiguracji.");
  const u = new URL(req.url);
  const p = u.searchParams.get("p") || "";
  const token = u.searchParams.get("token") || "";
  const d = u.searchParams.get("d") || "";
  if (!/^[A-Za-z0-9._\-/%]{3,500}$/.test(p) || p.includes("..") || !/^[A-Za-z0-9._-]{20,2000}$/.test(token)) {
    return fail(404, "Link jest nieprawidłowy albo wygasł. Wróć do Moich produktów albo do wiadomości z zamówienia i otwórz plik ponownie.");
  }
  const range = req.headers.get("range");
  let up: Response;
  try {
    up = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${p}?token=${encodeURIComponent(token)}`, {
      method: req.method, headers: range ? { range } : {}, signal: AbortSignal.timeout(55000),
    });
  } catch {
    return fail(502, "Nie udało się pobrać pliku. Spróbuj ponownie za chwilę.");
  }
  if (!up.ok && up.status !== 206) {
    await up.body?.cancel().catch(() => {});
    return fail(up.status === 400 || up.status === 403 || up.status === 404 ? 410 : 502,
      "Link do pliku wygasł. Wróć do Moich produktów albo do wiadomości z zamówienia i otwórz plik ponownie.");
  }
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" });
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = up.headers.get(h);
    if (v) headers.set(h, v);
  }
  const fileName = d || decodeURIComponent(p.split("/").pop() || "plik");
  headers.set("Content-Disposition", disposition(d ? "attachment" : "inline", fileName));
  return new Response(req.method === "HEAD" ? null : up.body, { status: up.status, headers });
});
