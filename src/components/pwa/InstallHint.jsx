import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, X } from "lucide-react";
import { readConsent } from "@/components/legal/cookieStore";
import { useCrisis } from "@/components/crisis/CrisisContext";

const KEY = "exm_install";
// Nie przeszkadzamy w kasie ani w formularzach (POWRÓT, kontakt, spotkania, rezerwacja).
const HIDE = ["/kasa", "/powrot", "/kontakt", "/spotkania", "/rezerwacja", "/admin", "/skaner"];

const isStandalone = () =>
  (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
  window.navigator.standalone === true;

// Dyskretna podpowiedź „Dodaj do ekranu głównego": najwyżej raz, dopiero na drugiej wizycie,
// z możliwością zamknięcia na zawsze. Nie pokazuje się nad banerem cookies ani nad oknem pomocy,
// a na telefonie siedzi wyżej niż pigułka „Pomoc" i dolny pasek zapisu.
export default function InstallHint() {
  const { pathname } = useLocation();
  const { isOpen } = useCrisis();
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [banner, setBanner] = useState(() => !readConsent());
  const deferred = useRef(null);

  // Baner cookies zasłania dolny pas — wtedy podpowiedź czeka na wybór zgody.
  useEffect(() => {
    const upd = () => setBanner(!readConsent());
    window.addEventListener("exm:consent", upd);
    return () => window.removeEventListener("exm:consent", upd);
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(`${KEY}_off`) === "1") return;
    } catch { return; }

    // Licznik wizyt — najwyżej raz na sesję.
    let visits = 0;
    try {
      visits = Number(localStorage.getItem(`${KEY}_v`) || "0");
      if (!sessionStorage.getItem(`${KEY}_s`)) {
        visits += 1;
        localStorage.setItem(`${KEY}_v`, String(visits));
        sessionStorage.setItem(`${KEY}_s`, "1");
      }
    } catch { /* brak pamięci */ }
    if (visits < 2) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    if (!isIos && !isAndroid) return;

    const onPrompt = (e) => { e.preventDefault(); deferred.current = e; };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setIos(isIos);
    const t = setTimeout(() => {
      setVisible(true);
      try { localStorage.setItem(`${KEY}_off`, "1"); } catch { /* brak pamięci */ }
    }, 2500);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); };
  }, []);

  if (!visible || banner || isOpen || HIDE.some((p) => pathname.startsWith(p))) return null;

  const close = () => setVisible(false);
  const install = async () => {
    const p = deferred.current;
    if (p && p.prompt) { p.prompt(); await p.userChoice?.catch(() => {}); }
    close();
  };

  return (
    <div className="fixed right-3 z-[45] w-[min(320px,calc(100vw-24px))] bottom-[calc(env(safe-area-inset-bottom)+9rem)] md:bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] border border-[#3D3D3F] bg-[#0F0F10] p-4 pr-9 text-sm shadow-lg">
      <button onClick={close} aria-label="Zamknij podpowiedź" className="absolute right-2 top-2 p-1 text-foreground/50 hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <p className="technical text-[9px] gold-text mb-2">APLIKACJA NA TELEFON</p>
      {ios ? (
        <p className="text-foreground/70 leading-relaxed">
          Dodaj exmortis do ekranu głównego: dotknij <span className="text-foreground">Udostępnij</span>, potem{" "}
          <span className="text-foreground">Do ekranu początkowego</span>.
        </p>
      ) : (
        <>
          <p className="text-foreground/70 leading-relaxed mb-3">
            Zainstaluj exmortis na telefonie — otwiera się jednym dotknięciem, także bez internetu.
          </p>
          <button onClick={install} className="btn-relic !px-4 !py-2.5 text-[10px] w-full">
            <Download className="h-4 w-4" /> Dodaj do ekranu głównego
          </button>
        </>
      )}
    </div>
  );
}