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
    return <div className="p-6 text-blue-500 text-center">Caricamento...</div>;

  return (
    <div className="min-h-screen rounded-2xl bg-gradient-to-b from-blue-900 to-blue-600 p-4 text-white">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white">Ordini Attivi</h1>
        <p className="text-s text-white/70">Visualizza gli ordini recenti da Shopify</p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white/10 shadow-xl backdrop-blur border border-white/20">
        <table className="min-w-full text-sm">
          <thead className="bg-white/10 text-white uppercase tracking-wide text-xs">
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
                className="hover:bg-white/10 border-b border-white/10 transition cursor-pointer"
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
