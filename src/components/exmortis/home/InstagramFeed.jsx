import React, { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Strona główna: najnowsze posty z Instagrama — minimalny pasek zdjęć bez ramek.
// Sekcja znika całkowicie, gdy feed nie jest dostępny.
export default function InstagramFeed() {
  const [feed, setFeed] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("instagramFeed", {})
      .then((res) => {
        if (res.data?.posts?.length) setFeed(res.data);
      })
      .catch(() => {});
  }, []);

  if (!feed) return null;

  return (
    <section className="py-24 md:py-32 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="technical text-[11px] gold-text mb-3">OBSERWUJ · INSTAGRAM</p>
            <a
              href={`https://instagram.com/${feed.username}`}
              target="_blank"
              rel="noreferrer"
              className="relic-heading text-2xl md:text-3xl text-foreground/85 hover:gold-text transition-colors"
            >
              @{feed.username}
            </a>
          </div>
          <a
            href={`https://instagram.com/${feed.username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 py-3 -my-3 technical text-[10px] text-foreground/50 hover:gold-text transition-colors"
          >
            Obserwuj <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 md:gap-2">
          {feed.posts.map((p) => (
            <a
              key={p.id}
              href={p.permalink}
              target="_blank"
              rel="noreferrer"
              className="group relative aspect-square block overflow-hidden"
            >
              <img
                src={p.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-500"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}