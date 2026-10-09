import { base44 } from "@/api/base44Client";

export const ecCall = (p) => base44.functions.invoke("emailChange", p).then((r) => r.data).catch((e) => ({ error: e?.response?.data?.error || e.message }));

export const EC_STATUS = {
  wyslano: "Link wysłany na obecny adres", podano: "Nowy adres podany — czeka na przyjęcie zaproszenia",
  przyjeto: "Zaproszenie przyjęte — gotowe do przeniesienia", przenoszenie: "Przenoszenie…", blad: "Błąd — ponawiane automatycznie",
  przeniesiono: "Przeniesiono", przywrocono: "Przywrócono z kopii", wygaslo: "Link wygasł",
};

export function downloadJson(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}