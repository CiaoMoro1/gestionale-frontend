// src/components/OrdineRow.tsx
import { memo } from "react";
import { ToggleSelector } from "./ToggleSelector";
import { useSelectedOrders } from "../state/useSelectedOrders";
import type { Ordine } from "../types/ordini";

type StatusInfo = {
  stato: "green" | "yellow" | "red";
  tot: number;
  disponibili: number;
};

type OrdineWithFlags = Ordine & {
  has_catalog_issue?: boolean;
};

type OrdineRowProps = {
  order: OrdineWithFlags;
  status?: StatusInfo;
  onOpenDetail?: (order: OrdineWithFlags) => void;

  // ✅ nuove colonne opzionali (non rompono Sito)
  showCatalogCol?: boolean;
  showItemsCol?: boolean;
  itemsCount?: number;
};

export const OrdineRow = memo(function OrdineRow({
  order,
  onOpenDetail,
  showCatalogCol = false,
  showItemsCol = false,
  itemsCount = 0,
}: OrdineRowProps) {
  const { selected, toggleSelected } = useSelectedOrders();
  const isSelected = selected.includes(order.id);
  const isSelectable = true;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalLabel =
    order.total !== null && order.total !== undefined
      ? `${Number(order.total).toFixed(2)} €`
      : "—";

  return (
    <tr
      onClick={() => onOpenDetail?.(order)}
      className="hover:bg-gray-50 transition cursor-pointer border-b border-black/10"
    >
      {/* checkbox */}
      <td
        className="text-center p-3 w-[40px]"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <ToggleSelector
          checked={isSelected}
          disabled={!isSelectable}
          onToggle={() => toggleSelected(order.id, isSelectable)}
        />
      </td>

      {/* ✅ Catalogo (opzionale) */}
      {showCatalogCol && (
        <td className="text-center p-3 whitespace-nowrap">
          {order.has_catalog_issue ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200"
              title="Problema catalogo: alcuni articoli non sono collegati al catalogo prodotti"
            >
              ⚠︎ ISSUE
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200"
              title="Catalogo OK"
            >
              ✓ OK
            </span>
          )}
        </td>
      )}

      {/* ✅ Numero righe (opzionale) */}
      {showItemsCol && (
        <td className="text-center p-3 whitespace-nowrap">
          <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {itemsCount}
          </span>
        </td>
      )}

      {/* Cliente */}
      <td className="text-center p-3 whitespace-nowrap">
        {order.customer_name || "—"}
      </td>

      {/* Totale */}
      <td className="text-center p-3 whitespace-nowrap">
        {totalLabel}
      </td>

      {/* Pagamento */}
      <td className="text-center p-3 whitespace-nowrap">
        {order.payment_status || "—"}
      </td>

      {/* Ordine */}
      <td className="text-center p-3 font-semibold whitespace-nowrap">
        {order.number || "—"}
      </td>

      {/* Canale */}
      <td className="text-center p-3 whitespace-nowrap">
        {order.channel || "—"}
      </td>

      {/* Data */}
      <td className="text-center p-3 whitespace-nowrap">
        {formatDate(order.created_at)}
      </td>
    </tr>
  );
});
