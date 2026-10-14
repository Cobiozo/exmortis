import React from "react";
import { Star } from "lucide-react";

// Gwiazdki oceny (1–5).
export function Stars({ value, className = "" }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Ocena ${n} z 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className="h-3.5 w-3.5" fill={i <= n ? "currentColor" : "none"} strokeWidth={1.5} />
      ))}
    </span>
  );
}

// Krótki zapis średniej (karta produktu): ★ 4,8 · 12
export function RatingLine({ avg, count, className = "" }) {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Star className="h-3.5 w-3.5" fill="currentColor" strokeWidth={1.5} />
      {Number(avg || 0).toFixed(1).replace(".", ",")} · {count}
    </span>
  );
}