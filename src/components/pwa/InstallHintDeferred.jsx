import { lazy, Suspense, useEffect, useState } from "react";

const InstallHint = lazy(() => import("@/components/pwa/InstallHint"));

// Podpowiedź instalacji startuje dopiero po pełnym załadowaniu strony i w wolnym czasie
// przeglądarki — nie zabiera żądań przed pierwszym malowaniem (wynik PageSpeed).
export default function InstallHintDeferred() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = () => {
      if (window.requestIdleCallback) window.requestIdleCallback(() => setReady(true), { timeout: 3000 });
      else setTimeout(() => setReady(true), 500);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    return () => window.removeEventListener("load", idle);
  }, []);
  return ready ? <Suspense fallback={null}><InstallHint /></Suspense> : null;
}