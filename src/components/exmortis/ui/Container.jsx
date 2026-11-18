import React from "react";
import { cn } from "@/lib/utils";

// Container — szerokość treści z tokenu (1200 px) albo wąska kolumna tekstu (720 px).
// Marginesy boczne: --exm-pad (20 / 32 / 48 px).
// Użycie: <Container>…</Container>  ·  <Container narrow as="div">…</Container>
export default function Container({ narrow = false, as: Tag = "div", className = "", children, ...rest }) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-[var(--exm-pad)]",
        narrow ? "max-w-[var(--exm-container-narrow)]" : "max-w-[var(--exm-container)]",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}