import { useNavigate } from "react-router-dom";
import { useState } from "react";
import EvadiButton from "./EvadiButton";

export default function OrdineRow({
  order,
  evadibiliOnly,
}: {
  order: any;
  evadibiliOnly: boolean;
}) {
  const [status, setStatus] = useState<"green" | "yellow" | "red" | null>(null);
  const navigate = useNavigate();

  // Filtro attivo: nascondi se non evadibile
  if (evadibiliOnly && status === "red") return null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <tr
      className="hover:bg-gray-50 transition cursor-pointer border-b border-black/60"
      onClick={() => navigate(`/ordini/${order.id}`)}
    >
      <td className="px-4 py-3 text-center">
        <EvadiButton orderId={order.id} onStatus={(s) => setStatus(s)} />
      </td>
      <td className="px-4 py-3 text-center">{order.customer_name}</td>
      <td className="px-4 py-3 text-center">{Number(order.total).toFixed(2)} €</td>
      <td className="px-4 py-3 text-center">{order.payment_status}</td>
      <td className="px-4 py-3 text-center font-semibold">{order.number}</td>
      <td className="px-4 py-3 text-center">{order.channel}</td>
      <td className="px-4 py-3 text-center">{order.fulfillment_status}</td>
      <td className="px-4 py-3 text-center">{formatDate(order.created_at)}</td>
    </tr>
  );
}
