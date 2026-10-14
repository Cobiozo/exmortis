import { SITE_URL } from "@/config/site";
import { unitPrice } from "@/lib/productPrice";
import { coverOf } from "@/components/exmortis/events/cover";

// Dane strukturalne dla Google. Tylko prawdziwe dane z serwera — nic nie jest dopisywane.
// Opisy muszą być czystym tekstem, dlatego każdy tekst przechodzi przez plain().

const ENTITIES = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&oacute;": "ó", "&ndash;": "-", "&mdash;": "-" };

// Tekst bez znaczników HTML, bez zbędnych odstępów i o rozsądnej długości.
export const plain = (v, max = 500) =>
  String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const LOGO_URL = `${SITE_URL}/exmortis-logo-500.png`;

// Okruszki (BreadcrumbList).
export const breadcrumb = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE_URL + path })),
});

// Strona główna: marka i witryna. sameAs wyłącznie z linków społecznościowych podanych w ustawieniach.
const SOCIAL = /^https?:\/\/(www\.)?(facebook|instagram|youtube|tiktok|linkedin|x|twitter)\./i;

export function orgJsonLd(social = []) {
  const sameAs = [...new Set((social || []).map((u) => String(u || "").trim()).filter((u) => SOCIAL.test(u)))];
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "exmortis",
      url: SITE_URL,
      logo: LOGO_URL,
      ...(sameAs.length ? { sameAs } : {}),
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: "exmortis", url: SITE_URL },
  ];
}

// Produkt: nazwa, opis bez HTML, zdjęcie, oferta z bieżącą ceną i oceny —
// oceny tylko wtedy, gdy produkt ma opublikowane opinie.
export function productJsonLd(product) {
  if (!product?.name || !product.slug) return null;
  const url = `${SITE_URL}/skarbiec/${product.slug}`;
  const soon = product.status === "wkrótce";
  const soldOut = !!product.seats && Number(product.seats.left) <= 0;
  const price = product.is_free ? 0 : unitPrice(product);
  const offers =
    product.is_free || price > 0
      ? {
          "@type": "Offer",
          url,
          price: String(price),
          priceCurrency: "PLN",
          availability: soon ? "https://schema.org/PreOrder" : soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        }
      : null;
  const count = Number(product.rating_count) || 0;
  const avg = Number(product.rating_avg) || 0;
  const image = product.image_url || product.cover_image;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: plain(product.description || product.long_description || product.subtitle || product.name),
      url,
      ...(image ? { image: [image] } : {}),
      ...(product.category ? { category: product.category } : {}),
      ...(offers ? { offers } : {}),
      ...(count > 0 && avg > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: String(avg), reviewCount: count } } : {}),
    },
    breadcrumb([
      ["Skarbiec", "/skarbiec"],
      [product.name, `/skarbiec/${product.slug}`],
    ]),
  ];
}

// Spotkanie: termin, tryb, miejsce, organizator, cena i status odwołania.
export function eventJsonLd(event) {
  if (!event?.title || !event.start_datetime) return null;
  const url = `${SITE_URL}/spotkania/${event.slug}`;
  const start = new Date(event.start_datetime);
  const end = new Date(start.getTime() + (Number(event.duration_minutes) || 60) * 60000);
  const online = event.format !== "Stacjonarnie";
  const cancelled = event.status === "Odwołane";
  const price = Number(event.price) || 0;
  const cover = coverOf(event);
  const image = cover?.crops?.wide || cover?.src || event.cover_image;
  const description = plain(event.subtitle || event.description);
  return [
    {
      "@context": "https://schema.org",
      "@type": "Event",
      name: event.title,
      ...(description ? { description } : {}),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      eventAttendanceMode: online ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: cancelled ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
      location: online
        ? { "@type": "VirtualLocation", url }
        : { "@type": "Place", name: event.location || "exmortis", address: { "@type": "PostalAddress", addressCountry: "PL" } },
      organizer: { "@type": "Organization", name: "exmortis", url: SITE_URL },
      ...(image ? { image: [image] } : {}),
      ...(price > 0
        ? { offers: { "@type": "Offer", url, price: String(price), priceCurrency: "PLN", availability: cancelled ? "https://schema.org/SoldOut" : "https://schema.org/InStock" } }
        : {}),
    },
    breadcrumb([
      ["Spotkania", "/spotkania"],
      [event.title, `/spotkania/${event.slug}`],
    ]),
  ];
}