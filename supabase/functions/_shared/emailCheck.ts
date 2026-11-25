// Czy domena adresu e-mail w ogóle przyjmuje pocztę (25.11.2026): rekord MX, a bez niego — rekord A/AAAA
// (taka domena też może przyjmować pocztę). Domena, która nie istnieje albo ma „null MX” (RFC 7505), odpada.
// Przy kłopotach z DNS (limit czasu, brak uprawnień, błąd sieci) przepuszczamy — nie blokujemy zakupu przez awarię.
// Uwaga: to nie sprawdza istnienia skrzynki (np. literówka przed @gmail.com) — przed tym chroni pole „Powtórz e-mail”.
const cache = new Map<string, boolean>();

const within = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("dns-timeout")), ms))]);

const notFound = (e: unknown) => /NotFound|NXDOMAIN|no record|not found/i.test(String((e as Error)?.name || "") + " " + String((e as Error)?.message || e));

export async function mailDomainOk(email: string): Promise<boolean> {
  const domain = String(email || "").split("@")[1]?.trim().toLowerCase().replace(/\.$/, "");
  if (!domain || !domain.includes(".")) return false;
  if (cache.has(domain)) return cache.get(domain)!;
  let ok = true;
  try {
    const mx = await within(Deno.resolveDns(domain, "MX"), 2500);
    if (mx.length) ok = !mx.every((r) => !r.exchange || r.exchange === ".");
    else ok = false;
  } catch (e) {
    if (!notFound(e)) return true; // awaria DNS — przepuszczamy, bez zapamiętania
    ok = false;
  }
  if (!ok) {
    // Bez MX: poczta trafia na rekord A/AAAA domeny (RFC 5321) — o ile domena go ma.
    try { ok = (await within(Deno.resolveDns(domain, "A"), 2500)).length > 0; }
    catch (e) {
      if (!notFound(e)) return true;
      try { ok = (await within(Deno.resolveDns(domain, "AAAA"), 2500)).length > 0; } catch (e2) { if (!notFound(e2)) return true; ok = false; }
    }
  }
  cache.set(domain, ok);
  return ok;
}

export const MAIL_DOMAIN_ERROR = "Na ten adres e-mail nie da się wysłać wiadomości — domena po @ nie przyjmuje poczty. Sprawdź, czy adres jest wpisany poprawnie.";

// Walidacja dla formularzy: rzuca błąd walidacji (400) z czytelnym komunikatem.
export async function requireMailDomain(email: string) {
  if (await mailDomainOk(email)) return;
  const e = new Error(MAIL_DOMAIN_ERROR);
  (e as { isValidation?: boolean }).isValidation = true;
  throw e;
}
