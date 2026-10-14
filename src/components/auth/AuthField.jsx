import React from "react";

// Pole formularza w stylu exmortis.
export default function AuthField({ id, label, aside, ...props }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="technical text-[10px] text-foreground/55">{label}</label>
        {aside}
      </div>
      <input
        id={id}
        {...props}
        className="w-full bg-transparent border hairline px-4 py-3 text-[#F5EFE1] focus:border-[#C9A24A] focus:outline-none transition-colors"
      />
    </div>
  );
}