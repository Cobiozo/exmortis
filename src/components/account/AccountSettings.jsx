import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthField from "@/components/auth/AuthField";

export default function AccountSettings({ me }) {
  const [name, setName] = useState(me.imie || me.full_name || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    await base44.auth.updateMe({ imie: name.trim() });
    setBusy(false);
    setMsg("Zapisano.");
  };
  const letters = async () => {
    await base44.functions.invoke("subscribeNewsletter", { email: me.email, name });
    setMsg("Zapisałem Cię na Listy powrotu. Potwierdzenie przyjdzie mailem.");
  };

  return (
    <div className="max-w-lg space-y-10">
      <form onSubmit={save} className="space-y-5">
        <AuthField id="imie" label="IMIĘ" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <p className="technical text-[10px] text-foreground/50 mb-2">E-MAIL</p>
          <p className="text-sm">{me.email}</p>
        </div>
        <button disabled={busy} className="btn-relic !py-3">{busy && <Loader2 className="h-4 w-4 animate-spin" />} ZAPISZ</button>
      </form>
      <div className="space-y-4 border-t hairline pt-8">
        <Link to="/forgot-password" className="block text-sm text-foreground/65 hover:text-[#C9A24A]">Zmień hasło (link na e-mail)</Link>
        <button onClick={letters} className="block text-sm text-foreground/65 hover:text-[#C9A24A]">Chcę dostawać Listy powrotu</button>
        <button onClick={() => base44.auth.logout("/")} className="block text-sm text-foreground/65 hover:text-[#C9A24A]">Wyloguj</button>
      </div>
      {msg && <p className="text-sm gold-text">{msg}</p>}
    </div>
  );
}