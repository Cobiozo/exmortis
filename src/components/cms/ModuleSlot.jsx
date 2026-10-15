import React, { Suspense, useEffect, useState } from "react";
import lazyPage from "@/lib/lazyPage";

// Blok „moduł” (Dla kogo, Skarbiec, Spotkania, Newsletter…) rysuje się z osobnego pliku, więc nie
// obciąża pierwszej paczki. Blok w pierwszym widoku (albo w edytorze) startuje od razu — jak dotąd;
// blok niżej czeka na moment bezczynności po załadowaniu strony i wtedy dociąga się w tle.
const load = () => import("./ModuleLazy");
const LazyModule = lazyPage(load); // po publikacji nowej wersji: jedno przeładowanie zamiast błędu
// Strony zbudowane głównie z modułów (Skarbiec, produkt, spotkanie, kontakt…) pobierają plik modułów od razu,
// równolegle z danymi — bez dodatkowego czekania. Odciążamy tylko stronę główną i /1-listopada.
if (typeof window !== "undefined" && !["/", "/1-listopada"].includes(window.location.pathname)) load().catch(() => {});

// Zbliżona wysokość bloku: kontener trzyma miejsce, żeby treść nie skakała w trakcie dociągania.
const HEIGHT = {
  skarbiec: 760, skarbiec_katalog: 900, spotkania: 560, spotkania_lista: 900, instagram: 460,
  podcast: 620, muzyka: 520, swiadectwa: 520, kontakt: 560, kontakt_strona: 620, newsletter: 340,
  dla_kogo: 480, krotka_historia: 620, droga_powrotu: 620, zajawka_powrot: 560, powrot_formularz: 620,
  powrot_spotkanie: 400, test: 620, podcast_gosc: 520,
  produkt_tresc: 700, odcinek_tresc: 700, spotkanie_tresc: 700,
};

const placeholder = (modul) => (
  <div aria-hidden="true" style={{ minHeight: HEIGHT[modul] || 520 }} />
);

function useIdle() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(() => setIdle(true), { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => setIdle(true), 600);
    return () => clearTimeout(t);
  }, []);
  return idle;
}

export default function ModuleSlot({ d, label, eager }) {
  const idle = useIdle();
  if (!eager && !idle) return placeholder(d?.modul);
  return (
    <Suspense fallback={placeholder(d?.modul)}>
      <LazyModule d={d} label={label} />
    </Suspense>
  );
}