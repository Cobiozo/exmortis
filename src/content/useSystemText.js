import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { SYSTEM_BLOCKS } from "./systemTexts";

const DEF = Object.fromEntries(SYSTEM_BLOCKS.map((b) => [b.key, b.default]));

// t("dz.pdf", { imie: "Ania" }) — tekst z zakładki „Teksty systemowe” albo domyślny.
export default function useSystemText() {
  const { str } = useSiteContent();
  return (key, vars = {}) => (str("system", key, DEF[key]) || DEF[key]).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}