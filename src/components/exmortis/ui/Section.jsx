import React from "react";
import { cn } from "@/lib/utils";

// Section — pas treści z odstępem pionowym z tokenu (--exm-section-y: 56 px / 40 px).
// tone: "default" (tło strony) · "surface" (#111113) · "bordo" (bordowe tło marki).
// id służy do kotwic (np. /#manifest) — nagłówek nie zasłania początku sekcji.
// Użycie: <Section id="kontakt" tone="surface">…</Section>
const TONES = {
  default: "",
  surface: "bg-exm-surface",
  bordo: "bg-exm-bordo",
};

export default function Section({ id, tone = "default", as: Tag = "section", className = "", children, ...rest }) {
  return (
    <Tag id={id} className={cn("py-[var(--exm-section-y)]", TONES[tone] || "", className)} {...rest}>
      {children}
    </Tag>
  );
}