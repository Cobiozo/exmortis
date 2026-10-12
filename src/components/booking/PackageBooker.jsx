import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import SlotPicker from "@/components/booking/SlotPicker";
import { fullLabel, plNote, viewerTz } from "@/components/booking/bookingTime";

const call = (p) => base44.functions.invoke("bookingPublic", p).then((r) => r.data);
const inp = "w-full bg-[#0A0A0B] border hairline px-4 py-3 focus:border-[#C9A24A] outline-none";

// Wybór terminu z pakietu: identyfikatorem (konto) albo jednorazowym tokenem z zamówienia.
// Zgodę o wykonaniu usługi pokazujemy tylko, gdy termin wypada w ciągu 14 dni od zakupu.
export default function PackageBooker({ packageId, token, purchasedAt, consent, firstName = "", onDone }) {
  const key = token ? { token } : { package_id: packageId };
  const [slots, setSlots] = useState(null);
  const [earliest, setEarliest] = useState(null);
  const [pick, setPick] = useState(null);
  const [name, setName] = useState(firstName);
  const [agree, setAgree] = useState(false);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    call({ action: "slots", ...key }).then((d) => { setSlots(d.slots || []); setEarliest(d.earliest || null); }).catch(() => setSlots([]));
  }, [token, packageId]);
  useEffect(() => { load(); }, [load]);

  const near = !!(pick && purchasedAt) && new Date(pick.start).getTime() - new Date(purchasedAt).getTime() < 14 * 864e5;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr(""); setBusy(true);
    try {
      const r = await call({
        action: "book_package", ...key, starts_at: pick.start, tz: viewerTz(), first_name: name,
        service_consent: near && agree, consent_version: consent?.version, consent_text: consent?.text, website: "",
      });
      onDone(r);
    } catch (e2) {
      const msg = e2?.response?.data?.error || "Nie udało się zarezerwować.";
      if (e2?.response?.status === 409) { setNotice(msg); setPick(null); setSlots(null); load(); }
      else setErr(msg);
      setBusy(false);
    }
  };

  if (slots === null) return <p className="text-foreground/50">Ładowanie terminów…</p>;

  if (!pick) {
    return (
      <>
        {notice && <p className="mb-4 text-sm text-[#E8C547]" role="alert">{notice}</p>}
        {earliest && new Date(earliest).getTime() > Date.now() && (
          <p className="mb-4 text-sm text-foreground/60">
            Kolejne spotkanie możesz umówić najwcześniej {new Date(earliest).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })} — między spotkaniami jest czas na pracę własną.
          </p>
        )}
        <SlotPicker slots={slots} value={pick} onPick={(s) => { setNotice(""); setPick(s); }} />
      </>
    );
  }

  const note = plNote(pick.start);
  return (
    <form onSubmit={submit} className="space-y-5">
      <button type="button" onClick={() => setPick(null)} className="technical text-[10px] text-foreground/50 hover:gold-text">← ZMIEŃ TERMIN</button>
      <p className="relic-heading text-xl">
        {fullLabel(pick.start)}
        {note && <span className="block text-xs font-mono text-foreground/50 mt-1">{note}</span>}
      </p>
      <label className="block text-sm">Imię<input required maxLength={120} className={inp} value={name} onChange={(e) => setName(e.target.value)} /></label>
      {near && (
        <label className="flex gap-3 text-sm">
          <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>{consent?.text}</span>
        </label>
      )}
      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
      <button type="submit" disabled={busy} className="btn-relic w-full sm:w-auto">{busy ? "REZERWUJĘ…" : "REZERWUJĘ"}</button>
    </form>
  );
}