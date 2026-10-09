import React from "react";

const bar = (w, gold) => <span className={`block h-1.5 ${w} ${gold ? "bg-[#C9A24A]" : "bg-foreground/25"}`} />;

// Miniatura gotowej sekcji: uproszczony szkic układu.
export default function PresetThumb({ szkic }) {
  const box = "h-20 bg-[#070708] border hairline p-3 flex gap-2";
  if (szkic === "split" || szkic === "invite") return (
    <div className={box}>
      <span className={`w-2/5 bg-foreground/15 ${szkic === "invite" ? "order-2" : ""}`} />
      <span className="flex-1 flex flex-col justify-center gap-1.5">{bar("w-1/3", true)}{bar("w-4/5")}{bar("w-3/5")}{szkic === "invite" && <span className="block h-3 w-1/3 bg-[#C9A24A] mt-1" />}</span>
    </div>);
  if (szkic === "faq") return <div className={`${box} flex-col justify-center`}>{[0, 1, 2].map((i) => <span key={i} className="flex justify-between items-center border-b hairline pb-1">{bar("w-2/3")}<span className="text-[9px] gold-text">+</span></span>)}</div>;
  if (szkic === "steps") return <div className={`${box} items-center`}>{[0, 1, 2, 3].map((i) => <span key={i} className="flex-1 flex flex-col gap-1"><span className="technical text-[8px] gold-text">0{i + 1}</span>{bar("w-full")}</span>)}</div>;
  if (szkic === "form") return <div className={`${box} flex-col justify-center`}>{bar("w-1/3", true)}<span className="flex gap-1 mt-1"><span className="flex-1 h-4 border hairline" /><span className="w-1/4 h-4 bg-[#C9A24A]" /></span></div>;
  if (szkic === "cta") return <div className={`${box} flex-col items-center justify-center`}>{bar("w-1/4", true)}{bar("w-2/3")}<span className="block h-3 w-1/4 bg-[#C9A24A] mt-1" /></div>;
  return <div className={box}><span className="flex-1 border-l-2 border-[#BC1E22] pl-2 flex flex-col justify-center gap-1.5">{bar("w-1/2", true)}{bar("w-4/5")}</span></div>;
}