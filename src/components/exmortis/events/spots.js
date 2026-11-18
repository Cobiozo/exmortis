// Wolne miejsca wyłącznie z danych spotkania (capacity i registered z API).
// Brak limitu miejsc → null, czyli żadnej informacji o miejscach.
export function spotsLeft(ev) {
  const capacity = ev?.capacity ? Number(ev.capacity) : 0;
  if (!(capacity > 0)) return null;
  return Math.max(0, capacity - (Number(ev?.registered) || 0));
}

export function spotsText(ev) {
  const left = spotsLeft(ev);
  if (left === null) return null;
  if (left === 0) return "brak wolnych miejsc";
  if (left === 1) return "ostatnie wolne miejsce";
  if (left < 5) return `wolne miejsca: ${left}`;
  return `wolnych miejsc: ${left}`;
}