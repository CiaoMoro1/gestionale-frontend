/* src/features/produzione/api/produzione.api.ts */
import { apiUrl, headersJson } from "../utils/http";
import type {
  ApiListResponse,
  LogMovimento,
  ProduzioneRow,
  ProductSuggest,
  SiteOrdersSummary,
  StatoProduzione,
} from "../types";

/* ------------------------------ LIST / GET ------------------------------ */

export async function listProduzione(params?: {
  canale?: string;
}): Promise<ProduzioneRow[]> {
  const url = apiUrl("/api/produzione", { canale: params?.canale });
  const r = await fetch(url, { headers: headersJson() });
  if (!r.ok) return [];
  const data = (await r.json()) as ApiListResponse<ProduzioneRow[]>;
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function getProduzione(id: number): Promise<ProduzioneRow | null> {
  const r = await fetch(apiUrl(`/api/produzione/${id}`), { headers: headersJson() });
  if (!r.ok) return null;
  return (await r.json()) as ProduzioneRow;
}

/* ------------------------------ MUTATIONS ------------------------------ */

export async function patchProduzione(
  id: number,
  body: Partial<ProduzioneRow & { password?: string }>
): Promise<void> {
  const r = await fetch(apiUrl(`/api/produzione/${id}`), {
    method: "PATCH",
    headers: headersJson(),
    body: JSON.stringify(body),
  });
  if (r.status === 403) {
    const e = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(e?.error || "Password errata.");
  }
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(e?.error || "Patch fallita");
  }
}

export async function moveQty(args: {
  from_id: number;
  to_state: StatoProduzione | string;
  qty: number;
}): Promise<void> {
  const r = await fetch(apiUrl("/api/produzione/move-qty"), {
    method: "POST",
    headers: headersJson(),
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(e?.error || "Spostamento non riuscito");
  }
}

export async function bulkSetState(ids: number[], stato: StatoProduzione): Promise<void> {
  const r = await fetch(apiUrl("/api/produzione/bulk"), {
    method: "PATCH",
    headers: headersJson(),
    body: JSON.stringify({ ids, fields: { stato_produzione: stato } }),
  });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(e?.error || "Bulk set stato fallito");
  }
}

export async function bulkDelete(ids: number[]): Promise<void> {
  const r = await fetch(apiUrl("/api/produzione/bulk"), {
    method: "DELETE",
    headers: headersJson(),
    body: JSON.stringify({ ids }),
  });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(e?.error || "Bulk delete fallito");
  }
}

/* ------------------------------- SEARCH / INFO ------------------------------- */

export async function searchProducts(q: string): Promise<ProductSuggest[]> {
  if (!q) return [];
  const r = await fetch(apiUrl("/api/products/search", { q }), { headers: headersJson() });
  if (!r.ok) return [];
  return (await r.json()) as ProductSuggest[];
}

export async function fetchSiteSummary(sku: string): Promise<SiteOrdersSummary | null> {
  if (!sku) return null;
  const r = await fetch(apiUrl("/api/orders/site/sku-summary", { sku }), { headers: headersJson() });
  if (!r.ok) return null;
  return (await r.json()) as SiteOrdersSummary;
}

/* ----------------------------- LOGS / CAVALLOTTO ----------------------------- */

export async function getLogs(produzioneId: number): Promise<LogMovimento[]> {
  // preferisci unified compatto, con fallback
  const tryUnified = await fetch(
    apiUrl(`/api/produzione/${produzioneId}/log-unified`, { compact: 1 }),
    { headers: headersJson() }
  ).catch(() => null);

  if (tryUnified && tryUnified.ok) {
    const arr = (await tryUnified.json().catch(() => null)) as LogMovimento[] | { data?: LogMovimento[] } | null;
    if (arr) return Array.isArray(arr) ? arr : arr.data ?? [];
  }

  const r = await fetch(apiUrl(`/api/produzione/${produzioneId}/log`), { headers: headersJson() });
  if (!r.ok) return [];
  const arr = (await r.json().catch(() => null)) as LogMovimento[] | { data?: LogMovimento[] } | null;
  return arr ? (Array.isArray(arr) ? arr : arr.data ?? []) : [];
}

export function cavallottoPdfUrl(sku: string, formato: string): string {
  return apiUrl("/api/cavallotto/html", { sku, formato });
}

/* ------------------------------ INSERIMENTO MANUALE ------------------------------ */

export async function insertManual(payload: {
  canale: "Amazon Seller" | "Sito";
  sku: string;
  ean?: string;
  qty: number;
  note?: string;
  plus?: number;
  cavallotti?: boolean;
}): Promise<void> {
  const r = await fetch(apiUrl("/api/produzione/manuale"), {
    method: "POST",
    headers: headersJson(),
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(e?.error || "Errore inserimento manuale");
  }
}
