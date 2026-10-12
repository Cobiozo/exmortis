import React from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useNoIndex } from "@/lib/useNoIndex";
import { useAuth } from "@/lib/AuthContext";
import RzIntro from "@/components/rozdroza/RzIntro";
import RzLibrary from "@/components/rozdroza/RzLibrary";
import RzPreview from "@/components/rozdroza/RzPreview";
import RzReader from "@/components/rozdroza/RzReader";
import RzProblem from "@/components/rozdroza/RzProblem";
import { adminPreview } from "@/components/rozdroza/api";

// Izolacja błędów modułu: awaria czytnika nie wywraca reszty konta ani strony.
class RzBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("ROZDROŻA", error?.message); }
  render() {
    if (!this.state.error) return this.props.children;
    return <RzProblem text="Coś poszło nie tak w czytniku. Twój zapisany postęp jest bezpieczny." onRetry={() => this.setState({ error: null })} />;
  }
}

function AdminPreview() {
  const id = new URLSearchParams(useLocation().search).get("id");
  const { user } = useAuth();
  if (user?.role !== "admin") return <RzProblem text="Podgląd szkicu jest dostępny tylko dla administratora." />;
  return <RzReader previewId={id} />;
}

// Pasek administratora: „Podgląd jak klient” pokazuje też historie zaplanowane (z datą). Klient tego paska nie widzi.
function AdminPreviewBar() {
  const { user } = useAuth();
  const loc = useLocation();
  const q = new URLSearchParams(loc.search).get("jak_klient");
  const [on, setOn] = React.useState(() => adminPreview.on());
  React.useEffect(() => {
    if (user?.role !== "admin" || q === null) return;
    adminPreview.set(q === "1"); setOn(q === "1");
  }, [q, user?.role]);
  if (user?.role !== "admin") return null;
  const toggle = () => { adminPreview.set(!on); setOn(!on); window.location.replace(loc.pathname); };
  return (
    <div className={`mb-6 border p-3 flex flex-wrap items-center gap-3 text-xs ${on ? "border-[#C9A24A]/60 bg-[#C9A24A]/[0.06]" : "hairline"}`} role="note">
      <span className="technical text-[9px] gold-text">ADMIN</span>
      <span className="text-foreground/70 flex-1 min-w-[200px]">{on
        ? "Podgląd jak klient: widzisz opublikowane wersje tak jak klient, a także historie zaplanowane (oznaczone datą — klienci zobaczą je dopiero wtedy)."
        : "Widzisz to, co klient w tej chwili (bez historii zaplanowanych)."}</span>
      <button type="button" onClick={toggle} className="technical text-[9px] underline underline-offset-4 text-foreground/75 hover:text-foreground min-h-[32px]">{on ? "WYŁĄCZ PODGLĄD ZAPLANOWANYCH" : "POKAŻ TEŻ ZAPLANOWANE"}</button>
    </div>
  );
}

// /konto/rozdroza — moduł Panelu Klienta (to samo konto i sesja; trasa ładowana na żądanie).
export default function Rozdroza() {
  useNoIndex();
  const { pathname } = useLocation();
  return (
    <div className="bg-[#0A0A0B] pt-24 md:pt-28 pb-24 min-h-[100svh]">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-5 md:px-10">
        <nav aria-label="Ścieżka" className="technical text-[10px] text-foreground/45 mb-8 flex items-center gap-2">
          <Link to="/konto" className="hover:text-foreground min-h-[32px] inline-flex items-center">MOJE KONTO</Link>
          <span aria-hidden="true">/</span>
          {pathname.replace(/\/+$/, "") === "/konto/rozdroza" ? <span className="gold-text">ROZDROŻA</span> : <Link to="/konto/rozdroza" className="hover:text-foreground min-h-[32px] inline-flex items-center">ROZDROŻA</Link>}
        </nav>
        <AdminPreviewBar />
        <RzBoundary key={pathname}>
          <Routes>
            <Route index element={<RzIntro />} />
            <Route path="biblioteka" element={<RzLibrary />} />
            <Route path="podglad" element={<AdminPreview />} />
            <Route path=":slug" element={<RzPreview />} />
            <Route path=":slug/czytaj" element={<RzReader />} />
            <Route path="*" element={<RzProblem text="Nie ma takiej strony w ROZDROŻACH." />} />
          </Routes>
        </RzBoundary>
      </div>
    </div>
  );
}
