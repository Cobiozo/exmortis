import { base44 } from "@/api/base44Client";

// Lista spotkań (eventsPublic → list) pobierana raz na załadowanie strony i dzielona między blokami
// strony głównej (nagłówek, „Najbliższe spotkania”). Po błędzie kolejne wywołanie spróbuje ponownie.
let pending = null;
export function listPublicEvents() {
  if (!pending) {
    pending = base44.functions.invoke("eventsPublic", { action: "list" })
      .then((r) => r?.data || { upcoming: [], past: [] })
      .catch(() => { pending = null; return { upcoming: [], past: [] }; });
  }
  return pending;
}

// Najbliższe opublikowane spotkanie, które jeszcze się nie zaczęło (albo null).
export async function nextPublicEvent() {
  const d = await listPublicEvents();
  const now = Date.now();
  return (d.upcoming || [])
    .filter((e) => e.status === "Opublikowane" && e.start_datetime && new Date(e.start_datetime).getTime() > now)
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))[0] || null;
}
