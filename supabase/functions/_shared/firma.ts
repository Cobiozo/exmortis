// Dane firmy i tryb przedpremierowy (app_settings: "firma", "premiera").
export const FIRMA_KEYS = ["nazwa", "osoba", "adres", "korespondencja", "nip", "regon", "email", "telefon"];
export const PREMIERA_DEFAULT = { do: "2026-11-01T20:30:00.000Z", wylaczony: false }; // 1.11.2026, 21:30 Europe/Warsaw

export function cleanFirma(data) {
  const out = {};
  for (const k of FIRMA_KEYS) out[k] = String(data?.[k] ?? "").trim().slice(0, 300);
  return out;
}

export function cleanPremiera(data) {
  const d = new Date(data?.do);
  if (isNaN(d.getTime())) throw new Error("Podaj poprawną datę i godzinę");
  const dostep = (Array.isArray(data?.dostep) ? data.dostep : []).slice(0, 50)
    .map((x) => ({ email: String(x?.email || "").trim().toLowerCase().slice(0, 200), do: new Date(x?.do).toISOString() }))
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email));
  return { do: d.toISOString(), wylaczony: !!data?.wylaczony, dostep };
}

// Linia do stopek e-maili — tylko wypełnione pola.
export function firmaFooter(f) {
  if (!f) return "";
  const parts = [f.nazwa, f.adres, f.nip && `NIP ${f.nip}`, f.regon && `REGON ${f.regon}`].filter(Boolean);
  return parts.length ? `<p style="font-size:11px;color:#8A8A8C;line-height:1.6;margin-top:24px;">${parts.join(", ")}</p>` : "";
}