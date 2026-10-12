import { runSql, escStr } from "./supabase.ts";

// Ogłoszenia na koncie: status i to, czy ogłoszenie trafia do danej osoby (wspólne dla „announcements” i „notifications”).
export function annStatus(a, now = Date.now()) {
  if (!a.opublikowane) return "Szkic";
  if (a.zakonczono_at || (a.do && new Date(a.do).getTime() <= now)) return "Zakończone";
  if (a.od && new Date(a.od).getTime() > now) return "Zaplanowane";
  return "Aktywne";
}

export async function inAudience(sr, base44, a, me) {
  if (a.odbiorcy === "wszyscy") return true;
  const email = String(me.email).toLowerCase();
  if (a.odbiorcy === "produkt") {
    const rows = await sr.entities.Access.filter({ user_email: email, product_id: a.cel_id }, "-created_date", 5);
    const today = new Date().toISOString().slice(0, 10);
    return rows.some((r) => !r.valid_until || r.valid_until >= today);
  }
  if (a.odbiorcy === "obok") return (await sr.entities.ObokUczestnik.filter({ seria_id: a.cel_id, user_email: email }, "-created_date", 1)).length > 0;
  if (a.odbiorcy === "spotkanie") {
    const r = await runSql(base44, `SELECT 1 FROM public.registrations WHERE event_id = ${escStr(a.cel_id)} AND lower(email) = ${escStr(email)}
      AND status IN ('Zapisany','Obecny','Lista rezerwowa') LIMIT 1`, true).catch(() => []);
    return r.length > 0;
  }
  return false;
}

// Aktywne ogłoszenia dla osoby (bez zamkniętych przez nią) + mapa „widziane”.
export async function myAnnouncements(sr, base44, me) {
  const A = sr.entities.Announcement, S = sr.entities.AnnouncementSeen;
  const all = (await A.filter({ opublikowane: true }, "-created_date", 200)).filter((a) => annStatus(a) === "Aktywne");
  const mine = [];
  for (const a of all) if (await inAudience(sr, base44, a, me)) mine.push(a);
  const seen = mine.length ? await S.filter({ user_id: me.id, ann_id: { $in: mine.map((a) => a.id) } }, "-created_date", 500) : [];
  const by = Object.fromEntries(seen.map((s) => [s.ann_id, s]));
  return { items: mine.filter((a) => !by[a.id]?.dismissed_at), seen: by };
}
