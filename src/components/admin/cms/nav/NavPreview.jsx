import React from "react";
import { NavDraftContext } from "@/components/exmortis/nav/useSiteNav";
import DesktopNav from "@/components/exmortis/nav/DesktopNav";
import MobileMenu from "@/components/exmortis/nav/MobileMenu";
import FooterColumns from "@/components/exmortis/footer/FooterColumns";

// Podgląd szkicu menu i stopki w wyglądzie strony (bez publikacji).
export default function NavPreview({ d }) {
  return (
    <NavDraftContext.Provider value={d}>
      <section className="space-y-3">
        <h3 className="relic-heading text-xl">Podgląd szkicu</h3>
        <div className="border hairline pointer-events-none select-none" aria-hidden="true">
          <div className="px-6 py-5 border-b hairline overflow-x-auto"><DesktopNav /></div>
          <div className="px-6 py-10 bg-[#0A0A0B]"><FooterColumns /></div>
        </div>
        <p className="technical text-[10px] text-foreground/50 pt-4">Menu na telefonie</p>
        <div className="w-[360px] max-w-full h-[600px] border hairline pointer-events-none select-none overflow-hidden" aria-hidden="true">
          <MobileMenu open preview onClose={() => {}} />
        </div>
        <p className="technical text-[10px] text-foreground/50 pt-4">Stopka na telefonie</p>
        <div className="w-[360px] max-w-full border hairline pointer-events-none select-none px-4 py-10 bg-[#0A0A0B]" aria-hidden="true">
          <FooterColumns mobile />
        </div>
      </section>
    </NavDraftContext.Provider>
  );
}