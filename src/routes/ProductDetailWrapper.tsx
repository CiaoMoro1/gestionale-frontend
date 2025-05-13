import { useLocation } from "react-router-dom";
import ProductDetail from "./ProductDetail";

export default function ProductDetailWrapper() {
  const location = useLocation();
  return <ProductDetail key={location.pathname} />;
}
