import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

export default function Etichettati() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", "etichette"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, customer_name, shipping_address, total, created_at, parcel_id")
        .eq("stato_ordine", "etichette")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Caricamento…</div>;
  if (error) return <div className="p-8 text-center text-red-600">Errore: {String(error.message)}</div>;
  if (!data?.length) return <div className="p-8 text-center text-gray-400">Nessun ordine etichettato.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Ordini Etichettati</h1>
      <div className="rounded-xl bg-white shadow border">
        <table className="min-w-full table-auto text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="py-2 px-4 text-left">Numero</th>
              <th className="py-2 px-4 text-left">Cliente</th>
              <th className="py-2 px-4 text-left">Tracking</th>
              <th className="py-2 px-4 text-left">Indirizzo</th>
              <th className="py-2 px-4 text-left">Totale</th>
              <th className="py-2 px-4 text-left">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {data.map((order: any) => (
              <tr key={order.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4 font-semibold text-blue-800">{order.number}</td>
                <td className="py-2 px-4">{order.customer_name}</td>
                <td className="py-2 px-4 text-cyan-800 font-mono flex items-center gap-2">
                    {order.parcel_id ? (
                        <>
                        <span>{order.parcel_id}</span>
                        <button
                            className="ml-2 text-xs bg-gray-100 border px-1 rounded hover:bg-gray-200"
                            title="Copia ParcelID"
                            onClick={() => {
                            navigator.clipboard.writeText(order.parcel_id);
                            }}
                        >
                            Copia
                        </button>
                        </>
                    ) : (
                        <span className="text-gray-400">—</span>
                    )}
                    </td>


                <td className="py-2 px-4">{order.shipping_address}</td>
                <td className="py-2 px-4">€ {order.total}</td>
                <td className="py-2 px-4">
                  <Link
                    to={`/prelievo/${order.id}`}
                    className="bg-cyan-700 text-white px-3 py-1 rounded-lg text-xs hover:bg-cyan-800 transition"
                  >
                    Apri
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
