// Rozróżnienie błędu walidacji (komunikat dla klienta, 400) od błędu serwera (odpowiedź
// generyczna, szczegóły tylko w logach — bez ujawniania nazw tabel/kolumn klientowi).
// Wzorzec przejęty z payuCreateOrder; walidatory w shared/supabase.ts znaczą błąd `isValidation`.
const VALIDATION_RE = /^(Brak pola|Pole .* jest zbyt długie|Niepoprawny adres e-mail|Zaakceptuj|Zaznacz|Koszyk jest pusty|Jeden z produktów|Nieprawidłowy kod|Kod |Kodem |Kwota zamówienia|Podaj |Niepoprawny NIP|Bilet:|Brak wolnych|Zostało tylko|Zbyt wiele prób|Ten materiał)/;

export function errorResponse(error: unknown, fallback: string) {
  const e = error as { message?: string; isValidation?: boolean } | null;
  const msg = String(e?.message || "");
  if (e?.isValidation === true || VALIDATION_RE.test(msg)) {
    return Response.json({ error: msg }, { status: 400 });
  }
  console.error("error:", msg);
  return Response.json({ error: fallback }, { status: 500 });
}