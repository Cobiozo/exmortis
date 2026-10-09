import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { plDate, TYPE_LABEL } from "@/components/account/accountUtils";
import AccessActions from "./AccessActions";
import EmailChangeBox from "./EmailChangeBox";

export default function ClientDetail({ email, onChange }) {
  const [d, setD] = useState(null);
  const load = () => base44.functions.invoke("adminClients", { action: "detail", email }).then((r) => setD(r.data));
  useEffect(() => { load(); }, [email]);
  if (!d) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="shop-heading text-2xl text-[#F5EFE1]">{d.user?.full_name || email}</h2>
        <p className="text-sm text-foreground/50 mt-1">{email} · {d.user ? `konto od ${plDate(d.user.created_date)}` : "bez konta (zaproszenie wysłane)"} · ukończone lekcje: {d.completed}</p>
      </div>
      {d.user && <EmailChangeBox email={email} />}
      <section>
        <p className="technical text-[10px] gold-text mb-3">DOSTĘPY</p>
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {d.access.map((a) => (
            <div key={a.id} className={`p-4 flex flex-wrap items-center gap-4 ${a.active ? "" : "opacity-60"}`}>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm">{a.product_name}</p>
                <p className="text-xs text-foreground/45">{TYPE_LABEL[a.product_type]} · {a.revoked ? "odebrany" : a.valid_until ? `do ${plDate(a.valid_until)}` : "bezterminowo"} · źródło: {a.source}</p>
              </div>
              <AccessActions a={a} onDone={() => { load(); onChange(); }} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <p className="technical text-[10px] gold-text mb-3">DZIENNIK ODTWORZEŃ (OSTATNIE 50)</p>
        {d.logs.length === 0 ? <p className="text-sm text-foreground/40">Brak odtworzeń.</p> : (
          <div className="text-xs space-y-1 text-foreground/60">
            {d.logs.map((l) => (
              <p key={l.id}>{new Date(l.created_date).toLocaleString("pl-PL")} · {l.lesson_title} · {l.ip || "?"} · <span className="text-foreground/35">{(l.user_agent || "").slice(0, 60)}</span></p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}