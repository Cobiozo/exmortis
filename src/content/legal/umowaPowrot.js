// Umowa o udział w programie POWRÓT — wzór z 18.11.2026 (decyzje właściciela z 18.11: kontakt między Sesjami,
// 9 miesięcy na Sesje, wstrzymanie do 8 tygodni, notatki 12 miesięcy, zakończenie z ważnej przyczyny, raty przez PayU).
// Poprzedni wzór (13.11.2026) jest w archiwum dokumentów. Parametry programu zgodne z src/lib/powrotOffer.js;
// dane firmy w nawiasach wstawia src/lib/firma.js. Numer wersji nadaje archiwum (Ustawienia → Dokumenty prawne → Zapisz).
// Klient dostaje tę umowę razem z osobistym linkiem do płatności (przed zapłatą) i w potwierdzeniu płatności.
export const UMOWA_POWROT = {
  title: "Umowa o udział w programie POWRÓT",
  sections: [
    { id: "u1", title: "§1. Strony i pojęcia", body: [
      "1. Umowę zawierają: [IMIĘ I NAZWISKO], prowadzący działalność gospodarczą pod firmą [NAZWA FIRMY], NIP [NIP], REGON [REGON], adres do korespondencji: [ADRES DO KORESPONDENCJI], e-mail [E-MAIL KONTAKTOWY], telefon [TELEFON] (dalej: „Mentor”), oraz osoba, która opłaca udział w programie przez osobisty link do płatności i której imię, nazwisko i adres e-mail są wskazane w zamówieniu (dalej: „Uczestnik”).",
      "2. Program — indywidualny program mentoringowy POWRÓT opisany w §3. Sesja — indywidualne spotkanie Mentora z Uczestnikiem w ramach Programu. Rozmowa wstępna — bezpłatna, 20-minutowa rozmowa przed zawarciem Umowy, na zaproszenie Mentora. Link do płatności — osobisty adres strony płatności wysłany Uczestnikowi przez Mentora po Rozmowie wstępnej. Konto — konto Uczestnika w serwisie exmortis.pl z sekcją „Mój POWRÓT”. Regulamin — Regulamin serwisu i sklepu exmortis.pl.",
      "3. W sprawach nieuregulowanych Umową stosuje się Regulamin. Jeśli Umowa i Regulamin regulują tę samą sprawę inaczej, stosuje się postanowienie korzystniejsze dla Uczestnika.",
    ]},
    { id: "u2", title: "§2. Zawarcie Umowy", body: [
      "1. Udział w Programie poprzedzają: zgłoszenie, ankieta i Rozmowa wstępna. Żaden z tych kroków nie zobowiązuje do zakupu, a Rozmowa wstępna nie jest Sesją.",
      "2. Po Rozmowie wstępnej, jeśli obie strony chcą współpracy, Mentor wysyła Uczestnikowi na podany adres e-mail Link do płatności, treść Umowy i Regulamin. Link jest osobisty i ważny przez termin podany w wiadomości.",
      "3. Umowa zostaje zawarta z chwilą złożenia zamówienia na stronie płatności (przycisk „Zamawiam z obowiązkiem zapłaty”), po akceptacji Umowy i Regulaminu. Potwierdzenie zawarcia Umowy, z jej treścią, Uczestnik otrzymuje e-mailem.",
      "4. Uczestnikiem może być wyłącznie osoba pełnoletnia.",
      "5. Mentor prowadzi jednocześnie najwyżej 4 uczestników Programu. Gdy wszystkie miejsca są zajęte, Mentor może zaproponować wpis na listę oczekujących; wpis nie jest zawarciem Umowy.",
    ]},
    { id: "u3", title: "§3. Przedmiot Umowy", body: [
      "1. Mentor prowadzi dla Uczestnika Program obejmujący osiem Sesji indywidualnych (1:1) po 90 minut, online przez platformę Zoom, zwykle co 2–3 tygodnie. Program przechodzi przez cztery etapy: Śmierć, Próg, Powrót, Inny. Kolejność i tempo pracy w etapach Mentor dostosowuje do sytuacji Uczestnika.",
      "2. W ramach Programu Uczestnik otrzymuje także:",
      "a) Mapę powrotu — indywidualny plan pracy, który powstaje na pierwszej Sesji i jest aktualizowany w trakcie Programu;",
      "b) Dziennik powrotu — w wersji cyfrowej w Koncie, z zadaniami i pytaniami między Sesjami;",
      "c) narzędzia pracy i materiały do Sesji, udostępniane w Koncie;",
      "d) kontakt z Mentorem między Sesjami na zasadach z §4;",
      "e) osobisty plan dalszej drogi na czas po Programie;",
      "f) dostęp do zamkniętej ścieżki „Listów powrotu” dla absolwentów Programu.",
      "3. Program trwa zwykle 4–6 miesięcy. Termin pierwszej Sesji strony ustalają po zawarciu Umowy, a kolejne — w trakcie Programu, uwzględniając możliwości obu stron. Uczestnik rezerwuje terminy Sesji w Koncie albo ustala je z Mentorem.",
      "4. Wszystkie Sesje powinny odbyć się w ciągu 9 miesięcy od pierwszej Sesji. Termin ten wydłuża się o czas wstrzymania Programu (§8) oraz przerw z przyczyn leżących po stronie Mentora.",
      "5. Do udziału w Sesjach Uczestnik potrzebuje urządzenia z dostępem do internetu, kamerą i mikrofonem oraz aktualnej przeglądarki albo aplikacji Zoom. Link do Sesji jest dostępny w Koncie i w potwierdzeniu rezerwacji.",
    ]},
    { id: "u4", title: "§4. Kontakt między Sesjami", body: [
      "1. W trakcie Programu Uczestnik może raz w tygodniu skorzystać z jednej z form kontaktu: wysłać Mentorowi wiadomość głosową do 10 minut albo odbyć z Mentorem rozmowę przez WhatsApp lub telefon do 10 minut, w terminie uzgodnionym wcześniej.",
      "2. Niezależnie od tego Uczestnik może wysłać do dwóch wiadomości pisemnych tygodniowo przez Konto (sekcja „Mój POWRÓT”).",
      "3. Mentor odpowiada w ciągu 48 godzin w dni robocze (od poniedziałku do piątku, z wyłączeniem świąt). Niewykorzystany kontakt w danym tygodniu nie przechodzi na kolejny.",
      "4. Kontakt między Sesjami służy krótkiemu wsparciu w realizacji ustaleń z Sesji i nie zastępuje Sesji. Nie jest pomocą w nagłych sytuacjach — w kryzysie Uczestnik korzysta z numerów wskazanych w §5 ust. 3.",
      "5. WhatsApp jest usługą zewnętrzną (Meta Platforms Ireland Ltd.) i korzystanie z niego jest dobrowolne. Uczestnik może zamiast niego wybrać rozmowę telefoniczną albo wiadomości w Koncie.",
    ]},
    { id: "u5", title: "§5. Charakter Programu i bezpieczeństwo", body: [
      "1. Program jest mentoringiem rozwojowym. Nie jest psychoterapią, leczeniem ani poradnictwem medycznym. Mentor nie stawia diagnoz i nie zastępuje pomocy lekarza, psychologa ani psychoterapeuty.",
      "2. Uczestnik oświadcza, że według swojej najlepszej wiedzy nie jest w ostrym kryzysie psychicznym wymagającym pilnej pomocy specjalisty. Jeśli w trakcie Programu jego sytuacja się zmieni, poinformuje o tym Mentora.",
      "3. W sytuacji zagrożenia życia lub zdrowia Uczestnik dzwoni pod numer 112. Wsparcie w kryzysie: 116 123 oraz 800 70 2222 (całodobowo, bezpłatnie).",
      "4. Jeśli Mentor uzna, że Uczestnik potrzebuje najpierw pomocy specjalisty, może zaproponować wstrzymanie Programu (§8) albo jego zakończenie. Przy zakończeniu z tej przyczyny Uczestnik otrzymuje zwrot zgodnie z §10 ust. 4.",
    ]},
    { id: "u6", title: "§6. Cena i płatność", body: [
      "1. Cena Programu jest podana w Linku do płatności i na stronie płatności przed złożeniem zamówienia. Cena jest ceną końcową — Mentor korzysta ze zwolnienia z VAT (art. 113 ust. 1 ustawy o VAT).",
      "2. Płatność następuje z góry, za pośrednictwem operatora płatności PayU S.A., metodami dostępnymi na stronie PayU.",
      "3. Uczestnik może wybrać płatność w ratach albo z odroczonym terminem udostępnianą przez PayU (np. Raty PayU), jeśli instytucja finansująca udostępni ją dla danej płatności. Umowę o kredyt albo odroczenie płatności Uczestnik zawiera bezpośrednio z tą instytucją i według jej zasad; o przyznaniu i warunkach rat decyduje instytucja finansująca. Mentor otrzymuje całą cenę od operatora płatności.",
      "4. Przy płatności w ratach albo z odroczonym terminem zwrot należny Uczestnikowi trafia przez PayU do instytucji finansującej i zmniejsza zadłużenie Uczestnika według jej zasad.",
      "5. Mentor wystawia fakturę bez VAT na życzenie Uczestnika zgłoszone na stronie płatności albo e-mailem i przesyła ją e-mailem.",
    ]},
    { id: "u7", title: "§7. Terminy Sesji, przełożenie i nieobecność", body: [
      "1. Uczestnik może bezpłatnie przełożyć Sesję najpóźniej 24 godziny przed jej rozpoczęciem. Strony ustalają wtedy nowy termin.",
      "2. Nieobecność bez uprzedzenia albo przełożenie później niż 24 godziny przed Sesją oznacza wykorzystanie Sesji, chyba że wynika z przyczyn niezależnych od Uczestnika (np. nagła choroba, awaria łącza). Wtedy strony ustalają nowy termin.",
      "3. Mentor może przełożyć Sesję z ważnej przyczyny, proponując nowy termin. Jeśli Uczestnik go nie przyjmie, otrzymuje zwrot ceny tej Sesji zgodnie z §10 ust. 4.",
      "4. Spóźnienie Uczestnika skraca Sesję. Sesja może zostać wydłużona tylko za zgodą obu stron.",
    ]},
    { id: "u8", title: "§8. Wstrzymanie Programu", body: [
      "1. Z ważnej przyczyny, np. choroby, kryzysu, zdarzenia losowego albo nagłej zmiany sytuacji rodzinnej lub zawodowej, Uczestnik może wstrzymać Program na łącznie do 8 tygodni. Wystarczy wiadomość e-mail albo wiadomość w Koncie z krótkim opisem przyczyny; Mentor nie wymaga dokumentacji medycznej.",
      "2. Mentor może zaproponować wstrzymanie w sytuacji opisanej w §5 ust. 4.",
      "3. W czasie wstrzymania Sesje i kontakt między Sesjami nie odbywają się, a dostęp do materiałów w Koncie pozostaje. Termin z §3 ust. 4 wydłuża się o czas wstrzymania.",
      "4. Po wstrzymaniu strony ustalają termin kolejnej Sesji. Jeśli po 8 tygodniach Uczestnik nie może wrócić do Programu z tej samej ważnej przyczyny, może zakończyć udział zgodnie z §10 ust. 2.",
    ]},
    { id: "u9", title: "§9. Poufność, notatki i materiały", body: [
      "1. Sesje nie są nagrywane. Treść rozmów jest poufna, z wyjątkiem sytuacji bezpośredniego zagrożenia życia lub zdrowia oraz obowiązków wynikających z przepisów prawa.",
      "2. Mentor może sporządzać notatki z Sesji potrzebne do prowadzenia Programu. Dostęp do nich ma wyłącznie Mentor. Notatki są przechowywane w zabezpieczonym systemie przez 12 miesięcy od ostatniej Sesji, a następnie usuwane. Uczestnik może poprosić o ich wcześniejsze usunięcie.",
      "3. Dane osobowe Uczestnika są przetwarzane zgodnie z Polityką prywatności exmortis.pl. Informacje o zdrowiu Mentor przetwarza wyłącznie za odrębną zgodą Uczestnika, którą można wycofać w każdej chwili.",
      "4. Materiały udostępnione w Programie (w tym Dziennik powrotu i narzędzia pracy) są przeznaczone do osobistego użytku Uczestnika. Nie wolno ich udostępniać innym osobom ani publikować. Własne zapiski i odpowiedzi Uczestnika należą do niego.",
    ]},
    { id: "u10", title: "§10. Zakończenie udziału przez Uczestnika", body: [
      "1. W ciągu 14 dni od zawarcia Umowy Uczestnik może od niej odstąpić na zasadach z §11.",
      "2. Po tym terminie Uczestnik może zakończyć udział w Programie z ważnej przyczyny, czyli takiej, która trwale albo na dłużej niż 8 tygodni uniemożliwia lub istotnie utrudnia udział w Sesjach (np. stan zdrowia, nagła zmiana sytuacji życiowej, rodzinnej lub zawodowej, zdarzenie losowe). Wystarczy wiadomość na adres [E-MAIL KONTAKTOWY], w Koncie albo pocztą na [ADRES DO KORESPONDENCJI] z krótkim opisem przyczyny. Mentor nie wymaga dokumentacji medycznej.",
      "3. Jeśli Uczestnik chce przerwać Program z innej przyczyny, Mentor proponuje wstrzymanie Programu (§8) albo dokończenie Sesji w terminie z §3 ust. 4. W takim przypadku zwrot ceny nie przysługuje, chyba że przepisy bezwzględnie obowiązujące stanowią inaczej.",
      "4. Przy zakończeniu udziału z ważnej przyczyny, a także w przypadkach z §5 ust. 4, §7 ust. 3 i §12, Mentor zwraca cenę Sesji, które się nie odbyły i nie zostały wykorzystane zgodnie z §7 ust. 2, liczoną proporcjonalnie: cena Programu podzielona przez osiem, pomnożona przez liczbę takich Sesji. Zwrot następuje w ciągu 14 dni od otrzymania wiadomości, tą samą metodą, którą Uczestnik zapłacił, chyba że Uczestnik zgodzi się na inną bez kosztów dla siebie. Przy płatności w ratach stosuje się §6 ust. 4.",
      "5. Postanowienia tego paragrafu nie ograniczają uprawnień Uczestnika wynikających z bezwzględnie obowiązujących przepisów prawa. Prawo odstąpienia od Umowy (§11) przysługuje niezależnie od nich.",
    ]},
    { id: "u11", title: "§11. Prawo odstąpienia od Umowy", body: [
      "1. Uczestnik będący konsumentem albo przedsiębiorcą na prawach konsumenta może odstąpić od Umowy w ciągu 14 dni od jej zawarcia, bez podania przyczyny. Wystarczy wysłać oświadczenie przed upływem tego terminu, np. e-mailem na [E-MAIL KONTAKTOWY]. Można skorzystać ze wzoru formularza dostępnego na stronie exmortis.pl/odstapienie.",
      "2. Jeśli Uczestnik zażąda rozpoczęcia Programu przed upływem 14 dni od zawarcia Umowy, a następnie od niej odstąpi, płaci za świadczenia spełnione do chwili odstąpienia — proporcjonalnie do ceny Programu (art. 35 ustawy o prawach konsumenta).",
      "3. Prawo odstąpienia wygasa po pełnym wykonaniu Programu, jeżeli Mentor wykonał go za wyraźną zgodą Uczestnika, który został poinformowany przed rozpoczęciem świadczenia, że po spełnieniu świadczenia utraci prawo odstąpienia, i przyjął to do wiadomości.",
      "4. Zwrot płatności następuje niezwłocznie, nie później niż w ciągu 14 dni od otrzymania oświadczenia, tą samą metodą płatności (przy płatności w ratach — według §6 ust. 4).",
    ]},
    { id: "u12", title: "§12. Zakończenie Programu przez Mentora", body: [
      "1. Mentor może zakończyć Program z przyczyny wskazanej w §5 ust. 4, przy rażącym naruszeniu Umowy przez Uczestnika (np. zachowania obraźliwe lub agresywne wobec Mentora) albo gdy z ważnych przyczyn nie może dalej prowadzić Programu.",
      "2. W każdym z tych przypadków Uczestnik otrzymuje zwrot ceny Sesji, które się nie odbyły, zgodnie z §10 ust. 4.",
    ]},
    { id: "u13", title: "§13. Reklamacje i odpowiedzialność", body: [
      "1. Reklamacje Uczestnik może składać e-mailem na [E-MAIL KONTAKTOWY] albo pocztą na [ADRES DO KORESPONDENCJI]. Mentor odpowiada w ciągu 14 dni. Szczegółowe zasady określa Regulamin.",
      "2. Mentor zobowiązuje się do prowadzenia Programu z należytą starannością i zgodnie z opisem. Efekty Programu zależą w dużej mierze od zaangażowania Uczestnika, dlatego Mentor nie gwarantuje osiągnięcia określonego rezultatu. Nie ogranicza to uprawnień Uczestnika wynikających z przepisów prawa.",
    ]},
    { id: "u14", title: "§14. Postanowienia końcowe", body: [
      "1. Umowa podlega prawu polskiemu. Nie pozbawia Uczestnika ochrony, jaką zapewniają mu bezwzględnie obowiązujące przepisy państwa jego zwykłego pobytu.",
      "2. Uczestnik będący konsumentem może skorzystać z pozasądowych sposobów rozpatrywania sporów, m.in. pomocy miejskiego lub powiatowego rzecznika konsumentów; informacje są dostępne na stronie prawakonsumenta.uokik.gov.pl.",
      "3. Zmiana Umowy wymaga zgody obu stron wyrażonej e-mailem.",
      "4. Wzór Umowy obowiązuje od 18 listopada 2026 r. dla Umów zawieranych od tego dnia. Umowy zawarte wcześniej są wykonywane według wzoru z 13 listopada 2026 r., chyba że Uczestnik zgodzi się e-mailem na stosowanie nowego wzoru. Wersja i data wersji są podane nad treścią Umowy na stronie exmortis.pl/umowa-powrot.",
    ]},
  ],
};
