import React from "react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

// Podstrona O mnie: „Krótka historia” · 01 — tekst ze wyróżnionym cytatem.
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
<p class="gold-text">To cała moja historia w jednym zdaniu. Reszta to konsekwencje.</p>`
  );

  return (
    <section className="border-y hairline">
      <div className="py-24 md:py-32 px-5 md:px-10">
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-8">KRÓTKA HISTORIA · 01</p>
          <div
            className="rich-content max-w-2xl text-lg leading-relaxed text-foreground/75"
            dangerouslySetInnerHTML={{ __html: story }}
          />
        </div>
      </div>
    </section>
  );
}