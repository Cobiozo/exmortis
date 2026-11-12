// Umowa o udział w programie POWRÓT — wzór z 13.11.2026 (projekt do akceptacji właściciela).
// Parametry programu zgodne z src/lib/powrotOffer.js; dane firmy w nawiasach wstawia src/lib/firma.js,
// Numer wersji nadaje archiwum (Ustawienia → Dokumenty prawne → Zapisz).
// Klient dostaje tę umowę razem z osobistym linkiem do płatności (przed zapłatą) i w potwierdzeniu płatności.
export const UMOWA_POWROT = {
  title: "Umowa o udział w programie POWRÓT",
  sections: [
    { id: "u1", title: "§1. Strony i pojęcia", body: [
      "1. Umowę zawierają: [IMIĘ I NAZWISKO], prowadzący działalność gospodarczą pod firmą [NAZWA FIRMY], NIP [NIP], REGON [REGON], adres do korespondencji: [ADRES DO KORESPONDENCJI], e-mail [E-MAIL KONTAKTOWY], telefon [TELEFON] (dalej: „Mentor”), oraz osoba, która opłaca udział w programie przez osobisty link do płatności i której imię, nazwisko i adres e-mail są wskazane w zamówieniu (dalej: „Uczestnik”).",
      "2. Program — program mentoringowy POWRÓT opisany w §3. Sesja — indywidualne spotkanie Mentora z Uczestnikiem w ramach Programu. Link do płatności — osobisty adres strony płatności wysłany Uczestnikowi przez Mentora po rozmowie kwalifikacyjnej. Regulamin — Regulamin serwisu i sklepu exmortis.pl.",
      "3. W sprawach nieuregulowanych Umową stosuje się Regulamin. Jeśli Umowa i Regulamin regulują tę samą sprawę inaczej, stosuje się postanowienie korzystniejsze dla Uczestnika.",
    ]},
    { id: "u2", title: "§2. Zawarcie Umowy", body: [
      "1. Udział w Programie poprzedza zgłoszenie i bezpłatna rozmowa kwalifikacyjna. Ani zgłoszenie, ani rozmowa nie zobowiązują do zakupu.",
      "2. Po rozmowie, jeśli obie strony chcą współpracy, Mentor wysyła Uczestnikowi na podany adres e-mail Link do płatności, treść Umowy i Regulamin. Link jest osobisty i ważny przez termin podany w wiadomości.",
      "3. Umowa zostaje zawarta z chwilą złożenia zamówienia na stronie płatności (przycisk „Zamawiam z obowiązkiem zapłaty”), po akceptacji Umowy i Regulaminu. Potwierdzenie zawarcia Umowy, z jej treścią, Uczestnik otrzymuje e-mailem.",
      "4. Uczestnikiem może być wyłącznie osoba pełnoletnia.",
    ]},
    { id: "u3", title: "§3. Przedmiot Umowy", body: [
      "1. Mentor prowadzi dla Uczestnika Program obejmujący: osiem Sesji indywidualnych (1:1) po 90 minut, online przez platformę Zoom, zwykle co 2–3 tygodnie, w czterech etapach (Śmierć, Próg, Powrót, Inny).",
      "2. W ramach Programu Uczestnik otrzymuje także: osobistą Mapę powrotu (powstaje w pierwszej Sesji), narzędzia pracy do każdej Sesji, dziennik powrotu z zadaniami między Sesjami, kontakt z Mentorem między Sesjami (wiadomości tekstowe i głosowe) w zakresie i godzinach ustalonych na pierwszej Sesji, osobisty plan na czas po Programie oraz dostęp do zamkniętej ścieżki „Listów powrotu” dla uczestników Programu.",
      "3. Program trwa zwykle 4–6 miesięcy. Termin pierwszej Sesji strony ustalają po zawarciu Umowy, a kolejne — w trakcie Programu, uwzględniając możliwości obu stron.",
      "4. Wszystkie Sesje powinny odbyć się w ciągu 8 miesięcy od pierwszej Sesji. Termin ten wydłuża się o czas przerw uzgodnionych przez strony oraz przerw z przyczyn leżących po stronie Mentora lub z przyczyn niezależnych od Uczestnika (np. choroba).",
      "5. Do udziału w Sesjach Uczestnik potrzebuje urządzenia z dostępem do internetu, kamerą i mikrofonem oraz aktualnej przeglądarki albo aplikacji Zoom. Link do Sesji Mentor przekazuje e-mailem albo w wiadomości.",
    ]},
    { id: "u4", title: "§4. Charakter Programu i bezpieczeństwo", body: [
      "1. Program jest mentoringiem rozwojowym. Nie jest psychoterapią, leczeniem ani poradnictwem medycznym. Mentor nie stawia diagnoz i nie zastępuje pomocy lekarza, psychologa ani psychoterapeuty.",
      "2. Uczestnik oświadcza, że według swojej najlepszej wiedzy nie jest w ostrym kryzysie psychicznym wymagającym pilnej pomocy specjalisty. Jeśli w trakcie Programu jego sytuacja się zmieni, poinformuje o tym Mentora.",
      "3. W sytuacji zagrożenia życia lub zdrowia Uczestnik dzwoni pod numer 112. Wsparcie w kryzysie: 116 123 oraz 800 70 2222 (całodobowo, bezpłatnie).",
      "4. Jeśli Mentor uzna, że Uczestnik potrzebuje najpierw pomocy specjalisty, może zaproponować przerwę albo zakończenie Programu. Uczestnik otrzymuje wtedy zwrot zgodnie z §8 ust. 2.",
    ]},
    { id: "u5", title: "§5. Cena i płatność", body: [
      "1. Cena Programu jest podana w Linku do płatności i na stronie płatności przed złożeniem zamówienia. Cena jest ceną końcową — Mentor korzysta ze zwolnienia z VAT (art. 113 ust. 1 ustawy o VAT).",
      "2. Płatność jest jednorazowa, z góry, za pośrednictwem operatora płatności PayU S.A., metodami dostępnymi na stronie PayU.",
      "3. Uczestnik może wybrać płatność odroczoną albo w ratach PayPo, jeśli PayPo udostępni ją dla danej płatności. Usługę świadczy PayPo sp. z o.o. na podstawie umowy zawieranej bezpośrednio między Uczestnikiem a PayPo i według zasad PayPo. Mentor otrzymuje całą cenę od operatora płatności, a raty Uczestnik spłaca PayPo. Decyzję o udostępnieniu tej formy płatności i jej warunkach podejmuje PayPo.",
      "4. Mentor wystawia fakturę bez VAT na życzenie Uczestnika zgłoszone na stronie płatności albo e-mailem i przesyła ją e-mailem.",
    ]},
    { id: "u6", title: "§6. Terminy Sesji, przełożenie i nieobecność", body: [
      "1. Uczestnik może bezpłatnie przełożyć Sesję najpóźniej 24 godziny przed jej rozpoczęciem. Strony ustalają wtedy nowy termin.",
      "2. Nieobecność bez uprzedzenia albo przełożenie później niż 24 godziny przed Sesją oznacza wykorzystanie Sesji, chyba że wynika z przyczyn niezależnych od Uczestnika (np. nagła choroba, awaria łącza). Wtedy strony ustalają nowy termin.",
      "3. Mentor może przełożyć Sesję z ważnej przyczyny, proponując nowy termin. Jeśli Uczestnik go nie przyjmie, otrzymuje zwrot ceny tej Sesji zgodnie z §8 ust. 2.",
      "4. Spóźnienie Uczestnika skraca Sesję. Sesja może zostać wydłużona tylko za zgodą obu stron.",
    ]},
    { id: "u7", title: "§7. Poufność i dane osobowe", body: [
      "1. Sesje nie są nagrywane. Treść rozmów jest poufna, z wyjątkiem sytuacji bezpośredniego zagrożenia życia lub zdrowia oraz obowiązków wynikających z przepisów prawa.",
      "2. Mentor może zanotować informacje potrzebne do prowadzenia Programu. Notatki przechowuje w sposób zabezpieczony i usuwa po zakończeniu współpracy, chyba że przepisy wymagają ich dłuższego przechowywania.",
      "3. Dane osobowe Uczestnika są przetwarzane zgodnie z Polityką prywatności exmortis.pl. Informacje o zdrowiu Mentor przetwarza wyłącznie za odrębną zgodą Uczestnika, którą można wycofać w każdej chwili.",
    ]},
    { id: "u8", title: "§8. Zakończenie udziału przez Uczestnika", body: [
      "1. Uczestnik może zakończyć udział w Programie w każdym czasie, bez podania przyczyny, wysyłając wiadomość na adres [E-MAIL KONTAKTOWY] albo pocztą na [ADRES DO KORESPONDENCJI].",
      "2. Mentor zwraca wtedy cenę Sesji, które się nie odbyły i nie zostały wykorzystane zgodnie z §6 ust. 2, liczoną proporcjonalnie: cena Programu podzielona przez osiem, pomnożona przez liczbę takich Sesji. Zwrot następuje w ciągu 14 dni od otrzymania wiadomości, tą samą metodą, którą Uczestnik zapłacił, chyba że Uczestnik zgodzi się na inną bez kosztów dla siebie. Przy płatności PayPo zwrot trafia do PayPo i zmniejsza zadłużenie Uczestnika wobec PayPo według zasad PayPo.",
      "3. Prawo odstąpienia od Umowy (§9) przysługuje niezależnie od tego postanowienia.",
    ]},
    { id: "u9", title: "§9. Prawo odstąpienia od Umowy", body: [
      "1. Uczestnik będący konsumentem albo przedsiębiorcą na prawach konsumenta może odstąpić od Umowy w ciągu 14 dni od jej zawarcia, bez podania przyczyny. Wystarczy wysłać oświadczenie przed upływem tego terminu, np. e-mailem na [E-MAIL KONTAKTOWY]. Można skorzystać ze wzoru formularza dostępnego na stronie exmortis.pl/odstapienie.",
      "2. Jeśli Uczestnik zażąda rozpoczęcia Programu przed upływem 14 dni od zawarcia Umowy, a następnie od niej odstąpi, płaci za świadczenia spełnione do chwili odstąpienia — proporcjonalnie do ceny Programu (art. 35 ustawy o prawach konsumenta).",
      "3. Prawo odstąpienia wygasa po pełnym wykonaniu Programu, jeżeli Mentor wykonał go za wyraźną zgodą Uczestnika, który został poinformowany przed rozpoczęciem świadczenia, że po spełnieniu świadczenia utraci prawo odstąpienia, i przyjął to do wiadomości.",
      "4. Zwrot płatności następuje niezwłocznie, nie później niż w ciągu 14 dni od otrzymania oświadczenia, tą samą metodą płatności (przy PayPo — według §8 ust. 2 zdanie trzecie).",
    ]},
    { id: "u10", title: "§10. Zakończenie Programu przez Mentora", body: [
      "1. Mentor może zakończyć Program z przyczyny wskazanej w §4 ust. 4, przy rażącym naruszeniu Umowy przez Uczestnika (np. zachowania obraźliwe lub agresywne wobec Mentora) albo gdy z ważnych przyczyn nie może dalej prowadzić Programu.",
      "2. W każdym z tych przypadków Uczestnik otrzymuje zwrot ceny Sesji, które się nie odbyły, zgodnie z §8 ust. 2.",
    ]},
    { id: "u11", title: "§11. Reklamacje i odpowiedzialność", body: [
      "1. Reklamacje Uczestnik może składać e-mailem na [E-MAIL KONTAKTOWY] albo pocztą na [ADRES DO KORESPONDENCJI]. Mentor odpowiada w ciągu 14 dni. Szczegółowe zasady określa Regulamin.",
      "2. Mentor zobowiązuje się do prowadzenia Programu z należytą starannością i zgodnie z opisem. Efekty Programu zależą w dużej mierze od zaangażowania Uczestnika, dlatego Mentor nie gwarantuje osiągnięcia określonego rezultatu. Nie ogranicza to uprawnień Uczestnika wynikających z przepisów prawa.",
    ]},
    { id: "u12", title: "§12. Postanowienia końcowe", body: [
      "1. Umowa podlega prawu polskiemu. Nie pozbawia Uczestnika ochrony, jaką zapewniają mu bezwzględnie obowiązujące przepisy państwa jego zwykłego pobytu.",
      "2. Uczestnik będący konsumentem może skorzystać z pozasądowych sposobów rozpatrywania sporów, m.in. pomocy miejskiego lub powiatowego rzecznika konsumentów; informacje są dostępne na stronie prawakonsumenta.uokik.gov.pl.",
      "3. Zmiana Umowy wymaga zgody obu stron wyrażonej e-mailem.",
      "4. Wzór Umowy obowiązuje od 13 listopada 2026 r. Wersja i data wersji są podane nad treścią Umowy na stronie exmortis.pl/umowa-powrot.",
    ]},
  ],
};
