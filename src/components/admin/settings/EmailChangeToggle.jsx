import React, { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { ecCall } from "@/components/admin/clients/emailChangeApi";

// Jeden przełącznik: funkcja „Zmień adres e-mail” w panelu Klienci.
export default function EmailChangeToggle() {
  const [on, setOn] = useState(null);
  useEffect(() => { ecCall({ action: "settings" }).then((r) => setOn(r.wlaczona)); }, []);
  if (on === null) return null;
  return (
    <section className="border hairline p-6 md:p-8 flex items-center justify-between gap-4">
      <div>
        <h2 className="relic-heading text-xl">Zmiana adresu e-mail klienta</h2>
        <p className="text-sm text-foreground/50 mt-1">Przycisk „Zmień adres e-mail” w panelu Klienci.</p>
      </div>
      <Switch checked={on} onCheckedChange={(v) => { setOn(v); ecCall({ action: "settings", wlaczona: v }); }} />
    </section>
  );
}