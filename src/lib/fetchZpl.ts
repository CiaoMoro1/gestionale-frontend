// src/lib/fetchZpl.ts
export type ZplResult = { order_id: string; ok: boolean; zpl?: string[]; message?: string };
export type ZplResponse = { error?: string; results?: ZplResult[] };

export async function fetchZplForOrders(args: {
  apiUrl: string;
  orderIds: string[];
  channel: "SITO" | "AMAZON_SELLER";
}): Promise<ZplResult[]> {
  const endpoint =
    args.channel === "AMAZON_SELLER"
      ? "/api/brt/labels-zpl-seller"
      : "/api/brt/labels-zpl";

  const resp = await fetch(`${args.apiUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_ids: args.orderIds }),
  });

  const data = (await resp.json().catch(() => ({}))) as ZplResponse;

  if (!resp.ok || data.error) {
    throw new Error(data.error || "Errore recupero ZPL");
  }

  return data.results ?? [];
}
