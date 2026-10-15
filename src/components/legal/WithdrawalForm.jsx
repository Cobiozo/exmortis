import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useFirma } from "@/lib/useSiteSettings";

const F = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";
const Field = ({ id, label, hint, children }) => (
  <label htmlFor={id} className="block">
    <span className="block technical text-[11px] text-foreground/70 mb-2">{label}</span>
    {children}
    {hint && <span className="block text-sm text-foreground/60 mt-1">{hint}</span>}
  </label>
);

export default function WithdrawalForm({ order }) {
  const { user } = useAuth();
  const [f, setF] = useState({ name: "", email: "", order_id: order?.id || "", product: order?.product || "", order_date: order?.date || "", reason: "" });
  const [state, setState] = useState("form");
  const [err, setErr] = useState("");
  const [at, setAt] = useState("");
  const firma = useFirma();
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
      <Field id="w-name" label="IMIĘ I NAZWISKO"><input id="w-name" required value={f.name} onChange={set("name")} className={F} /></Field>
      <Field id="w-email" label="E-MAIL DO POTWIERDZENIA"><input id="w-email" required type="email" value={f.email} onChange={set("email")} className={F} /></Field>
      <Field id="w-order" label="NUMER ZAMÓWIENIA (NIEOBOWIĄZKOWO)" hint="Jeśli masz — z e-maila z potwierdzeniem."><input id="w-order" value={f.order_id} onChange={set("order_id")} className={F} /></Field>
      <Field id="w-product" label="PRODUKT LUB USŁUGA"><input id="w-product" required value={f.product} onChange={set("product")} className={F} /></Field>
      <Field id="w-date" label="DATA ZAWARCIA UMOWY"><input id="w-date" type="date" value={f.order_date} onChange={set("order_date")} className={`${F} dt-input`} /></Field>
      <Field id="w-reason" label="POWÓD (NIEOBOWIĄZKOWO)"><textarea id="w-reason" rows={3} value={f.reason} onChange={set("reason")} className={`${F} resize-none`} /></Field>
      {err && <p className="text-sm text-[#E8C547]">{err}</p>}
      <button disabled={state === "busy"} className="btn-relic w-full disabled:opacity-60">Potwierdź odstąpienie od umowy</button>
      <p className="text-sm text-foreground/75">Dane z formularza przetwarzamy wyłącznie, aby obsłużyć odstąpienie. Szczegóły: <Link to="/polityka-prywatnosci" className="underline">Polityka prywatności</Link>.</p>
    </form>
  );
}