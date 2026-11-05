import React from "react";
import Register from "@/pages/Register";

// Rejestracja działa zawsze — także w czasie przerwy technicznej (zalogowani widzą pełną stronę).
export default function RegisterGate() {
  return <Register />;
}
