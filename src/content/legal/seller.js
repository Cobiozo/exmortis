// Dane Sprzedawcy — uzupełnij pola w nawiasach kwadratowych.
export const SELLER = {
  company: "[NAZWA FIRMY]",
  address: "[ADRES DZIAŁALNOŚCI]",
  nip: "[NIP]",
  email: "[E-MAIL KONTAKTOWY]",
  postal: "[ADRES DO KORESPONDENCJI]",
};
export const LEGAL_VERSION = "1.0";
export const LEGAL_FROM = "[DATA WEJŚCIA W ŻYCIE]";
export const COOKIES_VERSION = "1.0";

export const CLAUSE = (purpose) =>
  `Administratorem Twoich danych jest Exmortis. Przetwarzamy je, aby ${purpose}. Masz prawo dostępu do danych, ich poprawienia, usunięcia i wycofania zgody.`;

export const TXT = {
  terms: "Akceptuję Regulamin. Znam Politykę prywatności.",
  adult: "Mam ukończone 18 lat.",
  newsletter: "Chcę otrzymywać Listy powrotu — newsletter exmortis z treściami oraz informacjami o produktach i wydarzeniach — na podany adres e-mail. Zgodę mogę wycofać w każdej chwili.",
  service: "Żądam rozpoczęcia świadczenia usługi przed upływem 14 dni od zawarcia umowy. Przyjmuję do wiadomości, że jeśli odstąpię od umowy, zapłacę za część usługi wykonaną do chwili odstąpienia, a po pełnym wykonaniu usługi utracę prawo odstąpienia.",
};