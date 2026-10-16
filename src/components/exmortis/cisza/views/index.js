// Jeden widok czasu w czterech odmianach.
export const VIEWS = [
  { id: "cyfry", label: "Same cyfry" },
  { id: "cyfry_sek", label: "Cyfry z sekundami" },
  { id: "cyfry_pasek", label: "Cyfry i pasek" },
  { id: "pasek", label: "Sam pasek" },
];

export const DEFAULT_VIEW = "cyfry_pasek";
export const isView = (id) => VIEWS.some((v) => v.id === id);
export const getView = (id) => VIEWS.find((v) => v.id === id) || VIEWS[0];
export const nextView = (id) => VIEWS[(VIEWS.findIndex((v) => v.id === id) + 1) % VIEWS.length].id;