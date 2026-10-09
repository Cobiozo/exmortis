import React from "react";
import { Link } from "react-router-dom";
import useMailStatus from "@/lib/useMailStatus";

// Pulpit: ostrzeżenie, dopóki wysyłka nie ma statusu DZIAŁA.
export default function MailWarning() {
  const { status, ready } = useMailStatus();
  if (!status || ready) return null;
  return (
    <Link to="/admin/ustawienia" className="block border border-[#BC1E22]/60 bg-[#BC1E22]/10 p-5 mb-6 text-sm">
      Wysyłka e-mail nie jest skonfigurowana — {status.queue?.total || 0} maili czeka w kolejce. <span className="gold-text underline">Ustawienia → Wysyłka e-mail.</span>
    </Link>
  );
}