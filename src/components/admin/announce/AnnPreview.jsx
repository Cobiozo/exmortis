import React from "react";
import AccountAnnouncements from "@/components/account/announce/AccountAnnouncements";
import DailyThought from "@/components/account/DailyThought";

// Podgląd jak w Moim koncie: telefon (pod nagłówkiem) i komputer (prawa kolumna, 380 px).
export default function AnnPreview({ f }) {
  const items = [{ ...f, id: "podglad" }];
  const head = <><p className="technical text-[10px] gold-text mb-4">MOJE KONTO</p><p className="shop-heading text-4xl text-[#F5EFE1]">Dobrze, że jesteś.</p></>;
  return (
    <div className="space-y-6" inert="">
      <div>
        <p className="technical text-[10px] text-foreground/50 mb-2">TELEFON</p>
        <div className="w-[375px] max-w-full border border-[#3D3D3F] bg-[#0A0A0B] p-5 space-y-6">
          <div>{head}</div>
          <div className="flex flex-col gap-4"><AccountAnnouncements items={items} /><DailyThought /></div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <p className="technical text-[10px] text-foreground/50 mb-2">KOMPUTER</p>
        <div className="w-[1100px] border border-[#3D3D3F] bg-[#0A0A0B] p-10 flex items-end justify-between gap-6">
          <div>{head}</div>
          <div className="w-[380px] flex flex-col gap-4"><AccountAnnouncements items={items} /><DailyThought /></div>
        </div>
      </div>
    </div>
  );
}