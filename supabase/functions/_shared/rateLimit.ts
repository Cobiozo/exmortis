// Prosty limit zgłoszeń z jednego adresu IP (rejestr w SecurityLog), dla publicznych formularzy wysyłających e-mail.
// Chroni przed masowym wysyłaniem wiadomości na cudze adresy i wyczerpaniem dziennego limitu poczty.
// Przy błędzie technicznym przepuszcza (fail-open) — formularz nigdy nie przestaje działać przez licznik.
export async function ipAllowed(base44, ip: string, type: string, max: number, windowMs: number, details = ""): Promise<boolean> {
  if (!ip || ip === "brak") return true;
  try {
    const L = base44.asServiceRole.entities.SecurityLog;
    const since = new Date(Date.now() - windowMs).toISOString();
    const recent = await L.filter({ type, ip, created_date: { $gte: since } }, "-created_date", max + 1);
    if (recent.length >= max) return false;
    await L.create({ type, ip, details: String(details).slice(0, 80) });
  } catch {
    return true;
  }
  return true;
}
export const TOO_MANY = "Zbyt wiele zgłoszeń z tego połączenia. Spróbuj ponownie za godzinę.";
