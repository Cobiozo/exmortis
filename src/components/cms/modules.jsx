import ForWhom from "@/components/exmortis/ForWhom";
import ShortHistory from "@/components/exmortis/home/ShortHistory";
import ReturnPath from "@/components/exmortis/home/ReturnPath";
import PowrotTeaser from "@/components/exmortis/PowrotTeaser";
import EventsTeaser from "@/components/exmortis/events/EventsTeaser";
import NewsletterSection from "@/components/exmortis/NewsletterSection";
import ContactSection from "@/components/exmortis/ContactSection";
import InstagramFeed from "@/components/exmortis/home/InstagramFeed";
import Testimonials from "@/components/exmortis/Testimonials";
import HomeSkarbiec from "./modules/HomeSkarbiec";
import ContactPageForm from "./modules/ContactPageForm";
import MusicSection from "@/components/exmortis/MusicSection";
import PodcastSection from "@/components/exmortis/PodcastSection";
import PodcastGuest from "@/components/exmortis/PodcastGuest";
import PowrotForm from "@/components/exmortis/powrot/PowrotForm";
import PowrotEventLine from "./modules/PowrotEventLine";
import TestQuiz from "@/pages/Test";
import ShopCatalog from "@/pages/Shop";
import EventsListing from "./modules/EventsListing";
import { EventSlot, ProductSlot } from "./modules/TemplateSlot";

// Moduły dynamiczne — ich treść pochodzi z własnych zakładek panelu.
export const MODULES = {
  spotkania: ["Najbliższe spotkania", EventsTeaser],
  skarbiec: ["Produkty Skarbca", HomeSkarbiec],
  newsletter: ["Listy powrotu (newsletter)", NewsletterSection],
  kontakt: ["Kontakt z formularzem", ContactSection],
  dla_kogo: ["Dla kogo", ForWhom],
  krotka_historia: ["Krótka historia", ShortHistory],
  droga_powrotu: ["Droga powrotu", ReturnPath],
  zajawka_powrot: ["Zajawka POWRÓT", PowrotTeaser],
  swiadectwa: ["Świadectwa", Testimonials],
  instagram: ["Instagram", InstagramFeed],
  kontakt_strona: ["Kontakt: dane i formularz", ContactPageForm],
  muzyka: ["Muzyka (utwory)", MusicSection],
  podcast: ["Podcast (odcinki)", PodcastSection],
  podcast_gosc: ["Zostań gościem podcastu", PodcastGuest],
  powrot_formularz: ["POWRÓT: formularz zgłoszeniowy", PowrotForm],
  powrot_spotkanie: ["POWRÓT: najbliższe spotkanie", PowrotEventLine],
  test: ["Test „Która śmierć jest Twoja?”", TestQuiz],
  spotkania_lista: ["Lista spotkań (nadchodzące i minione)", EventsListing],
  skarbiec_katalog: ["Katalog Skarbca (etapy, filtry, produkty)", ShopCatalog],
  spotkanie_tresc: ["Szablon: treść spotkania", EventSlot],
  produkt_tresc: ["Szablon: karta produktu", ProductSlot],
};

export function ModuleBlock({ d, label }) {
  const C = MODULES[d.modul]?.[1];
  return C ? <C d={d} label={label} /> : null;
}