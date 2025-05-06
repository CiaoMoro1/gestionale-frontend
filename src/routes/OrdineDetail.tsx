import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

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
  } | null;
};

export default function OrdineDetail() {
  const { id } = useParams();

  const { data, isLoading, error } = useQuery<{ ordine: Ordine; items: OrderItem[] }>({
    queryKey: ["ordine", id],
    queryFn: async (): Promise<{ ordine: Ordine; items: OrderItem[] }> => {
        const { data: ordine, error: err1 } = await supabase
          .from("orders")
          .select("*")
          .eq("id", id)
          .single();
        if (err1) throw err1;
      
        const { data: rawItems, error: err2 } = await supabase
          .from("order_items")
          .select("sku, quantity, shopify_variant_id, product_id, products(product_title, variant_title)")
          .eq("order_id", id);
        if (err2) throw err2;
      
        const items: OrderItem[] = (rawItems ?? []).map((item: any) => ({
          ...item,
          products: Array.isArray(item.products) ? item.products[0] : item.products,
        }));
      
        return { ordine, items };
      }
      
  });

  if (isLoading) return <div className="p-6 text-blue-500 text-center">Caricamento...</div>;
  if (error) return <div className="p-6 text-red-500">Errore: {error.message}</div>;

  const { ordine, items } = data!;

  return (
    <div className="p-4 space-y-6 rounded-3xl border text-white bg-gradient-to-b from-blue-900 to-blue-300 min-h-screen">
      <h1 className="text-xl font-bold text-center">Ordine {ordine.number}</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-black">
        <Glass label="Cliente" value={ordine.customer_name} />
        <Glass label="Canale" value={ordine.channel} />
        <Glass label="Totale" value={`${ordine.total?.toFixed(2)} €`} />
        <Glass label="Pagamento" value={ordine.payment_status} />
        <Glass label="Evasione" value={ordine.fulfillment_status} />
        <Glass label="Data" value={formatDate(ordine.created_at)} />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white/90 mt-6 mb-2">Articoli ({items.length})</h2>
        <div className="grid grid-cols-1 gap-2">
          {items.map((item: OrderItem, i: number) => (
            <div key={i} className="p-4 rounded-xl bg-white/50 border text-black backdrop-blur">
              <div className="text-sm font-semibold">
                {item.products?.product_title || "Prodotto sconosciuto"}
              </div>
              <div className="text-xl text-gray-700">
                {item.products?.variant_title || item.sku || "—"}
              </div>
              <div className="text-s">Quantità: {item.quantity}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Glass({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-4 rounded-xl border border-white/90 backdrop-blur bg-white/50 shadow">
      <div className="text-[clamp(1.2rem,2.5vw,1.5rem)] mb-1">{label}</div>
      <div className="text-[clamp(1.3rem,2vw,1.2rem)]">
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
