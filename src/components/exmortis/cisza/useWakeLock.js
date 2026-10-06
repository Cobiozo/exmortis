import { useEffect } from "react";

// Screen Wake Lock — ekran nie gaśnie, gdy włączone i obsługiwane.
export default function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock = null;
    const acquire = () => navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, [enabled]);
}