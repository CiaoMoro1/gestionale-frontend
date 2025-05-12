// src/hooks/useOrderStatusMap.ts
import { useMemo } from "react";

type StatusType = "green" | "yellow" | "red";

export function useOrderStatusMap(orderItems: any[]) {
  return useMemo(() => {
    const map: Record<string, { stato: StatusType; tot: number; disponibili: number }> = {};

    const grouped = orderItems.reduce((acc: Record<string, any[]>, item) => {
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});

    for (const orderId in grouped) {
      const items = grouped[orderId];
      const validItems = items.filter((i) => i.products?.product_title?.trim() !== "—");

      const tot = validItems.reduce((sum, i) => sum + i.quantity, 0);
      const disponibili = validItems.reduce((sum, i) => {
        const inv = i.products?.inventory?.inventario ?? 0;
        return inv >= i.quantity ? sum + i.quantity : sum;
      }, 0);

      let stato: StatusType = "green";
      for (const i of validItems) {
        const q = i.quantity;
        const inv = i.products?.inventory;
        if (inv?.inventario < q) {
          stato = "red";
          break;
        } else if (inv?.disponibile < q) {
          stato = "yellow";
        }
      }

      map[orderId] = { stato, tot, disponibili };
    }

    return map;
  }, [orderItems]);
}
