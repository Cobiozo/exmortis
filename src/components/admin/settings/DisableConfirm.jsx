import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Potwierdzenie wyłączenia trybu przedpremierowego.
export default function DisableConfirm({ open, onOpenChange, onConfirm }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#0A0A0B] border hairline rounded-none">
        <AlertDialogHeader>
          <AlertDialogTitle className="relic-heading">Wyłączyć tryb przedpremierowy?</AlertDialogTitle>
          <AlertDialogDescription>Goście od razu zobaczą pełną stronę, pełne menu i wszystkie podstrony. Możesz go potem włączyć ponownie, zapisując nową datę.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-none">Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="rounded-none bg-[#BC1E22] hover:bg-[#d6262b]">Wyłącz teraz</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}