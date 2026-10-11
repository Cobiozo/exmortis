import React, { useEffect, useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { lib, inputCls, plToUtc, utcToPlInput } from "./libApi";
import LibModal from "./LibModal";
import TargetPicker, { EMPTY_TARGET } from "./TargetPicker";
import RichLite from "./RichLite";
import MessagePreview from "./MessagePreview";
import AttachmentPicker from "./AttachmentPicker";

const EMPTY = { title: "", body_html: "", email_mode: "BRAK", attachments: [] };

// Załączniki zapisanej wiadomości: nowa lista albo (starsze wiadomości) pojedynczy materiał / kolekcja.
const attOf = (item) => {
  if (Array.isArray(item?.attachments) && item.attachments.length) {
    return item.attachments.map((a) => (a.material_id ? { material_id: a.material_id, material_title: a.material_title } : { collection_id: a.collection_id, collection_title: a.collection_title }));
  }
  if (item?.attached_material_id) return [{ material_id: item.attached_material_id }];
  if (item?.attached_collection_id) return [{ collection_id: item.attached_collection_id }];
  return [];
};

// Tworzenie i edycja wiadomości. `editSent` = poprawka literówki po wysłaniu (bez ponownego e-maila).
// Ten sam formularz obsługuje zapis jako szablon i użycie szablonu.
export default function MessageForm({ open, onClose, item, editSent, presetTarget, template, onDone }) {
  const [t, setT] = useState(() => presetTarget || { ...EMPTY_TARGET });
  const [m, setM] = useState(() => (item
    ? { title: item.title || "", body_html: item.body_html || "", email_mode: item.email_mode || "BRAK", attachments: attOf(item) }
    : template
      ? { ...EMPTY, title: template.title || "", body_html: template.body_html || "" }
      : { ...EMPTY }));
  const [when, setWhen] = useState(() => utcToPlInput(item?.send_at));
  const [prev, setPrev] = useState(null);
  const [pick, setPick] = useState("");
  const [prevBusy, setPrevBusy] = useState(false);
  const [mats, setMats] = useState([]);
  const [cols, setCols] = useState([]);
  const [openPrev, setOpenPrev] = useState(false);
  const [tplName, setTplName] = useState(null);
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (editSent) return;
    Promise.all([lib("materials_list", {}), lib("collections_list")])
      .then(([a, b]) => { setMats(a.items || []); setCols(b.items || []); })
      .catch(() => {});
  }, [editSent]);

  const target = () => (t.kind === "osoba"
    ? { kind: "osoba", emails: t.emails }
    : { kind: "grupa", group_id: t.group_id, group_mode: t.group_mode, exceptions_add: t.exceptions_add, exceptions_drop: t.exceptions_drop });

  // Liczba odbiorców i podgląd liczone na serwerze — ta sama ścieżka co u klienta.
  useEffect(() => {
    if (editSent) return;
    const ready = t.kind === "osoba" ? t.emails.length > 0 : !!t.group_id;
    if (!ready) { setPrev(null); return; }
    setPrevBusy(true);
    const timer = setTimeout(() => {
      lib("message_preview", { body_html: m.body_html, target: target(), email: pick || undefined })
        .then((d) => { setPrev(d); setPick(d.email || ""); })
        .catch(() => setPrev(null))
        .finally(() => setPrevBusy(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [t, m.body_html, pick, editSent]);

  const payload = () => ({
    title: m.title || null, body_html: m.body_html, email_mode: m.email_mode,
    attachments: (m.attachments || []).map((a) => (a.material_id ? { material_id: a.material_id } : { collection_id: a.collection_id })),
    target: target(),
  });

  const save = async (status) => {
    const r = await lib("message_save", { id: item?.id || null, ...payload(), status, send_at: status === "ZAPLANOWANA" ? plToUtc(when) : null });
    return r.id;
  };

  const run = async (what) => {
    setAsk(null); setBusy(what); setErr("");
    try {
      if (what === "editSent") {
        await lib("message_edit_sent", { id: item.id, title: m.title || null, body_html: m.body_html });
      } else if (what === "template") {
        await lib("template_save", { name: tplName, title: m.title || null, body_html: m.body_html });
      } else if (what === "now") {
        const id = await save("SZKIC");
        await lib("message_send", { id, count: prev?.count || 0, confirm: true });
      } else if (what === "schedule") {
        await save("ZAPLANOWANA");
      } else {
        await save("SZKIC");
      }
      onDone?.();
    } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  const sendNow = () => {
    if ((prev?.count || 0) > 10) { setAsk("now"); return; }
    run("now");
  };

  const btn = (k, l, cls) => (
    <button className={cls} onClick={() => run(k)} disabled={!!busy}>
      {busy === k ? <Loader2 className="h-4 w-4 animate-spin" /> : l}
    </button>
  );

  return (
    <>
      <LibModal
        open={open} onClose={onClose} wide title={editSent ? "Popraw treść wysłanej" : item ? "Wiadomość" : "Nowa wiadomość"}
        footer={editSent ? (
          <>
            <button className="btn-ghost" onClick={onClose}>ZAMKNIJ</button>
            {btn("editSent", "ZAPISZ POPRAWKĘ", "btn-relic")}
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={onClose}>ZAMKNIJ</button>
            {btn("draft", "ZAPISZ SZKIC", "btn-ghost")}
            {btn("schedule", "ZAPLANUJ", "btn-ghost")}
            {btn("now", "WYŚLIJ TERAZ", "btn-relic")}
          </>
        )}
      >
        {err && <p className="text-sm blood-text">{err}</p>}
        {editSent && <p className="text-xs text-foreground/45">Poprawka nie wysyła ponownie e-maila.</p>}

        {!editSent && (
          <>
            <TargetPicker value={t} onChange={setT} />

            <div className="border hairline p-3">
              <button onClick={() => setOpenPrev((v) => !v)} className="w-full flex items-center justify-between gap-3 text-left">
                <span className="text-sm">Wyślesz do {prev ? prev.count : 0} {prev?.count === 1 ? "osoby" : "osób"}</span>
                <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${openPrev ? "rotate-180" : ""}`} />
              </button>
              {openPrev && (
                <div className="mt-3 text-xs text-foreground/60 space-y-1 max-h-40 overflow-y-auto">
                  {prev?.emails?.length ? prev.emails.map((e) => <p key={e}>{e}</p>) : <p className="text-foreground/40">Nikt nie pasuje do tej reguły.</p>}
                </div>
              )}
            </div>
          </>
        )}

        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">TYTUŁ (OPCJONALNY)</label>
          <input value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">TREŚĆ</label>
          <RichLite semantic token value={m.body_html} onChange={(v) => setM({ ...m, body_html: v })} placeholder="Treść wiadomości…" />
        </div>

        {!editSent && (
          <>
            <MessagePreview data={prev} email={pick} onPick={setPick} busy={prevBusy} />

            <AttachmentPicker value={m.attachments} onChange={(v) => setM({ ...m, attachments: v })} mats={mats} cols={cols} />

            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-2">KOPIA E-MAIL</label>
              <div className="flex flex-wrap gap-2">
                {[["BRAK", "Brak"], ["POWIADOMIENIE", "Powiadomienie bez treści"], ["PELNA", "Pełna treść"]].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setM({ ...m, email_mode: k })}
                    className={`px-3 py-2 technical text-[10px] border hairline ${m.email_mode === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>{l}</button>
                ))}
              </div>
              {m.email_mode === "PELNA" && (
                <p className="text-xs blood-text mt-2">E-mail z pełną treścią może przeczytać ktoś inny niż odbiorca.</p>
              )}
            </div>

            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-2">TERMIN WYSYŁKI (CZASU PL)</label>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${inputCls} dt-input`} />
            </div>

            <div className="border hairline p-3 space-y-2">
              {tplName === null ? (
                <button type="button" className="btn-ghost !px-3 !py-2" onClick={() => setTplName(m.title || "")}>ZAPISZ JAKO SZABLON</button>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Nazwa szablonu" className={`${inputCls} max-w-[260px]`} />
                  {btn("template", "ZAPISZ", "btn-relic !px-3 !py-2")}
                  <button type="button" className="btn-ghost !px-3 !py-2" onClick={() => setTplName(null)}>ANULUJ</button>
                </div>
              )}
            </div>
          </>
        )}
      </LibModal>

      <LibModal
        open={!!ask} onClose={() => setAsk(null)} title="Wysłać do ponad 10 osób?"
        footer={<>
          <button className="btn-ghost" onClick={() => setAsk(null)}>ANULUJ</button>
          <button className="btn-relic" onClick={() => run("now")}>WYŚLIJ</button>
        </>}
      >
        <p className="text-sm text-foreground/70">Ta wiadomość trafi do {prev?.count} osób i pojawi się na ich kontach.</p>
      </LibModal>
    </>
  );
}