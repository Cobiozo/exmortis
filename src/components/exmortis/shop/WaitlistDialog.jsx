import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { track } from "@/lib/track";

// Małe okno zapisu na listę oczekujących przy produktach „wkrótce".
export default function WaitlistDialog({ product, onClose }) {
  const [form, setForm] = useState({ first_name: "", email: "", consent: false });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (!product) return null;

  // Limit miejsc wykorzystany: ten sam zapis, tylko inne słowa.
  const soldOut = !!(product.seats && product.seats.left <= 0);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.consent) {
      setError("Potrzebuję Twojej zgody na kontakt.");
      return;
    }
    setSending(true);
    try {
      await base44.functions.invoke("shopWaitlist", {
        first_name: form.first_name,
        email: form.email,
        product_id: product.id,
      });
      track("Lead", { content_name: "lista_oczekujacych" });
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.error && err.response.status < 500 ? err.response.data.error : "Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#0A0A0B]/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md border border-[#C9A24A]/30 bg-[#0D0D0E] p-8 fade-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-foreground/55 hover:text-foreground transition-colors"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4" />
        </button>

        {sent ? (
          <div className="text-center py-6 space-y-4">
            <Check className="h-8 w-8 gold-text mx-auto" />
            <p className="shop-heading text-2xl text-[#F5EFE1]">Dziękuję.</p>
            <p className="text-sm text-foreground/60 leading-relaxed">
              {soldOut ? "Napiszę do Ciebie, gdy zwolni się miejsce." : "Napiszę do Ciebie, kiedy to będzie gotowe."}
            </p>
            <button onClick={onClose} className="btn-ghost !px-5 !py-2.5 text-[10px]">
              ZAMKNIJ
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <p className="technical text-[9px] gold-text mb-2">{soldOut ? "LISTA REZERWOWA" : "LISTA OCZEKUJĄCYCH"}</p>
              <h3 className="shop-heading text-2xl text-[#F5EFE1]">{product.name}</h3>
            </div>
            <div>
              <label className="technical text-[9px] text-foreground/55 block mb-2">IMIĘ</label>
              <input
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="technical text-[9px] text-foreground/55 block mb-2">E-MAIL</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5"
              />
              <span className="text-xs text-foreground/55 leading-relaxed">
                {soldOut
                  ? "Wyrażam zgodę, żeby exmortis napisał do mnie, gdy zwolni się miejsce."
                  : "Wyrażam zgodę, żeby exmortis napisał do mnie, kiedy ten materiał będzie dostępny."}
              </span>
            </label>
            {error && <p className="text-xs blood-text">{error}</p>}
            <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
              {sending ? "ZAPISUJĘ..." : soldOut ? "DAJ ZNAĆ, GDY ZWOLNI SIĘ MIEJSCE" : "ZAPISZ MNIE"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}