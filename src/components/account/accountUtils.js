export const plDate = (ymd) =>
  new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

export const todayWarsaw = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });

export const daysLeft = (ymd) =>
  Math.round((new Date(`${ymd}T12:00:00Z`) - new Date(`${todayWarsaw()}T12:00:00Z`)) / 86400000);

export const TYPE_LABEL = { pdf: "PDF", audio: "Audio", wideo: "Wideo", kurs: "Kurs wideo", usluga: "Usługa" };

export const STATUS_LABEL = {
  COMPLETED: "Opłacone",
  PENDING: "Oczekuje",
  NEW: "Oczekuje",
  WAITING_FOR_CONFIRMATION: "Oczekuje",
  CANCELED: "Anulowane",
  REFUNDED: "Zwrócone",
  FREE: "Bezpłatne",
};

// „Dostęp: 12 miesięcy od zakupu” / „Dostęp: bezterminowy”.
export const accessLabel = (p) =>
  p.access_months ? `Dostęp: ${p.access_months} ${p.access_months === 1 ? "miesiąc" : p.access_months < 5 ? "miesiące" : "miesięcy"} od zakupu` : "Dostęp: bezterminowy";

// Pakiet składa się wyłącznie z treści cyfrowych — przy zakupie ta sama zgoda i informacja o dostępie.
export const isDigital = (p) => ["pdf", "audio", "wideo", "kurs", "pakiet"].includes(p?.product_type);