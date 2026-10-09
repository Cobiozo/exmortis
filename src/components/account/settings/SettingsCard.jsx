import React from "react";

export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";
export const BTN_PRIMARY = `inline-flex items-center justify-center gap-2 min-h-[44px] px-6 w-full sm:w-auto font-mono text-xs tracking-[0.18em] uppercase bg-[#C9A24A] text-[#0A0A0B] hover:bg-[#E2C170] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${FOCUS}`;
export const BTN_SECONDARY = `inline-flex items-center justify-center gap-2 min-h-[44px] px-6 w-full sm:w-auto font-mono text-xs tracking-[0.18em] uppercase border border-[#C9A24A] text-[#C9A24A] bg-transparent hover:bg-[#C9A24A]/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${FOCUS}`;
export const LINK = `inline-flex items-center min-h-[44px] underline decoration-[#C9A24A] decoration-1 underline-offset-4 hover:decoration-2 cursor-pointer ${FOCUS}`;

export const maskEmail = (e = "") => { const [u, d] = e.split("@"); return u ? `${u[0]}***@${d}` : e; };

export default function SettingsCard({ title, children }) {
  return (
    <section className="bg-[#0A0A0B] border border-[rgba(201,162,74,.25)] p-5 sm:p-7 font-body text-base text-[#E2E2E2]">
      <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#C9A24A] mb-5">{title}</h2>
      {children}
    </section>
  );
}