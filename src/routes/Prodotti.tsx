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
import { Search } from "lucide-react";

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
  const [showSearchIcon, setShowSearchIcon] = useState(false);
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

  // Scroll: mostra bottone search fluttuante
  useEffect(() => {
    const handleScroll = () => {
      const top = document.getElementById("search-bar")?.getBoundingClientRect().top ?? 0;
      setShowSearchIcon(top < 0);
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

  // Filtro ricerca ottimizzato
  const filtered = useMemo(() => {
    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9]/gi, " ").split(/\s+/).join(" ");
    const tokens = normalize(deferredSearch).split(" ");

    return (data ?? [])
      .filter((p) => {
        const full = normalize(`${p.sku ?? ""} ${p.product_title ?? ""}`);
        return tokens.every((token) => full.includes(token));
      })
      .sort((a, b) => (a.product_title ?? "").localeCompare(b.product_title ?? ""));
  }, [data, deferredSearch]);

  const visibleItems = deferredSearch
    ? filtered
    : filtered.slice(0, visibleCount);

  if (isLoading)
    return <div className="p-6 text-black text-center">Caricamento prodotti...</div>;

  if (error)
    return <div className="p-6 text-red-500 text-center">Errore: {(error as Error).message}</div>;

  return (
    <div className="text-black/70">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-black">Prodotti</h1>
        <p className="text-sm text-black/70">Gestione inventario e anagrafica prodotti</p>
      </div>

      {/* Campo ricerca */}
      <div id="search-bar" className="mb-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          <Search size={22} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(10);
            }}
            className="flex-1 outline-none bg-transparent text-sm text-gray-800 placeholder:text-gray-300"
            placeholder="Cerca per SKU o nome prodotto..."
          />
        </div>
      </div>

      {/* Lista prodotti */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center italic">
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
                <div className="text-sm text-gray-600 font-semibold">
                  SKU: {product.sku || "—"}
                </div>
                <div className="text-sm text-gray-700">
                  {product.product_title || "(Nessun titolo prodotto)"}
                </div>
                <div className="text-sm text-gray-500 italic">
                  EAN: {product.ean || "—"}
                </div>
                <div className="text-sm text-gray-700">
                  Prezzo: €{Number(product.price ?? 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-700 font-bold">
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
            className="text-gray-600 text-sm mt-4 hover:underline"
          >
            Mostra altri 10 prodotti
          </button>
        </div>
      )}

      {/* Bottone ricerca flottante */}
      {showSearchIcon && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-4 bg-gray-800 text-white p-3 rounded-full shadow-lg z-50"
          aria-label="Torna alla ricerca"
        >
          <Search size={20} />
        </button>
      )}
    </div>
  );
}
