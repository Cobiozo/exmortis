import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { clause } from "@/lib/firma";
import { useFirma } from "@/lib/useSiteSettings";

const F = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";

export default function WithdrawalForm({ order }) {
  const { user } = useAuth();
  const [f, setF] = useState({ name: "", email: "", order_id: order?.id || "", product: order?.product || "", order_date: order?.date || "", reason: "" });
  const [state, setState] = useState("form");
  const [err, setErr] = useState("");
  const [at, setAt] = useState("");
  useEffect(() => { if (user) setF((x) => ({ ...x, email: x.email || user.email, name: x.name || user.full_name || "" })); }, [user]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setState("busy"); setErr("");
    try {
      const r = await base44.functions.invoke("withdrawal", f);
      setAt(r.data.received_at); setState("done");
    } catch (x) { setErr(x?.response?.data?.error || "Nie udało się wysłać. Spróbuj ponownie."); setState("form"); }
  };

  if (state === "done") return <p className="text-foreground/80">Otrzymaliśmy Twoje oświadczenie o odstąpieniu od umowy ({new Date(at).toLocaleString("pl-PL")}). Potwierdzenie wysłaliśmy na {f.email}.</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <input required placeholder="Imię i nazwisko" value={f.name} onChange={set("name")} className={F} />
      <input required type="email" placeholder="Adres e-mail do potwierdzenia" value={f.email} onChange={set("email")} className={F} />
      <input required placeholder="Numer zamówienia" value={f.order_id} onChange={set("order_id")} className={F} />
      <input required placeholder="Produkt lub usługa" value={f.product} onChange={set("product")} className={F} />
      <input type="date" aria-label="Data zamówienia" value={f.order_date} onChange={set("order_date")} className={F} />
      <textarea rows={3} placeholder="Powód (nieobowiązkowo)" value={f.reason} onChange={set("reason")} className={`${F} resize-none`} />
      {err && <p className="text-sm text-[#E8C547]">{err}</p>}
      <button disabled={state === "busy"} className="btn-relic w-full disabled:opacity-60">Potwierdź odstąpienie od umowy</button>
      <p className="text-xs text-foreground/45">{clause("przyjąć i obsłużyć Twoje odstąpienie od umowy", firma)} Więcej: <Link to="/polityka-prywatnosci" className="underline">Polityka prywatności</Link>.</p>
    </form>
  );
}