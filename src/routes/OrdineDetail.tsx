import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useState, useEffect } from "react";

type Ordine = {
  id: string;
  number: string;
  customer_name: string;
  channel: string;
  total: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
};

type OrderItem = {
  sku: string;
  quantity: number;
  shopify_variant_id: string | null;
  product_id: string | null;
  products?: {
    product_title: string;
    variant_title: string;
    inventory?: {
      inventario: number;
      disponibile: number;
      riservato_sito?: number;
    };
  } | null;
};

// ...import e tipi invariati

export default function OrdineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [relatedOrders, setRelatedOrders] = useState<{ orders: Ordine; quantity: number }[] | null>(null);
  const [relatedSku, setRelatedSku] = useState<string | null>(null);
  const [originOrder, setOriginOrder] = useState<{ id: string; number: string } | null>(null);
  const [originSet, setOriginSet] = useState(false);

  useEffect(() => {
    const origin = location.state?.originOrder;
    if (origin && !originSet) {
      if (origin.id === id) {
        setOriginOrder(null);
      } else {
        setOriginOrder(origin);
        setOriginSet(true);
      }
    }
  }, [location.state, id, originSet]);

  const { data, isLoading, error } = useQuery<{ ordine: Ordine; items: OrderItem[] }>({
    queryKey: ["ordine", id],
    queryFn: async () => {
      if (!id) throw new Error("ID ordine non valido");

      const { data: ordine, error: err1 } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
      if (err1) throw err1;

      const { data: rawItems, error: err2 } = await supabase
        .from("order_items")
        .select(`sku, quantity, shopify_variant_id, product_id, products:product_id(product_title, variant_title, inventory(inventario, disponibile, riservato_sito))`)
        .eq("order_id", id);
      if (err2) throw err2;

      const items: OrderItem[] = (rawItems ?? []).map((item: any) => ({
        ...item,
        products: Array.isArray(item.products) ? item.products[0] : item.products
      }));

      return { ordine, items };
    },
  });

  const fetchRelatedOrders = async (productId: string, orderNumber: string, sku: string) => {
    const { data, error } = await supabase
      .from("order_items")
      .select("order_id, quantity, orders(id, number, customer_name, created_at)")
      .eq("product_id", productId);

    if (!error && data) {
      const ordini = data
        .filter((item: any) => item.orders && item.orders.id !== id)
        .map((item: any) => ({ orders: item.orders, quantity: item.quantity }));

      setRelatedOrders(ordini);
      setRelatedSku(sku);

      if (!originSet) {
        setOriginOrder({ id: id!, number: orderNumber });
        setOriginSet(true);
      }
    }
  };

  if (isLoading) return <div className="p-6 text-blue-500 text-center">Caricamento...</div>;
  if (error) return <div className="p-6 text-red-500">Errore: {error.message}</div>;

  const { ordine, items } = data!;

  const totalQty = items.reduce((sum, item) => {
    const titolo = item.products?.product_title;
    if (!titolo || titolo.trim() === "—") return sum;
    return sum + item.quantity;
  }, 0);

  return (
    <div className="p-4 space-y-6 rounded-3xl border text-white bg-gradient-to-b from-white to-gray-200 min-h-screen">
      <h1 className="font-bold text-center text-black text-[clamp(1.2rem,4vw,2rem)]">Ordine {ordine.number}</h1>
          <div className="flex justify-center">
            <button
              onClick={() => navigate("/ordini")}
              className="px-4 py-2 mb-2 rounded-full border border-gray-400 text-gray-800 bg-white hover:bg-gray-100 transition font-medium shadow-sm"
            >
              ⬅️ Torna alla lista ordini
            </button>
          </div>

      {originOrder && originOrder.id !== id && (
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-4 px-4 py-3 bg-white/60 backdrop-blur border border-white/90 rounded-2xl shadow text-[clamp(0.8rem,2vw,1rem)] text-black">
            <span className="font-medium">Ordine di partenza: <strong>{originOrder.number}</strong></span>
            <button
              onClick={() => navigate(`/ordini/${originOrder.id}`)}
              className="px-3 py-1 rounded-xl border border-black/20 bg-black/80 hover:bg-white/90 transition text-white/80 shadow-sm font-semibold"
            >
              Torna all’ordine
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-black">
        <Glass label="Cliente" value={ordine.customer_name} />
        <Glass label="Canale" value={ordine.channel} />
        <Glass label="Totale" value={`${ordine.total?.toFixed(2)} €`} />
        <Glass label="Pagamento" value={ordine.payment_status} />
        <Glass label="Evasione" value={ordine.fulfillment_status} />
        <Glass label="Data" value={formatDate(ordine.created_at)} />
      </div>

      <div>
        <h2 className="text-[clamp(1rem,3vw,1.5rem)] font-semibold text-black mt-6 mb-2">
          Articoli ({items.length}) — Totale pezzi: {totalQty}
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {items.map((item, i) => {
            const titolo = item.products?.product_title;
            const isNota = !titolo || titolo.trim() === "—";

            if (isNota) {
              return (
                <div key={i} className="p-4 rounded-xl bg-white/50 border text-black backdrop-blur space-y-1 text-[clamp(0.9rem,2vw,1.1rem)]">
                  <div className="flex items-center gap-2">
                    <strong>SKU:</strong> {item.sku || "—"}
                  </div>
                  <div><strong>Prodotto:</strong> —</div>
                  <div><strong>Variante:</strong> {item.products?.variant_title || "—"}</div>
                  <div><strong>Quantità:</strong> {item.quantity}</div>
                </div>
              );
            }

            const inv = item.products?.inventory;
            const qty = item.quantity;
            const invDisponibile = inv?.disponibile ?? 0;
            const invFisico = inv?.inventario ?? 0;

            let stato = "bg-red-500";
            if (invFisico >= qty && invDisponibile >= qty) stato = "bg-green-500";
            else if (invFisico >= qty && invDisponibile < qty) stato = "bg-yellow-500";

            const parziale = Math.min(invFisico, qty);

            return (
              <div
                key={i}
                className={`p-4 rounded-xl bg-white/50 border text-black backdrop-blur space-y-1 text-[clamp(0.9rem,2vw,1.1rem)] ${
                  item.product_id ? "cursor-pointer hover:bg-white/80 transition" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <strong>SKU:</strong> {item.sku || "—"}
                  {item.product_id && (
                    <button
                      onClick={() =>
                        navigate(`/prodotti/${item.product_id}`, {
                          state: { originOrder: { id: ordine.id, number: ordine.number } },
                        })
                      }
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                      title="Apri prodotto"
                    >
                      🔗
                    </button>
                  )}
                </div>

                <div><strong>Prodotto:</strong> {item.products?.product_title}</div>
                <div><strong>Variante:</strong> {item.products?.variant_title || "—"}</div>
                <div className="flex items-center gap-3">
                  <span><strong>Quantità:</strong> {item.quantity}</span>
                  <span className={`text-[clamp(0.85rem,2vw,1.1rem)] font-semibold text-white px-2 py-1 rounded ${stato}`}>
                    {parziale}/{qty}
                  </span>
                  {item.product_id && stato === "bg-yellow-500" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchRelatedOrders(item.product_id!, ordine.number, item.sku);
                      }}
                      className="ml-auto text-[clamp(0.85rem,2vw,1.1rem)] px-2 py-1 rounded bg-black text-white hover:bg-gray-800 transition"
                    >
                      ⚠️Scorte
                    </button>
                  )}
                </div>

                {stato === "bg-yellow-500" && (
                  <div className="pt-3">
                    <div className="text-[clamp(0.8rem,2vw,1rem)] text-gray-700 font-semibold mb-1">
                      INVENTARIO: <span className="text-black font-bold">{inv?.inventario ?? "—"}</span> &nbsp;–&nbsp; RISERVATI:
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[clamp(0.75rem,2vw,0.95rem)]">
                      <div className="p-2 rounded-xl bg-white/70 border text-center shadow">
                        <div className="text-xs text-gray-500 mb-1">S (Sito)</div>
                        <div className="font-semibold">{inv?.riservato_sito ?? "—"}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/70 border text-center shadow">
                        <div className="text-xs text-gray-500 mb-1">P (Seller)</div>
                        <div className="font-semibold">—</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/70 border text-center shadow">
                        <div className="text-xs text-gray-500 mb-1">V (Vendor)</div>
                        <div className="font-semibold">—</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {relatedOrders && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center">
          <div className="bg-white text-black rounded-2xl p-6 shadow-xl w-[90%] max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[clamp(1rem,2.5vw,1.4rem)] font-semibold text-gray-800">
                ({relatedSku ?? "SKU"}) è presente in:
              </h3>
              <button onClick={() => setRelatedOrders(null)} className="text-xl">×</button>
            </div>
            {relatedOrders.length === 0 ? (
              <div className="text-gray-500 text-center">Nessun ordine correlato trovato</div>
            ) : (
              <ul className="space-y-2">
                {relatedOrders.map(({ orders, quantity }) => (
                  <li
                    key={orders.id}
                    className="p-3 bg-gray-100 rounded-xl cursor-pointer hover:bg-gray-200"
                    onClick={() => {
                      setRelatedOrders(null);
                      navigate(`/ordini/${orders.id}`, { state: { originOrder } });
                    }}
                  >
                    <div className="text-[clamp(0.9rem,2vw,1.1rem)] font-semibold">{orders.number}</div>
                    <div className="text-[clamp(0.8rem,2vw,1rem)] text-gray-600">
                      {orders.customer_name} — {formatDate(orders.created_at)}
                    </div>
                    <div className="text-[clamp(0.9rem,2vw,1.1rem)] font-medium text-black/80 mt-1">
                      quantità: {quantity}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Glass({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-3 sm:p-4 rounded-xl border border-white/90 backdrop-blur bg-white/50 shadow">
      <div className="text-[clamp(0.75rem,2vw,1rem)] font-semibold text-gray-600 mb-1">{label}</div>
      <div className="text-[clamp(0.9rem,2.5vw,1.2rem)] font-medium text-black">
        {value !== undefined && value !== null && value !== "" ? value : "—"}
      </div>
    </div>
  );
}

function formatDate(dateString: string = "") {
  return new Date(dateString).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
