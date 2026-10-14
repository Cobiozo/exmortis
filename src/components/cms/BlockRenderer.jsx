import React from "react";
import { TYPES } from "./blockTypes";
import Section from "./Section";
import HeroBlock from "./blocks/HeroBlock";
import { TextBlock, ImageBlock, ButtonsBlock, QuoteBlock, SeparatorBlock, LinesBlock, TextImageBlock } from "./blocks/SimpleBlocks";
import { CardsBlock, StepsBlock, FaqBlock } from "./blocks/ListBlocks";
import ModuleSlot from "./ModuleSlot";
import { GalleryBlock, VideoBlock } from "./blocks/MediaBlocks";
import EventSignupBlock from "./blocks/EventSignupBlock";
import SafetyBox from "./blocks/SafetyBox";
import CtaBlock from "./blocks/CtaBlock";
import { isDraft, DRAFT } from "./draft";

const VIEW = { hero: HeroBlock, tekst: TextBlock, tekst_zdjecie: TextImageBlock, zdjecie: ImageBlock, przyciski: ButtonsBlock,
  cytat: QuoteBlock, linie: LinesBlock, etapy: StepsBlock, karty: CardsBlock, faq: FaqBlock, separator: SeparatorBlock, galeria: GalleryBlock, wideo: VideoBlock, zapis_spotkanie: EventSignupBlock, ramka: SafetyBox, cta: CtaBlock };
const DEVICE = { telefon: "md:hidden", komputer: "hidden md:block" };

// Rysuje stronę z bloków. editable — podgląd w panelu (klik wybiera blok, linki nie nawigują).
export default function BlockRenderer({ blocks = [], editable, selectedId, onSelect, tools }) {
  let n = 0;
  const zoom = blocks.some((b) => b.typ === "zapis_spotkanie" && b.widoczny !== false);
  return (
    <div className="bg-[#0A0A0B]">
      {blocks.filter((b) => b.widoczny !== false && (b.typ === "modul" || VIEW[b.typ]) && (editable || b.typ === "faq" || !isDraft(b.dane))).map((b, i) => {
        const u = b.uklad || {};
        const num = u.numer === "auto" ? String(++n).padStart(2, "0") : u.numer === "wlasny" ? u.numer_wlasny : "";
        const d = b.dane || {};
        const label = [d.etykieta, num].filter(Boolean).join(" · ");
        const View = VIEW[b.typ];
        // Moduł (Dla kogo, Skarbiec, Newsletter…) jedzie w osobnym pliku. W pierwszym widoku i w edytorze
        // wchodzi od razu; niżej dociąga się po załadowaniu strony — patrz ModuleSlot.
        const inner = b.typ === "modul"
          ? <ModuleSlot d={d} label={label} eager={editable || i < 2} />
          : <View d={d} label={label} center={u.wyrownanie === "srodek"} editable={editable} zoom={b.typ === "faq" && zoom} />;
        const warn = editable && isDraft(b.dane) && (
          <p className="bg-[#5C1A1B] border border-[#BC1E22] text-[#F5EFE1] text-sm px-4 py-2">Do uzupełnienia: „{DRAFT}” — ta treść jest ukryta dla odwiedzających, dopóki jej nie zastąpisz.</p>
        );
        return (
          <div key={b.id} data-block={b.id} id={u.kotwica || undefined}
            className={`${DEVICE[u.urzadzenia] || ""} ${u.kotwica ? "scroll-mt-20" : ""} ${editable ? `relative cursor-pointer outline-offset-[-2px] hover:outline hover:outline-1 hover:outline-[#C9A24A]/60 ${selectedId === b.id ? "outline outline-2 outline-[#C9A24A]" : ""}` : ""}`}
            onClickCapture={editable ? (e) => { if (e.target.closest("[data-tools]")) return; e.preventDefault(); e.stopPropagation(); onSelect?.(b.id); } : undefined}>
            {editable && selectedId === b.id && tools?.(b)}
            {warn}
            {TYPES[b.typ].bare ? inner : <Section u={u} spine={TYPES[b.typ].spine}>{inner}</Section>}
          </div>
        );
      })}
    </div>
  );
}