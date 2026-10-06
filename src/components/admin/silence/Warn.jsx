import React from "react";
import { AlertTriangle } from "lucide-react";

export default function Warn({ text }) {
  return (
    <p className="flex items-start gap-2 text-xs text-[#E8C547] bg-[#E8C547]/10 border border-[#E8C547]/30 px-3 py-2">
      <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.25} /> {text}
    </p>
  );
}