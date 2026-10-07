import React, { useRef } from "react";
import { useFrame, mmss, minutesText } from "./useFrame";

// Widok A — cyfry MM:SS (albo same minuty), dwukropek powoli oddycha.
export default function DigitsView({ clock, slow, minutesOnly, mini }) {
  if (mini) {
    return (
      <div className="absolute -inset-2 flex items-center justify-center shop-heading text-[13px] text-[#F5EFE1] digits">
        10<span className={`text-[#C9A24A] ${slow ? "" : "breathe"}`}>:</span>00
      </div>
    );
  }
  return <Digits clock={clock} slow={slow} minutesOnly={minutesOnly} />;
}

function Digits({ clock, slow, minutesOnly, mini }) {
  const a = useRef(null);
  const b = useRef(null);
  const last = useRef("");

  useFrame(() => {
    const { rem } = clock.get();
    const [m, s] = mmss(rem);
    const key = minutesOnly ? minutesText(rem) : `${m}:${s}`;
    if (key === last.current || !a.current) return;
    last.current = key;
    a.current.textContent = minutesOnly ? key : m;
    if (b.current) b.current.textContent = s;
  }, slow);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <p
        className="shop-heading text-[#F5EFE1] leading-none whitespace-nowrap digits"
        style={{ fontSize: mini ? "15px" : minutesOnly ? "clamp(40px, 9vmin, 96px)" : "clamp(64px, 17vmin, 168px)" }}
      >
        <span ref={a} />
        {!minutesOnly && (
          <>
            <span className={`text-[#C9A24A] ${slow ? "" : "breathe"}`}>:</span>
            <span ref={b} />
          </>
        )}
      </p>
      {!mini && <span className="mt-8 block h-px w-10 bg-[#C9A24A]" />}
    </div>
  );
}