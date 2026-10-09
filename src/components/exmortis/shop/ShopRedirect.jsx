import { Navigate, useLocation, useParams } from "react-router-dom";

// Stare adresy /sklep i /produkt/:slug → /skarbiec (z zachowaniem ?src, utm i #).
export default function ShopRedirect() {
  const { slug } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`/skarbiec${slug ? `/${slug}` : ""}${search}${hash}`} replace />;
}