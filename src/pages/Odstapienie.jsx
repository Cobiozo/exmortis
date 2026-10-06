import React from "react";
import LegalPage from "@/components/legal/LegalPage";
import WithdrawalForm from "@/components/legal/WithdrawalForm";
import { REGULAMIN, WZOR } from "@/content/legal/regulamin";

const doc = { title: "Odstąpienie od umowy", sections: [REGULAMIN.sections.find((s) => s.id === "p9")] };

export default function Odstapienie() {
  return (
    <LegalPage doc={doc} extra={[WZOR]}>
      <section id="formularz" className="mb-14 border border-[#C9A24A]/40 p-6">
        <h2 className="shop-heading text-2xl text-[#F5EFE1] mb-4">Odstąp od umowy tutaj</h2>
        <WithdrawalForm />
      </section>
    </LegalPage>
  );
}