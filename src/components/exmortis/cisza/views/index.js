// Jeden widok czasu w trzech odmianach.
export const VIEWS = [
  { id: "cyfry_pasek", label: "Cyfry i pasek" },
  { id: "cyfry", label: "Same cyfry" },
  { id: "pasek", label: "Sam pasek" },
];

export const DEFAULT_VIEW = "cyfry_pasek";
export const isView = (id) => VIEWS.some((v) => v.id === id);
export const getView = (id) => VIEWS.find((v) => v.id === id) || VIEWS[0];
export const nextView = (id) => VIEWS[(VIEWS.findIndex((v) => v.id === id) + 1) % VIEWS.length].id;