import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PAGES } from "@/components/seo/seoPages";
import { SITE_URL, OG_SPOTKANIE, OG_MARKA, metaMode } from "@/config/site";

const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
};

// Meta po stronie przeglądarki (ten sam tryb i adres co wspólny nagłówek z src/config/site.js).
// /1-listopada zawsze pokazuje grafikę spotkania.
export default function SeoMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const og = metaMode() === "spotkanie" || pathname === "/1-listopada" ? OG_SPOTKANIE : OG_MARKA;
    const page = PAGES[pathname] || PAGES["/"];
    const ogTitle = og === OG_SPOTKANIE ? og.title : page.t;
    const ogDesc = og === OG_SPOTKANIE ? og.d : page.d;
    document.title = page.t;
    setMeta("name", "description", page.d);
    setMeta("property", "og:title", ogTitle);
    setMeta("property", "og:description", ogDesc);
    setMeta("name", "twitter:title", ogTitle);
    setMeta("name", "twitter:description", ogDesc);
    setMeta("property", "og:url", SITE_URL + pathname);
    setMeta("property", "og:image", SITE_URL + og.img);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:image:alt", og.alt);
    setMeta("name", "twitter:image", SITE_URL + og.img);
    setMeta("name", "twitter:image:alt", og.alt);
  }, [pathname]);
  return null;
}