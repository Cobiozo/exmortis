// Pomiar reklam (Meta Pixel + GA4). Wartości są publiczne (nie sekrety) — trafiają do gościa
// razem z pozostałymi ustawieniami strony, bez dodatkowego zapytania.
export const POMIAR_DEFAULT = { wlaczony: false, pixel_id: "", ga4_id: "" };

// Odczyt publiczny: nigdy nie rzuca — niepoprawna wartość w bazie nie może przewrócić strony.
export function cleanPomiar(data) {
  const pixel = String(data?.pixel_id ?? "").trim();
  const ga4 = String(data?.ga4_id ?? "").trim().toUpperCase();
  return {
    wlaczony: !!data?.wlaczony,
    pixel_id: /^\d{6,20}$/.test(pixel) ? pixel : "",
    ga4_id: /^G-[A-Z0-9]{4,12}$/.test(ga4) ? ga4 : "",
  };
}

// Zapis z panelu: pilnuje formatów.
export function validatePomiar(data) {
  const out = cleanPomiar(data);
  const pixel = String(data?.pixel_id ?? "").trim();
  const ga4 = String(data?.ga4_id ?? "").trim();
  if (pixel && !out.pixel_id) throw new Error("Meta Pixel ID to same cyfry (np. 123456789012345).");
  if (ga4 && !out.ga4_id) throw new Error("GA4 Measurement ID ma postać G-XXXXXXXXXX.");
  return out;
}