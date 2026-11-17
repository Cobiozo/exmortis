import React from "react";

const STAGES = [
  { name: "Śmierć", text: "Nazywasz to, co w Tobie umarło. Bez upiększania i bez oceniania." },
  { name: "Próg", text: "Zatrzymujesz się i decydujesz, że wracasz. To pierwszy ruch, nie gotowość." },
  { name: "Powrót", text: "Krok po kroku budujesz siebie na nowo: rytm, relacje, sens." },
  { name: "Inny", text: "Nie wracasz do dawnej wersji siebie. Wracasz jako ktoś nowy." },
];

// Strona główna: „Droga powrotu” — cztery etapy, na których opiera się mentoring POWRÓT.
// Od 17.11.2026 karty w stylu Mojego konta; trzy dawne „prawdy” usunięte (powtarzały manifest).
export default function ReturnPath({ label } = {}) {
  return (
    <section className="py-16 md:py-24 px-4 sm:px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1200px]">
        <p className="technical text-[11px] gold-text">{label || "DROGA POWROTU"}</p>
        <div className="mt-2 grid gap-4 md:grid-cols-12 md:items-end mb-8 md:mb-10">
          <h2 className="relic-heading text-[32px] md:text-[44px] md:col-span-6">Droga powrotu ma cztery etapy</h2>
          <p className="text-[#F5EFE1]/70 leading-relaxed md:col-span-6 max-w-[52ch]">
            Powrót nie dzieje się w jeden dzień. Na każdym etapie potrzeba czegoś innego — dlatego tak samo zbudowany jest mentoring POWRÓT.
          </p>
        </div>
        <ol className="grid gap-3 md:gap-5 grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, i) => (
            <li key={s.name} className="rounded-2xl border hairline bg-[#111113] p-4 md:p-6 flex flex-col gap-2 md:gap-3">
              <span className="technical text-[10px] gold-text">ETAP {String(i + 1).padStart(2, "0")}</span>
              <h3 className="relic-heading text-[24px] md:text-[28px]">{s.name}</h3>
              <p className="text-[14px] md:text-[15px] leading-relaxed text-[#F5EFE1]/70">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
