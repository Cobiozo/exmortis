import React from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

// Tylko dla administratora: skrót do zarządzania muzyką w panelu (zastępuje dawny menedżer na stronie, 27.11.2026).
export default function AdminEditLink({ to = "/admin/glos?widok=muzyka&tab=utwory", label = "Edytuj muzykę w panelu" }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || user?.role !== "admin") return null;
  return (
    <div className="mt-10 flex justify-end">
      <Link to={to} className="inline-flex items-center gap-2 text-[13px] text-exm-muted hover:text-exm-gold">
        <Pencil className="h-3.5 w-3.5" /> {label}
      </Link>
    </div>
  );
}
