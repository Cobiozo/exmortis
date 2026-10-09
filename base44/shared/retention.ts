import { runSql, escStr } from "./supabase.ts";
import { purgeUnconfirmed } from "./newsletter.ts";

// Okresy przechowywania (polityka prywatności §3), uruchamiane w ticku co 15 min.
export async function runRetention(base44) {
  const withdrawn = await base44.asServiceRole.entities.Consent.filter({ kind: "test_art9", status: "wycofana" }, "-created_date", 1000);
  const emails = [...new Set(withdrawn.map((c) => String(c.email).toLowerCase()))];
  const [quiz, quizW, powrot, listy] = await Promise.all([
    runSql(base44, `DELETE FROM public.quiz_result WHERE created_at < now() - interval '12 months' RETURNING 1`),
    emails.length ? runSql(base44, `DELETE FROM public.quiz_result WHERE lower(email) IN (${emails.map(escStr).join(",")}) RETURNING 1`) : [],
    runSql(base44, `DELETE FROM public.powrot_applications
      WHERE (wspolpraca_od IS NULL AND created_date::timestamptz < now() - interval '6 months')
         OR (wspolpraca_do IS NOT NULL AND wspolpraca_do < (now() - interval '12 months')::date) RETURNING 1`),
    purgeUnconfirmed(base44),
  ]);
  return { quiz_12m: quiz.length, quiz_wycofane: quizW.length, powrot: powrot.length, listy_niepotwierdzone: listy };
}