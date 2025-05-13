import { useParams } from "react-router-dom";
import ProductDetail from "./ProductDetail";

export default function ProductDetailWrapper() {
  const { id } = useParams();

  // 🔑 Questo forza React a rimontare il componente quando cambia ID
  return <ProductDetail key={id} />;
}
