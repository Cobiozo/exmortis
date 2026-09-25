import { runSql, escStr } from "./supabase.ts";

// Dopisuje adres do listy „Listy powrotu” (public.subscribers).
// consentGiven=true → zapisuje datę i godzinę udzielenia zgody.
export async function addSubscriber(base44, { email, name, consentGiven }) {
  await runSql(
    base44,
    `ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS consent_date timestamptz`
  );
  const nameVal =
    name === undefined || name === null || String(name).trim() === ""
      ? "NULL"
      : escStr(String(name).trim().slice(0, 200));
  await runSql(
    base44,
    `INSERT INTO public.subscribers (id, email, name, consent_date)
     VALUES (gen_random_uuid()::text, ${escStr(email)}, ${nameVal}, ${
      consentGiven ? "now()" : "NULL"
    })
     ON CONFLICT (email) DO NOTHING`
  );
}