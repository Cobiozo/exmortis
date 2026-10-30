import { runSql, escStr } from "./supabase.ts";

// Drugi etap zgłoszenia POWRÓT — osobisty link do pełnej ankiety.
// Kolumny dokładane przy pierwszym użyciu (bez migracji wdrożeniowej): token, wysyłka, ważność,
// wypełnienie i zgoda na dane o zdrowiu.
const COLUMNS: [string, string][] = [
  ["survey_token", "text"],
  ["survey_sent_at", "timestamptz"],
  ["survey_expires_at", "timestamptz"],
  ["survey_done_at", "timestamptz"],
  ["consent_health", "boolean"],
  ["consent_health_at", "timestamptz"],
];

let READY = false;

export async function ensureSurveyColumns(base44) {
  if (READY) return;
  const adds = COLUMNS.map(([c, t]) => `ADD COLUMN IF NOT EXISTS ${c} ${t}`).join(", ");
  await runSql(base44, `ALTER TABLE public.powrot_applications ${adds}`);
  await runSql(base44, `CREATE INDEX IF NOT EXISTS powrot_survey_token_idx ON public.powrot_applications (survey_token)`).catch(() => {});
  READY = true;
}

export const SURVEY_DAYS = 14;

// Token jednorazowy: 32 losowe bajty w zapisie hex (64 znaki).
export function newSurveyToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const tokenOk = (t: unknown) => /^[a-f0-9]{64}$/.test(String(t ?? "").trim().toLowerCase());

// Link ankiety — adres strony wyłącznie z app_url (loadAppUrl).
export const surveyLink = (appUrl: string, token: string) => `${appUrl}/powrot/ankieta?t=${token}`;

export const firstName = (full: unknown) => String(full ?? "").trim().split(/\s+/)[0] || "";

// ==== Wspólne dla obu etapów zgłoszenia (etap 1 i ankieta) ====
export const wrap = (body: string) =>
  `<div style="background:#0A0A0B;color:#E2E2E2;font-family:Georgia,serif;padding:32px;max-width:560px">${body}<hr style="border:none;border-top:1px solid #3D3D3F;margin:28px 0"><p style="font-size:12px;color:#8A8A8C">W kryzysie: 116 123 · 800 70 2222 · 112</p></div>`;

export const escHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export const bad = (msg: string): never => {
  const e = new Error(msg);
  (e as Error & { isValidation?: boolean }).isValidation = true;
  throw e;
};

export const num1to10 = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : null;
};

export const list = (v: unknown) => (Array.isArray(v) ? v.map((s) => String(s)).slice(0, 20) : []);

export const jsonb = (v: unknown) => `${escStr(JSON.stringify(v))}::jsonb`;