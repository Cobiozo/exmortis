import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { plWhenFull } from "@/components/exmortis/events/time";

// Pulpit: spotkanie online za mniej niż 48 h bez linku do Zoom.
export default function ZoomWarning({ items }) {
  if (!items?.length) return null;
  return (
    <div className="border border-[#C9A24A] p-5 mb-8 space-y-2">
      {items.map((e, i) => (
        <p key={i} className="flex items-start gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 gold-text shrink-0 mt-0.5" />
          <span>Spotkanie „{e.title}” ({plWhenFull(e.start)}) nie ma linku do Zoom. <Link to="/admin/spotkania" className="gold-text underline">Uzupełnij</Link></span>
        </p>
      ))}
    </div>
  );
}