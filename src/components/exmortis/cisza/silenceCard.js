// „Karta ciszy” 1080×1920: czarne tło, ostatnia klatka widoku, napis, logo, adres.
const LOGO = "/exmortis-logo-karta.png";

// Wybrane tło w wersji pionowej (kadr wg punktu skupienia) + przyciemnienie.
async function drawBackdrop(x, bg) {
  const W = 1080, H = 1920;
  if (bg.typ === "kolor") { x.fillStyle = bg.kolor || "#0A0A0A"; x.fillRect(0, 0, W, H); }
  else if (bg.typ === "gradient") {
    const cols = (bg.kolory || []).filter(Boolean);
    const a = ((bg.kierunek ?? 180) * Math.PI) / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const L = Math.abs(W * dx) + Math.abs(H * dy);
    const g = x.createLinearGradient(W / 2 - (dx * L) / 2, H / 2 - (dy * L) / 2, W / 2 + (dx * L) / 2, H / 2 + (dy * L) / 2);
    cols.forEach((col, i) => g.addColorStop(cols.length > 1 ? i / (cols.length - 1) : 0, col));
    x.fillStyle = cols.length ? g : "#0A0A0A";
    x.fillRect(0, 0, W, H);
  } else {
    const src = bg.typ === "zdjecie" ? bg.zdjecie_pionowe || bg.zdjecie_szerokie : bg.poster;
    const img = src ? await loadImg(src).catch(() => null) : null;
    if (img) {
      const s = Math.max(W / img.width, H / img.height);
      const w = img.width * s, h = img.height * s;
      const fx = (bg.fokus_x ?? 50) / 100, fy = (bg.fokus_y ?? 50) / 100;
      const ox = Math.min(0, Math.max(W - w, W / 2 - w * fx));
      const oy = Math.min(0, Math.max(H - h, H / 2 - h * fy));
      if (bg.rozmycie) x.filter = `blur(${bg.rozmycie * 1.5}px)`;
      x.drawImage(img, ox, oy, w, h);
      x.filter = "none";
    }
  }
  x.fillStyle = `rgba(0,0,0,${(Number(bg.przyciemnienie) || 0) / 100})`;
  x.fillRect(0, 0, W, H);
}

const loadImg = (src) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

export async function makeSilenceCard(view, minutes, bg) {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1920;
  const x = c.getContext("2d");
  x.fillStyle = "#0A0A0A";
  x.fillRect(0, 0, 1080, 1920);
  if (bg && !bg.systemowe) await drawBackdrop(x, bg);
  else {
    const v = x.createRadialGradient(540, 820, 0, 540, 820, 1000);
    v.addColorStop(0, "rgba(201,162,74,0.07)");
    v.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = v;
    x.fillRect(0, 0, 1080, 1920);
  }

  await document.fonts?.load('80px "EB Garamond"').catch(() => {});
  // Cyfry „00:00” + pełny złoty pasek (wg wybranego widoku).
  x.textAlign = "center";
  if (view === "cyfry") {
    x.font = '230px "EB Garamond", Georgia, serif';
    x.fillStyle = "#F5EFE1";
    x.fillText("00", 540, 900);
  } else if (view !== "pasek") {
    x.font = '230px "EB Garamond", Georgia, serif';
    x.fillStyle = "#F5EFE1";
    x.fillText("00", 365, 900);
    x.fillText("00", 715, 900);
    x.fillStyle = "#C9A24A";
    x.fillText(":", 540, 885);
  }
  if (view !== "cyfry") {
    const y = view === "pasek" ? 830 : 980;
    x.fillStyle = "#C9A24A";
    x.shadowColor = "rgba(201,162,74,0.6)";
    x.shadowBlur = 16;
    x.fillRect(240, y, 600, 6);
    x.shadowBlur = 0;
  }

  x.textAlign = "center";
  x.fillStyle = "#F5EFE1";
  x.font = '76px "EB Garamond", Georgia, serif';
  x.fillText(`${minutes} minut ciszy`, 540, 1340);
  const logo = await loadImg(LOGO).catch(() => null);
  if (logo) x.drawImage(logo, 420, 1420, 240, 240);
  x.fillStyle = "#C9A24A";
  x.font = '34px "EB Garamond", Georgia, serif';
  x.fillText("exmortis.pl", 540, 1680);

  return new Promise((res) => c.toBlob(res, "image/png"));
}