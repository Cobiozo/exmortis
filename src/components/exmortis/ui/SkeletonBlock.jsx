import React from "react";
import { cn } from "@/lib/utils";

// SkeletonBlock — miejsce ładowanej treści o docelowych wymiarach (żeby nic nie skakało po wczytaniu).
// Użycie: <SkeletonBlock className="h-[220px]" />  ·  <SkeletonBlock className="h-4 w-2/3" />
export default function SkeletonBlock({ className = "", rounded = "var(--exm-r-field)" }) {
  return (
    <div
      aria-hidden="true"
      style={{ borderRadius: rounded }}
      className={cn("animate-pulse bg-exm-surface-2", className)}
    />
  );
}