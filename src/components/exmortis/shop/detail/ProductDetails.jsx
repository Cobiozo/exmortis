import React, { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import Curriculum from "@/components/exmortis/shop/Curriculum";
import BundleBox from "@/components/exmortis/shop/BundleBox";
import ProductReviews from "@/components/exmortis/shop/ProductReviews";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { fixText, fixTextNodes } from "@/lib/typography";
import RelatedProducts from "./RelatedProducts";
import { sameText } from "./text";

// Treść pod blokiem zakupu: „Dla kogo”, opis długi z panelu, spis treści lub program, pakiet,
// opinie (tylko gdy są) i powiązane produkty (najwyżej 3).
export default function ProductDetails({ product }) {
  const rich = useRef(null);
  const long = product.long_description;
  const hasLong =
    long && !sameText(long, product.description) && !sameText(long, product.subtitle) && !sameText(long, product.for_whom);

  // Twarde spacje z edytora na zwykłe — tekst nie łamie się w środku wyrazu.
  useEffect(() => {
    if (rich.current) fixTextNodes(rich.current);
  }, [long]);

  return (
    <Section as="div" tone="surface">
      <Container>
        <div className="max-w-[var(--exm-container-narrow)] space-y-10">
          {product.for_whom && (
            <div>
              <h2 className="exm-h3">Dla kogo</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-exm-muted">{fixText(product.for_whom)}</p>
            </div>
          )}

          {hasLong && (
            <div>
              <h2 className="exm-h3">O produkcie</h2>
              {String(long).includes("<") ? (
                <div
                  ref={rich}
                  className="rich-content mt-3 leading-relaxed text-exm-muted"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(long) }}
                />
              ) : (
                <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-exm-muted">{fixText(long)}</p>
              )}
            </div>
          )}

          {product.details?.length > 0 && (
            <ul className="space-y-3">
              {product.details.map((d, i) => (
                <li key={i} className="flex items-start gap-3 text-exm-muted">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-exm-gold" aria-hidden="true" />
                  <span className="text-[15px] leading-relaxed">{fixText(d)}</span>
                </li>
              ))}
            </ul>
          )}

          {["kurs", "wideo", "zestaw"].includes(product.product_type) && <Curriculum productId={product.id} />}

          <BundleBox product={product} />

          {!product.is_free && Number(product.price) > 0 && product.product_type !== "karta" &&
            !/\/o-mnie/.test(`${long || ""} ${product.description || ""}`) && (
              <p className="text-[14px] text-exm-muted">
                {product.product_type === "usluga" ? "Prowadzi: Dawid" : "Autor: Dawid"} ·{" "}
                <Link to="/o-mnie" className="text-exm-gold hover:underline">poznaj moją historię →</Link>
              </p>
            )}
        </div>

        <ProductReviews productId={product.id} />
        <RelatedProducts product={product} />
      </Container>
    </Section>
  );
}