import React from "react";
import { Image } from "@/components/ui/image";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

const PHOTO =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/29c863d5e_Gemini_Generated_Image_5hhwtq5hhwtq5hhw.jpeg";

export default function ShortStory() {
  const { rich } = useSiteContent();
  const story = rich(
    "about",
    "shortStory",
    `<p>Byłem księdzem. Prowadziłem ludzi.</p>
<p>A potem sam znalazłem się w miejscu, którego nie było na mapie. W odrzuceniu, w „trędowatości”, w braku perspektyw.</p>
<p>Nie zaczynałem od dna. Do dna jeszcze pukałem od spodu.</p>
<p><strong class="gold-text">Byłem niżej.</strong></p>
<p>W piosence „exmortis” zapisałem zdanie, które długo w sobie nosiłem:</p>
<blockquote class="about-quote"><p>„Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie zasadziłeś.”</p></blockquote>
<p>To cała moja historia w jednym zdaniu. Reszta to konsekwencje.</p>
<p>Dziś rosnę — jako szczęśliwy mąż i ojciec. I tę iskrę chcę dawać dalej: zamieniając „grzebanie” w „sadzenie”.</p>`
  );

  return (
    <section className="grid md:grid-cols-2 border-y hairline">
      <div className="p-10 md:p-16 lg:p-24 flex flex-col justify-center order-1">
        <p className="technical text-[11px] gold-text mb-8">KRÓTKA HISTORIA · 01</p>
        <div
          className="rich-content text-lg leading-relaxed text-foreground/75"
          dangerouslySetInnerHTML={{ __html: story }}
        />
      </div>
      <div className="relative bg-[#070708] overflow-hidden min-h-[70vh] order-2">
        <Image
          src={PHOTO}
          alt="Dawid — exmortis"
          fittingType="fill"
          className="absolute inset-0 w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-transparent to-transparent" />
        <div className="absolute bottom-8 left-8">
          <p className="technical text-[10px] gold-text">POSŁUGA · WCZEŚNIEJSZE ŻYCIE</p>
        </div>
      </div>
    </section>
  );
}