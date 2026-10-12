import React from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useNoIndex } from "@/lib/useNoIndex";
import { useAuth } from "@/lib/AuthContext";
import RzIntro from "@/components/rozdroza/RzIntro";
import RzLibrary from "@/components/rozdroza/RzLibrary";
import RzPreview, { StoryCard } from "@/components/rozdroza/RzPreview";
import RzReader from "@/components/rozdroza/RzReader";
import RzProblem from "@/components/rozdroza/RzProblem";
import { adminPreview, loadPreview } from "@/components/rozdroza/api";

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

// Podgląd szkicu jak u klienta: najpierw karta historii (okładka, opis, ostrzeżenie), potem czytnik.
// /konto/rozdroza/podglad?id=… → karta; …&czytaj=1 → czytnik. Tylko administrator (serwer też to sprawdza).
function AdminPreview() {
  const loc = useLocation();
  const nav = useNavigate();
  const q = new URLSearchParams(loc.search);
  const id = q.get("id") || "";
  const reading = q.get("czytaj") === "1";
  const { user } = useAuth();
  const [d, setD] = React.useState(null);
  const [err, setErr] = React.useState("");
  const isAdmin = user?.role === "admin";
  const load = React.useCallback(() => { setErr(""); setD(null); loadPreview(id).then(setD).catch((e) => setErr(e.message)); }, [id]);
  React.useEffect(() => { if (isAdmin && !reading && id) load(); }, [isAdmin, reading, id, load]);
  if (!isAdmin) return <RzProblem text="Podgląd szkicu jest dostępny tylko dla administratora." />;
  if (!id) return <RzProblem text="Brak historii do podglądu — otwórz ją z panelu." />;
  if (reading) return <RzReader previewId={id} />;
  if (err) return <RzProblem text={err} onRetry={load} />;
  if (!d) return <div className="max-w-[720px] mx-auto aspect-video bg-[#141416] animate-pulse motion-reduce:animate-none" aria-busy="true" />;
  return (
    <StoryCard meta={d.meta} backTo={`/admin/rozdroza?historia=${encodeURIComponent(id)}`} backLabel="WRÓĆ DO EDYCJI"
      note={<p className="text-xs text-[#E8C547] border border-[#E8C547]/30 px-3 py-2 mb-6" role="status">PODGLĄD SZKICU — tak tę historię zobaczy klient po publikacji (karta, potem czytanie). Widzisz to tylko Ty.</p>}
      onStart={() => nav(`/konto/rozdroza/podglad?id=${encodeURIComponent(id)}&czytaj=1`)} />
  );
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
  if (user?.role !== "admin" || loc.pathname.startsWith("/konto/rozdroza/podglad")) return null;
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
