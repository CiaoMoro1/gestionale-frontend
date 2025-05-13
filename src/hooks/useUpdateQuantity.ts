import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

type Payload = {
  productId: string
  value: number
  mode: "delta" | "replace"
}

export function useUpdateQuantity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ productId, value, mode }: Payload) => {
      if (mode === "delta") {
        const { error } = await supabase.rpc("adjust_inventory_quantity", {
          pid: productId,
          delta: value,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("inventory")
          .update({ inventario: value })
          .eq("product_id", productId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}
