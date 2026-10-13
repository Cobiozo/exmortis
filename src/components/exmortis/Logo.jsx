import React from "react";

const LOGO_URL = "/exmortis-logo-500.png";
// Małe użycia (nagłówek, stopka — do 64 px) dostają lekką wersję 144 px WebP: ~5 KB zamiast ~38 KB.
const LOGO_SMALL = "/exmortis-logo-144.webp";
const SMALL = /(^|\s)h-(9|10|12|14|16)(\s|$)/;
const LARGE = /(^|\s)(md:|lg:)?h-(2[0-9]|3[0-9]|\[)/;

export default function Logo({ className = "h-12 w-12", glow = true }) {
  const small = SMALL.test(className) && !LARGE.test(className);
  return (
    <img
      src={small ? LOGO_SMALL : LOGO_URL}
      alt="exmortis"
      className={`${className} object-contain ${glow ? "glow-pulse" : ""}`}
      style={{ filter: glow ? undefined : "none" }}
    />
  );
}
