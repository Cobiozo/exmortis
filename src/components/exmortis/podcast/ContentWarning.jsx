import React from "react";

export default function ContentWarning({ topics }) {
  if (!topics?.length) return null;
  return (
    <div className="border border-[#C9A24A]/40 bg-[#0F0E0B] p-5 text-sm leading-relaxed text-foreground/75">
      W tej rozmowie pada temat: <span className="text-[#F5EFE1]">{topics.join(", ")}</span>. Jeśli to dla Ciebie trudne — możesz wrócić do niej później. W kryzysie:{" "}
      <span className="gold-text">116 123 · 800 70 2222</span> (całą dobę) · <span className="gold-text">112</span>.
    </div>
  );
}