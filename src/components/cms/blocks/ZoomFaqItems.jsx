import React from "react";
import FaqItem from "./ListBlocksFaq";
import useOnlineText from "@/content/useOnlineText";

// Pytania o Zoom z „Teksty systemowe → Spotkania online” — doklejane do FAQ stron spotkań z edytora.
export default function ZoomFaqItems({ start }) {
  const t = useOnlineText();
  return [["imie"], ["zoom"]].map(([k], j) => (
    <FaqItem key={`z-${k}`} i={`zoom-${start + j}`} q={{ pytanie: t(`faq.${k}.q`), odpowiedz: t(`faq.${k}.a`) }} />
  ));
}