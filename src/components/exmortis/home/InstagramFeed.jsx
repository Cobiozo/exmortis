import React, { useEffect, useState } from "react";
import { ArrowUpRight, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";

// Instagram na końcu strony głównej (etap 2, 18.11.2026): 6 miniatur w jednym rozdziale z kontaktem.
// Miniatury przychodzą z exmortis.pl (funkcja instagramFeed), więc nie wymagają zgody na treści zewnętrzne.
// Sekcja znika całkowicie, gdy feed nie jest dostępny.
export default function InstagramFeed({ d = {} } = {}) {
  const [feed, setFeed] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("instagramFeed", {})
      .then((res) => {
        const posts = (res.data?.posts || []).filter((p) => String(p.image || "").startsWith("/functions/instagramFeed"));
        if (posts.length) setFeed({ ...res.data, posts });
      })
      .catch(() => {});
  }, []);

  if (!feed) return null;

  return (
    <Section tone="surface">
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
          <div>
            <p className="exm-eyebrow mb-3">{d.etykieta || "OBSERWUJ · INSTAGRAM"}</p>
            <a
              href={`https://instagram.com/${feed.username}`}
              target="_blank"
              rel="noreferrer"
              className="exm-h3 inline-flex items-center gap-2 text-exm-ivory transition-colors hover:text-exm-gold"
            >
              @{feed.username}
            </a>
          </div>
          <a
            href={`https://instagram.com/${feed.username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-exm-muted transition-colors hover:text-exm-gold"
          >
            Obserwuj <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="grid grid-cols-3 gap-1.5 md:grid-cols-6 md:gap-2">
          {feed.posts.map((p) => (
            <a
              key={p.id}
              href={p.permalink}
              target="_blank"
              rel="noreferrer"
              aria-label={`${p.reel || /\/reel\//.test(p.permalink || "") ? "Rolka" : "Post"} na Instagramie — otwiera się w nowej karcie`}
              className="group relative block aspect-square overflow-hidden rounded-[var(--exm-r-field)] bg-exm-surface-2"
            >
              <img
                src={p.image}
                alt=""
                loading="lazy"
                decoding="async"
                width="320"
                height="320"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-all duration-500 group-hover:opacity-100"
              />
              {(p.reel || /\/reel\//.test(p.permalink || "")) && (
                <Play className="absolute right-2 top-2 h-4 w-4 text-white drop-shadow" fill="currentColor" aria-hidden="true" />
              )}
            </a>
          ))}
        </div>
      </Container>
    </Section>
  );
}