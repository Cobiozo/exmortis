import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import BlockRenderer from "@/components/cms/BlockRenderer";
import usePublishedPage from "@/components/cms/usePublishedPage";

// Strony utworzone w edytorze: /strona/:slug
export default function CmsPage() {
  const { slug } = useParams();
  const page = usePublishedPage(slug);
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  // Strona o zmienionym adresie: przekierowanie ze starego adresu na nowy.
  useEffect(() => {
    if (page !== null) return;
    base44.entities.PageRedirect.filter({ from_slug: slug }, { limit: 1 }).then((r) => {
      if (r.items[0]) navigate(`/strona/${r.items[0].to_slug}`, { replace: true });
      else setChecked(true);
    }).catch(() => setChecked(true));
  }, [page, slug]); // eslint-disable-line react-hooks/exhaustive-deps
  if (page === undefined || (page === null && !checked)) return <div className="min-h-screen bg-[#0A0A0B]" />;
  if (!page) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="technical text-[11px] gold-text">404</p>
      <h1 className="relic-heading text-4xl">Nie ma takiej strony</h1>
      <Link to="/" className="btn-ghost">Strona główna</Link>
    </div>
  );
  return <BlockRenderer blocks={page.bloki || []} />;
}