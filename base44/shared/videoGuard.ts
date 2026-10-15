import { getSetting } from "./settings.ts";
import { sendMail, adminTo } from "./smtp.ts";

const MAX_PER_HOUR = 60;
const MAX_IPS_24H = 3;
const ALERT_COOLDOWN_H = 12;
export const BLOCK_MSG = "Wstrzymałem odtwarzanie na tym koncie. Jeśli to pomyłka — napisz do mnie.";

// Zwraca komunikat błędu, jeśli odtwarzanie ma być zablokowane; inaczej null.
export async function checkVideoAbuse(base44, email: string, ip: string) {
  const sr = base44.asServiceRole.entities;
  const now = new Date();
  const block = await sr.SecurityLog.filter({ type: "blokada", user_email: email, resolved: false, until: { $gt: now.toISOString() } }, "-created_date", 1);
  if (block.length) return BLOCK_MSG;

  const hourAgo = new Date(now.getTime() - 3600000).toISOString();
  const lastHour = await sr.PlaybackLog.filter({ user_email: email, created_date: { $gte: hourAgo } }, "-created_date", MAX_PER_HOUR + 1);
  if (lastHour.length >= MAX_PER_HOUR) {
    await sr.SecurityLog.create({ type: "wideo_limit", user_email: email, ip, details: `>${MAX_PER_HOUR} żądań/h` });
    return "Zbyt wiele żądań. Spróbuj ponownie za godzinę.";
  }

  const dayAgo = new Date(now.getTime() - 86400000).toISOString();
  const day = await sr.PlaybackLog.filter({ user_email: email, created_date: { $gte: dayAgo } }, "-created_date", 300);
  const ips = new Set(day.map((r) => r.ip).filter(Boolean));
  if (ip) ips.add(ip);
  if (ips.size > MAX_IPS_24H) {
    // Bez automatycznej blokady: odtwarzanie działa dalej, a decyzję podejmuje administrator.
    // Powiadomienie idzie raz na 12 h na konto — inaczej alarm leciałby przy każdym odtworzeniu.
    const details = `${ips.size} różne sieci w 24 h: ${[...ips].join(", ")}`;
    const since = new Date(now.getTime() - ALERT_COOLDOWN_H * 3600000).toISOString();
    const already = await sr.SecurityLog.filter({ type: "wspoldzielenie", user_email: email, created_date: { $gte: since } }, "-created_date", 1);
    if (!already.length) {
      await sr.SecurityLog.create({ type: "wspoldzielenie", user_email: email, ip, details });
      const to = await adminTo(base44);
      if (to) {
        await sendMail(base44, {
          kind: "alarm",
          to,
          subject: `exmortis: podejrzenie współdzielenia konta — ${email}`,
          html: `<p>Konto <b>${email}</b> odtwarzało materiał z ${ips.size} różnych sieci w ciągu 24 godzin.</p><p>${details}</p><p>Odtwarzanie <b>nie zostało wstrzymane</b>. Jeśli to współdzielenie konta — odebranie dostępu: panel admina → Klienci i dostępy.</p>`,
        }).catch(() => {});
      }
    }
  }
  return null;
}