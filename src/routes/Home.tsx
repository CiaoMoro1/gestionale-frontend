import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UniversalBarcodeScannerModal from "../modals/UniversalBarcodeScannerModal";
import {
  Search,
  ClipboardList,
  Package,
  ArrowLeftRight,
  ArrowDown,
  RefreshCcw,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// Puoi tipizzare meglio se vuoi
type Product = { id: string; ean: string; sku?: string; product_title?: string };

export default function HomePage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const navigate = useNavigate();

  // Carica la lista prodotti (solo ean e id)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, ean, sku, product_title")
        .limit(2000); // Puoi aumentare il limite se hai molti prodotti
      if (data) setProducts(data);
    })();
  }, []);

  const menuItems = [
    {
      label: "Cerca Articoli",
      icon: <Search size={24} />,
      action: "search",
      description: "Scannerizza o cerca articoli per EAN/SKU",
    },
    {
      label: "Ordini",
      path: "/ordini",
      icon: <ClipboardList size={24} />,
      description: "Gestione e ricerca ordini",
    },
    {
      label: "Prodotti",
      path: "/prodotti",
      icon: <Package size={24} />,
      description: "Visualizza catalogo prodotti",
    },
    {
      label: "Movimenti",
      path: "/movimenti",
      icon: <ArrowLeftRight size={24} />,
      description: "Storico movimenti e audit log",
    },
    {
      label: "Imp/Exp",
      path: "/import",
      icon: <ArrowDown size={24} />,
      description: "Importa/esporta dati",
    },
    {
      label: "Sync",
      path: "/sync",
      icon: <RefreshCcw size={24} />,
      description: "Sincronizzazione Shopify/Qapla'",
    },
  ];

  return (
    <>
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {menuItems.map(({ label, icon, path, action, description }) => (
            <button
              key={label}
              onClick={() => {
                if (action === "search") setSearchOpen(true);
                else if (path) navigate(path);
              }}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl shadow-xl bg-white/90 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition group"
              tabIndex={0}
              aria-label={label}
            >
              <div className="mb-2 group-hover:scale-110 transition">{icon}</div>
              <span className="font-semibold text-base text-gray-800">{label}</span>
              <span className="text-sm text-gray-400">{description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scanner universale per prodotti */}
      <UniversalBarcodeScannerModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        mode="product"
        data={products}
        getCode={(product: Product) => product.ean}
        goTo={(product: Product) => window.location.href = `/prodotti/${product.id}`}
      />
    </>
  );
}
