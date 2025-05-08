import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function Ordini() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadOrders = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, created_at, customer_name, channel, total, payment_status, fulfillment_status")
        .not("fulfillment_status", "eq", "annullato")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Errore nel caricamento ordini:", error);
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    };

    loadOrders();
  }, []);

  if (loading)
    return <div className="p-6 text-black text-center">Caricamento Ordini...</div>;

  return (
    <div className="text-black/70">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-black">Ordini Attivi</h1>
        <p className="text-sm text-black/70">Visualizza gli ordini recenti da Shopify</p>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-md border border-gray-100">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-black text-white uppercase tracking-wide text-xs">
            <tr>
              <th className="px-4 py-3 text-center">Cliente</th>
              <th className="px-4 py-3 text-center">Totale</th>
              <th className="px-4 py-3 text-center">Pagamento</th>
              <th className="px-4 py-3 text-center">Ordine</th>
              <th className="px-4 py-3 text-center">Canale</th>
              <th className="px-4 py-3 text-center">Evasione</th>
              <th className="px-4 py-3 text-center">Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="hover:bg-gray-50 transition cursor-pointer border-b border-black/60"
                onClick={() => navigate(`/ordini/${order.id}`)}
              >
                <td className="px-4 py-3 text-center">{order.customer_name}</td>
                <td className="px-4 py-3 text-center">{Number(order.total).toFixed(2)} €</td>
                <td className="px-4 py-3 text-center">{order.payment_status}</td>
                <td className="px-4 py-3 text-center font-semibold">{order.number}</td>
                <td className="px-4 py-3 text-center">{order.channel}</td>
                <td className="px-4 py-3 text-center">{order.fulfillment_status}</td>
                <td className="px-4 py-3 text-center">{formatDate(order.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  function formatDate(dateString: string = "") {
    return new Date(dateString).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
