import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NUMBERS = [
  { tel: "116123", label: "116 123", desc: "telefon zaufania dla dorosłych w kryzysie emocjonalnym, całą dobę" },
  { tel: "800702222", label: "800 70 2222", desc: "Centrum Wsparcia, całą dobę" },
  { tel: "112", label: "112", desc: "zagrożenie życia" },
];

// Spokojne okno z numerami pomocowymi. Otwierane przyciskiem albo po pilnym zgłoszeniu.
// Bez zapisu, bez pomiaru. Fokus i Esc obsługuje Radix Dialog.
export default function CrisisDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[#3D3D3F] bg-[#0A0A0B] p-7 sm:p-9">
        <DialogHeader>
          <DialogTitle className="relic-heading text-2xl leading-tight text-foreground">
            Jeśli jest Ci teraz bardzo ciężko
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-foreground/70 leading-relaxed">
            Jeśli jest Ci bardzo ciężko albo myślisz o odebraniu sobie życia — nie musisz zostać z tym
            w samotności. Zadzwoń. Te numery są bezpłatne i działają całą dobę.
          </p>
          <div className="space-y-3">
            {NUMBERS.map((n) => (
              <a
                key={n.tel}
                href={`tel:${n.tel}`}
                className="block border hairline px-5 py-4 hover:border-[#C9A24A] transition-colors focus:outline-none focus-visible:border-[#C9A24A] focus-visible:ring-2 focus-visible:ring-[#C9A24A]/40"
              >
                <span className="relic-heading block text-3xl gold-text">{n.label}</span>
                <span className="mt-1 block text-xs text-foreground/60">{n.desc}</span>
              </a>
            ))}
          </div>
          <p className="text-sm text-foreground/55 leading-relaxed">
            exmortis to mentoring, nie terapia ani pomoc kryzysowa — w nagłej sytuacji zadzwoń pod
            jeden z tych numerów.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}