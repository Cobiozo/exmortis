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

  const add = async () => {
    await base44.entities.CourseLesson.create({
      product_id: String(productId), title: "Nowa lekcja", order: (lessons?.length || 0) + 1, published: false,
    });
    load();
  };

  return (
    <div className="mb-10 space-y-4">
      <p className="technical text-[10px] gold-text">LEKCJE / WIDEO</p>
      {!lessons ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : lessons.length === 0 && (
        <p className="text-sm text-foreground/50">Brak lekcji. Dodaj pierwszą i wgraj do niej wideo.</p>
      )}
      {lessons?.map((l) => <LessonRow key={l.id} lesson={l} onChange={load} />)}
      <button type="button" onClick={add} className="btn-ghost !px-4 !py-2 text-[10px]"><Plus className="h-4 w-4" /> DODAJ LEKCJĘ</button>
    </div>
  );
}