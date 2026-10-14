import React from "react";

// Ta sama suma kontrolna co na serwerze (base44/shared/invoice.ts).
export function validNip(raw) {
  const d = String(raw || "").toUpperCase().replace(/^PL/, "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(d)) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0) % 11;
  return sum !== 10 && sum === Number(d[9]);
}

const inp = "w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors";
const lab = "technical text-[10px] text-foreground/55 block mb-3";

// Opcjonalne dane do faktury na firmę.
export default function InvoiceFields({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const nipBad = value.want && value.nip && !validNip(value.nip);
  return (
    <div className="space-y-5">
      <label className="flex items-start gap-3 cursor-pointer text-sm text-foreground/75 min-h-[40px]">
        <input type="checkbox" checked={!!value.want} onChange={(e) => set("want", e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" />
        <span>Potrzebuję faktury na firmę (NIP)</span>
      </label>
      {value.want && (
        <div className="space-y-5 border-l-2 border-[#C9A24A]/40 pl-4 sm:pl-5">
          <div>
            <label htmlFor="inv-company" className={lab}>NAZWA FIRMY</label>
            <input id="inv-company" required autoComplete="organization" value={value.company || ""} onChange={(e) => set("company", e.target.value)} className={inp} />
          </div>
          <div>
            <label htmlFor="inv-nip" className={lab}>NIP</label>
            <input id="inv-nip" required inputMode="numeric" autoComplete="off" placeholder="np. 123-456-32-18" value={value.nip || ""}
              onChange={(e) => set("nip", e.target.value)} aria-invalid={nipBad || undefined} aria-describedby={nipBad ? "inv-nip-err" : undefined}
              className={`${inp} ${nipBad ? "!border-[#E8C547]" : ""}`} />
            {nipBad && <p id="inv-nip-err" className="text-xs text-[#E8C547] mt-2">Ten NIP się nie zgadza — sprawdź 10 cyfr.</p>}
          </div>
          <div>
            <label htmlFor="inv-address" className={lab}>ADRES FIRMY</label>
            <input id="inv-address" required autoComplete="street-address" placeholder="ulica i numer, kod, miasto" value={value.address || ""} onChange={(e) => set("address", e.target.value)} className={inp} />
          </div>
          <p className="text-xs text-foreground/55">Fakturę wyślę na podany wyżej e-mail.</p>
        </div>
      )}
    </div>
  );
}