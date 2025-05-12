import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function EvadiButton({
  orderId,
  onStatus,
}: {
  orderId: string;
  onStatus?: (status: "green" | "yellow" | "red") => void;
}) {
  const navigate = useNavigate();

  const { data: evadi, isLoading } = useQuery({
    queryKey: ["evadi", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select(`
          quantity,
          products:product_id(
            product_title,
            inventory(inventario, disponibile)
          )
        `)
        .eq("order_id", orderId);

      if (error) throw error;

      const normalized = (data ?? []).map((item: any) => ({
        ...item,
        products: Array.isArray(item.products) ? item.products[0] : item.products,
      }));

      const validItems = normalized.filter((item) => {
        const title = item.products?.product_title;
        return title && title.trim() !== "—";
      });

      const tot = validItems.reduce((sum, item) => sum + item.quantity, 0);

      const disponibili = validItems.reduce((sum, item) => {
        const inv = item.products?.inventory;
        const fisico = inv?.inventario ?? 0;
        return fisico >= item.quantity ? sum + item.quantity : sum;
      }, 0);

      let stato: "green" | "yellow" | "red" = "green";
      for (const item of validItems) {
        const q = item.quantity;
        const inv = item.products?.inventory;
        const fisico = inv?.inventario ?? 0;
        const disponibile = inv?.disponibile ?? 0;

        if (fisico >= q && disponibile < q) stato = "yellow";
        else if (fisico < q) {
          stato = "red";
          break;
        }
      }

      onStatus?.(stato); // ✅ FIX: ora viene eseguito
      return { tot, disponibili, stato };
    },
  });

  if (isLoading || !evadi)
    return <span className="text-gray-400 italic">...</span>;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/ordini/${orderId}`);
  };

  const classi = "px-3 py-1 rounded-full font-semibold";

  if (evadi.stato === "green")
    return (
      <button onClick={handleClick} className={`${classi} bg-green-600 text-white hover:bg-green-700`}>
        Evadi ({evadi.disponibili}/{evadi.tot})
      </button>
    );

  if (evadi.stato === "yellow")
    return (
      <button onClick={handleClick} className={`${classi} bg-yellow-300 text-black hover:bg-yellow-200`}>
        ⚠️ Evadi ({evadi.disponibili}/{evadi.tot})
      </button>
    );

  return (
    <button disabled className={`${classi} bg-gray-300 text-gray-600 cursor-not-allowed`}>
      🔒 Evadi ({evadi.disponibili}/{evadi.tot})
    </button>
  );
}
