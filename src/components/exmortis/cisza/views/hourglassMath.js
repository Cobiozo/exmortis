// Geometria klepsydry. d = odległość od szyjki (0) do podstawy (1), promień względny 0..1.
export const NECK = 0.05;
const N = 240;

export const radius = (d) => {
  const body = Math.pow(Math.sin(Math.min(1, d) * Math.PI / 2), 0.6);
  const cap = Math.pow(Math.max(0, (d - 0.78) / 0.22), 2) * 0.22;
  return NECK + (1 - NECK) * body * (1 - cap);
};

// Objętość od szyjki do d (całka z r² — przekrój okrągły).
const CUM = (() => {
  const c = [0];
  for (let i = 1; i <= N; i++) {
    const d = (i - 0.5) / N;
    c.push(c[i - 1] + radius(d) ** 2 / N);
  }
  return c;
})();

export const volTo = (d) => {
  const x = Math.max(0, Math.min(1, d)) * N;
  const i = Math.floor(x);
  return i >= N ? CUM[N] : CUM[i] + (CUM[i + 1] - CUM[i]) * (x - i);
};

export const levelFor = (v) => {
  let lo = 0, hi = 1;
  for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (volTo(m) < v) lo = m; else hi = m; }
  return lo;
};

export const FULL = 0.8;
export const TOTAL = volTo(1);

// Poziomy piasku z postępu (liczone z objętości, nie z wysokości).
export function sandLevels(p) {
  const v0 = volTo(FULL);
  const top = levelFor(v0 * (1 - p));
  const bottom = levelFor(TOTAL - v0 * p);
  return { top, bottom, empty: p >= 1, start: p <= 0 };
}