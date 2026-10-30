import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Potwierdzenie usunięcia zgłoszenia POWRÓT (razem z odpowiedziami ankiety).
export default function PowrotDeleteDialog({ app, open, onOpenChange, onConfirm, busy }) {
  const name = app?.full_name || "—";
  const mail = app?.email || "—";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#0A0A0B] border hairline rounded-none">
        <AlertDialogHeader>
          <AlertDialogTitle className="relic-heading">Usunąć zgłoszenie?</AlertDialogTitle>
          <AlertDialogDescription>
            Usunąć zgłoszenie {name} ({mail})? Odpowiedzi z ankiety zostaną trwale usunięte. Tej operacji nie można cofnąć.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-none" disabled={busy}>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={busy} className="rounded-none bg-[#BC1E22] hover:bg-[#d6262b]">
            {busy ? "Usuwanie…" : "Usuń trwale"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}