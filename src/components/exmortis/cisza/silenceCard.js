// „Karta ciszy” 1080×1920: czarne tło, ostatnia klatka widoku, napis, logo, adres.
const LOGO = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/58566649a_logogrupaeq31.png";

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

export async function makeSilenceCard(stageEl, view, minutes, bg) {
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

  const B = { x: 190, y: 470, s: 700 };
  const canvas = stageEl.querySelector("canvas");
  const svg = stageEl.querySelector("svg");
  await document.fonts?.load('80px "EB Garamond"').catch(() => {});
  if (view === "klepsydra" && canvas) {
    x.drawImage(canvas, B.x, B.y, B.s, B.s);
  } else if (svg) {
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", B.s);
    clone.setAttribute("height", B.s);
    clone.querySelectorAll("[vector-effect]").forEach((n) => { n.removeAttribute("vector-effect"); n.setAttribute("stroke-width", "0.3"); });
    const img = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone)));
    x.drawImage(img, B.x, B.y, B.s, B.s);
  } else if (view === "pasek") {
    x.fillStyle = "#C9A24A";
    x.fillRect(B.x, B.y + B.s / 2, B.s, 4);
  } else {
    x.fillStyle = "#F5EFE1";
    x.font = '200px "EB Garamond", Georgia, serif';
    x.textAlign = "center";
    x.fillText("00", 400, B.y + B.s / 2 + 60);
    x.fillText("00", 680, B.y + B.s / 2 + 60);
    x.fillStyle = "#C9A24A";
    x.fillText(":", 540, B.y + B.s / 2 + 50);
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