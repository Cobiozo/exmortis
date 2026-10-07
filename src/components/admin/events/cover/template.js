import { drawCover, loadImg, LOGO } from "./coverKit";
import { plWhenFull } from "@/components/exmortis/events/time";

// Okładka z szablonu: czarne tło z winietą, logo, typ złotymi kapitalikami,
// tytuł kremowym szeryfem (maks. 3 linie, dopasowanie), data złotem, stopka.
export const VARIANTS = ["Środek", "Do lewej", "Rama"];

function wrap(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/); const lines = []; let cur = "";
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}

export async function renderTemplate(ev, w, h, variant = 0, bg = null, story = false) {
  await document.fonts?.load?.("600 40px 'EB Garamond'").catch(() => {});
  const cv = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#0A0A0B"; ctx.fillRect(0, 0, w, h);
  if (bg) { drawCover(ctx, bg, w, h); ctx.fillStyle = "rgba(10,10,11,0.72)"; ctx.fillRect(0, 0, w, h); }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(26,23,18,0.35)"); v.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

  const u = Math.min(w, h) / 100; // jednostka
  const left = variant === 1;
  const pad = u * (variant === 2 ? 12 : 9);
  const x = left ? pad : w / 2;
  ctx.textAlign = left ? "left" : "center";
  const usableH = story ? h * 0.66 : h; // relacja: dolna 1/3 wolna na naklejkę

  if (variant === 2) { ctx.strokeStyle = "rgba(201,162,74,0.55)"; ctx.lineWidth = Math.max(2, u * 0.25); ctx.strokeRect(u * 5, u * 5, w - u * 10, h - u * 10); }
  try { const logo = await loadImg(LOGO); const lh = u * 7, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, left ? pad : w / 2 - lw / 2, pad * 0.8, lw, lh); } catch { /* bez logo */ }

  const maxW = w - pad * 2;
  let size = u * 13, lines;
  ctx.font = `600 ${size}px 'EB Garamond', Georgia, serif`;
  while ((lines = wrap(ctx, ev.title || "Tytuł spotkania", maxW)).length > 3 || lines.some((l) => ctx.measureText(l).width > maxW)) {
    size *= 0.92; ctx.font = `600 ${size}px 'EB Garamond', Georgia, serif`; if (size < u * 4) break;
  }
  const lineH = size * 1.08;
  const block = u * 4 + u * 3 + lines.length * lineH + u * 8;
  let y = (usableH - block) / 2 + u * 4;

  ctx.fillStyle = "#C9A24A"; ctx.font = `500 ${u * 2.6}px 'Inter', sans-serif`;
  ctx.letterSpacing = `${u * 0.6}px`;
  ctx.fillText(String(ev.event_type || "Spotkanie").toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
  y += u * 3 + size * 0.9;
  ctx.fillStyle = "#F5EFE1"; ctx.font = `600 ${size}px 'EB Garamond', Georgia, serif`;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  y += (lines.length - 1) * lineH + u * 7;
  ctx.fillStyle = "#C9A24A"; ctx.font = `400 ${u * 3.6}px 'EB Garamond', Georgia, serif`;
  if (ev.start_datetime) ctx.fillText(plWhenFull(ev.start_datetime, " · "), x, y);

  ctx.fillStyle = "rgba(226,226,226,0.6)"; ctx.font = `400 ${u * 2.3}px 'Inter', sans-serif`;
  const foot = [ev.format === "Online" ? "online" : "stacjonarnie", Number(ev.price) > 0 ? `${Number(ev.price)} zł` : "bezpłatnie", "exmortis.pl/spotkania"].join(" · ");
  ctx.fillText(foot, x, usableH - pad * 0.8);
  return cv;
}

export const canvasBlob = (cv, type = "image/png", q) => new Promise((ok) => cv.toBlob(ok, type, q));
export async function downloadCanvas(cv, name) {
  const b = await canvasBlob(cv);
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(b), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}