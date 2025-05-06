import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"

type Order = {
  id: string
  number: string
  customer_name: string
  channel: string
  total: number
  payment_status: string
  fulfillment_status: string
  created_at: string
}

export default function Ordini() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadOrders = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, created_at, customer_name, channel, total, payment_status, fulfillment_status")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Errore nel caricamento ordini:", error)
      } else {
        setOrders(data || [])
      }
      setLoading(false)
    }

    loadOrders()
  }, [])

  if (loading) return <div className="p-4">Caricamento...</div>

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Ordini</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">Ordine</th>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Cliente</th>
              <th className="text-left px-3 py-2">Canale</th>
              <th className="text-right px-3 py-2">Totale</th>
              <th className="text-left px-3 py-2">Pagamento</th>
              <th className="text-left px-3 py-2">Evasione</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr
                key={order.id}
                className="hover:bg-gray-50 cursor-pointer border-b"
                onClick={() => navigate(`/ordini/${order.id}`)}
              >
                <td className="px-3 py-2 font-medium">{order.number}</td>
                <td className="px-3 py-2">{new Date(order.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{order.customer_name}</td>
                <td className="px-3 py-2">{order.channel}</td>
                <td className="px-3 py-2 text-right">{order.total?.toFixed(2)} €</td>
                <td className="px-3 py-2">{order.payment_status}</td>
                <td className="px-3 py-2">{order.fulfillment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
