import React from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ErrorFallback from "./ErrorFallback";

const logged = new Set();
function logError(error) {
  const message = String(error?.message || error).slice(0, 500);
  const key = location.pathname + message;
  if (logged.has(key)) return;
  logged.add(key);
  // Zapis przez funkcję serwera: limit 10/h z jednego IP i przycięte pola (bezpośredni zapis SDK jest zablokowany).
  base44.functions.invoke("clientError", {
    url: location.origin + location.pathname + location.search.replace(/[?&]_preview_token=[^&]*/, ""),
    message, stack: String(error?.stack || ""),
    browser: navigator.userAgent, at: new Date().toISOString(),
  }).catch(() => {});
}

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { logError(error); }
  render() { return this.state.error ? <ErrorFallback full={this.props.full} /> : this.props.children; }
}

// Błąd strony nie wywraca aplikacji; zmiana adresu resetuje stan (key).
export default function ErrorBoundary({ children, full = false }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname} full={full}>{children}</Boundary>;
}