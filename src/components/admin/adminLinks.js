// Mapowanie strona publiczna ↔ ekran panelu.
export function panelFor(path) {
  if (path === "/spotkania") return "/admin/tresci?slug=spotkania";
  if (path === "/sklep") return "/admin/tresci?slug=sklep";
  if (path.startsWith("/spotkania")) return "/admin/spotkania";
  if (path.startsWith("/sklep") || path.startsWith("/produkt")) return "/admin/skarbiec";
  if (path.startsWith("/cisza")) return "/admin/cisza";
  if (path.startsWith("/glos/")) return "/admin/podcast";
  if (path === "/glos") return "/admin/tresci?slug=glos";
  if (path === "/o-mnie") return "/admin/tresci?slug=o-mnie";
  if (path === "/kontakt") return "/admin/tresci?slug=kontakt";
  if (path.startsWith("/glos")) return "/admin/glos";
  if (path === "/test") return "/admin/tresci?slug=test";
  if (path === "/powrot") return "/admin/tresci?slug=powrot";
  if (path.startsWith("/test")) return "/admin/testy";
  if (path === "/") return "/admin/tresci?slug=home";
  if (path.startsWith("/strona/")) return `/admin/tresci?slug=${path.slice(8)}`;
  if (["/o-mnie", "/powrot", "/kontakt"].includes(path)) return "/admin/tresci?tab=teksty";
  return "/admin";
}

export function siteFor(path) {
  if (path.startsWith("/admin/spotkania")) return "/spotkania";
  if (path.startsWith("/admin/skarbiec")) return "/sklep";
  if (path.startsWith("/admin/cisza")) return "/cisza";
  if (path.startsWith("/admin/podcast") || path.startsWith("/admin/glos")) return "/glos";
  if (path.startsWith("/admin/testy")) return "/test";
  return "/";
}

export const hasEdit = (path) => panelFor(path) !== "/admin";