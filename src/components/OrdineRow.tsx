// src/components/OrdineRow.tsx
import { useNavigate } from "react-router-dom";
import { memo } from "react";
import { ToggleSelector } from "./ToggleSelector";
import { EvadiStatus } from "./EvadiStatus";
import { useSelectedOrders } from "../state/useSelectedOrders";

export const OrdineRow = memo(function OrdineRow({
  order,
  status,
}: {
  order: any;
  status: { stato: "green" | "yellow" | "red"; tot: number; disponibili: number };
}) {
  const navigate = useNavigate();
  const { selected, toggleSelected } = useSelectedOrders();
  const isSelected = selected.includes(order.id);
  const isSelectable = status.stato !== "red";

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
      onClick={() => navigate(`/ordini/${order.id}`)}
      className="hover:bg-gray-50 transition cursor-pointer border-b border-black/10"
    >
      <td className="text-center p-3">
        <ToggleSelector
          checked={isSelected}
          disabled={!isSelectable}
          onToggle={() => toggleSelected(order.id, isSelectable)}
        />
      </td>

      <td className="text-center p-3">
        <EvadiStatus stato={status.stato} tot={status.tot} disponibili={status.disponibili} />
      </td>
      <td className="text-center p-3">{order.customer_name}</td>
      <td className="text-center p-3">{Number(order.total).toFixed(2)} €</td>
      <td className="text-center p-3">{order.payment_status}</td>
      <td className="text-center p-3 font-semibold">{order.number}</td>
      <td className="text-center p-3">{order.channel}</td>
      <td className="text-center p-3">{formatDate(order.created_at)}</td>
    </tr>
  );
});
