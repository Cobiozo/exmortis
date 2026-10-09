import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PAGES, PRE, PRE_UNTIL } from "@/components/seo/seoPages";

const ORIGIN = "https://exmortis-return-path.base44.app";
const LOGO = { url: ORIGIN + "/exmortis-og-logo-500.png", w: "500", h: "500", alt: "exmortis" };
const OG = { url: ORIGIN + "/exmortis-og-1-listopada-1200x630.png", w: "1200", h: "630", alt: PRE.title };

const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
};

// Do 1.11, 21:30 udostępnianie pokazuje spotkanie; potem każda strona ma własne teksty i logo.
export default function SeoMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const pre = Date.now() < PRE_UNTIL;
    const page = PAGES[pathname] || PAGES["/"];
    const img = pre ? OG : LOGO;
    const ogTitle = pre ? PRE.title : page.t;
    const ogDesc = pre ? PRE.d : page.d;
    document.title = page.t;
    setMeta("name", "description", page.d);
    setMeta("property", "og:title", ogTitle);
    setMeta("property", "og:description", ogDesc);
    setMeta("name", "twitter:title", ogTitle);
    setMeta("name", "twitter:description", ogDesc);
    setMeta("property", "og:url", ORIGIN + pathname);
    setMeta("property", "og:locale", "pl_PL");
    setMeta("property", "og:site_name", "exmortis");
    setMeta("property", "og:image", img.url);
    setMeta("property", "og:image:width", img.w);
    setMeta("property", "og:image:height", img.h);
    setMeta("property", "og:image:alt", img.alt);
    setMeta("name", "twitter:image", img.url);
    setMeta("name", "twitter:image:alt", img.alt);
  }, [pathname]);
  return null;
}