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

const col = (title, links) => ({ title, links: links.map(([label, to]) => ({ label, to })) });
export const FOOTER = [
  col("Skarbiec", [["Wszystkie produkty", "/sklep?src=footer"], ["Spotkania", "/spotkania?src=footer"], ["Powrót — mentoring", "/powrot"], ["Moje konto", "/konto"]]),
  col("Słuchaj", [["Podcast „Głos”", "/glos?src=footer"], ["Chwila ciszy", "/cisza?src=footer"], ["Test: która śmierć jest Twoja?", "/test?src=footer"]]),
  col("Poznaj", [["Strona główna", "/"], ["O mnie", "/o-mnie"], ["Manifest", "/#manifest"], ["Formularz kontaktowy", "/#kontakt"]]),
  col("Kontakt", [["kontakt@exmortis.pl", "mailto:kontakt@exmortis.pl"], ["Instagram", "https://www.instagram.com/e.x.m.o.r.t.i.s/"],
    ["Facebook", "https://www.facebook.com/dawidkowalczyk.exmortis"], ["YouTube", "https://www.youtube.com/@e.x.m.o.r.t.i.s"]]),
];

export const isActive = (pathname, to) => {
  const p = to.split("?")[0];
  return pathname === p || pathname.startsWith(p + "/");
};