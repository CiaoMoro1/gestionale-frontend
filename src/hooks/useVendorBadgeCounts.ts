// src/hooks/useVendorBadgeCounts.ts
import { useQuery } from "@tanstack/react-query";

export function useVendorBadgeCounts() {
  const { data: nuovi = [], isLoading: loadingNuovi } = useQuery({
    queryKey: ["badge-nuovi"],
    queryFn: async () => fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/nuovi`).then(r => r.json()),
    refetchInterval: 30000,
  });
  const { data: parziali = [], isLoading: loadingParziali } = useQuery({
    queryKey: ["badge-parziali"],
    queryFn: async () => fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/parziali`).then(r => r.json()),
    refetchInterval: 30000,
  });
  return {
    nuoviCount: loadingNuovi ? undefined : nuovi.length,
    parzialiCount: loadingParziali ? undefined : parziali.length,
  };
}
