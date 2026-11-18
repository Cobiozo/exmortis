import React from "react";
import { cn } from "@/lib/utils";

// SectionHeader — etykieta (eyebrow), tytuł H2 i lead. align: "left" | "center".
// action: opcjonalny link/przycisk po prawej (na telefonie schodzi pod tytuł).
// Użycie: <SectionHeader eyebrow="Powrót" title="Wracam z siebie" lead="…" action={<BrandButton variant="link" to="/powrot">Poznaj</BrandButton>} />
export default function SectionHeader({ eyebrow, title, lead, align = "left", action, as: Heading = "h2", id, className = "" }) {
  const center = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        action && !center ? "md:flex-row md:items-end md:justify-between md:gap-8" : "",
        className
      )}
    >
      <div className={cn("min-w-0 max-w-[62ch]", center && "mx-auto text-center")}>
        {eyebrow && <p className="exm-eyebrow mb-3">{eyebrow}</p>}
        {title && <Heading id={id} className="exm-h2 text-balance">{title}</Heading>}
        {lead && <p className="exm-lead mt-4">{lead}</p>}
      </div>
      {action && <div className={cn("shrink-0", center && "mx-auto")}>{action}</div>}
    </div>
  );
}