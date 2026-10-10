import React from "react";
import { warsawNote } from "./time";

// Mniejszym tekstem „20:00 czasu polskiego” — tylko gdy gość jest w innej strefie.
export default function WarsawNote({ iso, className = "" }) {
  const n = warsawNote(iso);
  return n ? <span className={`block text-xs text-foreground/50 font-mono mt-1 ${className}`}>{n}</span> : null;
}