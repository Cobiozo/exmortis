import React from "react";

export default function ErrorFallback({ full }) {
  return (
    <div className={`${full ? "min-h-[100svh]" : "min-h-[60svh]"} bg-[#0A0A0B] flex items-center justify-center px-5 pt-28 pb-20`}>
      <div className="max-w-md text-center">
        <p className="technical text-[10px] blood-text mb-4">BŁĄD</p>
        <h1 className="relic-heading text-2xl md:text-3xl mb-5">Coś poszło nie tak na tej stronie.</h1>
        <p className="text-foreground/70 mb-8">Wróć na stronę główną albo odśwież.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a href="/" className="btn-relic">STRONA GŁÓWNA</a>
          <button onClick={() => window.location.reload()} className="btn-ghost">ODŚWIEŻ</button>
        </div>
      </div>
    </div>
  );
}