// Zapisy z przeglądarki przez bramkę supabaseData (po przeniesieniu funkcji na Supabase).
// Reguły odwzorowują rls encji aplikacji: panele treści — admin+techniczna (staff),
// pozostałe bezpośrednie zapisy z interfejsu — tylko administrator. Zapisy użytkowników
// wykonują funkcje serwerowe (np. zamówienia, rezerwacje), nie bramka.

const STAFF = new Set(["SitePage", "PageVersion", "CmsSection", "MediaAsset", "SiteNav", "PageRedirect", "PublishedPage", "PodcastSettings", "PodcastEpisode", "PodcastPlaylist"]);
const ADMIN = new Set(["Utwor", "PodcastGuest", "ObokNagranie", "ObokSeria", "ObokUczestnik", "CourseLesson", "DiscountCode"]);
const SYSTEM = new Set(["created_date", "updated_date", "created_by_id"]);

function forbidden() {
  const e: any = new Error("FORBIDDEN");
  e.forbidden = true;
  throw e;
}

function allowed(entity: string, op: string, role: string): boolean {
  const staff = role === "admin" || role === "techniczna";
  if (STAFF.has(entity)) return staff;
  if (ADMIN.has(entity)) return role === "admin";
  if (entity === "ContentLog") return op === "create" ? staff : role === "admin";
  if (entity === "DataAccessLog") return op === "create" ? role === "admin" : false;
  return false;
}

// Rekord bez pól systemowych (id zostaje — potrzebne przy bulkUpdate).
function strip(rec: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) if (!SYSTEM.has(k)) out[k] = v;
  return out;
}

export async function supaWrite(base44: any, user: { id: string; role: string }, payload: any) {
  const { op, entity, args = {} } = payload || {};
  if (!allowed(entity, op, user.role)) forbidden();
  const e: any = (base44.entities as any)[entity];
  const me = { created_by_id: user.id };
  switch (op) {
    case "create": return e.create({ ...strip(args.rec), ...me });
    case "bulkCreate": return e.bulkCreate((args.recs || []).map((r: any) => ({ ...strip(r), ...me })));
    case "update": return e.update(args.id, strip(args.patch));
    case "bulkUpdate": return e.bulkUpdate((args.list || []).map((r: any) => ({ id: r.id, ...strip(r) })));
    case "delete": return e.delete(args.id);
    case "updateMany": return e.updateMany(args.query || {}, args.ops || {});
    case "deleteMany": return e.deleteMany(args.query || {});
    default: forbidden();
  }
}