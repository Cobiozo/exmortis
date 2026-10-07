import React from "react";
import { Link, useParams } from "react-router-dom";
import BlockRenderer from "@/components/cms/BlockRenderer";
import usePublishedPage from "@/components/cms/usePublishedPage";

// Strony utworzone w edytorze: /strona/:slug
export default function CmsPage() {
  const { slug } = useParams();
  const page = usePublishedPage(slug);
  if (page === undefined) return <div className="min-h-screen bg-[#0A0A0B]" />;
  if (!page) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="technical text-[11px] gold-text">404</p>
      <h1 className="relic-heading text-4xl">Nie ma takiej strony</h1>
      <Link to="/" className="btn-ghost">Strona główna</Link>
    </div>
  );
  return <BlockRenderer blocks={page.bloki || []} />;
}