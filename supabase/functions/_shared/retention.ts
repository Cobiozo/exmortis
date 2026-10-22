import { runSql, escStr } from "./supabase.ts";
import { consentFilter } from "./mirror.ts";
import { purgeUnconfirmed } from "./newsletter.ts";

// Okresy przechowywania (polityka prywatności §3), uruchamiane w ticku co 15 min.

// Polityka prywatności §3 pkt 9: „dzienniki — 90 dni". Dotyczy to dziennika odtworzeń (adres IP, urządzenie,
// identyfikator lekcji) i dziennika bezpieczeństwa (adres IP przy formularzach, pobraniach PDF i limitach).
// Nic ich dotąd nie usuwało, więc rosły bez końca — a to w nich leżą adresy IP.
const LOG_RETENTION_DAYS = 90;
const purgeLogs = (E, before) =>
  E.deleteMany({ created_date: { $lt: before } })
    .then((r) => Number(typeof r === "number" ? r : (r?.deleted ?? r?.count ?? 0)) || 0)
    .catch(() => 0);

export async function runRetention(base44) {
  const withdrawn = await consentFilter(base44, { kind: "test_art9", status: "wycofana" }, "-created_date", 1000);
  const emails = [...new Set(withdrawn.map((c) => String(c.email).toLowerCase()))];
  const [quiz, quizW, powrot, listy] = await Promise.all([
    runSql(base44, `DELETE FROM public.quiz_result WHERE created_at < now() - interval '12 months' RETURNING 1`),
    emails.length ? runSql(base44, `DELETE FROM public.quiz_result WHERE lower(email) IN (${emails.map(escStr).join(",")}) RETURNING 1`) : [],
    runSql(base44, `DELETE FROM public.powrot_applications
      WHERE (wspolpraca_od IS NULL AND created_date::timestamptz < now() - interval '6 months')
         OR (wspolpraca_do IS NOT NULL AND wspolpraca_do < (now() - interval '12 months')::date) RETURNING 1`),
    purgeUnconfirmed(base44),
  ]);
  const before = new Date(Date.now() - LOG_RETENTION_DAYS * 86400000).toISOString();
  const [dziennik_odtworzen, dziennik_bezpieczenstwa] = await Promise.all([
    purgeLogs(base44.asServiceRole.entities.PlaybackLog, before),
    purgeLogs(base44.asServiceRole.entities.SecurityLog, before),
  ]);
  return { quiz_12m: quiz.length, quiz_wycofane: quizW.length, powrot: powrot.length, listy_niepotwierdzone: listy,
    dziennik_odtworzen, dziennik_bezpieczenstwa };
}