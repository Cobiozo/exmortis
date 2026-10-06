// Dostępy klientów do produktów cyfrowych (encja Access w Base44).

export const DIGITAL = ["pdf", "audio", "wideo", "kurs"];

export const warsawToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });

function addMonths(ymd: string, m: number) {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + m, d)).toISOString().slice(0, 10);
}

// Dostęp trwa do końca dnia valid_until (Europe/Warsaw); puste = bezterminowo.
export function isActive(a) {
  return !a.revoked && (!a.valid_until || a.valid_until >= warsawToday());
}

// Nadaje albo wydłuża dostęp — nigdy go nie skraca.
export async function grantAccess(base44, { email, product, source, orderId = null }) {
  const E = base44.asServiceRole.entities.Access;
  const mail = String(email).toLowerCase();
  const existing = (await E.filter({ user_email: mail, product_id: String(product.id) }))[0];
  if (existing && source === "darmowy" && !existing.revoked) return;

  const today = warsawToday();
  const months = product.access_months ? Number(product.access_months) : null;
  let until = null;
  if (months) {
    const live = existing && !existing.revoked && existing.valid_until && existing.valid_until >= today;
    until = addMonths(live ? existing.valid_until : today, months);
  }
  if (existing && !existing.revoked && !existing.valid_until) until = null;

  const entry = { date: new Date().toISOString(), source, order_id: orderId, valid_until: until };
  const data = {
    user_email: mail,
    product_id: String(product.id),
    product_name: product.name,
    product_type: product.product_type || "pdf",
    valid_until: until,
    source,
    order_id: orderId || "",
    revoked: false,
  };
  if (!until) delete data.valid_until;
  if (existing) {
    await E.update(existing.id, { ...data, history: [...(existing.history || []), entry] });
    if (!until && existing.valid_until) await E.updateMany({ id: existing.id }, { $unset: { valid_until: "" } });
  }
  else await E.create({ ...data, valid_from: today, history: [entry] });
  return until;
}

// Konto dla kupującego bez logowania: zaproszenie z linkiem do ustawienia hasła.
export async function ensureAccount(base44, email) {
  const found = await base44.asServiceRole.entities.User.filter({ email: String(email).toLowerCase() });
  if (found.length) return false;
  try {
    await base44.asServiceRole.users.inviteUser(String(email).toLowerCase(), "user");
    return true;
  } catch {
    return false;
  }
}