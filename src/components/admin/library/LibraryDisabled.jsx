import React from "react";
import { Link } from "react-router-dom";
import { PowerOff } from "lucide-react";

export default function LibraryDisabled() {
  return (
    <div className="border hairline px-6 py-14 text-center space-y-4">
      <PowerOff className="h-10 w-10 mx-auto gold-text" />
      <p className="relic-heading text-2xl">Moduł wyłączony</p>
      <p className="text-sm text-foreground/50 max-w-md mx-auto">
        Ten moduł jest wyłączony. Włącz go w sekcji Ustawienia → „Biblioteka i wiadomości".
      </p>
      <Link to="/admin/ustawienia" className="btn-relic inline-flex">USTAWIENIA</Link>
    </div>
  );
}