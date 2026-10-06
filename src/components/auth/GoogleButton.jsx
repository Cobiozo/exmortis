import React from "react";
import GoogleIcon from "@/components/GoogleIcon";

export default function GoogleButton({ onClick }) {
  return (
    <>
      <button type="button" onClick={onClick} className="btn-ghost w-full !py-3">
        <GoogleIcon className="w-4 h-4" /> ZALOGUJ PRZEZ GOOGLE
      </button>
      <div className="flex items-center gap-4 my-6">
        <span className="flex-1 h-px bg-[#3D3D3F]" />
        <span className="technical text-[9px] text-foreground/35">ALBO</span>
        <span className="flex-1 h-px bg-[#3D3D3F]" />
      </div>
    </>
  );
}