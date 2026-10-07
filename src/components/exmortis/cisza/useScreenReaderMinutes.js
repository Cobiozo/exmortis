import { useState } from "react";
import { useFrame } from "./views/useFrame";

// Tekst dla czytników ekranu, zmieniany raz na minutę.
export default function useScreenReaderMinutes(clock) {
  const [text, setText] = useState("");
  useFrame(() => {
    const m = Math.ceil(clock.get().rem / 60000);
    const t = m > 0 ? `Pozostało ${m} min` : "Czas minął";
    setText((old) => (old === t ? old : t));
  }, 1000);
  return text;
}