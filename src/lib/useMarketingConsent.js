import { useEffect, useState } from "react";
import { readConsent } from "@/components/legal/cookieStore";

// Zgoda na „treści zewnętrzne” z banera cookies (od wersji 2.0 osobna od marketingowej) — odświeżana po każdej zmianie wyboru.
// Bez niej odtwarzacze YouTube i Spotify oraz ich miniatury ładują się dopiero po kliknięciu.
export default function useMarketingConsent() {
  const [on, setOn] = useState(() => readConsent()?.external === true);
  useEffect(() => {
    const upd = () => setOn(readConsent()?.external === true);
    window.addEventListener("exm:consent", upd);
    return () => window.removeEventListener("exm:consent", upd);
  }, []);
  return on;
}
