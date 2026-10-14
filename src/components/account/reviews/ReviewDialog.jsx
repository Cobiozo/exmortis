import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Check } from "lucide-react";

const MIN = 20;
const MAX = 1000;

// Formularz opinii: ocena, treść, podpis i wymagana zgoda na publikację.
export default function ReviewDialog({ item, onClose, onSaved }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [name, setName] = useState(item.default_name || "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const text = body.trim();
  const ready = rating > 0 && text.length >= MIN && text.length <= MAX && name.trim().length >= 2 && consent && !busy;

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await base44.functions.invoke("reviews", {
        action: "save",
        order_id: item.order_id,
        product_id: item.product_id,
        rating,
        body: text,
        display_name: name.trim(),
        consent,
      });
      setDone(true);
      onSaved?.();
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się wysłać opinii. Spróbuj jeszcze raz.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0D0D0E] border hairline rounded-none">
        <DialogHeader>
          <DialogTitle className="shop-heading text-xl text-[#F5EFE1]">
            {done ? "Dziękuję" : `Oceń: ${item.product_name}`}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-5 py-2">
            <p className="text-foreground/70 leading-relaxed">
              Opinię mam. Zajrzę do niej i opublikuję — zobaczysz ją na stronie produktu.
            </p>
            <button onClick={onClose} className="btn-ghost w-full">ZAMKNIJ</button>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div>
              <p className="technical text-[10px] text-foreground/50 mb-2">OCENA</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i)}
                    aria-label={`Ocena ${i} z 5`}
                    className={`p-1.5 transition-colors ${i <= rating ? "gold-text" : "text-foreground/30 hover:text-foreground/60"}`}
                  >
                    <Star className="h-6 w-6" fill={i <= rating ? "currentColor" : "none"} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="rev-body" className="technical text-[10px] text-foreground/50 block mb-2">
                TWOJA OPINIA
              </label>
              <textarea
                id="rev-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={MAX + 100}
                placeholder="Jak Ci się czyta, słucha, pracuje z tym materiałem? Co się zmieniło?"
                className="w-full bg-transparent border hairline px-4 py-3 text-sm leading-relaxed focus:border-[#C9A24A] focus:outline-none"
              />
              <p className="technical text-[9px] text-foreground/40 mt-2">
                {text.length < MIN ? `JESZCZE ${MIN - text.length} ZNAKÓW` : `${text.length} / ${MAX}`}
              </p>
            </div>

            <div>
              <label htmlFor="rev-name" className="technical text-[10px] text-foreground/50 block mb-2">
                PODPIS POD OPINIĄ
              </label>
              <input
                id="rev-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="w-full bg-transparent border hairline px-4 py-3 text-sm focus:border-[#C9A24A] focus:outline-none"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-foreground/70 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#C9A24A]"
              />
              <span>
                Zgadzam się na publikację mojej opinii z podpisem <span className="gold-text">{name.trim() || "…"}</span> na exmortis.pl
              </span>
            </label>

            {err && <p className="text-sm blood-text">{err}</p>}

            <button onClick={save} disabled={!ready} className="btn-relic w-full disabled:opacity-40">
              {busy ? "WYSYŁAM..." : "WYŚLIJ OPINIĘ"} {!busy && <Check className="h-4 w-4" />}
            </button>
            <p className="technical text-[9px] text-foreground/35 leading-relaxed">
              OPINIA POJAWI SIĘ NA STRONIE PRODUKTU PO SPRAWDZENIU. NIE PŁACIMY ZA OPINIE I NIE USUWAMY KRYTYCZNYCH.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}