// Pliki z panelu → Supabase Storage (krok 5 migracji). Zastępuje integrations.Core.Upload*/CreateFileSignedUrl,
// które po przeniesieniu hostingu trafiały na nieistniejący adres starej platformy (błąd 404 przy każdym wgraniu).
//
// Wgrywanie idzie wprost z przeglądarki do Storage z tokenem sesji zalogowanego administratora
// (uprawnienia: polityki storage.objects — docs/tech/storage_buckets.sql). Format wyników jak w funkcjach
// serwera (supabase/functions/_shared/compat.ts): publiczny → file_url, prywatny → file_uri "private/<plik>".
// Pliki powyżej 6 MB idą protokołem wznawialnym (TUS) w kawałkach po 6 MB — tak wymaga Supabase dla dużych plików.

import { SUPABASE_URL, ANON_KEY } from "./exmSupabase";
import { supaBearer } from "./exmAuth";

export const PUB_BUCKET = "public";
export const PRIV_BUCKET = "private";
const CHUNK = 6 * 1024 * 1024;

const safeName = (f) => `${Date.now()}-${String(f?.name || "plik").replace(/[^\w.\-]/g, "_").slice(-120)}`;
const b64 = (s) => btoa(unescape(encodeURIComponent(String(s))));

async function token() {
  const t = await supaBearer().catch(() => null);
  if (!t) throw new Error("Zaloguj się ponownie, żeby wgrać plik.");
  return t;
}

async function failText(res) {
  const j = await res.json().catch(() => null);
  const msg = (j && (j.message || j.error)) || `błąd ${res.status}`;
  if (res.status === 413 || /too large|maximum allowed size|exceeded/i.test(msg)) return "Plik jest większy niż limit magazynu plików.";
  if (/bucket not found/i.test(msg)) return "Magazyn plików nie jest jeszcze skonfigurowany (brak kubełka).";
  if (res.status === 401 || res.status === 403 || /row-level security|unauthorized/i.test(msg)) return "Brak uprawnień do wgrywania plików (konto administratora).";
  return `Nie udało się wgrać pliku: ${msg}`;
}

async function putSmall(bucket, name, file, jwt) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "false", "cache-control": "31536000" },
    body: file,
  });
  if (!res.ok) throw new Error(await failText(res));
}

async function putResumable(bucket, name, file, jwt) {
  const base = { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, "Tus-Resumable": "1.0.0" };
  const meta = [["bucketName", bucket], ["objectName", name], ["contentType", file.type || "application/octet-stream"], ["cacheControl", "31536000"]]
    .map(([k, v]) => `${k} ${b64(v)}`).join(",");
  const start = await fetch(`${SUPABASE_URL}/storage/v1/upload/resumable`, {
    method: "POST", headers: { ...base, "Upload-Length": String(file.size), "Upload-Metadata": meta, "x-upsert": "false" },
  });
  if (!start.ok) throw new Error(await failText(start));
  let loc = start.headers.get("Location");
  if (!loc) throw new Error("Nie udało się rozpocząć wgrywania (brak adresu sesji).");
  if (!/^https?:/.test(loc)) loc = `${SUPABASE_URL}${loc.startsWith("/") ? "" : "/"}${loc}`;
  let offset = 0;
  while (offset < file.size) {
    const part = file.slice(offset, Math.min(offset + CHUNK, file.size));
    let ok = false, last = null;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
      const res = await fetch(loc, {
        method: "PATCH", headers: { ...base, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, body: part,
      }).catch((e) => { last = e; return null; });
      if (res && res.ok) { offset = Number(res.headers.get("Upload-Offset")) || offset + part.size; ok = true; }
      else if (res && res.status === 409) {
        // Rozjechany offset po zerwanym połączeniu — pytamy serwer, ile już ma.
        const head = await fetch(loc, { method: "HEAD", headers: base }).catch(() => null);
        const o = head && Number(head.headers.get("Upload-Offset"));
        if (Number.isFinite(o)) { offset = o; ok = true; }
      } else if (res) { last = new Error(await failText(res)); if (res.status < 500 && res.status !== 408) break; }
    }
    if (!ok) throw last instanceof Error ? last : new Error("Wgrywanie przerwane — sprawdź połączenie i spróbuj ponownie.");
  }
}

async function upload(bucket, file) {
  if (!file) throw new Error("Nie wybrano pliku.");
  const jwt = await token();
  const name = safeName(file);
  if (file.size > CHUNK) await putResumable(bucket, name, file, jwt);
  else await putSmall(bucket, name, file, jwt);
  return name;
}

export async function UploadPublicFile({ file }) {
  const name = await upload(PUB_BUCKET, file);
  return { file_url: `${SUPABASE_URL}/storage/v1/object/public/${PUB_BUCKET}/${encodeURIComponent(name)}` };
}

export async function UploadPrivateFile({ file }) {
  const name = await upload(PRIV_BUCKET, file);
  return { file_uri: `${PRIV_BUCKET}/${name}` };
}

// Podpisany link do pliku prywatnego (podgląd w panelu). Adresy http zwracamy bez zmian.
export async function CreateFileSignedUrl({ file_uri, expires_in = 300 }) {
  const uri = String(file_uri || "");
  if (/^https?:\/\//.test(uri)) return { signed_url: uri };
  const m = uri.match(/^(?:supabase:\/\/)?(public|private)\/(.+)$/);
  if (!m) return null; // stary plik sprzed migracji — obsługa niżej (fallback)
  const jwt = await token();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${m[1]}/${m[2].split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: Math.max(60, Math.min(Number(expires_in) || 300, 604800)) }),
  });
  if (!res.ok) throw new Error(await failText(res));
  const j = await res.json();
  const rel = j.signedURL || j.signedUrl;
  return { signed_url: `${SUPABASE_URL}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}` };
}
