import React, { useEffect, useRef } from "react";
import { useFrame } from "./useFrame";
import { radius, sandLevels } from "./hourglassMath";

const GOLD = "#C9A24A";
const SAND = "rgba(216, 192, 140, 0.88)";

// Widok D — klepsydra w Canvas (ostra na Retinie), strumień z cząstek.
export default function HourglassView({ clock, slow, mini }) {
  const cv = useRef(null);
  const g = useRef({ w: 0, h: 0, dpr: 1, parts: [], last: 0, slowFrames: 0, simple: false, acc: 0 });

  useEffect(() => {
    const el = cv.current;
    const fit = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const { width, height } = el.getBoundingClientRect();
      Object.assign(g.current, { w: width * dpr, h: height * dpr, dpr });
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useFrame((now) => {
    const s = g.current;
    const ctx = cv.current?.getContext("2d");
    if (!ctx || !s.w) return;
    const { p, paused } = clock.get();
    const dt = s.last ? Math.min(0.1, (now - s.last) / 1000) : 0;
    s.last = now;
    if (!slow && !mini && dt > 0.025) s.slowFrames++; else if (dt) s.slowFrames = Math.max(0, s.slowFrames - 1);
    if (s.slowFrames > 90) s.simple = true;

    const S = Math.min(s.w, s.h), cx = s.w / 2, cy = s.h / 2;
    const L = S * 0.4, Rw = S * 0.23, lw = 1.25 * s.dpr;
    const X = (d) => radius(d) * Rw;
    ctx.clearRect(0, 0, s.w, s.h);

    const { top, bottom, empty } = sandLevels(p);
    ctx.fillStyle = SAND;
    // Górna bańka: piasek od szyjki do poziomu, lejek nad szyjką.
    if (top > 0.004) {
      const dip = Math.min(top * 0.85, 0.07) * (p > 0 ? 1 : 0.2);
      ctx.beginPath();
      ctx.moveTo(cx - X(0), cy);
      for (let i = 0; i <= 24; i++) { const d = (top * i) / 24; ctx.lineTo(cx - X(d), cy - d * L); }
      ctx.quadraticCurveTo(cx, cy - (top - dip * 2) * L, cx + X(top), cy - top * L);
      for (let i = 24; i >= 0; i--) { const d = (top * i) / 24; ctx.lineTo(cx + X(d), cy - d * L); }
      ctx.fill();
    }
    // Dolna bańka: kopczyk od podstawy.
    let surf = cy + L;
    if (bottom < 0.999) {
      const peak = Math.min(0.12, (1 - bottom) * 0.7);
      surf = cy + (bottom - peak) * L;
      ctx.beginPath();
      ctx.moveTo(cx - X(1), cy + L);
      for (let i = 0; i <= 24; i++) { const d = 1 - ((1 - bottom) * i) / 24; ctx.lineTo(cx - X(d), cy + d * L); }
      ctx.quadraticCurveTo(cx, cy + (bottom - peak * 2) * L, cx + X(bottom), cy + bottom * L);
      for (let i = 24; i >= 0; i--) { const d = 1 - ((1 - bottom) * i) / 24; ctx.lineTo(cx + X(d), cy + d * L); }
      ctx.fill();
    }

    // Strumień przez szyjkę.
    const flowing = p > 0 && !empty && top > 0.004;
    if (!slow) {
      if (s.simple || mini) {
        if (flowing) { ctx.fillStyle = SAND; ctx.fillRect(cx - 0.6 * s.dpr, cy, 1.2 * s.dpr, surf - cy); }
      } else {
        const max = Math.round(120 + 180 * Math.min(1, s.dpr / 2));
        if (!paused && dt) {
          if (flowing) {
            s.acc += dt * max * 1.4;
            while (s.acc >= 1 && s.parts.length < max) {
              s.acc -= 1;
              s.parts.push({ x: (Math.random() - 0.5) * 1.6 * s.dpr, y: cy + Math.random() * 2 * s.dpr, v: S * (0.05 + Math.random() * 0.05) });
            }
          }
          s.parts = s.parts.filter((q) => { q.v += S * 2.2 * dt; q.y += q.v * dt; return q.y < surf; });
        }
        ctx.fillStyle = SAND;
        for (const q of s.parts) ctx.fillRect(cx + q.x - 0.55 * s.dpr, q.y, 1.1 * s.dpr, 1.6 * s.dpr);
      }
    }

    // Kontur jak w logo.
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = lw;
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const d = i / 48; ctx.lineTo(cx - X(d), cy + sg * d * L); }
      ctx.moveTo(cx + X(0), cy);
      for (let i = 0; i <= 48; i++) { const d = i / 48; ctx.lineTo(cx + X(d), cy + sg * d * L); }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - Rw * 1.18, cy + sg * (L + S * 0.025));
      ctx.lineTo(cx + Rw * 1.18, cy + sg * (L + S * 0.025));
      ctx.stroke();
    }
  }, slow);

  return <canvas ref={cv} className="absolute inset-0 w-full h-full" />;
}