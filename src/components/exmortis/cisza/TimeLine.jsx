import React, { useRef } from "react";
import { useFrame, mmss } from "./views/useFrame";

// Małe cyfry pod sceną (pozycja zarezerwowana — nic się nie przesuwa).
export default function TimeLine({ clock, visible }) {
  const el = useRef(null);
  useFrame(() => {
    if (el.current) el.current.textContent = mmss(clock.get().rem).join(":");
  }, 250);
  return (
    <p
      ref={el}
      aria-hidden="true"
      className="absolute top-full mt-6 shop-heading text-lg text-[#F5EFE1] digits transition-opacity duration-700"
      style={{ opacity: visible ? 0.6 : 0 }}
    />
  );
}