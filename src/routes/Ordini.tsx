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
    <div className="p-4 space-y-2 rounded-3xl border text-white bg-gradient-to-b from-blue-900 to-blue-500 min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white/90">Ordini Attivi</h1>
        <p className="text-s text-white/50">Visualizza gli ordini recenti da Shopify</p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/20 bg-white/5 shadow-xl backdrop-blur">
      <table className="min-w-full text-s text-white">
        <thead className="bg-white/10">
          <tr>
            <th className="text-center px-4 py-3">Cliente</th>
            <th className="text-center px-4 py-3">Totale</th>
            <th className="text-center px-4 py-3">Pagamento</th>
            <th className="text-center px-4 py-3">Ordine</th>
            <th className="text-center px-4 py-3">Canale</th>
            <th className="text-center px-4 py-3">Evasione</th>
            <th className="text-center px-4 py-3">Data</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className="hover:bg-white/10 cursor-pointer border-b border-white/10"
              onClick={() => navigate(`/ordini/${order.id}`)}
            >
              <td className="px-4 py-3 text-center">{order.customer_name}</td>
              <td className="px-4 py-3 text-center">{Number(order.total).toFixed(2)}</td>
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
