import { useQuery } from "@tanstack/react-query";

export function useVendorBadgeCounts() {
  const { data, isLoading } = useQuery({
    queryKey: ["badge-counts"],
    queryFn: async () =>
      fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/badge-counts`)
        .then(r => r.json()),
    refetchInterval: 300000, // ogni 5 minuti (puoi regolare come vuoi)
  });

  return {
    nuoviCount: isLoading ? undefined : data?.nuovi ?? 0,
    parzialiCount: isLoading ? undefined : data?.parziali ?? 0,
  };
}
