import React, { Suspense, lazy, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNoIndex } from "@/lib/useNoIndex";

const PdfReader = lazy(() => import("@/components/account/reader/PdfReader"));

// Czytnik e-booka z konta (PDF z osobistym znakiem wodnym, ten sam plik co do pobrania).
export default function Czytnik() {
  const { accessId } = useParams();
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [back, setBack] = useState(null);
  useNoIndex();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    try { const b = sessionStorage.getItem("exm-reader-back"); if (b) setBack(JSON.parse(b)); } catch { /* bez powrotu */ }
    setErr(""); setFile(null);
    base44.functions.invoke("myAccount", { action: "file", access_id: accessId })
      .then((r) => { if (r.data?.url) setFile(r.data); else setErr("E-book jest jeszcze w przygotowaniu."); })
      .catch((e) => {
        const s = e?.response?.status || e?.status || 0;
        setErr(s === 403 || s === 401 ? "Nie masz dostępu do tego e-booka albo dostęp wygasł." : "Nie udało się otworzyć e-booka. Spróbuj ponownie za chwilę.");
      });
  }, [accessId, tick]);

  const backTo = back?.id === accessId && back?.to ? back : { to: "/konto", label: "MOJE PRODUKTY" };
  return (
    <div className="pt-24 md:pt-28 pb-10 px-3 md:px-10 mx-auto max-w-[1100px]">
      <Link to={backTo.to} className="inline-flex items-center gap-2 technical text-[10px] text-foreground/55 hover:gold-text"><ArrowLeft className="h-4 w-4" /> {backTo.label}</Link>
      <h1 className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] mt-4 mb-4">{file?.title || "E-book"}</h1>
      {err ? (
        <div className="py-16 text-center">
          <p className="text-foreground/65">{err}</p>
          <Link to="/konto" className="btn-ghost mt-6 inline-flex">Moje produkty</Link>
        </div>
      ) : !file ? (
        <div className="py-24 flex justify-center"><Loader2 className="h-6 w-6 animate-spin gold-text" /></div>
      ) : (
        <Suspense fallback={<div className="py-24 flex justify-center"><Loader2 className="h-6 w-6 animate-spin gold-text" /></div>}>
          <PdfReader src={file.url} downloadUrl={file.download_url} storageId={accessId} title={file.title || ""} onRetry={() => setTick((t) => t + 1)} />
        </Suspense>
      )}
      <p className="mt-4 text-xs text-foreground/45">Plik zawiera Twój osobisty znak wodny. Ostatnio czytana strona zapamiętuje się na tym urządzeniu.</p>
    </div>
  );
}
