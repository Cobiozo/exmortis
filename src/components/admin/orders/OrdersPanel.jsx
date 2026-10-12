import React, { useEffect, useRef, useState } from "react";
import { Loader2, Download, Search, ChevronDown, FileText, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { STATUS_LABEL } from "@/components/account/accountUtils";
import SalesStats from "./SalesStats";

const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} zł`;
const when = (iso) => (iso ? new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const shortNo = (id) => String(id || "").slice(0, 8).toUpperCase();
const nipPretty = (n) => String(n || "").replace(/^(\d{3})(\d{3})(\d{2})(\d{2})$/, "$1-$2-$3-$4");
const STATUS_CLS = { COMPLETED: "text-[#9FD3A0] border-[#9FD3A0]/40", CANCELED: "text-foreground/45 border-foreground/20" };

const FILTERS = [["", "Wszystkie"], ["paid", "Opłacone"], ["pending", "Oczekujące"], ["canceled", "Anulowane"]];

// Plik CSV dla księgowości (średnik + BOM — otwiera się poprawnie w Excelu).
function exportCsv(orders) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Numer", "Data", "Status", "Kupujący", "E-mail", "Produkty", "Kwota", "Firma", "NIP", "Adres firmy", "Faktura wystawiona", "Nr faktury"];
  const rows = orders.map((o) => [
    shortNo(o.id), when(o.created_date), STATUS_LABEL[o.status] || o.status, o.buyer_name, o.buyer_email,
    (o.items || []).map((i) => `${i.name} × ${i.quantity}`).join(", "), String(Number(o.total || 0).toFixed(2)).replace(".", ","),
    o.invoice?.company || "", o.invoice?.nip ? nipPretty(o.invoice.nip) : "", o.invoice?.address || "",
    o.invoice?.nip ? (o.invoice.wystawiona ? "tak" : "nie") : "", o.invoice?.numer || "",
  ]);
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `zamowienia_exmortis_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function InvoiceBox({ o, onSaved }) {
  const inv = o.invoice;
  const [num, setNum] = useState(inv?.numer || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!inv?.nip) return <p className="text-xs text-foreground/45">Bez faktury (osoba prywatna).</p>;
  const save = async (issued) => {
    setBusy(true); setErr("");
    try {
      const r = await base44.functions.invoke("adminOrders", { action: "invoice_issued", id: o.id, issued, number: num });
      onSaved(r.data.invoice);
    } catch (e) { setErr(e?.response?.data?.error || "Nie udało się zapisać."); }
    setBusy(false);
  };
  return (
    <div className="border hairline p-4 space-y-3">
      <p className="technical text-[10px] gold-text flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> DANE DO FAKTURY</p>
      <p className="text-sm text-[#F5EFE1] leading-relaxed">{inv.company}<br />NIP {nipPretty(inv.nip)}<br />{inv.address}</p>
      {inv.wystawiona ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[#9FD3A0] flex items-center gap-1.5"><Check className="h-4 w-4" /> Wystawiona{inv.numer ? `: ${inv.numer}` : ""}{inv.data ? ` (${inv.data})` : ""}</span>
          <button onClick={() => save(false)} disabled={busy} className="btn-ghost !px-3 !py-1.5 text-[10px]">COFNIJ</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Nr faktury (opcjonalnie)" className="bg-transparent border hairline px-3 py-2 text-sm min-w-0 basis-full sm:basis-auto flex-1 focus:border-[#C9A24A] focus:outline-none" />
          <button onClick={() => save(true)} disabled={busy} className="btn-relic !px-4 !py-2 text-[10px]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "OZNACZ JAKO WYSTAWIONĄ"}</button>
        </div>
      )}
      {err && <p className="text-xs text-[#E8C547]">{err}</p>}
    </div>
  );
}

export default function OrdersPanel() {
  const [status, setStatus] = useState("");
  const [todo, setTodo] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const seq = useRef(0);

  const load = () => {
    const my = ++seq.current;
    setErr("");
    base44.functions.invoke("adminOrders", { action: "list", status, invoice: todo ? "todo" : "", q })
      .then((r) => { if (my === seq.current) setData(r.data); })
      .catch((e) => { if (my === seq.current) setErr(e?.response?.data?.error || "Nie udało się wczytać zamówień."); });
  };
  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [status, todo, q]);

  const s = data?.summary || {};
  const orders = data?.orders || [];
  const patch = (id, invoice) => setData((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? { ...o, invoice } : o)) }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#3D3D3F]/40 border hairline">
        {[["Przychód w tym miesiącu", data ? zl(s.revenue_month) : "…"], ["Opłacone w tym miesiącu", data ? s.paid_month ?? 0 : "…"],
          ["Faktury do wystawienia", data ? s.invoices_todo ?? 0 : "…"], ["Przychód łącznie", data ? zl(s.revenue_all) : "…"]].map(([k, v]) => (
          <div key={k} className="bg-[#0A0A0B] p-5">
            <p className="technical text-[9px] text-foreground/45">{k.toUpperCase()}</p>
            <p className="font-mono text-xl sm:text-2xl gold-text mt-2 whitespace-nowrap">{v}</p>
          </div>
        ))}
      </div>

      <SalesStats />

      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-2 sm:flex border hairline w-full sm:w-auto" role="tablist" aria-label="Status">
          {FILTERS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={status === k} onClick={() => setStatus(k)}
              className={`px-4 py-2.5 technical text-[10px] ${status === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:text-foreground"}`}>{l.toUpperCase()}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground/70 cursor-pointer min-h-[40px]">
          <input type="checkbox" checked={todo} onChange={(e) => setTodo(e.target.checked)} className="h-5 w-5 accent-[#C9A24A]" /> Tylko faktury do wystawienia
        </label>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj: e-mail, imię, numer, produkt" aria-label="Szukaj zamówień"
            className="w-full bg-transparent border hairline pl-9 pr-3 py-2.5 text-sm focus:border-[#C9A24A] focus:outline-none" />
        </div>
        <button onClick={() => exportCsv(orders)} disabled={!orders.length} className="btn-ghost !px-4 !py-2.5 text-[10px] disabled:opacity-40">
          <Download className="h-4 w-4" /> CSV DLA KSIĘGOWOŚCI
        </button>
      </div>

      {err ? <p className="text-sm text-[#E8C547]">{err}</p> : !data ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : orders.length === 0 ? (
        <p className="text-sm text-foreground/50 py-10">Brak zamówień{status || todo || q ? " dla tego filtra" : ""}. Płatne zamówienia pojawią się tu po rozpoczęciu płatności w kasie.</p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {orders.map((o) => {
            const isOpen = open === o.id;
            return (
              <div key={o.id}>
                <button onClick={() => setOpen(isOpen ? null : o.id)} aria-expanded={isOpen}
                  className="w-full text-left p-4 grid grid-cols-[1fr_auto] md:grid-cols-[150px_1fr_1fr_110px_140px_20px] gap-x-4 gap-y-1 items-center hover:bg-[#0F0F10]">
                  <span className="text-xs text-foreground/50 order-3 md:order-none">{when(o.created_date)}</span>
                  <span className="min-w-0">
                    <span className="block text-sm text-[#F5EFE1] truncate">{o.buyer_name || "—"}</span>
                    <span className="block text-xs text-foreground/50 truncate">{o.buyer_email}</span>
                  </span>
                  <span className="hidden md:block text-sm text-foreground/70 truncate">{(o.items || []).map((i) => i.name).join(", ")}</span>
                  <span className="font-mono text-sm gold-text md:text-right">{zl(o.total)}</span>
                  <span className={`justify-self-start md:justify-self-end technical text-[9px] border px-2 py-1 ${STATUS_CLS[o.status] || "text-[#E8C547] border-[#E8C547]/40"}`}>
                    {(STATUS_LABEL[o.status] || o.status || "").toUpperCase()}{o.invoice?.nip && !o.invoice.wystawiona && o.status === "COMPLETED" ? " · FV" : ""}
                  </span>
                  <ChevronDown className={`hidden md:block h-4 w-4 text-foreground/40 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 grid md:grid-cols-2 gap-6">
                    <div className="space-y-2 text-sm">
                      <p className="technical text-[10px] text-foreground/45">ZAMÓWIENIE {shortNo(o.id)}</p>
                      {(o.items || []).map((i, k) => (
                        <p key={k} className="flex justify-between gap-4"><span className="text-foreground/80">{i.name} × {i.quantity}</span><span className="font-mono text-foreground/60">{zl((Number(i.unitPrice) * (Number(i.quantity) || 1)) / 100)}</span></p>
                      ))}
                      <p className="flex justify-between gap-4 border-t hairline pt-2"><span className="text-foreground/50">Razem</span><span className="font-mono gold-text">{zl(o.total)}</span></p>
                      {o.note && <p className="text-xs text-foreground/50 whitespace-pre-line pt-2">{o.note}</p>}
                      <p className="text-xs text-foreground/35 pt-2 break-all">Pełny numer: {o.id}{o.payu_order_id ? ` · PayU: ${o.payu_order_id}` : ""}</p>
                    </div>
                    <InvoiceBox o={o} onSaved={(inv) => patch(o.id, inv)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
