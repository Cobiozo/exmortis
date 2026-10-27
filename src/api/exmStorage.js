// Pliki z panelu → magazyn na hostingu aplikacji (cyberfolks.pl), obsługiwany przez server.js + multer.
// Zapis: POST /api/media/upload (multipart, pole „file", ?scope=public|private) — tylko dla zalogowanego konta.
// Odczyt: publiczne /media/public/<plik>, prywatne /media/private/<plik>?e=…&s=… (link podpisany, z terminem).
//
// Zastępuje wgrywanie do Supabase Storage (błąd 404 / „brak kubełka"). Pliki sprzed migracji leżą nadal
// w starym magazynie, dlatego ich podpisywanie (CreateFileSignedUrl dla „private/…", „public/…") zostało bez zmian.
// Format wyników jak w funkcjach serwera: publiczny → file_url, prywatny → file_uri „cf/private/<plik>".

import { SITE_URL } from "@/config/site";
import { SUPABASE_URL, ANON_KEY } from "./exmSupabase";
import { supaBearer } from "./exmAuth";

const API = "/api/media";

async function token() {
  const t = await supaBearer().catch(() => null);
  if (!t) throw new Error("Zaloguj się ponownie, żeby wgrać plik.");
  return t;
}

async function failText(res, fallback) {
  const j = await res.json().catch(() => null);
  const msg = (j && (j.error || j.message)) || `błąd ${res.status}`;
  if (res.status === 413) return /pdf/i.test(msg) ? "PDF może mieć najwyżej 100 MB." : "Plik jest większy niż limit magazynu (500 MB).";
  return `${fallback}: ${msg}`;
}

async function send(file, scope) {
  if (!file) throw new Error("Nie wybrano pliku.");
  const body = new FormData();
  body.append("file", file, file.name || "plik");
  const res = await fetch(`${API}/upload?scope=${scope}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}` },
    body,
  });
  if (!res.ok) throw new Error(await failText(res, "Nie udało się wgrać pliku"));
  const j = await res.json();
  if (!j || !j.name) throw new Error("Nie udało się wgrać pliku: serwer nie zwrócił nazwy pliku.");
  return j.name;
}

export async function UploadPublicFile({ file }) {
  const name = await send(file, "public");
  return { file_url: `${SITE_URL}/media/public/${encodeURIComponent(name)}` };
}

export async function UploadPrivateFile({ file }) {
  const name = await send(file, "private");
  return { file_uri: `cf/private/${name}` };
}

// Podpisany link do pliku prywatnego (podgląd w panelu). Adresy http zwracamy bez zmian.
export async function CreateFileSignedUrl({ file_uri, expires_in = 300 }) {
  const uri = String(file_uri || "");
  if (/^https?:\/\//.test(uri)) return { signed_url: uri };
  if (/^cf\//.test(uri)) return signHosted(uri, expires_in);
  return legacySign(uri, expires_in);
}

async function signHosted(uri, expires_in) {
  const res = await fetch(`${API}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ file_uri: uri, expires_in }),
  });
  if (!res.ok) throw new Error(await failText(res, "Nie udało się utworzyć linku do pliku"));
  const j = await res.json();
  if (!j || !j.signed_url) throw new Error("Nie udało się utworzyć linku do pliku.");
  return { signed_url: j.signed_url };
}

// --- Pliki sprzed migracji (stary magazyn Supabase) ---
async function legacySign(uri, expires_in) {
  const m = uri.match(/^(?:supabase:\/\/)?(public|private)\/(.+)$/);
  if (!m) return null; // nieznany wpis — obsługa po stronie wywołującego
  const jwt = await token();
  const expiresIn = Math.max(60, Math.min(Number(expires_in) || 300, 604800));
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${m[1]}/${m[2].split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(await failText(res, "Nie udało się utworzyć linku do pliku"));
  const j = await res.json();
  const rel = j.signedURL || j.signedUrl;
  if (!rel) throw new Error("Nie udało się utworzyć linku do pliku.");
  return { signed_url: `${SUPABASE_URL}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}` };
}