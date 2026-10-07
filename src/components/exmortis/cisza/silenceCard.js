// „Karta ciszy” 1080×1920: czarne tło, ostatnia klatka widoku, napis, logo, adres.
const LOGO = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/f5aebd2a8_logogrupaeq26.png";

const loadImg = (src) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

export async function makeSilenceCard(stageEl, view, minutes) {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1920;
  const x = c.getContext("2d");
  x.fillStyle = "#0A0A0A";
  x.fillRect(0, 0, 1080, 1920);
  const v = x.createRadialGradient(540, 820, 0, 540, 820, 1000);
  v.addColorStop(0, "rgba(201,162,74,0.07)");
  v.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = v;
  x.fillRect(0, 0, 1080, 1920);

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
  if (logo) x.drawImage(logo, 470, 1460, 140, 140);
  x.fillStyle = "#C9A24A";
  x.font = '34px "EB Garamond", Georgia, serif';
  x.fillText("exmortis.pl", 540, 1680);

  return new Promise((res) => c.toBlob(res, "image/png"));
}