import {
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  useState,
  useEffect,
  useMemo,
  useDeferredValue
} from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import SearchInput from "../components/SearchInput";
import { ArrowUp } from "lucide-react";

interface Product {
  id: string;
  sku: string | null;
  ean: string | null;
  product_title: string | null;
  price: number | null;
  inventario: number | null;
}

export default function Prodotti() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const deferredSearch = useDeferredValue(debouncedSearch);
  const [visibleCount, setVisibleCount] = useState(10);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const queryClient = useQueryClient();

  // debounce effettivo
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Realtime su Supabase
  useEffect(() => {
    const channel = supabase
      .channel("realtime:products+inventory")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  // Bottone "scroll to top"
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Query prodotti + inventario
  const { data, isLoading, error } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          sku,
          ean,
          product_title,
          price,
          inventory_product_id_fkey (inventario)
        `);

      if (error) throw error;

      return data?.map((p: any) => ({
        ...p,
        inventario: p.inventory_product_id_fkey?.inventario ?? 0,
      })) ?? [];
    },
  });

  // Filtro su SKU + nome + EAN
  const filtered = useMemo(() => {
    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9]/gi, " ").split(/\s+/).join(" ");
    const tokens = normalize(deferredSearch).split(" ");

    return (data ?? [])
      .filter((p) => {
        const full = normalize(`${p.sku ?? ""} ${p.product_title ?? ""} ${p.ean ?? ""}`);
        return tokens.every((token) => full.includes(token));
      })
      .sort((a, b) => (a.product_title ?? "").localeCompare(b.product_title ?? ""));
  }, [data, deferredSearch]);

  const visibleItems = deferredSearch
    ? filtered
    : filtered.slice(0, visibleCount);

  if (isLoading)
    return <div className="p-6 text-black text-center text-[clamp(1rem,2vw,1.2rem)]">Caricamento prodotti...</div>;

  if (error)
    return <div className="p-6 text-red-500 text-center text-[clamp(1rem,2vw,1.2rem)]">Errore: {(error as Error).message}</div>;

  return (
    <div className="text-black/70 px-2 pb-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-black mb-1">Prodotti</h1>
        <p className="text-[clamp(0.85rem,2vw,1.1rem)] text-black/60">
          Gestione inventario e anagrafica prodotti
        </p>
      </div>

      {/* Campo ricerca */}
      <SearchInput
        value={search}
        onChange={(val) => {
          setSearch(val);
          setVisibleCount(10);
        }}
        placeholder=" Cerca per SKU, nome o EAN..."
      />

      {/* Lista prodotti */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center italic text-[clamp(0.85rem,2vw,1rem)]">
          🔍 Nessun prodotto trovato per "{deferredSearch}"
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleItems.map((product) => (
            <li
              key={product.id}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow hover:ring-2 hover:ring-gray-400 transition"
            >
              <Link to={`/prodotti/${product.id}`} className="block space-y-1">
                <div className="text-[clamp(0.8rem,2vw,1rem)] text-gray-600 font-semibold">
                  SKU: {product.sku || "—"}
                </div>
                <div className="text-[clamp(0.85rem,2vw,1.05rem)] text-gray-800">
                  {product.product_title || "(Nessun titolo prodotto)"}
                </div>
                <div className="text-[clamp(0.8rem,2vw,1rem)] text-gray-500 italic">
                  EAN: {product.ean || "—"}
                </div>
                <div className="text-[clamp(0.8rem,2vw,1rem)] text-gray-700">
                  Prezzo: €{Number(product.price ?? 0).toFixed(2)}
                </div>
                <div className="text-[clamp(0.8rem,2vw,1rem)] text-gray-800 font-bold">
                  Inventario: {product.inventario}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Bottone mostra altri */}
      {!deferredSearch && filtered.length > visibleItems.length && (
        <div className="text-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 10)}
            className="text-gray-600 text-[clamp(0.8rem,2vw,1rem)] mt-4 hover:underline"
          >
            Mostra altri 10 prodotti
          </button>
        </div>
      )}

      {/* Bottone scroll to top */}
      {showScrollToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-4 bg-black text-white p-3 rounded-full shadow-lg z-50 hover:bg-gray-800 transition"
          aria-label="Torna su"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}
