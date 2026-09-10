import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

const CATEGORIES = ["ebook", "warsztat", "mentoring", "mastermind", "retreat", "darmowe"];

const inputCls = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none transition-colors";
const labelCls = "technical text-[10px] text-foreground/50 block mb-2";

export default function ProductEditor({ product, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    subtitle: product?.subtitle || "",
    description: product?.description || "",
    long_description: product?.long_description || "",
    price: product != null && product.price != null ? String(product.price) : "",
    old_price: product?.old_price != null ? String(product.old_price) : "",
    category: product?.category || "ebook",
    image_url: product?.image_url || "",
    gallery: Array.isArray(product?.gallery) ? product.gallery : [],
    details: Array.isArray(product?.details) ? product.details : [],
    format: product?.format || "",
    duration: product?.duration || "",
    spots: product?.spots || "",
    featured: !!product?.featured,
    active: product ? product.active !== false : true,
  });
  const [detailInput, setDetailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const uploadMainImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      set("image_url", file_url);
    } catch {
      setError("Nie udało się wgrać zdjęcia.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const uploadGallery = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const urls = [];
      for (const file of files.slice(0, 6)) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        urls.push(file_url);
      }
      setForm((f) => ({ ...f, gallery: [...f.gallery, ...urls] }));
    } catch {
      setError("Nie udało się wgrać zdjęć.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const addDetail = () => {
    const v = detailInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, details: [...f.details, v] }));
    setDetailInput("");
  };

  const save = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Produkt musi mieć nazwę.");
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke("adminProducts", {
        action: "save",
        product: {
          ...form,
          id: product?.id,
          price: Number(form.price) || 0,
          old_price: form.old_price === "" ? null : Number(form.old_price),
        },
      });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się zapisać produktu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button onClick={onCancel} className="technical text-[10px] text-foreground/40 hover:gold-text flex items-center gap-2 transition-colors mb-8">
        <ArrowLeft className="h-3 w-3" /> POWRÓT DO LISTY
      </button>

      <h2 className="relic-heading text-3xl mb-10">
        {product ? "Edytuj produkt" : "Nowy produkt"}
      </h2>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div>
          <label className={labelCls}>NAZWA *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>ADRES (SLUG) — puste = automatycznie z nazwy</label>
          <input value={form.slug} onChange={(e) => set("slug", e.target.value)} className={`${inputCls} font-mono text-sm`} placeholder="np. powrot-do-zycia" />
        </div>
        <div>
          <label className={labelCls}>PODKATEGORIA / PODTYTUŁ</label>
          <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>KATEGORIA</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className={`${inputCls} bg-[#0A0A0B]`}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>CENA (ZŁ) *</label>
          <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} className={`${inputCls} font-mono`} />
        </div>
        <div>
          <label className={labelCls}>CENA PRZEKREŚLONA (ZŁ)</label>
          <input type="number" min="0" step="0.01" value={form.old_price} onChange={(e) => set("old_price", e.target.value)} className={`${inputCls} font-mono`} />
        </div>
      </div>

      <div className="mb-10">
        <label className={labelCls}>KRÓTKI OPIS (LEAD)</label>
        <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} resize-none`} />
      </div>

      <div className="mb-10">
        <label className={labelCls}>PEŁNY OPIS — EDYTOR ROZBUDOWANEGO TEKSTU</label>
        <RichTextEditor value={form.long_description} onChange={(v) => set("long_description", v)} placeholder="Pełny opis produktu — nagłówki, listy, linki, formatowanie..." />
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-10">
        {/* Zdjęcie główne */}
        <div>
          <label className={labelCls}>ZDJĘCIE GŁÓWNE</label>
          <div className="flex gap-4 items-start">
            <div className="w-28 h-28 border hairline flex-shrink-0 overflow-hidden">
              {form.image_url ? (
                <Image src={form.image_url} className="w-full h-full" />
              ) : (
                <div className="w-full h-full bg-[#0F0F10]" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <label className="btn-ghost cursor-pointer !px-4 !py-2 text-[10px]">
                <Upload className="h-3.5 w-3.5" /> {uploading ? "WGRAWAM..." : "WGRAW Z URZĄDZENIA"}
                <input type="file" accept="image/*" className="hidden" onChange={uploadMainImage} />
              </label>
              {form.image_url && (
                <button onClick={() => set("image_url", "")} className="technical text-[10px] text-foreground/40 hover:blood-text transition-colors">
                  USUŃ ZDJĘCIE
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Galeria */}
        <div>
          <label className={labelCls}>GALERIA (MOŻESZ WGRAĆ KILKA)</label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {form.gallery.map((url, i) => (
              <div key={i} className="relative aspect-square border hairline group">
                <Image src={url} className="w-full h-full" />
                <button
                  onClick={() => set("gallery", form.gallery.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 p-1 bg-[#0A0A0B]/80 text-foreground/60 hover:blood-text transition-colors"
                  aria-label="Usuń"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <label className="btn-ghost cursor-pointer !px-4 !py-2 text-[10px]">
            <Upload className="h-3.5 w-3.5" /> {uploading ? "WGRAWAM..." : "DODAJ ZDJĘCIA"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={uploadGallery} />
          </label>
        </div>
      </div>

      {/* Szczegóły */}
      <div className="mb-10">
        <label className={labelCls}>SZCZEGÓŁY (CO DOSTAJE KUPOWĄCY)</label>
        <div className="flex gap-3 mb-4">
          <input
            value={detailInput}
            onChange={(e) => setDetailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDetail())}
            className={inputCls}
            placeholder="Np. 8 rozdziałów PDF"
          />
          <button onClick={addDetail} className="btn-ghost !px-4">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {form.details.length > 0 && (
          <ul className="space-y-2">
            {form.details.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-4 border hairline px-4 py-2">
                <span className="text-sm text-foreground/70">{d}</span>
                <button
                  onClick={() => set("details", form.details.filter((_, idx) => idx !== i))}
                  className="text-foreground/40 hover:blood-text transition-colors"
                  aria-label="Usuń"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-10">
        <div>
          <label className={labelCls}>FORMAT</label>
          <input value={form.format} onChange={(e) => set("format", e.target.value)} className={inputCls} placeholder="np. PDF + audio" />
        </div>
        <div>
          <label className={labelCls}>CZAS TRWANIA</label>
          <input value={form.duration} onChange={(e) => set("duration", e.target.value)} className={inputCls} placeholder="np. 6 tygodni" />
        </div>
        <div>
          <label className={labelCls}>MIEJSCA</label>
          <input value={form.spots} onChange={(e) => set("spots", e.target.value)} className={inputCls} placeholder="np. 12" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} className="accent-[#C9A24A] w-4 h-4" />
          <span className="technical text-[10px] text-foreground/60">WYRÓŻNIONY</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="accent-[#C9A24A] w-4 h-4" />
          <span className="technical text-[10px] text-foreground/60">WIDOCZNY W SKLEPIE</span>
        </label>
      </div>

      {error && <p className="text-sm blood-text mb-6">{error}</p>}

      <div className="flex gap-4 pb-10">
        <button onClick={save} disabled={saving} className="btn-relic disabled:opacity-60">
          {saving ? "ZAPISUJĘ..." : "ZAPISZ PRODUKT"}
        </button>
        <button onClick={onCancel} className="btn-ghost">ANULUJ</button>
      </div>
    </div>
  );
}