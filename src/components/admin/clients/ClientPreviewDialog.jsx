import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib, plDateTime, KIND_LABEL } from "@/components/admin/library/libApi";
import LibModal from "@/components/admin/library/LibModal";

// „Podgląd oczami klienta" — tylko do odczytu. Nic nie jest oznaczane jako przeczytane
// i nie otwieramy podpisanych linków do plików (same kafelki). Wpis w Historii zmian powstaje na serwerze.
export default function ClientPreviewDialog({ email, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    lib("preview_client", { email }).then(setD).catch((e) => { setErr(e.message); setD(null); });
  }, [email]);

  return (
    <LibModal open onClose={onClose} wide title={`Podgląd — ${email}`}
      footer={<button className="btn-ghost" onClick={onClose}>ZAMKNIJ</button>}>
      <p className="technical text-[10px] gold-text border hairline px-3 py-2">PODGLĄD — NIC NIE ZOSTANIE OZNACZONE JAKO PRZECZYTANE</p>
      {err && <p className="text-sm blood-text">{err}</p>}
      {!d ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : (
        <div className="space-y-8">
          <section>
            <p className="technical text-[10px] text-foreground/50 mb-3">BIBLIOTEKA ({d.library?.items?.length || 0})</p>
            {d.library?.items?.length ? (
              <div className="border hairline divide-y divide-[#3D3D3F]/60">
                {d.library.items.map((m) => (
                  <div key={m.id} className="p-3">
                    <p className="text-sm truncate">{m.title}</p>
                    <p className="text-[11px] text-foreground/45">
                      {KIND_LABEL[m.kind]}{m.collection_id ? " · kolekcja" : ""}
                      {m.visible_from ? ` · od ${plDateTime(m.visible_from)}` : ""}
                      {m.visible_to ? ` · do ${plDateTime(m.visible_to)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-foreground/45">Brak materiałów.</p>}
          </section>

          <section>
            <p className="technical text-[10px] text-foreground/50 mb-3">WIADOMOŚCI ({d.messages?.items?.length || 0})</p>
            {d.messages?.items?.length ? (
              <div className="border hairline divide-y divide-[#3D3D3F]/60">
                {d.messages.items.map((m) => (
                  <div key={m.id} className="p-3">
                    <p className="text-sm truncate">{m.title || "(bez tytułu)"}</p>
                    <p className="text-[11px] text-foreground/45">{plDateTime(m.sent_at)}</p>
                    <div className="rich-content text-xs text-foreground/60 mt-2" dangerouslySetInnerHTML={{ __html: m.text }} />
                    {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                      <ul className="mt-2 text-[11px] text-foreground/50 list-disc pl-5">
                        {m.attachments.map((x, i) => <li key={i}>{x.material_title || (x.collection_title ? `Kolekcja · ${x.collection_title}` : "Materiał")}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-foreground/45">Brak wiadomości.</p>}
          </section>
        </div>
      )}
    </LibModal>
  );
}