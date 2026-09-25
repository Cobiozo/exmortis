import React from "react";
import { Image } from "@/components/ui/image";

const PHOTO =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/29c863d5e_Gemini_Generated_Image_5hhwtq5hhwtq5hhw.jpeg";

// Podstrona O mnie: zdjęcie z posługi — pod blokiem piosenki.
export default function ServicePhoto() {
  return (
    <section className="relative h-[60vh] md:h-[80vh] overflow-hidden border-y hairline bg-[#070708]">
      <Image
        src={PHOTO}
        alt="Dawid — posługa kapłańska"
        fittingType="fill"
        className="absolute inset-0 w-full h-full"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-transparent to-transparent" />
      <div className="absolute bottom-8 left-5 md:left-10">
        <p className="technical text-[10px] gold-text">POSŁUGA · WCZEŚNIEJSZE ŻYCIE</p>
      </div>
    </section>
  );
}