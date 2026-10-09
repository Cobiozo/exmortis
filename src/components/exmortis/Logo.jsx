import React from "react";

const LOGO_URL =
  "/exmortis-logo-500.png";

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