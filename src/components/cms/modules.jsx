import ForWhom from "@/components/exmortis/ForWhom";
import StartPaths from "@/components/exmortis/home/StartPaths";
import ShortHistory from "@/components/exmortis/home/ShortHistory";
import ReturnPath from "@/components/exmortis/home/ReturnPath";
import RozdrozaHome from "@/components/exmortis/home/RozdrozaHome";
import ObokHome from "@/components/exmortis/home/ObokHome";
import WhatsAppChannelBlock from "@/components/exmortis/glos/WhatsAppChannelBlock";
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
import PowrotSummary from "@/components/exmortis/powrot/PowrotSummary";
import PowrotEventLine from "./modules/PowrotEventLine";
import TestQuiz from "@/pages/Test";
import ShopCatalog from "@/pages/Shop";
import EventsListing from "./modules/EventsListing";
import { EventSlot, ProductSlot, EpisodeSlot } from "./modules/TemplateSlot";

// Moduły dynamiczne — ich treść pochodzi z własnych zakładek panelu.
export const MODULES = {
  spotkania: ["Najbliższe spotkania", EventsTeaser],
  skarbiec: ["Produkty Skarbca", HomeSkarbiec],
  newsletter: ["Listy powrotu (newsletter)", NewsletterSection],
  kontakt: ["Kontakt z formularzem", ContactSection],
  dla_kogo: ["Dla kogo", ForWhom],
  od_czego_zaczac: ["Od czego zacząć (trzy pierwsze kroki)", StartPaths],
  krotka_historia: ["Krótka historia", ShortHistory],
  droga_powrotu: ["Droga powrotu", ReturnPath],
  rozdroza: ["ROZDROŻA — interaktywne historie", RozdrozaHome],
  obok: ["Biblioteka — zapowiedź (materiały dla osób z kontem)", ObokHome],
  zajawka_powrot: ["Zajawka POWRÓT", PowrotTeaser],
  swiadectwa: ["Świadectwa", Testimonials],
  instagram: ["Instagram", InstagramFeed],
  kontakt_strona: ["Kontakt: dane i formularz", ContactPageForm],
  muzyka: ["Muzyka (utwory)", MusicSection],
  podcast: ["Podcast (odcinki)", PodcastSection],
  podcast_gosc: ["Zostań gościem podcastu", PodcastGuest],
  whatsapp_glos: ["Kanał WhatsApp — Głos między poniedziałkami", WhatsAppChannelBlock],
  powrot_formularz: ["POWRÓT: formularz zgłoszeniowy", PowrotForm],
  powrot_podsumowanie: ["POWRÓT: podsumowanie przed zgłoszeniem", PowrotSummary],
  powrot_spotkanie: ["POWRÓT: najbliższe spotkanie", PowrotEventLine],
  test: ["Test „Która śmierć jest Twoja?”", TestQuiz],
  spotkania_lista: ["Lista spotkań (nadchodzące i minione)", EventsListing],
  skarbiec_katalog: ["Katalog Skarbca (etapy, filtry, produkty)", ShopCatalog],
  spotkanie_tresc: ["Szablon: treść spotkania", EventSlot],
  produkt_tresc: ["Szablon: karta produktu", ProductSlot],
  odcinek_tresc: ["Szablon: odcinek podcastu", EpisodeSlot],
};

export function ModuleBlock({ d, label }) {
  const C = MODULES[d.modul]?.[1];
  return C ? <C d={d} label={label} /> : null;
}