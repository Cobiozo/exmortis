import React from "react";

const LOGO_URL =
  "https://media.base44.com/images/public/user_6aa08adecf36284d2302742e/432e5548a_logo.png";

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