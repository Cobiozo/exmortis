import React from "react";

export default function Section({ id, label, title, dark = false, children }) {
  return (
    <section
      id={id}
      className={`py-24 md:py-32 px-5 md:px-10 border-t hairline ${dark ? "bg-[#070708]" : "bg-[#0A0A0B]"}`}
    >
      <div className="mx-auto max-w-[1400px]">
        {label && <p className="technical text-[11px] gold-text mb-4">{label}</p>}
        {title && (
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-12">{title}</h2>
        )}
        {children}
      </div>
    </section>
  );
}