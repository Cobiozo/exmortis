import React, { useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toLocalInput } from "@/components/exmortis/events/time";

const EVENT_TYPES = ["Spotkanie otwarte", "Live", "Webinar", "Warsztat", "Krąg", "Retreat"];
const FORMATS = ["Online", "Stacjonarnie"];
const REG_TYPES = ["Zapis na stronie", "Link zewnętrzny", "Bez zapisu"];
const STATUSES = ["Opublikowane", "Szkic", "Odwołane"];
const STAGES = ["Śmierć", "Próg", "Powrót", "Inny", "Wszystkie"];

const inputCls =
  "w-full bg-transparent border hairline px-4 py-3 text-foreground text-sm focus:border-[#C9A24A] focus:outline-none transition-colors";
const labelCls = "technical text-[9px] text-foreground/40 block mb-2";

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => (
        <option key={o} value={o} className="bg-[#0D0D0E] text-[#E2E2E2]">
          {o}
        </option>
      ))}
    </select>
  );
}

// Tworzenie / edycja wydarzenia — wszystkie pola encji Event.
export default function EventEditor({ event, onClose, onSaved }) {
  const [form, setForm] = useState(
    event
      ? {
          ...event,
          start_datetime: toLocalInput(event.start_datetime),
        }
      : {
          title: "",
          slug: "",
          subtitle: "",
          event_type: "Spotkanie otwarte",
          format: "Online",
          start_datetime: "",
          duration_minutes: 60,
          location: "",
          description: "",
          for_whom: "",
          price: 0,
          checkout_url: "",
          capacity: "",
          registration_type: "Zapis na stronie",
          external_url: "",
          join_link: "",
          recording_url: "",
          stage: "Wszystkie",
          cover_image: "",
          status: "Szkic",
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        id: event?.id || null,
        start_datetime: form.start_datetime ? new Date(form.start_datetime).toISOString() : null,
        duration_minutes: Number(form.duration_minutes) || 60,
        price: Number(form.price) || 0,
        capacity: form.capacity === "" || form.capacity === null ? null : Number(form.capacity),
      };
      await base44.functions.invoke("eventsAdmin", { action: "save", event: payload });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się zapisać wydarzenia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0D0D0E] border hairline p-6 md:p-10 my-8">
        <button onClick={onClose} className="absolute top-5 right-5 text-foreground/50 hover:text-foreground transition-colors" aria-label="Zamknij">
          <X className="h-5 w-5" />
        </button>

        <p className="technical text-[10px] gold-text mb-2">{event ? "EDYCJA WYDARZENIA" : "NOWE WYDARZENIE"}</p>
        <h3 className="shop-heading text-2xl text-[#F5EFE1] mb-8">{event ? event.title : "Spotkanie"}</h3>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>TYTUŁ *</label>
              <input required value={form.title} onChange={set("title")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>SLUG (URL)</label>
              <input value={form.slug} onChange={set("slug")} placeholder="auto z tytułu" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>SUBTITLE (JEDNO ZDANIE)</label>
            <input value={form.subtitle} onChange={set("subtitle")} className={inputCls} />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>TYP WYDARZENIA</label>
              <Select value={form.event_type} onChange={(v) => setForm((f) => ({ ...f, event_type: v }))} options={EVENT_TYPES} />
            </div>
            <div>
              <label className={labelCls}>FORMA</label>
              <Select value={form.format} onChange={(v) => setForm((f) => ({ ...f, format: v }))} options={FORMATS} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>DATA I GODZINA</label>
              <input type="datetime-local" value={form.start_datetime} onChange={set("start_datetime")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CZAS TRWANIA (MIN)</label>
              <input type="number" min="5" value={form.duration_minutes} onChange={set("duration_minutes")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CENA (ZŁ, 0 = BEZPŁATNE)</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={set("price")} className={inputCls} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>MIEJSCE (ADRES / „ONLINE, ZOOM”)</label>
              <input value={form.location} onChange={set("location")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>DLA KOGO („DLA…”)</label>
              <input value={form.for_whom} onChange={set("for_whom")} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>OPIS (CO SIĘ WYDARZY, JAK SIĘ PRZYGOTOWAĆ)</label>
            <textarea value={form.description} onChange={set("description")} rows={6} className={inputCls + " resize-y"} />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>TYP ZAPISU</label>
              <Select value={form.registration_type} onChange={(v) => setForm((f) => ({ ...f, registration_type: v }))} options={REG_TYPES} />
            </div>
            <div>
              <label className={labelCls}>LIMIT MIEJSC (PUSTO = BEZ LIMITU)</label>
              <input type="number" min="0" value={form.capacity ?? ""} onChange={set("capacity")} className={inputCls} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>CHECKOUT_URL (TYLKO PŁATNE)</label>
              <input value={form.checkout_url || ""} onChange={set("checkout_url")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>LINK ZEWNĘTRZNY (LIVE NA FB/IG/YT)</label>
              <input value={form.external_url || ""} onChange={set("external_url")} className={inputCls} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>LINK DO ZOOMA (WYSYŁANY TYLKO ZAPISANYM)</label>
              <input value={form.join_link || ""} onChange={set("join_link")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>LINK DO NAGRANIA (PO WYDARZENIU)</label>
              <input value={form.recording_url || ""} onChange={set("recording_url")} className={inputCls} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>ETAP DROGI</label>
              <Select value={form.stage} onChange={(v) => setForm((f) => ({ ...f, stage: v }))} options={STAGES} />
            </div>
            <div>
              <label className={labelCls}>STATUS</label>
              <Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={STATUSES} />
            </div>
            <div>
              <label className={labelCls}>OKŁADKA (URL, OPCJONALNIE)</label>
              <input value={form.cover_image || ""} onChange={set("cover_image")} className={inputCls} />
            </div>
          </div>

          {error && <p className="technical text-[10px] blood-text">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-relic !px-6 !py-3 disabled:opacity-60">
              {saving ? "ZAPISUJĘ..." : "ZAPISZ WYDARZENIE"}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost !px-6 !py-3">
              ANULUJ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}