import React from "react";
import { cn } from "@/lib/utils";

// EmptyState — pusty stan listy lub sekcji: ikona, tytuł, jedno zdanie i opcjonalna akcja.
// Użycie: <EmptyState icon={<Inbox />} title="Nie ma jeszcze wiadomości" description="Pojawią się tutaj." action={<BrandButton to="/kontakt">Napisz</BrandButton>} />
export default function EmptyState({ icon, title, description, action, className = "" }) {
  return (
    <div className={cn("flex flex-col items-center gap-4 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface px-6 py-12 text-center", className)}>
      {icon && <div className="text-exm-gold [&_svg]:h-7 [&_svg]:w-7" aria-hidden="true">{icon}</div>}
      {title && <p className="exm-h3">{title}</p>}
      {description && <p className="max-w-[46ch] text-[15px] leading-relaxed text-exm-muted">{description}</p>}
      {action}
    </div>
  );
}