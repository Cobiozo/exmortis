// Czytelność: kremowe cyfry i złote linie muszą mieć kontrast min. 3:1 z tłem po przyciemnieniu.
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hexLum = (h) => {
  const m = (h || "").replace("#", "");
  if (m.length !== 6) return 0;
  return lum(parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16));
};

// Jasność środka kadru (tam, gdzie stoi widok) — 90. percentyl.
function sample(url) {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 48;
        const x = c.getContext("2d");
        const sw = i.width * 0.7, sh = i.height * 0.7;
        x.drawImage(i, (i.width - sw) / 2, (i.height - sh) / 2, sw, sh, 0, 0, 48, 48);
        const d = x.getImageData(0, 0, 48, 48).data;
        const ls = [];
        for (let k = 0; k < d.length; k += 4) ls.push(lum(d[k], d[k + 1], d[k + 2]));
        ls.sort((a, b) => a - b);
        res(ls[Math.floor(ls.length * 0.9)]);
      } catch { res(null); }
    };
    i.onerror = () => res(null);
    i.src = url;
  });
}

export async function backgroundLum(bg) {
  if (bg.typ === "kolor") return hexLum(bg.kolor);
  if (bg.typ === "gradient") return Math.max(0, ...(bg.kolory || []).filter(Boolean).map(hexLum));
  const urls = bg.typ === "zdjecie" ? [bg.zdjecie_szerokie, bg.zdjecie_pionowe] : [bg.poster];
  const vals = await Promise.all(urls.filter(Boolean).map(sample));
  const ok = vals.filter((v) => v != null);
  return ok.length ? Math.max(...ok) : null;
}

const LIMIT = 0.095;
// Minimalne przyciemnienie (%) dla danej jasności tła.
export const requiredDim = (L) => (L == null || L <= LIMIT ? 0 : Math.min(90, Math.ceil((1 - (LIMIT / L) ** (1 / 2.2)) * 100)));