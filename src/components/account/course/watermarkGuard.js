// Sprawdza, czy znak wodny istnieje i jest widoczny (nie usunięty / ukryty stylami).
export function watermarkOk(container) {
  const el = container?.querySelector('[data-wm="1"]');
  if (!el || !el.isConnected) return false;
  const s = window.getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return s.display !== "none" && s.visibility === "visible" && Number(s.opacity) >= 0.1 &&
    r.width > 20 && r.height > 5 && s.color !== "transparent" && !s.color.endsWith(", 0)") &&
    Number(s.fontSize.replace("px", "")) >= 9;
}