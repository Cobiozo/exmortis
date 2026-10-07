import { base44 } from "@/api/base44Client";

export const APP = base44.entities.PodcastApplication;
export const STATUSES = [["nowe", "Nowe"], ["przeczytane", "Przeczytane"], ["wstepna", "Rozmowa wstępna"], ["zaproszony", "Zaproszony"], ["nagrane", "Nagrane"], ["opublikowane", "Opublikowane"], ["odrzucone", "Odrzucone"], ["wstrzymane", "Wstrzymane"]];
export const SMIERC = { mentalna: "Mentalna", duchowa: "Duchowa", zyciowa: "Życiowa", trudno: "Trudno powiedzieć" };
export const FORMA = { pelne: "Imię i nazwisko", imie: "Samo imię", pseudonim: "Pseudonim", anonimowo: "Anonimowo" };
export const label = (s) => STATUSES.find((x) => x[0] === s)?.[1] || s;

const cell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // ochrona przed formułami
  return `"${s.replace(/"/g, '""')}"`;
};

export function exportCsv(rows) {
  const cols = ["created_date", "name", "email", "phone", "smierc", "forma", "status", "pilne", "today", "story"];
  const csv = [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = "zgloszenia-podcast.csv";
  a.click();
}