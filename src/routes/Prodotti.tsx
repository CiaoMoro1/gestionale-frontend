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
import { ArrowUp, Loader2 } from "lucide-react";
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

const PAGE_SIZE = 25;

// ---- Utility (identico a produzione) ----
function normalize(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAllWords(target: string, queryWords: string[]) {
  const targetWords = normalize(target).split(" ");
  return queryWords.every(qw =>
    targetWords.some(tw => tw === qw || tw.startsWith(qw))
  );
}

export default function Prodotti() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const deferredSearch = useDeferredValue(debouncedSearch);
  const [page, setPage] = useState(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedEan, setSelectedEan] = useState<string | null>(null);

  // Cavallotto
  const [cavallottoModal, setCavallottoModal] = useState<string | null>(null);
  const [cavallottoLoading, setCavallottoLoading] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 180);
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

  const productsQuery = useQuery<Product[], Error>({
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
      return (data as ProductRaw[] | null)?.map((p) => ({
        ...p,
        inventario: Array.isArray(p.inventory_product_id_fkey)
          ? p.inventory_product_id_fkey[0]?.inventario ?? 0
          : (p.inventory_product_id_fkey?.inventario ?? 0),
      })) ?? [];
    }
  });

  const { data: products = [], isLoading, error } = productsQuery;

  // --- Ricerca PRODUZIONE STYLE ---
  const normalizedSearch = normalize(deferredSearch);
  const tokens = normalizedSearch.split(" ").filter(Boolean);
  const isSearching = debouncedSearch !== deferredSearch;

  const filtered: Product[] = useMemo(() => {
    if (!products) return [];
    if (!tokens.length) return products;
    return products.filter((p: Product) => {
      const full = `${p.sku ?? ""} ${p.product_title ?? ""} ${p.ean ?? ""}`;
      return matchAllWords(full, tokens);
    });
  }, [products, tokens]);

  // Pagination logic
  const paginated = useMemo(() => {
    if (deferredSearch) return filtered;
    return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filtered, deferredSearch, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Reset page to 0 if search or results change
  useEffect(() => {
    setPage(0);
  }, [deferredSearch, filtered.length]);

  // --- Cavallotto PDF (modale) ---
  function openCavallottoPdf(sku: string, formato: string) {
    setCavallottoLoading(true);
    window.open(
      `${import.meta.env.VITE_API_URL}/api/cavallotto/html?sku=${encodeURIComponent(sku)}&formato=${encodeURIComponent(formato)}`,
      "_blank"
    );
    setTimeout(() => {
      setCavallottoLoading(false);
      setCavallottoModal(null);
    }, 900);
  }

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
            setPage(0);
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
          {paginated.map((product: Product) => (
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
                    <div className="mt-2 flex gap-2">
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
                      <button
                        className="px-2 py-1 text-xs rounded bg-indigo-700 text-white font-bold hover:bg-indigo-900 transition"
                        onClick={() => setCavallottoModal(product.sku ?? "")}
                        disabled={!product.sku}
                      >
                        🖨️ Genera cavallotto
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

      {/* MODALE CAVALLOTTO */}
      {cavallottoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center relative">
            <button
              className="absolute top-2 right-3 text-2xl text-gray-300 hover:text-black"
              onClick={() => setCavallottoModal(null)}
            >×</button>
            <div className="mb-4 font-bold text-lg text-blue-800">Stampa Cavallotto</div>
            <div className="mb-4">Scegli il formato</div>
            <div className="flex flex-col gap-2 mb-3">
              {["A5", "A4", "A3"].map(formato => (
                <button
                  key={formato}
                  className="bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-800 font-semibold py-2 rounded-xl"
                  onClick={() => openCavallottoPdf(cavallottoModal, formato)}
                  disabled={cavallottoLoading}
                >
                  {formato}
                </button>
              ))}
            </div>
            {cavallottoLoading && <Loader2 className="mx-auto animate-spin text-cyan-600" />}
          </div>
        </div>
      )}

      {/* Paginazione solo se NON stai cercando */}
      {!deferredSearch && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-center mt-6 gap-3">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            className="px-3 py-1 bg-gray-200 rounded-l-lg font-bold hover:bg-gray-300 disabled:opacity-40"
            disabled={page === 0}
          >
            ⬅️
          </button>
          <span className="text-gray-600 text-sm">
            Pagina {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
            className="px-3 py-1 bg-gray-200 rounded-r-lg font-bold hover:bg-gray-300 disabled:opacity-40"
            disabled={page >= totalPages - 1}
          >
            ➡️
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
