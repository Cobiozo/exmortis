import { base44 } from "@/api/base44Client";

// Kolejka wysyłek formularzy w przeglądarce: gdy serwer nie odpowiada (503, limit, sieć),
// zgłoszenie czeka tutaj i jest ponawiane po 5, 15, 60 s oraz przy każdej kolejnej wizycie.
// Błędy walidacji (4xx poza 429) wracają do formularza jak dotąd.
const KEY = "exm_outbox";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const write = (q) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* pełna pamięć */ } };
const transient = (e) => { const s = e?.response?.status; return !s || s >= 500 || s === 429; };

let busy = false;
export async function flushOutbox() {
  if (busy) return;
  busy = true;
  for (const item of read()) {
    try { await base44.functions.invoke(item.fn, item.payload); write(read().filter((x) => x.id !== item.id)); }
    catch (e) { if (!transient(e)) write(read().filter((x) => x.id !== item.id)); }
  }
  busy = false;
}

const schedule = () => [5, 15, 60].forEach((s) => setTimeout(flushOutbox, s * 1000));

// Zwraca odpowiedź serwera albo { queued: true }, gdy zgłoszenie trafiło do kolejki.
export async function sendForm(fn, payload) {
  try { return (await base44.functions.invoke(fn, payload)).data; }
  catch (e) {
    if (!transient(e)) throw e;
    write([...read(), { id: Date.now() + "-" + Math.random().toString(36).slice(2), fn, payload, at: new Date().toISOString() }]);
    schedule();
    return { queued: true };
  }
}

if (read().length) setTimeout(flushOutbox, 3000);