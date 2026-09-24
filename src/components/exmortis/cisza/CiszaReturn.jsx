import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const NOTES_KEY = "cisza-notatki";

// Ekran 4 — powrót: refleksja (tylko lokalnie) i trzy spokojne wybory.
export default function CiszaReturn({ onAgain, reduced }) {
  const [lit, setLit] = useState(false);
  const [shown, setShown] = useState(false);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    try {
      setNotes(JSON.parse(localStorage.getItem(NOTES_KEY) || "[]"));
    } catch {
      setNotes([]);
    }
    const t1 = setTimeout(() => setLit(true), 80);
    const t2 = setTimeout(() => setShown(true), reduced ? 100 : 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduced]);

  const saveNote = () => {
    const v = note.trim();
    if (!v) return;
    const next = [{ date: new Date().toISOString(), text: v }, ...notes];
    setNotes(next);
    localStorage.setItem(NOTES_KEY, JSON.stringify(next));
    setNote("");
  };

  const clearNotes = () => {
    setNotes([]);
    localStorage.removeItem(NOTES_KEY);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !consent) {
      setError("Podaj imię, e-mail i zaznacz zgodę na kontakt.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await base44.functions.invoke("subscribeNewsletter", {
        email,
        name,
        source: "cisza-7-wieczorow",
      });
      setSent(true);
    } catch {
      setError("Nie udało się zapisać. Spróbuj jeszcze raz.");
    }
    setSending(false);
  };

  return (
    <section
      className={`min-h-screen flex flex-col items-center justify-center px-6 py-24 transition-colors ${
        lit ? "bg-[#1C1C1E]" : "bg-[#0A0A0B]"
      }`}
      style={{ transitionDuration: reduced ? "0ms" : "2000ms" }}
    >
      <div
        className={`w-full max-w-2xl text-center transition-opacity ${shown ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDuration: reduced ? "0ms" : "2000ms" }}
      >
        <h1 className="shop-heading text-4xl md:text-6xl text-[#F5EFE1]">Jesteś z powrotem.</h1>

        <p className="mt-10 text-foreground/60">Co było słychać w tej ciszy?</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="mt-4 w-full max-w-xl bg-transparent border hairline p-4 text-foreground/80 text-sm leading-relaxed focus:outline-none focus:border-[#C9A24A]/60 transition-colors mx-auto block"
          placeholder=""
        />
        <p className="mt-3 text-xs text-foreground/35">
          To zostaje tylko na Twoim urządzeniu. Nic nie trafia na serwer.
        </p>
        <button onClick={saveNote} className="btn-ghost mt-4 !px-6 !py-3">
          ZAPISZ
        </button>

        {notes.length > 0 && (
          <div className="mt-10 max-w-xl mx-auto text-left">
            {notes.map((n, i) => (
              <div key={i} className="border-b hairline py-4">
                <p className="technical text-[9px] text-foreground/30 mb-2">
                  {new Date(n.date).toLocaleString("pl-PL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">
                  {n.text}
                </p>
              </div>
            ))}
            <button
              onClick={clearNotes}
              className="mt-4 technical text-[9px] text-foreground/40 hover:text-[#F5EFE1]/70 transition-colors"
            >
              WYCZYŚĆ MOJE NOTATKI
            </button>
          </div>
        )}

        <div className="mt-14 flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onAgain} className="btn-ghost">
            Jeszcze raz
          </button>
          <button onClick={() => setShowForm((v) => !v)} className="btn-ghost">
            7 wieczorów ciszy — bezpłatnie
          </button>
          <Link to="/" className="btn-ghost">
            Wracam na stronę
          </Link>
        </div>

        {showForm && (
          <div className="mt-10 max-w-md mx-auto text-left border hairline p-6 md:p-8">
            {sent ? (
              <p className="text-sm text-[#C9A24A] leading-relaxed">
                Zapisane. Odezwę się w sprawie siedmiu wieczorów ciszy.
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="technical text-[9px] text-foreground/50">IMIĘ</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full bg-transparent border hairline px-3 py-2 text-sm text-foreground/80 focus:outline-none focus:border-[#C9A24A]/60"
                  />
                </div>
                <div>
                  <label className="technical text-[9px] text-foreground/50">E-MAIL</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full bg-transparent border hairline px-3 py-2 text-sm text-foreground/80 focus:outline-none focus:border-[#C9A24A]/60"
                  />
                </div>
                <label className="flex items-start gap-3 text-xs text-foreground/50 leading-relaxed cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 accent-[#C9A24A]"
                  />
                  Zgadzam się na kontakt w sprawie „7 wieczorów ciszy”.
                </label>
                {error && <p className="text-xs blood-text">{error}</p>}
                <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-50">
                  {sending ? "ZAPISUJĘ…" : "ZAPISZ MNIE"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}