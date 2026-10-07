import { useAuth } from "@/lib/AuthContext";
import { useAdminMode } from "@/components/admin/AdminModeContext";

// Użytkownik „widziany” przez stronę: w widoku gościa admin wygląda jak niezalogowany.
export function useViewer() {
  const { user } = useAuth();
  const { guest } = useAdminMode();
  return { user: guest ? null : user };
}