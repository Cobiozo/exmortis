export const NAV = [
  { label: "O mnie", to: "/o-mnie" },
  { label: "Powrót", to: "/powrot" },
  { label: "Skarbiec", to: "/sklep" },
  { label: "Spotkania", to: "/spotkania?src=nav" },
  { label: "Cisza", to: "/cisza" },
  { label: "Głos", to: "/glos" },
  { label: "Kontakt", to: "/#kontakt" },
];
export const TEST = { label: "Test", to: "/test?src=nav" };

export const isActive = (pathname, to) => {
  const p = to.split("?")[0];
  return pathname === p || pathname.startsWith(p + "/");
};