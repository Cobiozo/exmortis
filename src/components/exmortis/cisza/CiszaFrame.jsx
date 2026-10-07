import React from "react";
import CiszaLogo from "./CiszaLogo";

// Siatka 100dvh: GÓRA logo · ŚRODEK treść · DÓŁ zarezerwowana strefa.
export default function CiszaFrame({ onLogo, logoExtra, bottom, children, className = "" }) {
  return (
    <section className={`cisza-root fixed inset-0 z-10 grid overflow-hidden ${className}`} style={{ gridTemplateRows: "auto minmax(0,1fr) auto", height: "100dvh" }}>
      <div className="cisza-top relative flex justify-center">
        <CiszaLogo onClick={onLogo} />
        {logoExtra}
      </div>
      <div className="relative min-h-0 flex flex-col items-center justify-center px-4">{children}</div>
      <div className="cisza-bottom relative">{bottom}</div>
    </section>
  );
}