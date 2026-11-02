// Blok kanału WhatsApp na stronie GŁOS wchodzi KODEM (jak sekcja ROZDROŻA na stronie głównej),
// więc rekord CMS strony „glos" zostaje bez zmian. Jeśli administrator doda blok modułu
// „whatsapp_glos" sam, wstrzyknięcie się wyłącza (bez duplikatu).

export const GLOS_WHATSAPP_BLOCK = {
  id: "glos-whatsapp",
  typ: "modul",
  widoczny: true,
  dane: { modul: "whatsapp_glos" },
  uklad: { szerokosc: "standard", wyrownanie: "lewo", tlo: "czern", odstep: "duzy", numer: "brak", urzadzenia: "wszedzie" },
};

// Moduły, po których ma stać blok: muzyka i podcasty.
const PO = ["muzyka", "podcast", "podcast_gosc"];
const isWa = (b) => b.id === "glos-whatsapp" || (b.typ === "modul" && b.dane?.modul === "whatsapp_glos");

export function withGlosWhatsapp(blocks) {
  if (!Array.isArray(blocks) || blocks.some(isWa)) return blocks;
  let last = -1;
  blocks.forEach((b, i) => { if (b.typ === "modul" && PO.includes(b.dane?.modul)) last = i; });
  if (last < 0) return [...blocks, GLOS_WHATSAPP_BLOCK];
  return [...blocks.slice(0, last + 1), GLOS_WHATSAPP_BLOCK, ...blocks.slice(last + 1)];
}