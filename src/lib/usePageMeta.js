import { useEffect } from "react";
import { SITE_URL } from "@/config/site";

// Meta-dane strony: kanoniczny adres, obraz udostępniania, noindex.
export function usePageMeta({ canonical, ogImage, noindex } = {}) {
  useEffect(() => {
    const added = [];
    const put = (tag, attrs) => {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      added.push(el);
    };
    // Własny adres kanoniczny strony ma pierwszeństwo przed domyślnym z SeoMeta (data-page).
    if (canonical) put("link", { rel: "canonical", href: SITE_URL + canonical, "data-page": "1" });
    if (ogImage) {
      put("meta", { property: "og:image", content: ogImage });
      put("meta", { property: "og:image:width", content: "1200" });
      put("meta", { property: "og:image:height", content: "630" });
      put("meta", { name: "twitter:card", content: "summary_large_image" });
    }
    if (noindex) put("meta", { name: "robots", content: "noindex,nofollow" });
    return () => added.forEach((el) => el.remove());
  }, [canonical, ogImage, noindex]);
}