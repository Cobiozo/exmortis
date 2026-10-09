// Pomocnicze dla formularza ogłoszeń (czas lokalny przeglądarki = Europe/Warsaw w panelu).
export const EMPTY = { rodzaj: "ogloszenie", tytul: "", tresc: "", przycisk_napis: "", przycisk_link: "", odbiorcy: "wszyscy", cel_id: "", cel_nazwa: "", od: null, do: null, zamykalne: true, wazne: false };
export const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocal = (v) => (v ? new Date(v).toISOString() : null);
export const fmtPl = (iso) => (iso ? new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" }) : "");
export const INPUT = "w-full bg-[#0A0A0B] border border-[#3D3D3F] px-3 py-2.5 text-[#E2E2E2] focus:border-[#C9A24A] focus-visible:outline-none";
export const LABEL = "block technical text-[10px] text-foreground/60 mb-2";
export const STATUS_CLS = { Szkic: "text-foreground/50", Zaplanowane: "text-sky-300", Aktywne: "gold-text", "Zakończone": "text-foreground/40" };