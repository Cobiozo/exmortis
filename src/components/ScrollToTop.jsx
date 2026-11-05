import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Kotwica (#…): sekcje strony głównej wczytują się chwilę po wejściu — szukamy elementu do 3 s,
    // także przy bezpośrednim wejściu z adresu (np. /#manifest ze stopki na innej stronie).
    if (hash) {
      const id = getHashId(hash);
      let tries = 0;
      let timer;
      const tick = () => {
        const el = document.getElementById(id);
        if (el) { el.scrollIntoView({ behavior: "smooth" }); return; }
        if (++tries < 30) timer = window.setTimeout(tick, 100);
      };
      timer = window.setTimeout(tick, 50);
      return () => window.clearTimeout(timer);
    }

    if (navigationType === "POP") return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}
