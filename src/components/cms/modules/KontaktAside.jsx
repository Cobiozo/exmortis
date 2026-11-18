import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Facebook, Youtube } from "lucide-react";
import SafeImg from "@/components/cms/SafeImg";
import { Rich } from "@/components/cms/parts";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

// Lewa kolumna strony Kontakt (etap 8, 18.11.2026): zdjęcie 4:5, w jakich sprawach można pisać,
// adres e-mail i kanały społecznościowe (te same, co w menu i w stopce).
const ZDJECIE = { url: "/functions/media?id=1ddd087e40805dd910df4bdc28a2b802", alt: "Dawid — kontakt", fx: 50, fy: 38 };

const SOCIAL = [
  { label: "Instagram", url: "https://www.instagram.com/e.x.m.o.r.t.i.s/", icon: Instagram },
  { label: "Facebook", url: "https://www.facebook.com/dawidkowalczyk.exmortis", icon: Facebook },
  { label: "YouTube", url: "https://www.youtube.com/@e.x.m.o.r.t.i.s", icon: Youtube },
];

const LINK = "text-exm-gold underline decoration-exm-gold-line underline-offset-4 hover:text-exm-gold-hover";

export default function KontaktAside() {
  const { rich } = useSiteContent();
  const intro = rich("contact", "intro", "Nie ma botów i asystentów. Jeśli jesteś na progu — napisz pierwszy ruch, choćby jednym zdaniem.");

  return (
    <aside className="min-w-0 space-y-8">
      <SafeImg
        img={ZDJECIE}
        sizes="(min-width: 1024px) 420px, 92vw"
        className="aspect-[4/5] w-full rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface"
      />

      <Rich html={intro} className="text-[15px] leading-relaxed text-exm-muted" />

      <div className="border-t border-exm-line pt-6">
        <p className="exm-eyebrow">W jakich sprawach</p>
        <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-exm-muted">
          <li>
            <span className="text-exm-ivory">Nie masz linku do kupionych materiałów?</span>{" "}
            <Link to="/pobierz" className={LINK}>Wyślij sobie nowy link</Link> — otrzymasz go na adres e-mail podany w zamówieniu.
          </li>
          <li>
            <span className="text-exm-ivory">Chcesz odstąpić od umowy?</span>{" "}
            <Link to="/odstapienie" className={LINK}>Odstąp od umowy tutaj</Link>
          </li>
        </ul>
      </div>

      <div className="border-t border-exm-line pt-6">
        <p className="exm-eyebrow">E-mail</p>
        <a
          href="mailto:kontakt@exmortis.pl"
          className={`mt-2 inline-flex min-h-[44px] items-center font-exm-label text-[15px] ${LINK}`}
        >
          kontakt@exmortis.pl
        </a>
      </div>

      <div className="border-t border-exm-line pt-6">
        <p className="exm-eyebrow">Social media</p>
        <ul className="mt-3 flex flex-wrap gap-3">
          {SOCIAL.map((s) => (
            <li key={s.label}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="grid h-11 w-11 place-items-center rounded-[var(--exm-r-field)] border border-exm-line text-exm-muted transition-colors hover:border-exm-gold-line hover:text-exm-gold"
              >
                <s.icon className="h-4 w-4" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}