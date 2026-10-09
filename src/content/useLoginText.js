import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { LOGIN_DEF } from "./loginTexts";

// t("blad") — tekst z grupy „Logowanie” albo domyślny.
export default function useLoginText() {
  const { str } = useSiteContent();
  return (key) => str("login", key, LOGIN_DEF[key]) || LOGIN_DEF[key];
}