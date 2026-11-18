import React from "react";

export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exm-gold";
// Przyciski i odnośniki ustawień konta korzystają z systemu marki (btn-relic, btn-ghost, btn-link).
export const BTN_PRIMARY = `btn-relic w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${FOCUS}`;
export const BTN_SECONDARY = `btn-ghost w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${FOCUS}`;
export const LINK = `btn-link ${FOCUS}`;

export const maskEmail = (e = "") => { const [u, d] = e.split("@"); return u ? `${u[0]}***@${d}` : e; };

export default function SettingsCard({ title, children }) {
  return (
    <section className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 font-body text-base text-exm-text sm:p-7">
      <h2 className="exm-eyebrow mb-5">{title}</h2>
      {children}
    </section>
  );
}