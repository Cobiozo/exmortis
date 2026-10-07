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
};

export function ModuleBlock({ d, label }) {
  const C = MODULES[d.modul]?.[1];
  return C ? <C d={d} label={label} /> : null;
}