import React, { useEffect, useRef, useState } from "react";
import { getView } from "./views";
import TimeLine from "./TimeLine";

// Scena: zawsze ten sam rozmiar i miejsce (70% krótszego boku), przenikanie 600 ms przy zmianie widoku.
export default function Stage({ view, clock, slow, ending, minutesOnly, showTime, onTap, stageRef, label }) {
  const [prev, setPrev] = useState(null);
  const cur = useRef(view);
  useEffect(() => {
    if (cur.current === view) return;
    setPrev(cur.current);
    cur.current = view;
    const t = setTimeout(() => setPrev(null), 600);
    return () => clearTimeout(t);
  }, [view]);

  const slowFor = (id) => (slow === true ? (id === "cyfry" ? 1000 : 5000) : slow || 0);
  const layer = (id, cls) => {
    const { C } = getView(id);
    return (
      <div key={id} className={`absolute inset-0 ${cls}`}>
        <C clock={clock} slow={slowFor(id)} ending={ending} minutesOnly={minutesOnly} />
      </div>
    );
  };

  return (
    <div className="relative flex flex-col items-center">
      <div
        ref={stageRef}
        role="timer"
        aria-label={label}
        onClick={onTap}
        className="relative w-[70vmin] h-[70vmin] cursor-default select-none"
      >
        {prev && layer(prev, "xfade-out")}
        {layer(view, prev ? "xfade-in" : "")}
      </div>
      <TimeLine clock={clock} visible={showTime} />
    </div>
  );
}