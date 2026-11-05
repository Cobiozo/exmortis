import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Potwierdzenie włączenia przerwy technicznej.
export default function DisableConfirm({ open, onOpenChange, onConfirm, until }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#0A0A0B] border hairline">
        <AlertDialogHeader>
          <AlertDialogTitle className="relic-heading">Włączyć przerwę techniczną?</AlertDialogTitle>
          <AlertDialogDescription className="text-foreground/70 leading-relaxed">
            Goście zobaczą stronę przerwy{until ? ` do ${until}` : " do czasu, aż ją zakończysz"}. Otwarte zostają: logowanie, Kontakt, dokumenty prawne
            i linki z maili. Zalogowani klienci i Ty widzicie pełną stronę. Płatności PayU, maile i zadania w tle działają bez zmian.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="btn-blood">Włącz przerwę</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
