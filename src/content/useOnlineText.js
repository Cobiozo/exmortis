import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { ONLINE_BLOCKS } from "./onlineTexts";

const DEF = Object.fromEntries(ONLINE_BLOCKS.map((b) => [b.key, b.default]));

export default function useOnlineText() {
  const { str } = useSiteContent();
  return (key, vars = {}) => (str("online", key, DEF[key]) || DEF[key]).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}