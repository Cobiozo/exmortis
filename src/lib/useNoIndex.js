import { useEffect } from "react";

// Dodaje <meta name="robots" content="noindex,nofollow"> na czas wyświetlania strony.
export function useNoIndex() {
  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex,nofollow";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
}