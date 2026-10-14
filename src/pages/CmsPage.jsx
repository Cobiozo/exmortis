import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageNotFound from "@/lib/PageNotFound";
import { base44 } from "@/api/base44Client";
import BlockRenderer from "@/components/cms/BlockRenderer";
import usePublishedPage from "@/components/cms/usePublishedPage";
import { usePageMeta } from "@/lib/usePageMeta";
import { useDocMeta } from "@/lib/useDocMeta";

// Strony utworzone w edytorze: /strona/:slug
export default function CmsPage() {
  const { slug } = useParams();
  const page = usePublishedPage(slug);
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const found = !!page;
  // Adres kanoniczny i obrazek udostępniania z edytora (tylko pełne adresy https).
  usePageMeta({ canonical: found ? `/strona/${slug}` : undefined, ogImage: /^https:\/\//i.test(page?.seo_image || "") ? page.seo_image : undefined });
  useDocMeta(found ? page.seo_title || `${page.tytul} — exmortis` : null, page?.seo_description);
  // Strona o zmienionym adresie: przekierowanie ze starego adresu na nowy.
  useEffect(() => {
    if (page !== null) return;
    base44.entities.PageRedirect.filter({ from_slug: slug }, { limit: 1 }).then((r) => {
      if (r.items[0]) navigate(`/strona/${r.items[0].to_slug}`, { replace: true });
      else setChecked(true);
    }).catch(() => setChecked(true));
  }, [page, slug]); // eslint-disable-line react-hooks/exhaustive-deps
  if (page === undefined || (page === null && !checked)) return <div className="min-h-screen bg-[#0A0A0B]" />;
  if (!page) return <PageNotFound />;
  return <BlockRenderer blocks={page.bloki || []} />;
}