// JEDYNE źródło adresu kanału WhatsApp na froncie (stopka, kontakt, Głos, potwierdzenia zapisu).
// Ten sam adres jest w mailach: base44/shared/emailLayout.ts oraz supabase/functions/_shared/emailLayout.ts
// (WHATSAPP_CHANNEL). Nadpisanie bez przebudowy: panel Treści stron → contact.whatsapp.
export const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbDYXi1Lo4hfFPvT3O3G";

// Pusty lub niepoprawny adres = kanał nie jest ustawiony → elementy WhatsApp się nie pokazują.
export const waChannel = (override) => {
  const url = String(override ?? WHATSAPP_CHANNEL).trim();
  return /^https:\/\/[^\s]+$/i.test(url) ? url : "";
};