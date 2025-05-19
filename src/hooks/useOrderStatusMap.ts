import { useMemo } from "react";
import type { OrderItem } from "../types";

type StatusType = "green" | "yellow" | "red";

export function useOrderStatusMap(orderItems: OrderItem[]) {
  return useMemo(() => {
    const statusMap: Record<string, { stato: StatusType; tot: number; disponibili: number }> = {};
    const problematicItems: OrderItem[] = [];

    const grouped = orderItems.reduce((acc: Record<string, OrderItem[]>, item) => {
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});

    for (const orderId in grouped) {
      const items = grouped[orderId];

      // Escludi gli articoli senza prodotto valido (es. "—")
      const validItems = items.filter((i) => {
        const titolo = i.products?.product_title?.trim();
        return titolo && titolo !== "—";
      });

      const tot = validItems.reduce((sum, i) => sum + i.quantity, 0);
      const disponibili = validItems.reduce((sum, i) => {
        const inv = i.products?.inventory?.inventario ?? 0;
        return inv >= i.quantity ? sum + i.quantity : sum;
      }, 0);

      let stato: StatusType = "green";
      for (const i of validItems) {
        const q = i.quantity;
        const inv = i.products?.inventory;
        const invFisico = inv?.inventario ?? 0;
        const riservato = inv?.riservato_sito ?? 0;

        if (invFisico < q) {
          stato = "red";
          break;
        } else if (riservato > invFisico) {
          stato = "yellow";
          problematicItems.push(i);
        }
      }

      statusMap[orderId] = { stato, tot, disponibili };
    }

    return { statusMap, problematicItems };
  }, [orderItems]);
}
