import React, { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LessonRow from "./LessonRow";

// Lekcje kursu / wideo produktu (tylko po zapisaniu produktu).
export default function LessonsManager({ productId }) {
  const [lessons, setLessons] = useState(null);
  const load = () =>
    base44.entities.CourseLesson.filter({ product_id: String(productId) }, { sort: "order", limit: 300 })
      .then((p) => setLessons(p.items));
  useEffect(() => { load(); }, [productId]);
  // Zaufane domeny wideo (te same co w bibliotece) — do sprawdzenia adresów z własnego serwera.
  const [domains, setDomains] = useState(null);
  const [domErr, setDomErr] = useState("");
  useEffect(() => {
    base44.functions.invoke("libraryAdmin", { action: "settings" })
      .then((r) => setDomains(r.data?.settings?.video_domains || [])).catch(() => setDomains(null));
  }, []);
  const addDomain = async (host) => {
    setDomErr("");
    try {
      const r = await base44.functions.invoke("libraryAdmin", { action: "add_video_domain", domain: host });
      setDomains(r.data.video_domains || []);
    } catch (e) { setDomErr(e?.response?.data?.error || "Nie udało się dodać domeny."); }
  };

  const add = async () => {
    await base44.entities.CourseLesson.create({
      product_id: String(productId), title: "Nowa lekcja", order: (lessons?.length || 0) + 1, published: false,
    });
    load();
  };

  return (
    <div className="mb-10 space-y-4">
      <p className="technical text-[10px] gold-text">LEKCJE / WIDEO{lessons ? ` · WIDOCZNE ${lessons.filter((l) => l.published).length} / ${lessons.length}` : ""}</p>
      <p className="text-xs text-foreground/50 leading-relaxed">
        Kupujący dostaje dostęp od razu po płatności (Moje konto → Moje produkty → Otwórz kurs). Widzi tylko lekcje oznaczone „Widoczna dla klientów”.
        Wideo: wklej adres filmu z własnego serwera (https, .mp4 lub .webm) i kliknij „Sprawdź odtwarzanie”. Krótkie filmy (do 100 MB) można też wgrać. Kolejność = pole z numerem; „Moduł” grupuje lekcje w spisie.
        Podgląd jak klient: nadaj sobie dostęp w „Klienci i dostępy”.
      </p>
      {!lessons ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : lessons.length === 0 && (
        <p className="text-sm text-foreground/50">Brak lekcji. Dodaj pierwszą i wgraj do niej wideo.</p>
      )}
      {domErr && <p className="text-xs text-[#E8C547]">{domErr}</p>}
      {lessons?.map((l) => <LessonRow key={l.id} lesson={l} onChange={load} domains={domains} onAddDomain={addDomain} />)}
      <button type="button" onClick={add} className="btn-ghost !px-4 !py-2 text-[10px]"><Plus className="h-4 w-4" /> DODAJ LEKCJĘ</button>
    </div>
  );
}