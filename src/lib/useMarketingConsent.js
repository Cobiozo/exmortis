import { useEffect, useState } from "react";
import { readConsent } from "@/components/legal/cookieStore";

// Zgoda „marketingowe / treści zewnętrzne” z banera cookies — odświeżana po każdej zmianie wyboru.
// Bez niej odtwarzacze YouTube i Spotify oraz ich miniatury ładują się dopiero po kliknięciu.
export default function useMarketingConsent() {
  const [on, setOn] = useState(() => readConsent()?.marketing === true);
  useEffect(() => {
    const upd = () => setOn(readConsent()?.marketing === true);
    window.addEventListener("exm:consent", upd);
    return () => window.removeEventListener("exm:consent", upd);
  }, []);
  return on;
}
