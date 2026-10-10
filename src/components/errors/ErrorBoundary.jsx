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
  base44.entities.ClientError.create({
    url: (location.origin + location.pathname + location.search.replace(/[?&]_preview_token=[^&]*/, "")).slice(0, 500), message, stack: String(error?.stack || "").slice(0, 2000),
    browser: navigator.userAgent.slice(0, 300), at: new Date().toISOString(),
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