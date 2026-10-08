import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MediaLibrary from "./MediaLibrary";

export default function MediaPickerDialog({ open, onOpenChange, onPick }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0A0A0B] border-[#3D3D3F] rounded-none">
        <DialogHeader><DialogTitle className="relic-heading text-xl">Biblioteka mediów</DialogTitle></DialogHeader>
        {open && <MediaLibrary onPick={(m) => { onPick(m); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}