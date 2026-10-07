// Mapowanie strona publiczna ↔ ekran panelu.
export function panelFor(path) {
  if (path.startsWith("/spotkania")) return "/admin/spotkania";
  if (path.startsWith("/sklep") || path.startsWith("/produkt")) return "/admin/skarbiec";
  if (path.startsWith("/cisza")) return "/admin/cisza";
  if (path.startsWith("/glos/")) return "/admin/podcast";
  if (path.startsWith("/glos")) return "/admin/glos";
  if (path.startsWith("/test")) return "/admin/testy";
  if (["/", "/o-mnie", "/powrot", "/kontakt"].includes(path)) return "/admin/tresci";
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