// Porównanie tekstów bez znaczników, wielkości liter i odstępów — żeby to samo zdanie nie stało dwa razy.
export const sameText = (a, b) => {
  const n = (x) => String(x || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return !!n(a) && n(a) === n(b);
};