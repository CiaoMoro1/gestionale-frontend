import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
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
  const [visibleCount, setVisibleCount] = useState(10);
  const queryClient = useQueryClient();

  // 🔄 debounce della ricerca
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // 📡 Realtime su inventario
  useEffect(() => {
    const channel = supabase
      .channel("realtime:products+inventory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          console.log("🟦 Realtime update su products:", payload);
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        (payload) => {
          console.log("🟩 Realtime update su inventory:", payload);
          queryClient.invalidateQueries({ queryKey: ["inventory"] });
        }
      )
      .subscribe();
  
    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);
  

  // 📦 Fetch prodotti + inventario
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
          inventory (inventario)
        `);

      if (error) throw error;

      return data?.map((p: any) => ({
        ...p,
        inventario: p.inventory?.inventario ?? 0,
      })) ?? [];
    },
  });

  // 🔍 Filtro ricerca
  const filtered = useMemo(() => {
    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9]/gi, " ").split(/\s+/).join(" ");
    const tokens = normalize(debouncedSearch).split(" ");

    return (data ?? [])
      .filter((p) => {
        const full = normalize(`${p.sku ?? ""} ${p.product_title ?? ""}`);
        return tokens.every((token) => full.includes(token));
      })
      .sort((a, b) =>
        (a.product_title ?? "").localeCompare(b.product_title ?? "")
      );
  }, [data, debouncedSearch]);

  const visibleItems = debouncedSearch
    ? filtered
    : filtered.slice(0, visibleCount);

  if (isLoading)
    return <div className="p-4 text-blue-500">Caricamento prodotti...</div>;
  if (error)
    return (
      <div className="p-4 text-red-500">Errore: {(error as Error).message}</div>
    );

  return (
    <div className="relative">
      <div className="fixed top-16 sm:top-0 sm:ml-48 left-0 right-0 z-40 bg-white px-4 py-2 border-b shadow-sm">
        <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-lg px-3 py-2 shadow-sm">
          <Search size={28} className="text-blue-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(10);
            }}
            className="flex-1 outline-none bg-transparent text-sm text-blue-800 placeholder:text-blue-300"
            placeholder="Cerca per SKU o nome prodotto..."
          />
        </div>
      </div>

      <div className="pt-[40px] space-y-3">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center italic">
            🔍 Nessun prodotto trovato per "{debouncedSearch}"
          </p>
        )}

        <ul className="space-y-2">
          {visibleItems.map((product) => (
            <li
              key={product.id}
              className="bg-white rounded-xl border border-blue-100 p-4 shadow hover:ring-2 hover:ring-blue-400 transition"
            >
              <Link to={`/prodotti/${product.id}`} className="block space-y-2">
                <div className="text-sm text-blue-600 font-semibold">
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

        {!debouncedSearch && filtered.length > visibleItems.length && (
          <div className="text-center">
            <button
              onClick={() => setVisibleCount((prev) => prev + 10)}
              className="text-blue-600 text-sm mt-2 hover:underline"
            >
              Mostra altri 10 prodotti
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
