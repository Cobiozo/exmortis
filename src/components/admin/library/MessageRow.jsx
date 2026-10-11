import React, { useState } from "react";
import { Loader2, ChevronDown, Mail, Pencil } from "lucide-react";
import { lib, plDateTime } from "./libApi";
import LibModal from "./LibModal";

// Jeden wiersz listy wiadomości: stan, odbiorcy i akcje zależne od statusu.
export default function MessageRow({ m, onChanged, onEdit }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState("");
  const [ask, setAsk] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const expand = () => {
    setOpen((v) => !v);
    if (m.status === "WYSLANA" && !stats) lib("message_stats", { id: m.id }).then(setStats).catch(() => setStats({ items: [] }));
  };

  const run = async (what) => {
    setBusy(what); setErr(""); setNotice(""); setAsk("");
    try {
      if (what === "notify") {
        const r = await lib("message_notify_unread", { id: m.id });
        setNotice(`Wysłano powiadomienie do ${r.nieprzeczytane ?? 0} nieprzeczytanych.`);
      } else if (what === "withdraw") {
        const r = await lib("message_withdraw", { id: m.id });
        setNotice(r.uwaga || "Wycofano.");
      } else if (what === "cancel") {
        await lib("message_cancel", { id: m.id });
      } else if (what === "send") {
        const r = await lib("message_send", { id: m.id, count: m.recipient_count || 0 });
        setNotice(`Wysłano do ${r.odbiorcy} osób.`);
      } else if (what === "delete") {
        await lib("message_delete", { id: m.id });
      }
      onChanged?.();
    } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  const unread = Math.max(0, (m.dostarczone || 0) - (m.przeczytane || 0));

  return (
    <div className="border hairline">
      <div className="p-4 flex flex-wrap items-start gap-3">
        <button onClick={expand} className="min-w-0 flex-1 text-left">
          <p className="text-sm truncate">{m.title || "(bez tytułu)"}</p>
          <p className="text-[11px] text-foreground/45 mt-1">
            {m.target_label} · {m.status === "ZAPLANOWANA" ? `zaplanowana na ${plDateTime(m.send_at)}`
              : m.sent_at ? `wysłana ${plDateTime(m.sent_at)}` : `utworzona ${plDateTime(m.created_at)}`}
            {m.status === "WYSLANA" ? ` · przeczytane ${m.przeczytane} / ${m.dostarczone}` : ""}
            {m.status === "WYCOFANA" ? " · wycofana" : ""}
          </p>
          {m.preview && <p className="text-xs text-foreground/35 mt-1 truncate">{m.preview}</p>}
        </button>
        <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform mt-1 ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="border-t hairline p-4 space-y-3">
          {m.status === "WYSLANA" && (
            <div className="space-y-2">
              <p className="technical text-[10px] text-foreground/50">ODBIORCY ({m.dostarczone})</p>
              {!stats ? <Loader2 className="h-4 w-4 animate-spin gold-text" /> : (
                <div className="text-xs text-foreground/60 space-y-1 max-h-52 overflow-y-auto">
                  {stats.items?.length ? stats.items.map((r) => (
                    <p key={r.client_email}>
                      {r.name ? `${r.name} · ` : ""}{r.client_email} —{" "}
                      <span className={r.read_at ? "gold-text" : "text-foreground/40"}>{r.read_at ? `przeczytane ${plDateTime(r.read_at)}` : "nieprzeczytane"}</span>
                    </p>
                  )) : <p className="text-foreground/40">Brak odbiorców.</p>}
                </div>
              )}
            </div>
          )}

          {m.attached_material_id && <p className="text-xs text-foreground/45">Dołączony materiał (przydzielony odbiorcom).</p>}
          {m.attached_collection_id && <p className="text-xs text-foreground/45">Dołączona kolekcja (przydzielona odbiorcom).</p>}
          {m.email_mode !== "BRAK" && <p className="text-xs text-foreground/45">Kopia e-mail: {m.email_mode === "PELNA" ? "pełna treść" : "powiadomienie bez treści"}.</p>}

          {notice && <p className="text-xs gold-text">{notice}</p>}
          {err && <p className="text-xs blood-text">{err}</p>}

          <div className="flex flex-wrap gap-2">
            {m.status === "SZKIC" && (
              <>
                <button className="btn-ghost !px-3 !py-2" onClick={() => onEdit(m)}><Pencil className="h-4 w-4" /> EDYTUJ</button>
                <button className="btn-relic !px-3 !py-2" onClick={() => run("send")} disabled={!!busy}>
                  {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : "WYŚLIJ TERAZ"}
                </button>
              </>
            )}
            {m.status === "ZAPLANOWANA" && (
              <>
                <button className="btn-ghost !px-3 !py-2" onClick={() => onEdit(m)}><Pencil className="h-4 w-4" /> EDYTUJ</button>
                <button className="btn-ghost !px-3 !py-2" onClick={() => setAsk("cancel")} disabled={!!busy}>ANULUJ</button>
              </>
            )}
            {m.status === "WYSLANA" && (
              <>
                {m.email_mode !== "BRAK" && unread > 0 && (
                  <button className="btn-ghost !px-3 !py-2" onClick={() => run("notify")} disabled={!!busy}>
                    {busy === "notify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4" /> POWIADOM NIEPRZECZYTANYCH</>}
                  </button>
                )}
                <button className="btn-ghost !px-3 !py-2" onClick={() => onEdit(m, true)}><Pencil className="h-4 w-4" /> POPRAW LITERÓWKĘ</button>
                <button className="btn-ghost !px-3 !py-2" onClick={() => setAsk("withdraw")} disabled={!!busy}>WYCOFAJ</button>
              </>
            )}
            {(m.status === "SZKIC" || m.status === "WYCOFANA") && (
              <button className="btn-ghost !px-3 !py-2" onClick={() => setAsk("delete")} disabled={!!busy}>USUŃ</button>
            )}
          </div>
        </div>
      )}

      <LibModal
        open={ask === "withdraw"} onClose={() => setAsk("")} title="Wycofać wiadomość?"
        footer={<>
          <button className="btn-ghost" onClick={() => setAsk("")}>ANULUJ</button>
          <button className="btn-blood" onClick={() => run("withdraw")}>WYCOFAJ</button>
        </>}
      >
        <p className="text-sm text-foreground/70">Wiadomość zniknie z kont odbiorców. Wysłanego e-maila nie da się cofnąć.</p>
      </LibModal>

      <LibModal
        open={ask === "cancel"} onClose={() => setAsk("")} title="Anulować wysyłkę?"
        footer={<>
          <button className="btn-ghost" onClick={() => setAsk("")}>WRÓĆ</button>
          <button className="btn-relic" onClick={() => run("cancel")}>ANULUJ WYSYŁKĘ</button>
        </>}
      >
        <p className="text-sm text-foreground/70">Wiadomość wróci do szkiców. Można to zrobić tylko do chwili, gdy zadanie ją przejmie.</p>
      </LibModal>

      <LibModal
        open={ask === "delete"} onClose={() => setAsk("")} title="Usunąć wiadomość?"
        footer={<>
          <button className="btn-ghost" onClick={() => setAsk("")}>WRÓĆ</button>
          <button className="btn-blood" onClick={() => run("delete")}>USUŃ</button>
        </>}
      >
        <p className="text-sm text-foreground/70">Wiadomość zniknie razem z listą odbiorców. Wysłanej wiadomości nie usuwamy — tę się wycofuje.</p>
      </LibModal>
    </div>
  );
}