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
import { QuantityInput } from "../components/QuantityInput";
import GeneraEtichetteModal from "../components/GeneraEtichetteModal";


interface Inventory {
  inventario: number | null;
}

interface ProductRaw {
  id: string;
  sku: string | null;
  ean: string | null;
  product_title: string | null;
  price: number | null;
  inventory_product_id_fkey?: Inventory | Inventory[] | null;
}

interface Product extends ProductRaw {
  inventario: number;
}

export default function Prodotti() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const deferredSearch = useDeferredValue(debouncedSearch);
  const [visibleCount, setVisibleCount] = useState(10);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
const [selectedSku, setSelectedSku] = useState<string | null>(null);
const [selectedEan, setSelectedEan] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

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

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

      // Typizza la mappa!
      return (data as ProductRaw[] | null)?.map((p) => ({
        ...p,
        inventario: Array.isArray(p.inventory_product_id_fkey)
          ? p.inventory_product_id_fkey[0]?.inventario ?? 0
          : (p.inventory_product_id_fkey?.inventario ?? 0),
      })) ?? [];
    },
  });

  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]/gi, " ").split(/\s+/).join(" ");

  const normalizedSearch = normalize(deferredSearch);
  const tokens = normalizedSearch.split(" ");
  const isSearching = debouncedSearch !== deferredSearch;

  const filtered = useMemo(() => {
    return (data ?? [])
      .filter((p) => {
        const full = normalize(`${p.sku ?? ""} ${p.product_title ?? ""} ${p.ean ?? ""}`);
        return tokens.every((token) => full.includes(token));
      })
      .sort((a, b) => (a.product_title ?? "").localeCompare(b.product_title ?? ""));
  }, [data, tokens]);

  const visibleItems = deferredSearch
    ? filtered
    : filtered.slice(0, visibleCount);

  if (isLoading)
    return <div className="p-6 text-black text-center">Caricamento prodotti...</div>;

  if (error)
    return <div className="p-6 text-red-500 text-center">Errore: {(error as Error).message}</div>;

  return (
    <div className="text-black/70 px-2 pb-10 max-w-6xl mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-black mb-1">Prodotti</h1>
        <p className="text-[clamp(0.85rem,2vw,1.1rem)] text-black/60">
          Gestione inventario e anagrafica prodotti
        </p>
      </div>

      <div className="flex items-center justify-between mb-2 px-1">
        <SearchInput className="w-full max-w-xl" 
          value={search}
          onChange={(val) => {
            setSearch(val);
            setVisibleCount(10);
          }}
          placeholder=" Cerca per SKU, nome o EAN..."
        />
        {isSearching && (
          <div className="text-xs text-gray-400 animate-pulse ml-2">⏳ Cercando...</div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center italic">
          🔍 Nessun prodotto trovato per "{deferredSearch}"
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {visibleItems.map((product) => (
            <li
              key={product.id}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow transition"
            >
              <div className="space-y-1">
                <div className="text-gray-800">
                  <Link to={`/prodotti/${product.id}`} className="hover:underline text-[clamp(0.85rem,2vw,1.05rem)]">
                    {product.product_title || "(Nessun titolo prodotto)"}
                  </Link>
                </div>
                <div className="text-sm text-gray-600 font-semibold">
                  SKU: {product.sku || "—"}
                </div>
                <div className="text-sm text-gray-500 italic">
                  EAN: {product.ean || "—"}
                </div>
                <div className="text-sm text-gray-700">
                  Prezzo: €{Number(product.price ?? 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-800 font-bold mt-2">
                  Quantità:
                  <div className="mt-1">
                    <QuantityInput
                      productId={product.id}
                      initialQuantity={product.inventario ?? 0}
                    />
                                                <div className="mt-2">
                              <button
                                className="px-2 py-1 text-xs rounded bg-cyan-700 text-white font-bold hover:bg-cyan-900 transition"
                                onClick={() => {
                                  setSelectedSku(product.sku ?? "");
                                  setSelectedEan(product.ean ?? "");
                                  setModalOpen(true);
                                }}
                                disabled={!product.sku || !product.ean}
                              >
                                🏷️ Genera etichette
                              </button>
                            </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

{modalOpen && selectedSku && selectedEan && (
  <GeneraEtichetteModal
    open={modalOpen}
    onClose={() => setModalOpen(false)}
    sku={selectedSku}
    ean={selectedEan}
  />
)}


      {!deferredSearch && filtered.length > visibleItems.length && (
        <div className="text-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 10)}
            className="text-gray-600 mt-4 hover:underline"
          >
            Mostra altri 10 prodotti
          </button>
        </div>
      )}

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
