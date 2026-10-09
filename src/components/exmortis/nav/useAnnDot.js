import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ann, ANN_SEEN } from "@/components/account/announce/annApi";

// Złota kropka przy ikonie konta: są nowe ogłoszenia, których osoba jeszcze nie widziała.
export function useAnnDot(user) {
  const [dot, setDot] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!user || pathname === "/konto") { setDot(false); return; }
    ann("mine").then((d) => setDot(d.unread > 0)).catch(() => {});
  }, [user?.id, pathname]);
  useEffect(() => {
    const off = () => setDot(false);
    window.addEventListener(ANN_SEEN, off);
    return () => window.removeEventListener(ANN_SEEN, off);
  }, []);
  return dot;
}