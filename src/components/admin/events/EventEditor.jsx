import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Eye, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Stepper from "./form/Stepper";
import StepBasics from "./form/StepBasics";
import StepCover from "./form/StepCover";
import StepAccess from "./form/StepAccess";
import StepPublish from "./form/StepPublish";
import EventPreview from "./form/EventPreview";
import LeaveDialog from "./form/LeaveDialog";
import { makeCrops } from "./cover/coverKit";
import { STEPS, initForm, stepErrors, allErrors, toPayload, loadDraft, saveDraft, clearDraft } from "./form/eventForm";

const hhmm = (iso) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

// Tworzenie / edycja spotkania w 4 krokach, z podglądem, autozapisem szkicu i paskiem akcji.
export default function EventEditor({ event, onClose, onSaved }) {
  const draft = useRef(loadDraft(event?.id)).current;
  const [form, setForm] = useState(() => draft?.form || initForm(event));
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState({});
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(draft?.at || null);
  const [restored] = useState(!!draft);
  const [img, setImg] = useState(null);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [leave, setLeave] = useState(false);
  const top = useRef(null);
  const formRef = useRef(form); formRef.current = form;

  const [changed, setChanged] = useState(!!draft);
  const set = (p) => { setForm((f) => ({ ...f, ...p })); setDirty(true); setChanged(true); };
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const errs = stepErrors(form, step);
  const errors = Object.fromEntries(Object.entries(errs).filter(([k]) => touched[k]));
  const done = STEPS.map((_, i) => i < 3 && Object.keys(stepErrors(form, i)).length === 0);

  const autosave = useCallback(() => { setSavedAt(saveDraft(event?.id, formRef.current)); setDirty(false); }, [event?.id]);
  useEffect(() => { if (!dirty) return; const t = setTimeout(autosave, 10000); return () => clearTimeout(t); }, [dirty, form, autosave]);

  const focusField = (k) => setTimeout(() => {
    const el = document.getElementById(`f-${k}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector("input,select,textarea,[contenteditable],button")?.focus({ preventScroll: true });
  }, 50);
  const go = (i, field) => {
    if (dirty) autosave();
    setStep(i); top.current?.scrollIntoView({ block: "start" });
    if (field) { touch(field); focusField(field); }
  };
  const next = () => {
    const keys = Object.keys(errs);
    if (keys.length) { setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) })); return focusField(keys[0]); }
    go(step + 1);
  };

  const save = async (status) => {
    if (saving) return;
    setError("");
    const publish = status === "Opublikowane";
    const all = allErrors(form, publish);
    const first = Object.keys(all)[0];
    if (publish && first) { const s = ["title", "date", "time", "duration_minutes"].includes(first) ? 0 : first === "cover_alt" ? 1 : 2; return go(s, first); }
    if (!form.title.trim()) return go(0, "title");
    setSaving(status);
    try {
      let f = form;
      if (f.cover?.src && (f.cover.stale || !f.cover.crops?.wide) && img) {
        f = { ...f, cover: { ...f.cover, crops: await makeCrops(img, f.cover.fx, f.cover.fy), stale: false } };
        setForm(f);
      }
      const res = await base44.functions.invoke("eventsAdmin", { action: "save", event: toPayload(f, status) });
      if (res.data?.rescheduled > 0 && window.confirm(`Termin się zmienił. Wysłać zapisanym (${res.data.rescheduled}) informację o zmianie terminu z nowym plikiem kalendarza?`)) {
        await base44.functions.invoke("eventsAdmin", { action: "notifyReschedule", id: res.data.event.id });
      }
      clearDraft(event?.id);
      if (!event?.id && res.data?.event?.id) clearDraft(res.data.event.id);
      setDirty(false);
      onSaved();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Nie udało się zapisać spotkania.");
    }
    setSaving("");
  };
  const keepStatus = event?.status && event.status !== "Szkic" ? event.status : "Szkic";
  const close = () => (changed ? setLeave(true) : onClose());
  const leaveNoSave = () => { clearDraft(event?.id); onClose(); };
  const p = { form, set, touch, errors };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B] overflow-y-auto overflow-x-hidden" role="dialog" aria-modal="true" aria-labelledby="ev-ed-title">
      <div ref={top} className="sticky top-0 z-20 bg-[#0A0A0B]/95 border-b hairline px-4 sm:px-8 py-4">
        <div className="mx-auto max-w-[1440px] flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 id="ev-ed-title" className="shop-heading text-xl sm:text-2xl text-[#F5EFE1] truncate max-w-full">{event ? "Edycja spotkania" : "Nowe spotkanie"}</h2>
              {savedAt && <span className="text-xs text-foreground/45" aria-live="polite">Szkic zapisany · {hhmm(savedAt)}</span>}
            </div>
            <Stepper step={step} done={done} onGo={go} />
          </div>
          <button type="button" onClick={close} className="h-11 w-11 flex items-center justify-center text-foreground/60 hover:text-foreground" aria-label="Zamknij"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 pt-6 pb-[calc(120px+env(safe-area-inset-bottom))] min-[1025px]:grid min-[1025px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] min-[1025px]:gap-10">
        <div className="min-w-0">
          {restored && step === 0 && savedAt && <p className="text-sm gold-text border border-[#C9A24A]/40 p-3 mb-6">Przywrócono szkic z {hhmm(savedAt)}.</p>}
          {step === 0 && <StepBasics {...p} />}
          {step === 1 && <StepCover {...p} img={img} setImg={setImg} />}
          {step === 2 && <StepAccess {...p} />}
          {step === 3 && <StepPublish {...p} goStep={go} />}
          {error && <p role="alert" className="text-sm text-[#E5484D] mt-6">{error}</p>}
        </div>
        <aside className="hidden min-[1025px]:block min-w-0"><div className="sticky top-40"><EventPreview form={form} /></div></aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-[#0D0D0E] border-t hairline px-4 sm:px-8 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[1440px] flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="btn-ghost !px-3 sm:!px-4 !py-3 disabled:opacity-30">WSTECZ</button>
          <button type="button" onClick={() => save(keepStatus)} disabled={!!saving} className="btn-ghost !px-3 sm:!px-4 !py-3 disabled:opacity-50">
            {saving && saving !== "Opublikowane" && <Loader2 className="h-4 w-4 animate-spin" />}{keepStatus === "Szkic" ? <>ZAPISZ<span className="hidden sm:inline">&nbsp;SZKIC</span></> : "ZAPISZ"}
          </button>
          {step < 3 && <button type="button" onClick={() => go(3)} className="lg:hidden btn-ghost !px-3 !py-3" aria-label="Podgląd"><Eye className="h-4 w-4" /></button>}
          <span className="flex-1" />
          {step < 3 ? (
            <button type="button" onClick={next} className="btn-relic !px-4 sm:!px-6 !py-3">DALEJ</button>
          ) : (
            <button type="button" onClick={() => save("Opublikowane")} disabled={!!saving} className="btn-relic !px-4 sm:!px-6 !py-3 disabled:opacity-60">
              {saving === "Opublikowane" && <Loader2 className="h-4 w-4 animate-spin" />}{event?.status === "Opublikowane" ? <><span className="hidden sm:inline">ZAPISZ I&nbsp;</span>PUBLIKUJ</> : "OPUBLIKUJ"}
            </button>
          )}
        </div>
      </div>

      {leave && <LeaveDialog onStay={() => setLeave(false)} onLeave={leaveNoSave} onSave={() => { setLeave(false); save(keepStatus); }} />}
    </div>
  );
}