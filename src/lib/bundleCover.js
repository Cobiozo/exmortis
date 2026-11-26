// Okładka pakietu z okładek produktów (26.11.2026): kwadrat 1200×1200, ciemne tło,
// okładki w równych kafelkach, złota ramka i podpis „PAKIET · N PRODUKTÓW”.
// Obrazy są z tej samej domeny (exmortis.pl/media, /img), więc płótno nie jest „skażone” i da się je zapisać.
const SIZE = 1200;

async function loadImage(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("obraz");
  const blob = await res.blob();
  return await createImageBitmap(blob);
}

const countLabel = (n) => {
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? `${n} PRODUKTY` : `${n} PRODUKTÓW`;
};

// products: [{ image_url, cover_image, name }] — zwraca File (webp albo png) albo rzuca, gdy brak okładek.
export async function makeBundleCover(products, name = "") {
  const urls = products.map((p) => p?.image_url || p?.cover_image).filter(Boolean).slice(0, 4);
  const imgs = (await Promise.all(urls.map((u) => loadImage(u).catch(() => null)))).filter(Boolean);
  if (!imgs.length) throw new Error("Wybrane produkty nie mają okładek — wgraj okładkę pakietu ręcznie.");

  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext("2d");

  // Tło: głęboka czerń z delikatnym złotym światłem od środka.
  g.fillStyle = "#0A0A0B";
  g.fillRect(0, 0, SIZE, SIZE);
  const glow = g.createRadialGradient(SIZE / 2, SIZE * 0.45, 40, SIZE / 2, SIZE * 0.45, SIZE * 0.7);
  glow.addColorStop(0, "rgba(201,162,74,0.16)");
  glow.addColorStop(1, "rgba(201,162,74,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, SIZE, SIZE);

  // Okładki w równych kafelkach (kadr „cover” od środka) — działa i dla pionowych okładek, i dla zdjęć poziomych.
  const n = imgs.length;
  const area = { x: 100, y: 100, w: SIZE - 200, h: SIZE - 330 };
  const gap = 24;
  // Układ: 1 → cały obszar, 2 → dwie kolumny, 3 → duża po lewej i dwie po prawej, 4 → siatka 2×2.
  const half = (area.w - gap) / 2;
  const halfH = (area.h - gap) / 2;
  const cells =
    n === 1 ? [[area.x, area.y, area.w, area.h]]
    : n === 2 ? [[area.x, area.y, half, area.h], [area.x + half + gap, area.y, half, area.h]]
    : n === 3 ? [[area.x, area.y, half, area.h], [area.x + half + gap, area.y, half, halfH], [area.x + half + gap, area.y + halfH + gap, half, halfH]]
    : [0, 1, 2, 3].map((i) => [area.x + (i % 2) * (half + gap), area.y + Math.floor(i / 2) * (halfH + gap), half, halfH]);
  imgs.forEach((img, i) => {
    const [x, y, cw, ch] = cells[i];
    // Kadr „cover”, chyba że ucięłby ponad 45% obrazu — wtedy cały obraz wpisany w kafelek („contain”).
    const cover = Math.max(cw / img.width, ch / img.height);
    const lost = 1 - Math.min((cw / cover) / img.width, (ch / cover) / img.height);
    const fit = lost > 0.45 ? Math.min(cw / img.width, ch / img.height) : cover;
    const dw = Math.min(cw, img.width * fit);
    const dh = Math.min(ch, img.height * fit);
    const dx = x + (cw - dw) / 2;
    const dy = y + (ch - dh) / 2;
    const sw = dw / fit;
    const sh = dh / fit;
    g.save();
    g.shadowColor = "rgba(0,0,0,0.6)";
    g.shadowBlur = 40;
    g.shadowOffsetY = 14;
    g.fillStyle = "#0A0A0B";
    g.fillRect(dx, dy, dw, dh);
    g.restore();
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, dw, dh);
    g.strokeStyle = "rgba(245,239,225,0.14)";
    g.lineWidth = 2;
    g.strokeRect(dx, dy, dw, dh);
  });

  // Złota ramka i podpis.
  g.strokeStyle = "rgba(201,162,74,0.55)";
  g.lineWidth = 2;
  g.strokeRect(40, 40, SIZE - 80, SIZE - 80);
  g.textAlign = "center";
  g.fillStyle = "#C9A24A";
  g.font = "600 34px 'Courier New', monospace";
  g.fillText(`PAKIET · ${countLabel(products.length)}`.split("").join(" "), SIZE / 2, SIZE - 150);
  if (name) {
    g.fillStyle = "#F5EFE1";
    g.font = "48px Georgia, 'Times New Roman', serif";
    let t = String(name);
    while (g.measureText(t).width > SIZE - 200 && t.length > 4) t = `${t.slice(0, -2).trimEnd()}…`;
    g.fillText(t, SIZE / 2, SIZE - 88);
  }

  const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.9));
  const out = blob || (await new Promise((r) => c.toBlob(r, "image/png")));
  const type = out.type || "image/png";
  return new File([out], `pakiet-${Date.now()}.${type.includes("webp") ? "webp" : "png"}`, { type });
}
