import React from "react";

const F = "w-full bg-transparent border px-4 py-3 focus:border-[#C9A24A] focus:outline-none";

// Pole formularza z etykietą nad polem i błędem słowami pod polem.
export default function ContactField({ id, label, textarea, error, ...props }) {
  const cls = `${F} ${error ? "border-[#BC1E22]" : "hairline"}`;
  const aria = { id, "aria-invalid": !!error, "aria-describedby": error ? `${id}-err` : undefined };
  return (
    <div>
      <label htmlFor={id} className="block technical text-[10px] text-foreground/70 mb-2">{label}</label>
      {textarea ? <textarea rows={5} {...aria} {...props} className={`${cls} resize-none`} /> : <input {...aria} {...props} className={cls} />}
      {error && <p id={`${id}-err`} className="text-sm text-[#E8C547] mt-1.5">{error}</p>}
    </div>
  );
}