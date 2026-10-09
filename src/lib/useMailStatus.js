import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Status wysyłki e-mail (DZIAŁA / NIESKONFIGUROWANA) + kolejka zaległych. Tylko w panelu.
export default function useMailStatus() {
  const [s, setS] = useState(null);
  const reload = useCallback(() => base44.functions.invoke("mailAdmin", { action: "status" }).then((r) => setS(r.data)).catch(() => setS({ ready: false, queue: { total: 0, byKind: {} }, config: {} })), []);
  useEffect(() => { reload(); }, [reload]);
  return { status: s, ready: !!s?.ready, reload };
}

export const MAIL_KINDS = {
  zapis: "Potwierdzenia zapisu",
  przypomnienie: "Przypomnienia",
  nagranie: "Maile z nagraniem",
  odwolanie: "Odwołania spotkań",
  miejsce: "Zwolnione miejsca",
  listy_potwierdzenie: "Potwierdzenia Listów powrotu",
  listy: "Listy powrotu",
  ogloszenie: "Ogłoszenia",
  zamowienie: "Zamówienia",
  test_wynik: "Wyniki testu",
  podcast: "Zgłoszenia do podcastu",
  odstapienie: "Odstąpienia od umowy",
  alarm: "Alarmy",
  test: "Test wysyłki",
  inne: "Inne",
};

export const MAIL_REQUIRED = "Wymaga skonfigurowanej wysyłki e-mail";