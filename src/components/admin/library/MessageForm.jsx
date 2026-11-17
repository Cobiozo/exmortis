import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { lib, inputCls, plToUtc, utcToPlInput } from "./libApi";
import LibModal from "./LibModal";
import RichLite from "./RichLite";
import MessagePreview from "./MessagePreview";
import AttachmentPicker from "./AttachmentPicker";
import RecipientStep, { EMPTY_R, fromTarget, toTarget } from "./RecipientStep";

const EMPTY = { title: "", body_html: "", email_mode: "POWIADOMIENIE", attachments: [] };
const STEPS = ["Do kogo", "Treść", "Wysyłka"];
// Kanał w prostych słowach. Wiadomość zawsze pojawia się w Moim koncie; e-mail jest dodatkiem.
const KANALY = [
  ["POWIADOMIENIE", "W koncie + e-mail „Masz nową wiadomość”", "Polecane. E-mail bez treści — treść czyta się po zalogowaniu."],
  ["PELNA", "W koncie + e-mail z całą treścią", "Treść idzie mailem — może ją przeczytać ktoś, kto ma dostęp do skrzynki odbiorcy."],
  ["BRAK", "Tylko w koncie", "Bez e-maila. Zobaczą ją tylko osoby, które same się zalogują."],
];
const kanalKrotko = { POWIADOMIENIE: "w koncie + e-mail", PELNA: "w koncie + e-mail z treścią", BRAK: "tylko w koncie (bez e-maila)" };

// Załączniki zapisanej wiadomości: nowa lista albo (starsze wiadomości) pojedynczy materiał / kolekcja.
const attOf = (item) => {
  if (Array.isArray(item?.attachments) && item.attachments.length) {
    return item.attachments.map((a) => (a.material_id ? { material_id: a.material_id, material_title: a.material_title } : { collection_id: a.collection_id, collection_title: a.collection_title }));
  }
  if (item?.attached_material_id) return [{ material_id: item.attached_material_id }];
  if (item?.attached_collection_id) return [{ collection_id: item.attached_collection_id }];
  return [];
};
const osob = (n) => (n === 1 ? "osoby" : "osób");

// Nowa wiadomość w trzech krokach: Do kogo → Treść → Wysyłka. `editSent` = poprawka literówki po wysłaniu.
export default function MessageForm({ open, onClose, item, editSent, presetTarget, template, onDone }) {
  const [step, setStep] = useState(0);
  const [clients, setClients] = useState(null);
  const [groups, setGroups] = useState(null);
  const [r, setR] = useState(null);
  const [m, setM] = useState(() => (item
    ? { title: item.title || "", body_html: item.body_html || "", email_mode: item.email_mode || "BRAK", attachments: attOf(item) }
    : template ? { ...EMPTY, title: template.title || "", body_html: template.body_html || "" } : { ...EMPTY }));
  const [kiedy, setKiedy] = useState(item?.send_at ? "plan" : "teraz");
  const [when, setWhen] = useState(() => utcToPlInput(item?.send_at));
  const [prev, setPrev] = useState(null);
  const [pick, setPick] = useState("");
  const [prevBusy, setPrevBusy] = useState(false);
  const [mats, setMats] = useState([]);
  const [cols, setCols] = useState([]);
  const [codes, setCodes] = useState(null);
  const [kod, setKod] = useState("");
  const [openList, setOpenList] = useState(false);
  const [tplName, setTplName] = useState(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const editor = useRef(null);

  // Dane do wyboru odbiorców: konta (z oznaczeniami) i grupy — raz, przy otwarciu.
  useEffect(() => {
    if (editSent) return;
    lib("clients_list", {}).then((d) => { setClients(d.items || []); setGroups(d.grupy || []); })
      .catch(() => { setClients([]); setGroups([]); });
    Promise.all([lib("materials_list", {}), lib("collections_list")])
      .then(([a, b]) => { setMats(a.items || []); setCols(b.items || []); }).catch(() => {});
    lib("codes_for_message").then((d) => setCodes(d.items || [])).catch(() => setCodes([]));
  }, [editSent]);

  const allGroupId = useMemo(() => (groups || []).find((g) => g.kind === "AUTOMATYCZNA" && g.rule?.typ === "wszystkie_konta")?.id || "", [groups]);
  useEffect(() => {
    if (r || !groups) return;
    const t = item?.target || presetTarget;
    setR(t ? fromTarget(t, allGroupId) : { ...EMPTY_R });
  }, [groups, allGroupId]);  

  const target = useMemo(() => (r && clients ? toTarget(r, clients, allGroupId) : null), [r, clients, allGroupId]);

  // Liczba odbiorców i podgląd liczone na serwerze — ta sama ścieżka co przy wysyłce.
  useEffect(() => {
    if (editSent) return undefined;
    if (!target) { setPrev(null); return undefined; }
    setPrevBusy(true);
    const timer = setTimeout(() => {
      lib("message_preview", { body_html: m.body_html, target, email: pick || undefined })
        .then((d) => { setPrev(d); setPick(d.email || ""); })
        .catch(() => setPrev(null))
        .finally(() => setPrevBusy(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [target, m.body_html, pick, editSent]);

  const count = prev?.count || 0;
  const payload = () => ({
    title: m.title || null, body_html: m.body_html, email_mode: m.email_mode,
    attachments: (m.attachments || []).map((a) => (a.material_id ? { material_id: a.material_id } : { collection_id: a.collection_id })),
    target,
  });
  const save = async (status) => {
    const res = await lib("message_save", { id: item?.id || null, ...payload(), status, send_at: status === "ZAPLANOWANA" ? plToUtc(when) : null });
    return res.id;
  };

  const run = async (what) => {
    setAsk(false); setBusy(what); setErr("");
    try {
      if (what === "editSent") {
        await lib("message_edit_sent", { id: item.id, title: m.title || null, body_html: m.body_html });
        onDone?.(); return;
      }
      if (what === "template") {
        await lib("template_save", { name: tplName, title: m.title || null, body_html: m.body_html });
        setTplName(null); setDone("Zapisano szablon."); return;
      }
      if (what === "now") {
        const id = await save("SZKIC");
        const res = await lib("message_send", { id, count, confirm: true });
        setDone(`Wysłano do ${res.odbiorcy} ${osob(res.odbiorcy)}${res.email_mode && res.email_mode !== "BRAK" ? ` · e-maile: ${res.maile ?? 0}` : " · bez e-maila"}.`);
        setTimeout(() => onDone?.(), 1400);
        return;
      }
      if (what === "schedule") await save("ZAPLANOWANA");
      else await save("SZKIC");
      onDone?.();
    } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  // Kody wpisane w treść, które teraz nie działają — ostrzeżenie przed wysyłką.
  const plain = String(m.body_html || "").replace(/<[^>]+>/g, " ").toUpperCase();
  const badCodes = (codes || []).filter((c) => !c.ok && new RegExp(`(^|[^A-Z0-9_-])${c.kod}([^A-Z0-9_-]|$)`).test(plain));
  const kodSel = (codes || []).find((c) => c.kod === kod);
  const hasBody = plain.replace(/\s|&NBSP;/g, "").length > 0;

  const canNext = step === 0 ? count > 0 && !prevBusy : step === 1 ? hasBody : true;
  const summary = (
    <span className="mr-auto text-xs sm:text-sm text-foreground/75">
      {prevBusy ? "Liczę odbiorców…" : count ? <>Wyślesz do <strong className="text-[#F1EDE3]">{count} {osob(count)}</strong> · {kanalKrotko[m.email_mode]}</> : <span className="text-[#E8C547]">Wybierz odbiorców</span>}
    </span>
  );

  if (editSent) {
    return (
      <LibModal open={open} onClose={onClose} wide title="Popraw treść wysłanej"
        footer={<>
          <button className="btn-ghost" onClick={onClose}>ZAMKNIJ</button>
          <button className="btn-relic" onClick={() => run("editSent")} disabled={!!busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZAPISZ POPRAWKĘ"}</button>
        </>}>
        {err && <p role="alert" className="text-sm blood-text">{err}</p>}
        <p className="text-xs text-foreground/45">Poprawka nie wysyła ponownie e-maila.</p>
        <label className="block"><span className="technical text-[10px] text-foreground/50 block mb-2">TYTUŁ</span>
          <input value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} className={inputCls} /></label>
        <RichLite semantic token value={m.body_html} onChange={(v) => setM({ ...m, body_html: v })} placeholder="Treść wiadomości…" />
      </LibModal>
    );
  }

  const footer = done ? (
    <><span className="mr-auto text-sm gold-text inline-flex items-center gap-2" role="status"><Check className="h-4 w-4" /> {done}</span>
      <button className="btn-relic" onClick={() => onDone?.()}>GOTOWE</button></>
  ) : (
    <>
      {summary}
      {step > 0 && <button className="btn-ghost" onClick={() => setStep(step - 1)}>WSTECZ</button>}
      {step < 2 && <button className="btn-relic" disabled={!canNext} onClick={() => setStep(step + 1)}>DALEJ</button>}
      {step === 2 && (
        <>
          <button className="btn-ghost" onClick={() => run("draft")} disabled={!!busy || !target}>{busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZAPISZ SZKIC"}</button>
          {kiedy === "plan"
            ? <button className="btn-relic" onClick={() => run("schedule")} disabled={!!busy || !count || !when}>{busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZAPLANUJ"}</button>
            : <button className="btn-relic" onClick={() => setAsk(true)} disabled={!!busy || !count}>{busy === "now" ? <Loader2 className="h-4 w-4 animate-spin" /> : "WYŚLIJ"}</button>}
        </>
      )}
    </>
  );

  return (
    <>
      <LibModal open={open} onClose={onClose} wide title={item ? "Wiadomość" : "Nowa wiadomość"} footer={footer}>
        <ol className="flex gap-1 sm:gap-2" aria-label="Kroki">
          {STEPS.map((l, i) => (
            <li key={l} className="flex-1">
              <button type="button" onClick={() => (i < step || (i === step + 1 && canNext)) && setStep(i)} aria-current={i === step ? "step" : undefined}
                className={`w-full text-left border-t-2 pt-2 technical text-[10px] ${i === step ? "border-[#C9A24A] gold-text" : i < step ? "border-[#C9A24A]/40 text-foreground/70" : "border-white/10 text-foreground/40"}`}>
                {i + 1}. {l.toUpperCase()}
              </button>
            </li>
          ))}
        </ol>
        {err && <p role="alert" className="text-sm blood-text">{err}</p>}

        {step === 0 && (!r || !clients ? <Loader2 className="h-5 w-5 animate-spin gold-text" aria-label="Wczytuję" /> : (
          <>
            <RecipientStep r={r} setR={setR} clients={clients} groups={groups} />
            <div className="border hairline">
              <button type="button" onClick={() => setOpenList((v) => !v)} aria-expanded={openList} className="w-full min-h-[44px] px-3 flex items-center justify-between gap-3 text-left">
                <span className="text-sm">{prevBusy ? "Liczę…" : `Lista odbiorców: ${count} ${osob(count)}`}</span>
                <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${openList ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {openList && (
                <div className="border-t hairline px-3 py-2 text-xs text-foreground/65 space-y-1 max-h-48 overflow-y-auto">
                  {prev?.emails?.length ? prev.emails.map((e) => {
                    const c = (clients || []).find((x) => x.email === e);
                    return <p key={e}>{c?.name ? `${c.name} · ` : ""}{e}</p>;
                  }) : <p className="text-foreground/45">Nikt nie pasuje do tego wyboru.</p>}
                </div>
              )}
            </div>
          </>
        ))}

        {step === 1 && (
          <>
            <label className="block"><span className="technical text-[10px] text-foreground/50 block mb-2">TYTUŁ (WIDOCZNY W SKRZYNCE KLIENTA)</span>
              <input value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} className={inputCls} placeholder="np. Nowy ebook w Sklepie" /></label>
            <div>
              <span className="technical text-[10px] text-foreground/50 block mb-2">TREŚĆ</span>
              <RichLite semantic token apiRef={editor} value={m.body_html} onChange={(v) => setM({ ...m, body_html: v })} placeholder="Treść wiadomości…" />
            </div>
            <div className="border hairline p-3 space-y-2">
              <p className="technical text-[10px] text-foreground/50">KOD RABATOWY (OPCJONALNIE)</p>
              <div className="flex flex-wrap gap-2">
                <select value={kod} onChange={(e) => setKod(e.target.value)} className={`${inputCls} sm:max-w-sm`} aria-label="Kod rabatowy">
                  <option value="">— wybierz kod —</option>
                  {(codes || []).map((c) => <option key={c.kod} value={c.kod}>{c.kod} · {c.opis}{c.ok ? " · działa" : " · teraz nie działa"}</option>)}
                </select>
                <button type="button" className="btn-ghost !px-3 !py-2" disabled={!kod} onClick={() => editor.current?.insert(kod, { bold: true })}>
                  {kodSel && !kodSel.ok ? "WSTAW MIMO TO" : "WSTAW W TREŚĆ"}
                </button>
              </div>
              {kodSel && (
                <p className={`text-xs ${kodSel.ok ? "text-emerald-300" : "text-[#E8C547]"}`}>
                  {kodSel.ok ? "Kod działa teraz." : `Kod teraz nie działa: ${kodSel.powod}.`}
                  {kodSel.od ? ` Od ${kodSel.od.split("-").reverse().join(".")}.` : ""}{kodSel.do ? ` Do ${kodSel.do.split("-").reverse().join(".")}.` : ""}
                  {kodSel.tylko_subskrybenci ? " Tylko subskrybenci Listów Powrotu." : ""}{kodSel.tylko_konto ? " Tylko zalogowani." : ""}{kodSel.bez_promocji ? " Tylko cena regularna." : ""}
                </p>
              )}
            </div>
            <AttachmentPicker value={m.attachments} onChange={(v) => setM({ ...m, attachments: v })} mats={mats} cols={cols} />
          </>
        )}

        {step === 2 && (
          <>
            {badCodes.length > 0 && (
              <p role="alert" className="flex gap-2 text-sm text-[#E8C547] border border-[#E8C547]/40 bg-[#E8C547]/5 p-3">
                <AlertTriangle className="h-4 w-4 flex-none mt-0.5" aria-hidden="true" />
                <span>W treści jest kod, który teraz nie działa: {badCodes.map((c) => `${c.kod} (${c.powod})`).join(", ")}. Odbiorcy zobaczą odmowę w kasie — popraw treść albo napisz, od kiedy kod działa.</span>
              </p>
            )}
            <fieldset className="space-y-2">
              <legend className="technical text-[10px] text-foreground/50 mb-2">JAK DOSTARCZYĆ</legend>
              {KANALY.map(([k, l, d]) => (
                <label key={k} className={`flex gap-3 items-start p-3 border cursor-pointer ${m.email_mode === k ? "border-[#C9A24A] bg-[#C9A24A]/10" : "hairline"}`}>
                  <input type="radio" name="kanal" className="accent-[#C9A24A] mt-1" checked={m.email_mode === k} onChange={() => setM({ ...m, email_mode: k })} />
                  <span><span className="block text-sm text-[#F1EDE3]">{l}</span><span className="block text-xs text-foreground/50">{d}</span></span>
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="technical text-[10px] text-foreground/50 mb-2">KIEDY</legend>
              <div className="flex flex-wrap gap-2">
                {[["teraz", "Teraz"], ["plan", "Zaplanuj"]].map(([k, l]) => (
                  <label key={k} className={`min-h-[40px] px-4 inline-flex items-center gap-2 border cursor-pointer text-sm ${kiedy === k ? "border-[#C9A24A] bg-[#C9A24A]/10" : "hairline"}`}>
                    <input type="radio" name="kiedy" className="accent-[#C9A24A]" checked={kiedy === k} onChange={() => setKiedy(k)} /> {l}
                  </label>
                ))}
                {kiedy === "plan" && <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Termin wysyłki (czas polski)" className={`${inputCls} dt-input sm:max-w-[240px]`} />}
              </div>
            </fieldset>
            <MessagePreview data={prev} email={pick} onPick={setPick} busy={prevBusy} />
            <div className="border hairline p-3">
              {tplName === null ? (
                <button type="button" className="btn-ghost !px-3 !py-2" onClick={() => setTplName(m.title || "")}>ZAPISZ TREŚĆ JAKO SZABLON</button>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Nazwa szablonu" className={`${inputCls} max-w-[260px]`} />
                  <button className="btn-relic !px-3 !py-2" onClick={() => run("template")} disabled={!!busy}>ZAPISZ</button>
                  <button type="button" className="btn-ghost !px-3 !py-2" onClick={() => setTplName(null)}>ANULUJ</button>
                </div>
              )}
            </div>
          </>
        )}
      </LibModal>

      <LibModal open={ask} onClose={() => setAsk(false)} title="Wysłać wiadomość?"
        footer={<>
          <button className="btn-ghost" onClick={() => setAsk(false)}>WRÓĆ</button>
          <button className="btn-relic" onClick={() => run("now")}>WYŚLIJ DO {count} {osob(count).toUpperCase()}</button>
        </>}>
        <ul className="text-sm text-foreground/75 space-y-1.5">
          <li>Odbiorcy: <strong className="text-[#F1EDE3]">{count} {osob(count)}</strong></li>
          <li>Dostarczenie: <strong className="text-[#F1EDE3]">{kanalKrotko[m.email_mode]}</strong></li>
          {m.title && <li>Tytuł: „{m.title}”</li>}
          {(m.attachments || []).length > 0 && <li>Załączniki: {m.attachments.length} (zostaną przydzielone odbiorcom)</li>}
        </ul>
        {badCodes.length > 0 && <p className="text-sm text-[#E8C547]">Uwaga: kod {badCodes.map((c) => c.kod).join(", ")} teraz nie działa.</p>}
        <p className="text-xs text-foreground/50">Wysłanej wiadomości nie da się cofnąć z e-maili — można ją tylko wycofać z kont.</p>
      </LibModal>
    </>
  );
}
