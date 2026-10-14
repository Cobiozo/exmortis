import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Check, X, EyeOff, Star } from "lucide-react";

const FILTERS = [
  ["oczekuje", "Oczekujące"],
  ["opublikowana", "Opublikowane"],
  ["odrzucona", "Odrzucone"],
];

const plDate = (v) => (v ? new Date(v).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "");

// Panel Skarbca → OPINIE: moderacja (publikacja, odrzucenie, ukrycie) i odpowiedź exmortis.
// Treści opinii nie da się zmienić — to jest jej autentyczność.
export default function ReviewsPanel({ onBack }) {
  const [status, setStatus] = useState("oczekuje");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [replies, setReplies] = useState({});

  const load = (s = status) => {
    setData(null);
    base44.functions
      .invoke("reviewsAdmin", { action: "list", status: s })
      .then((r) => {
        setData(r.data);
        setReplies(Object.fromEntries((r.data.reviews || []).map((x) => [x.id, x.reply || ""])));
      })
      .catch(() => setData({ reviews: [], counts: {} }));
  };
  useEffect(() => load(status), [status]);

  const act = async (payload) => {
    setBusy(true);
    try {
      await base44.functions.invoke("reviewsAdmin", payload);
      load();
    } finally {
      setBusy(false);
    }
  };

  const counts = data?.counts || {};
  const list = data?.reviews || [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="technical text-[10px] text-foreground/50 hover:gold-text inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> PRODUKTY
            </button>
          )}
          <p className="technical text-[10px] text-foreground/40">
            {data === null ? "ŁADUJĘ..." : `${counts.oczekuje || 0} DO SPRAWDZENIA · ${counts.opublikowana || 0} OPUBLIKOWANYCH`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setStatus(k)}
              className={`technical text-[9px] px-3 py-2 border transition-colors ${
                status === k ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10" : "hairline text-foreground/50 hover:text-foreground"
              }`}
            >
              {l.toUpperCase()} {counts[k] ? `(${counts[k]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {data === null ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 border hairline animate-pulse bg-[#0F0F10]" />
          ))}
        </div>
      ) : !list.length ? (
        <p className="text-foreground/50 border hairline p-10 text-center">Nic tu nie ma.</p>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <article key={r.id} className="border hairline p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-[#F5EFE1]">{r.display_name}</span>
                <span className="gold-text inline-flex items-center gap-0.5" aria-label={`Ocena ${r.rating} z 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5" fill={i <= r.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                  ))}
                </span>
                <span className="technical text-[9px] text-foreground/40">{plDate(r.created_at)}</span>
                <span className="technical text-[9px] text-foreground/30">NR {String(r.order_id).slice(0, 8).toUpperCase()}</span>
                <span className="flex-1" />
                {r.product_slug ? (
                  <Link to={`/skarbiec/${r.product_slug}`} target="_blank" className="technical text-[9px] gold-text hover:underline">
                    {r.product_name || "PRODUKT"} ↗
                  </Link>
                ) : (
                  <span className="technical text-[9px] text-foreground/40">{r.product_name || "PRODUKT"}</span>
                )}
              </div>

              <p className="text-foreground/80 leading-relaxed whitespace-pre-line max-w-[70ch]">{r.body}</p>

              <div className="flex flex-wrap items-center gap-3">
                {r.status !== "opublikowana" && (
                  <button onClick={() => act({ action: "status", id: r.id, status: "opublikowana" })} disabled={busy} className="btn-relic !px-4 !py-2.5 disabled:opacity-50">
                    <Check className="h-4 w-4" /> OPUBLIKUJ
                  </button>
                )}
                {r.status !== "odrzucona" && (
                  <button onClick={() => act({ action: "status", id: r.id, status: "odrzucona" })} disabled={busy} className="btn-ghost !px-4 !py-2.5 disabled:opacity-50">
                    <X className="h-4 w-4" /> ODRZUĆ
                  </button>
                )}
                {r.status === "opublikowana" && (
                  <button onClick={() => act({ action: "status", id: r.id, status: "oczekuje" })} disabled={busy} className="btn-ghost !px-4 !py-2.5 disabled:opacity-50">
                    <EyeOff className="h-4 w-4" /> UKRYJ PONOWNIE
                  </button>
                )}
              </div>

              <div>
                <label className="technical text-[9px] text-foreground/45 block mb-2">ODPOWIEDŹ EXMORTIS (WIDOCZNA POD OPINIĄ)</label>
                <textarea
                  value={replies[r.id] ?? ""}
                  onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })}
                  rows={2}
                  maxLength={600}
                  className="w-full bg-transparent border hairline px-4 py-3 text-sm focus:border-[#C9A24A] focus:outline-none"
                />
                <button
                  onClick={() => act({ action: "reply", id: r.id, reply: replies[r.id] || "" })}
                  disabled={busy}
                  className="technical text-[9px] px-3 py-2 border border-[#C9A24A]/50 gold-text hover:bg-[#C9A24A]/10 mt-2 disabled:opacity-50"
                >
                  ZAPISZ ODPOWIEDŹ
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}