import { base44 } from "@/api/base44Client";

// Dziennik dostępu do danych osobowych: kto i kiedy wyeksportował dane.
export async function logAccess(akcja, zakres, liczba) {
  const me = await base44.auth.me();
  await base44.entities.DataAccessLog.create({ kto: me.email, akcja, zakres, liczba, at: new Date().toISOString() });
}