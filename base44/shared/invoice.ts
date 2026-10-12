// Dane do faktury z kasy: nazwa firmy, NIP (z sumą kontrolną), adres.

// Zwraca 10 cyfr NIP albo null (dopuszcza prefiks PL, spacje i myślniki).
export function validNip(raw: unknown): string | null {
  const d = String(raw ?? "").toUpperCase().replace(/^PL/, "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(d)) return null;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0) % 11;
  if (sum === 10 || sum !== Number(d[9])) return null;
  return d;
}

// null = bez faktury. Błędy mają treść dla klienta (kasa pokazuje je wprost).
export function cleanInvoice(b: any) {
  if (!b || b.want !== true) return null;
  const company = String(b.company ?? "").trim().slice(0, 200);
  const nip = validNip(b.nip);
  const address = String(b.address ?? "").trim().slice(0, 300);
  if (!company) throw new Error("Podaj nazwę firmy do faktury");
  if (!nip) throw new Error("Niepoprawny NIP — sprawdź 10 cyfr");
  if (address.length < 5) throw new Error("Podaj adres firmy do faktury");
  return { company, nip, address };
}

export const nipPretty = (nip: string) => String(nip || "").replace(/^(\d{3})(\d{3})(\d{2})(\d{2})$/, "$1-$2-$3-$4");

export function invoiceText(inv: any) {
  if (!inv) return "";
  return `Faktura: ${inv.company}, NIP ${nipPretty(inv.nip)}, ${inv.address}`;
}
