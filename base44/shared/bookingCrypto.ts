// Szyfrowanie danych o zdrowiu — AES-256-GCM (WebCrypto). Klucz (BOOKING_ENC_KEY) nigdy nie opuszcza
// funkcji serwera: do bazy trafia wyłącznie zaszyfrowana wartość, nigdy klucz ani hasło.
const te = new TextEncoder();
const td = new TextDecoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (s) => Uint8Array.from((String(s).match(/../g) || []).map((h) => parseInt(h, 16)));

// Klucz 256-bitowy z sekretu o dowolnej długości (SHA-256 → zawsze 32 bajty).
export async function aesKeyFromSecret(bytes) {
  const raw = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// Format zapisu: [1 bajt wersji][12 bajtów losowego IV][szyfrogram + tag GCM]. Zwraca hex.
export async function encryptHealth(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(String(text))));
  const out = new Uint8Array(1 + 12 + ct.length);
  out[0] = 1;
  out.set(iv, 1);
  out.set(ct, 13);
  return toHex(out);
}

export async function decryptHealth(key, hexStr) {
  const bytes = fromHex(hexStr);
  if (bytes.length < 14 || bytes[0] !== 1) return null;
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(1, 13) }, key, bytes.slice(13));
  return td.decode(pt);
}