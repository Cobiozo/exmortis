import React from "react";
import GoogleIcon from "@/components/GoogleIcon";
import useLoginText from "@/content/useLoginText";

// Logowanie przez Google jako przycisk drugorzędny, oddzielony linią „albo” od formularza.
export default function GoogleButton({ onClick }) {
  const t = useLoginText();
  return (
    <>
      <button type="button" onClick={onClick} className="btn-ghost w-full">
        <GoogleIcon className="h-4 w-4" aria-hidden="true" /> {t("google")}
      </button>
      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-exm-line" aria-hidden="true" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-exm-muted">{t("albo")}</span>
        <span className="h-px flex-1 bg-exm-line" aria-hidden="true" />
      </div>
    </>
  );
}