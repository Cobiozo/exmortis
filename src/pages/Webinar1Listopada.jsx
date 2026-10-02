import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";

const ZOOM_URL = "https://us06web.zoom.us/j/85685431982";
// Rejestracja otwarta do 1.11, 19:58 (czas warszawski).
const CLOSES_AT = new Date("2026-11-01T19:58:00+01:00");

const TITLE = "Ze śmierci. O powrotach, o których świat nie mówi";
const SUBTITLE = "Niedziela, 1 listopada, 20:00 · online · bezpłatnie";
const TEXT =
  "W Wieczór Wszystkich Świętych, po powrocie z cmentarzy, usiądziemy razem online. Godzina o śmierciach, po których nikt nie przynosi kwiatów, wypaleniu, kryzysie sensu, stracie i o drodze z powrotem. Po zapisaniu dostaniesz link do Zoom, część z pytaniami tylko dla nich i nagranie na siedem dni.";

// .ics — 1.11.2026, 20:00–21:00 CET (UTC+1)
function buildIcs() {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//exmortis//Webinar 1.11//PL",
    "BEGIN:VEVENT",
    "UID:ze-smierci-1-11@exmortis.pl",
    "DTSTAMP:20261002T000000Z",
    "DTSTART:20261101T190000Z",
    "DTEND:20261101T200000Z",
    `SUMMARY:${esc(TITLE)}`,
    `DESCRIPTION:${esc("Online · Zoom: " + ZOOM_URL)}`,
    `LOCATION:${esc("Online")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs() {
  const blob = new Blob([buildIcs()], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ze-smierci-1-11.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Webinar1Listopada() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [listy, setListy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const closed = new Date() >= CLOSES_AT;

  const urlParams = new URLSearchParams(window.location.search);
  const source = urlParams.get("src") || urlParams.get("utm_source") || "";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Podaj imię.");
    if (!email.trim()) return setError("Podaj adres e-mail.");
    if (!consent) return setError("Potrzebna jest zgoda zapisu na wydarzenie.");
    setSending(true);
    try {
      await base44.functions.invoke("webinarSignup", {
        name: name.trim(),
        email: email.trim(),
        listy,
        source,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || "Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#0A0A0B]">
      <section className="relative min-h-[70vh] flex items-center justify-center px-5 py-32 grain overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
        <div className="relative z-10 w-full max-w-3xl text-center">
          <div className="flex justify-center mb-8">
            <Logo className="h-16 w-16" />
          </div>
          <p className="technical text-[11px] gold-text mb-6">WEBINAR · 01.11</p>
          <h1 className="relic-heading text-4xl md:text-6xl leading-[0.95]">{TITLE}</h1>
          <p className="technical text-xs md:text-sm text-foreground/60 mt-6">{SUBTITLE}</p>
          <p className="mt-8 text-foreground/60 leading-relaxed max-w-2xl mx-auto text-left md:text-center">
            {TEXT}
          </p>
        </div>
      </section>

      <section className="relative py-16 px-5 border-t hairline bg-[#070708]">
        <div className="mx-auto max-w-xl">
          {closed ? (
            <div className="text-center py-10">
              <p className="relic-heading text-2xl md:text-3xl text-foreground/80">
                Zapisy zamknięte.
              </p>
              <p className="mt-4 text-foreground/60">Zapraszam następnym razem.</p>
            </div>
          ) : done ? (
            <div className="text-center py-10 fade-up">
              <p className="relic-heading text-2xl md:text-3xl gold-text mb-6">
                Jesteś zapisany.
              </p>
              <p className="text-foreground/70">
                Link do Zoom:{" "}
                <a
                  href={ZOOM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="gold-text underline break-all"
                >
                  {ZOOM_URL}
                </a>
              </p>
              <button onClick={downloadIcs} className="btn-ghost mt-8">
                DODAJ DO KALENDARZA (.ICS)
              </button>
              <p className="mt-6 text-foreground/50 text-sm">
                Ten sam link dostaniesz e-mailem.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-2">
                  IMIĘ
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0A0A0B] border hairline px-4 py-3 text-foreground focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-2">
                  E-MAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0A0A0B] border hairline px-4 py-3 text-foreground focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer text-sm text-foreground/70">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 accent-[#C9A24A]"
                />
                <span>
                  Zapisuję się na wydarzenie 1 listopada i akceptuję{" "}
                  <Link to="/polityka-prywatnosci" className="gold-text underline">
                    politykę prywatności
                  </Link>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer text-sm text-foreground/70">
                <input
                  type="checkbox"
                  checked={listy}
                  onChange={(e) => setListy(e.target.checked)}
                  className="mt-1 accent-[#C9A24A]"
                />
                <span>
                  Chcę też dostawać Listy powrotu — jeden list w każdy poniedziałek.
                </span>
              </label>
              {error && <p className="blood-text text-sm">{error}</p>}
              <button type="submit" disabled={sending} className="btn-relic disabled:opacity-50">
                {sending ? "ZAPISUJĘ…" : "ZAPISUJĘ SIĘ"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}