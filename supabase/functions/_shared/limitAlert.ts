import { runSql } from "./supabase.ts";
import { getSetting, saveSetting } from "./settings.ts";
import { sendMail, adminTo } from "./smtp.ts";

// Alert (audyt bezpieczeństwa 16.11.2026): bardzo dużo zdarzeń limitów z jednego adresu w ciągu godziny.
// Najczęstsza przyczyna: zmiana adresu serwera exmortis.pl — wtedy wszyscy klienci liczą się jako jeden adres
// i limity mogą blokować kasę, pobieranie i zapisy. Druga: ktoś masowo próbuje kodów albo formularzy.
// Raz na 12 godzin, bez danych osobowych w treści (sam adres IP i liczba zdarzeń).
const PROG = 40;
export async function limitAlert(base44) {
  const rows = await runSql(base44, `SELECT data->>'ip' AS ip, count(*)::int AS n, string_agg(DISTINCT data->>'type', ', ') AS typy
     FROM public.exm_securitylog WHERE created_date > now() - interval '1 hour' AND COALESCE(data->>'ip','') NOT IN ('', 'brak')
     GROUP BY 1 HAVING count(*) >= ${PROG} ORDER BY 2 DESC LIMIT 3`, true).catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return 0;
  const st = (await getSetting(base44, "alert_limity").catch(() => null)) || {};
  if (st.at && Date.now() - Date.parse(st.at) < 12 * 3600000) return 0;
  const to = await adminTo(base44).catch(() => null);
  if (!to) return 0;
  const lista = rows.map((r) => `<li>${String(r.ip).replace(/[<>&]/g, "")} — ${r.n} zdarzeń (${String(r.typy || "").replace(/[<>&]/g, "")})</li>`).join("");
  await sendMail(base44, {
    to, kind: "alert", subject: "EXMORTIS — nietypowo dużo zdarzeń z jednego adresu",
    html: `<p>W ostatniej godzinie z jednego adresu przyszło co najmniej ${PROG} zdarzeń objętych limitami:</p><ul>${lista}</ul>
      <p>Jeśli to adres serwera strony (np. po zmianie u dostawcy), klienci mogą trafiać na limity w kasie i przy pobieraniu — daj znać informatykowi albo mnie.
      Jeśli to obcy adres — ktoś masowo próbuje kodów lub formularzy; limity go zatrzymują.</p>`,
  });
  await saveSetting(base44, "alert_limity", { at: new Date().toISOString() }).catch(() => {});
  return rows.length;
}
