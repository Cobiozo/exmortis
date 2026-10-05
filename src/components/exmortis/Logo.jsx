import React from "react";

const LOGO_URL =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/d0e611e91_logogrupaeq1.png";

export default function Logo({ className = "h-12 w-12", glow = true }) {
  return (
    <img
      src={LOGO_URL}
      alt="exmortis"
      className={`${className} object-contain ${glow ? "glow-pulse" : ""}`}
      style={{ filter: glow ? undefined : "none" }}
    />
  );
}