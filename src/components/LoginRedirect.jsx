import React from "react";
import { Navigate, useLocation } from "react-router-dom";

// Niezalogowany na stronie dla zalogowanych → logowanie z powrotem w to samo miejsce (np. /konto?tab=spotkania z maila).
export default function LoginRedirect() {
  const { pathname, search } = useLocation();
  const back = pathname + search;
  return <Navigate to={back && back !== "/" ? `/login?returnTo=${encodeURIComponent(back)}` : "/login"} replace />;
}
