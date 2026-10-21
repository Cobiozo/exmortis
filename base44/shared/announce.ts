import { runSql, escStr } from "./supabase.ts";
import { accessFilter } from "./mirror.ts";

// Ogłoszenia na koncie: status i to, czy ogłoszenie trafia do danej osoby (wspólne dla „announcements” i „notifications”).

export function annStatus(a, now = Date.now()) {
  if (!a.opublikowane) return "Szkic";
  if (a.zakonczono_at || (a.do && new Date(a.do).getTime() <= now)) return "Zakończone";
  if (a.od && new Date(a.od).getTime() > now) return "Zaplanowane";
  return "Aktywne";
}

// Przynależność do grup odbiorców liczona ZBIORCZO: jedno zapytanie na typ odbiorcy, nie na ogłoszenie.
// Wcześniej każde ogłoszenie robiło własne zapytanie (przy 200 ogłoszeniach i 200 wejściach na dzwoneczek
// mieliło bazę bez potrzeby) — teraz to najwyżej trzy zapytania na całą listę.
async function audienceSets(sr, base44, me, all) {
  const email = String(me?.email || "").toLowerCase();
  const idsOf = (typ) => [...new Set(all.filter((a) => a.odbiorcy === typ && a.cel_id).map((a) => String(a.cel_id)))];
  const prodIds = idsOf("produkt"), obokIds = idsOf("obok"), evIds = idsOf("spotkanie");
  const today = new Date().toISOString().slice(0, 10);
  const [acc, obok, regs] = await Promise.all([
    prodIds.length ? accessFilter(base44, { user_email: email, product_id: { $in: prodIds } }, "-created_date", 500) : [],
    obokIds.length ? sr.entities.ObokUczestnik.filter({ user_email: email, seria_id: { $in: obokIds } }, "-created_date", 500) : [],
    evIds.length
      ? runSql(base44, `SELECT DISTINCT event_id::text AS id FROM public.registrations
           WHERE lower(email) = ${escStr(email)} AND status IN ('Zapisany','Obecny','Lista rezerwowa')
             AND event_id::text IN (${evIds.map(escStr).join(",")})`, true).catch(() => [])
      : [],
  ]);
  return {
    produkt: new Set(acc.filter((r) => !r.valid_until || r.valid_until >= today).map((r) => String(r.product_id))),
    obok: new Set(obok.map((r) => String(r.seria_id))),
    spotkanie: new Set((regs || []).map((r) => String(r.id))),
  };
}

export async function inAudience(sr, base44, a, me) {
  if (a.odbiorcy === "wszyscy") return true;
  const set = (await audienceSets(sr, base44, me, [a]))[a.odbiorcy];
  return !!set && set.has(String(a.cel_id));
}

// Aktywne ogłoszenia dla osoby (bez zamkniętych przez nią) + mapa „widziane”.
export async function myAnnouncements(sr, base44, me) {
  const A = sr.entities.Announcement, S = sr.entities.AnnouncementSeen;
  const all = (await A.filter({ opublikowane: true }, "-created_date", 200)).filter((a) => annStatus(a) === "Aktywne");
  const sets = await audienceSets(sr, base44, me, all);
  const mine = all.filter((a) => a.odbiorcy === "wszyscy" || !!sets[a.odbiorcy]?.has(String(a.cel_id)));
  const seen = mine.length ? await S.filter({ user_id: me.id, ann_id: { $in: mine.map((a) => a.id) } }, "-created_date", 500) : [];
  const by = Object.fromEntries(seen.map((s) => [s.ann_id, s]));
  return { items: mine.filter((a) => !by[a.id]?.dismissed_at), seen: by };
}