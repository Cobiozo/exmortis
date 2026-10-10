import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Lista zapisanych wersji (bez treści) i — przy ?wersja= — dokładnie zapisana treść.
export default function useLegalArchive(docKey, want) {
  const list = useQuery({
    queryKey: ["legalVersions", docKey],
    queryFn: () => base44.entities.LegalDocVersion.filter({ doc: docKey }, { sort: "-created_date", limit: 50, fields: ["version", "date"] }).then((p) => p.items),
    staleTime: 5 * 60000,
  });
  const one = useQuery({
    queryKey: ["legalVersion", docKey, want],
    enabled: !!want,
    queryFn: () => base44.entities.LegalDocVersion.filter({ doc: docKey, version: want }, { limit: 1 }).then((p) => p.items[0] || null),
  });
  return { versions: list.data || [], archived: one.data, loading: !!want && one.isLoading };
}