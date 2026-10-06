import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none";

// Ręczne nadanie dostępu (np. prezent, płatność przelewem).
export default function GrantForm({ onDone }) {
  const [products, setProducts] = useState([]);
  const [email, setEmail] = useState("");
  const [pid, setPid] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    base44.functions.invoke("adminProducts", { action: "list" }).then((r) =>
      setProducts(r.data.products.filter((p) => p.product_type && p.product_type !== "usluga")));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await base44.functions.invoke("adminClients", { action: "grant", email, product_id: pid });
      setMsg("Dostęp nadany."); onDone(email.toLowerCase().trim()); setEmail("");
    } catch (err) {
      setMsg(err?.response?.data?.error || "Nie udało się nadać dostępu.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="border hairline p-4 space-y-3">
      <p className="technical text-[10px] gold-text">NADAJ DOSTĘP</p>
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail klienta" className={inp} />
      <select required value={pid} onChange={(e) => setPid(e.target.value)} className={inp}>
        <option value="">Wybierz produkt</option>
        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button disabled={busy} className="btn-relic w-full !py-2.5">{busy && <Loader2 className="h-4 w-4 animate-spin" />} NADAJ</button>
      {msg && <p className="text-xs gold-text">{msg}</p>}
    </form>
  );
}