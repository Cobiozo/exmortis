import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import ReleaseFields from "@/components/admin/ReleaseFields";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import ProductAccessFields from "./ProductAccessFields";
import BundleItemsPicker from "./BundleItemsPicker";
import LessonsManager from "./course/LessonsManager";
import PriceSteps from "./PriceSteps";
import CoverAiButton from "./CoverAiButton";

const CATEGORIES = ["ebook", "warsztat", "mentoring", "mastermind", "retreat", "darmowe"];
const LEVELS = [
  { value: 0, label: "0 — Brama (za darmo)" },
  { value: 1, label: "1 — Pierwszy krok" },
  { value: 2, label: "2 — Praktyka" },
  { value: 3, label: "3 — Krąg" },
  { value: 4, label: "4 — Głębia" },
  { value: 5, label: "5 — Specjalne" },
];
const STAGES = ["Śmierć", "Próg", "Powrót", "Inny", "Wszystkie"];
const FORMS = ["Czytam", "Słucham", "Oglądam", "Uczestniczę", "Idę głęboko"];
const STATUSES = ["dostępny", "wkrótce", "ukryty"];
const AUDIENCES = ["Mężczyzna", "Kobieta", "Ojciec", "Matka", "Mąż", "Żona", "Lider"];

const inputCls =
  "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none transition-colors";
const selectCls = `${inputCls} bg-[#0A0A0B]`;
const labelCls = "technical text-[10px] text-foreground/50 block mb-2";

const toLocalInput = (iso) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function ProductEditor({ product, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    // Drabina Skarbca
    level: product?.level != null ? String(product.level) : "1",
    stage: product?.stage || "Wszystkie",
    form: product?.form || "",
    audience_tags: Array.isArray(product?.audience_tags) ? product.audience_tags : [],
    status: product?.status || "dostępny",
    release_at: product?.release_at ? toLocalInput(product.release_at) : "",
    release_note: product?.release_note || "",
    // Karta w Skarbcu
    promise: product?.promise || "",
    for_whom: product?.for_whom || "",
    format_details: product?.format_details || "",
    button_label: product?.button_label || "",
    checkout_url: product?.checkout_url || "",
    next_step: product?.next_step || "",
    is_featured: !!product?.is_featured,
    sort_order: product?.sort_order != null ? String(product.sort_order) : "",
    cover_image: product?.cover_image || "",
    file_url: product?.file_url || "",
    product_type: product?.product_type || "pdf",
    access_months: product?.access_months != null ? String(product.access_months) : "",
    private_file_uri: product?.private_file_uri || "",
    private_file_name: product?.private_file_name || "",
    bundle_items: Array.isArray(product?.bundle_items) ? product.bundle_items : [],
    // Ceny
    price_start: product?.price_start != null ? String(product.price_start) : "",
    price_regular: product?.price_regular != null ? String(product.price_regular) : "",
    promo_end_date: product?.promo_end_date || "",
    price_options: Array.isArray(product?.price_options) ? product.price_options.join(", ") : "",
    price_steps: Array.isArray(product?.price_steps) ? product.price_steps.map((s) => ({ do: s.do || "", cena: s.cena != null ? String(s.cena) : "" })) : [],
    is_free: !!product?.is_free,
    // Pola klasyczne (strona produktu, koszyk)
    price: product != null && product.price != null ? String(product.price) : "0",
    old_price: product?.old_price != null ? String(product.old_price) : "",
    category: product?.category || "ebook",
    subtitle: product?.subtitle || "",
    description: product?.description || "",
    long_description: product?.long_description || "",
    image_url: product?.image_url || "",
    gallery: Array.isArray(product?.gallery) ? product.gallery : [],
    details: Array.isArray(product?.details) ? product.details : [],
    format: product?.format || "",
    duration: product?.duration || "",
    spots: product?.spots || "",
    active: product ? product.active !== false : true,
  });
  const [detailInput, setDetailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggleTag = (tag) =>
    setForm((f) => ({
      ...f,
      audience_tags: f.audience_tags.includes(tag)
        ? f.audience_tags.filter((t) => t !== tag)
        : [...f.audience_tags, tag],
    }));

  const upload = async (e, key) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      set(key, file_url);
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
          price_start: form.price_start === "" ? null : Number(form.price_start),
          price_regular: form.price_regular === "" ? null : Number(form.price_regular),
          price_steps: form.price_steps.filter((s) => s.do || s.cena !== "").map((s) => ({ do: s.do, cena: s.cena === "" ? null : Number(s.cena) })),
          release_at: form.release_at ? new Date(form.release_at).toISOString() : null,
          level: form.level === "" ? null : Number(form.level),
          sort_order: form.sort_order === "" ? null : Number(form.sort_order),
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
      <button
        onClick={onCancel}
        className="technical text-[10px] text-foreground/40 hover:gold-text flex items-center gap-2 transition-colors mb-8"
      >
        <ArrowLeft className="h-3 w-3" /> POWRÓT DO LISTY
      </button>

      <h2 className="relic-heading text-3xl mb-10">
        {product ? "Edytuj produkt" : "Nowy produkt"}
      </h2>

      {/* ===== DRABINA POWROTU ===== */}
      <p className="technical text-[10px] gold-text mb-6">DRABINA POWROTU</p>
      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div>
          <label className={labelCls}>NAZWA *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>ADRES (SLUG) — puste = automatycznie z nazwy</label>
          <input
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            className={`${inputCls} font-mono text-sm`}
            placeholder="np. wracam-inny"
          />
        </div>
        <div>
          <label className={labelCls}>POZIOM DRABINY</label>
          <select
            value={form.level}
            onChange={(e) => set("level", e.target.value)}
            className={selectCls}
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>STATUS</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className={selectCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {form.status === "wkrótce" && (
          <ReleaseFields form={form} set={set} labelCls={labelCls} inputCls={inputCls} />
        )}
        <div>
          <label className={labelCls}>ETAP</label>
          <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={selectCls}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>FORMA</label>
          <select value={form.form} onChange={(e) => set("form", e.target.value)} className={selectCls}>
            <option value="">— brak —</option>
            {FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-10">
        <label className={labelCls}>DLA KOGO (TAGI ODBIORCY)</label>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleTag(a)}
              className={`technical text-[9px] px-3 py-1.5 border transition-colors ${
                form.audience_tags.includes(a)
                  ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10"
                  : "hairline text-foreground/40 hover:text-foreground/70"
              }`}
            >
              {a.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ===== KARTA W SKARBCU ===== */}
      <p className="technical text-[10px] gold-text mb-6">KARTA W SKARBCU</p>
      <div className="grid md:grid-cols-2 gap-8 mb-6">
        <div className="md:col-span-2">
          <label className={labelCls}>OBIETNICA (1 ZDANIE NA KARTĘ)</label>
          <input value={form.promise} onChange={(e) => set("promise", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>DLA KOGO (1 LINIA, „Dla…")</label>
          <input value={form.for_whom} onChange={(e) => set("for_whom", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>FORMAT I OBJĘTOŚĆ (np. „PDF, 60 stron")</label>
          <input
            value={form.format_details}
            onChange={(e) => set("format_details", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>PRZYCISK (np. „Zacznij czytać")</label>
          <input
            value={form.button_label}
            onChange={(e) => set("button_label", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>LINK DO PŁATNOŚCI / ZAPISU (zostaw puste, jeśli brak)</label>
          <input
            value={form.checkout_url}
            onChange={(e) => set("checkout_url", e.target.value)}
            className={`${inputCls} font-mono text-sm`}
            placeholder="np. https://… albo /powrot"
          />
        </div>
        <div>
          <label className={labelCls}>NASTĘPNY KROK („Następny krok: …")</label>
          <input value={form.next_step} onChange={(e) => set("next_step", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>KOLEJNOŚĆ SORTOWANIA (liczba)</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => set("sort_order", e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={(e) => set("is_featured", e.target.checked)}
            className="accent-[#C9A24A] w-4 h-4"
          />
          <span className="technical text-[10px] text-foreground/60">WYRÓŻNIONY (DUŻA KARTA)</span>
        </label>
      </div>

      {/* ===== CENY ===== */}
      <p className="technical text-[10px] gold-text mb-6">CENY</p>
      <div className="grid md:grid-cols-4 gap-8 mb-6">
        <div>
          <label className={labelCls}>CENA STARTOWA (ZŁ)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price_start}
            onChange={(e) => set("price_start", e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <label className={labelCls}>CENA REGULARNA (ZŁ)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price_regular}
            onChange={(e) => set("price_regular", e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <label className={labelCls}>PROMOCJA DO (DATA)</label>
          <input
            type="date"
            value={form.promo_end_date}
            onChange={(e) => set("promo_end_date", e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <label className={labelCls}>CENA STARA — STRONA PRODUKTU (ZŁ)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </div>
      </div>
      {form.product_type === "karta" && (
        <div className="mb-8">
          <label className={labelCls}>KWOTY KARTY PODARUNKOWEJ (ZŁ, PO PRZECINKU)</label>
          <input value={form.price_options} onChange={(e) => set("price_options", e.target.value)} placeholder="97, 197, 497" className={`${inputCls} font-mono`} />
          <p className="text-[11px] text-foreground/50 mt-1">Klient wybiera kwotę na stronie karty i może dopisać imię obdarowanego oraz jedno zdanie. Puste pole = jedna kwota z ceny produktu.</p>
        </div>
      )}
      <PriceSteps value={form.price_steps} onChange={(v) => set("price_steps", v)} regular={form.price_regular} inputCls={inputCls} labelCls={labelCls} />
      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_free}
            onChange={(e) => set("is_free", e.target.checked)}
            className="accent-[#C9A24A] w-4 h-4"
          />
          <span className="technical text-[10px] text-foreground/60">BEZPŁATNE</span>
        </label>
      </div>

      {/* ===== OKŁADKA ===== */}
      <p className="technical text-[10px] gold-text mb-6">OKŁADKA W SKARBCU</p>
      <div className="mb-10">
        <div className="flex gap-4 items-start">
          <div className="w-28 h-28 border hairline flex-shrink-0 overflow-hidden">
            {form.cover_image ? (
              <Image src={form.cover_image} className="w-full h-full" />
            ) : (
              <div className="w-full h-full bg-[#0F0F10]" />
            )}
          </div>
          <div className="flex-1 space-y-3">
            <label className="btn-ghost cursor-pointer !px-4 !py-2 text-[10px]">
              <Upload className="h-3.5 w-3.5" /> {uploading ? "WGRAWAM..." : "WGRAW Z URZĄDZENIA"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e, "cover_image")} />
            </label>
            {form.category !== "ebook" && <CoverAiButton form={form} onDone={(url) => set("cover_image", url)} />}
            {form.cover_image && (
              <button
                onClick={() => set("cover_image", "")}
                className="technical text-[10px] text-foreground/40 hover:blood-text transition-colors"
              >
                USUŃ OKŁADKĘ
              </button>
            )}
          </div>
        </div>
      </div>

      <ProductAccessFields form={form} set={set} />
      {form.product_type === "pakiet" && <BundleItemsPicker form={form} set={set} />}
      {(form.product_type === "wideo" || form.product_type === "kurs") && (
        product?.id ? <LessonsManager productId={product.id} /> : (
          <p className="mb-10 text-sm text-foreground/50">Zapisz produkt, a potem dodasz lekcje i wideo.</p>
        )
      )}

      {/* ===== PLIK DO POBRANIA ===== */}
      <p className="technical text-[10px] gold-text mb-6">PLIK DO POBRANIA (BEZPŁATNE MATERIAŁY)</p>
      <div className="mb-10 space-y-3">
        <label className="btn-ghost cursor-pointer !px-4 !py-2 text-[10px]">
          <Upload className="h-3.5 w-3.5" /> {uploading ? "WGRAWAM..." : "WGRAW PLIK"}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.epub,.mobi,.zip"
            onChange={(e) => upload(e, "file_url")}
          />
        </label>
        {form.file_url && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-mono text-xs text-foreground/50 break-all">{form.file_url}</span>
            <button
              onClick={() => set("file_url", "")}
              className="technical text-[10px] text-foreground/40 hover:blood-text transition-colors"
            >
              USUŃ PLIK
            </button>
          </div>
        )}
        <p className="text-xs text-foreground/40 leading-relaxed max-w-xl">
          Plik nie jest dostępny do pobrania na stronie — po złożeniu zamówienia bezpłatnego
          materiału trafia do e-maila z linkiem do pobrania.
        </p>
      </div>

      {/* ===== STRONA PRODUKTU (POLA KLASYCZNE) ===== */}
      <p className="technical text-[10px] gold-text mb-6">STRONA PRODUKTU /PRODUKT/SLUG</p>
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        <div>
          <label className={labelCls}>PODKATEGORIA / PODTYTUŁ</label>
          <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>KATEGORIA</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className={selectCls}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>CENA PRZEKREŚLONA — STARA (ZŁ)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.old_price}
            onChange={(e) => set("old_price", e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </div>
      </div>

      <div className="mb-10">
        <label className={labelCls}>KRÓTKI OPIS (LEAD)</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="mb-10">
        <label className={labelCls}>PEŁNY OPIS — EDYTOR ROZBUDOWANEGO TEKSTU</label>
        <RichTextEditor
          value={form.long_description}
          onChange={(v) => set("long_description", v)}
          placeholder="Pełny opis produktu — nagłówki, listy, linki, formatowanie..."
        />
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div>
          <label className={labelCls}>ZDJĘCIE GŁÓWNE (STRONA PRODUKTU)</label>
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
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e, "image_url")} />
              </label>
              {form.image_url && (
                <button
                  onClick={() => set("image_url", "")}
                  className="technical text-[10px] text-foreground/40 hover:blood-text transition-colors"
                >
                  USUŃ ZDJĘCIE
                </button>
              )}
            </div>
          </div>
        </div>
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
          <input
            value={form.format}
            onChange={(e) => set("format", e.target.value)}
            className={inputCls}
            placeholder="np. PDF + audio"
          />
        </div>
        <div>
          <label className={labelCls}>CZAS TRWANIA</label>
          <input
            value={form.duration}
            onChange={(e) => set("duration", e.target.value)}
            className={inputCls}
            placeholder="np. 6 tygodni"
          />
        </div>
        <div>
          <label className={labelCls}>MIEJSCA</label>
          <input
            value={form.spots}
            onChange={(e) => set("spots", e.target.value)}
            className={inputCls}
            placeholder="np. 12"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="accent-[#C9A24A] w-4 h-4"
          />
          <span className="technical text-[10px] text-foreground/60">WIDOCZNY W SKLEPIE</span>
        </label>
      </div>

      {error && <p className="text-sm blood-text mb-6">{error}</p>}

      <div className="flex gap-4 pb-10">
        <button onClick={save} disabled={saving} className="btn-relic disabled:opacity-60">
          {saving ? "ZAPISUJĘ..." : "ZAPISZ PRODUKT"}
        </button>
        <button onClick={onCancel} className="btn-ghost">
          ANULUJ
        </button>
      </div>
    </div>
  );
}