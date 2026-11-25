import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Container from "@/components/exmortis/ui/Container";

// Zaproszenie do nagrań z Wieczorów powrotu (25.11.2026). Pokazuje się tylko wtedy, gdy w Bibliotece
// naprawdę są nagrania dla wszystkich kont — bez obietnic na zapas.
export default function RecordingsInvite() {
  const { isAuthenticated } = useAuth();
  const [n, setN] = useState(0);
  useEffect(() => {
    base44.functions.invoke("eventsPublic", { action: "nagrania" }).then((r) => setN(Number(r.data?.n) || 0)).catch(() => setN(0));
  }, []);
  if (!n) return null;
  const lib = "/konto?tab=biblioteka";
  return (
    <div className="pt-12 md:pt-16">
      <Container>
        <div className="flex flex-col gap-6 rounded-[var(--exm-r-card)] border border-exm-gold-line bg-exm-surface p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex gap-4">
            <PlayCircle className="mt-1 h-7 w-7 shrink-0 text-exm-gold" strokeWidth={1.25} aria-hidden="true" />
            <div>
              <p className="exm-eyebrow">Nagrania</p>
              <h2 className="mt-2 font-exm-serif text-[clamp(1.3rem,2.4vw,1.7rem)] leading-snug text-exm-ivory">Nie zdążysz na żywo? Obejrzyj nagrania z poprzednich Wieczorów powrotu.</h2>
              <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-exm-muted">
                {isAuthenticated
                  ? "Czekają w Twojej Bibliotece na koncie. Gdy dodam nowe, dostaniesz krótki e-mail."
                  : "Są w Bibliotece na exmortis.pl — wystarczy darmowe konto. Gdy dodam nowe nagranie, dostaniesz krótki e-mail."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 md:flex-col md:items-stretch">
            {isAuthenticated ? (
              <Link to={lib} className="btn-relic !px-5 !py-3 justify-center">Otwórz Bibliotekę</Link>
            ) : (
              <>
                <Link to="/register" className="btn-relic !px-5 !py-3 justify-center">Załóż darmowe konto</Link>
                <Link to={`/login?returnTo=${encodeURIComponent(lib)}`} className="btn-ghost !px-5 !py-3 justify-center">Zaloguj się</Link>
              </>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
