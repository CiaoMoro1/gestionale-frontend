/* src/features/produzione/hooks/useProduzioneData.ts */
import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  ProduzioneRow,
  StatoProduzione,
  ProductSuggest,
} from "../types";

import {
  listProduzione,
  patchProduzione as patchProduzioneApi,
  moveQty as moveQtyApi,
  bulkSetState as bulkSetStateApi,
  bulkDelete as bulkDeleteApi,
  searchProducts as searchProductsApi,
  fetchSiteSummary as fetchSiteSummaryApi,
  insertManual as insertManualApi,
  getProduzione,
  getLogs,
  cavallottoPdfUrl,
} from "../api/produzione.api";

import { radiceMenuKey, sortKeySku, sameSku } from "../utils/sku";

/* ------------------------------ Match “smart” ------------------------------ */
function matchSmart(row: { sku: string; ean: string }, query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const SKU = (row.sku || "").toUpperCase();
  const EAN = (row.ean || "").toUpperCase();
  const parts = SKU.split("-").filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : "";
  return tokens.every((tok) => {
    const exact = tok.endsWith(";");
    const t = tok.replace(/;$/, "").toUpperCase();
    if (!t) return true;
    if (exact) {
      if (/^\d+$/.test(t)) return EAN === t;
      return last === t;
    }
    return SKU.includes(t) || EAN.includes(t);
  });
}

/* ------------------------------ Hook principale ------------------------------ */

type UseProduzioneParams = {
  stato?: string;   // label “Da Stampare”, ...
  radice?: string;  // radice menu
  search?: string;  // query libera SKU/EAN
  canale?: string;  // “Amazon Vendor” | “Sito” | “Amazon Seller”
};

export default function useProduzioneData(params?: UseProduzioneParams) {
  const { stato = "", radice = "", search = "", canale = "" } = params || {};
  const qc = useQueryClient();

  /* ------------------------------ Query lista ------------------------------ */
  const listQuery = useQuery({
    queryKey: ["produzione", "list", { canale }],
    queryFn: () => listProduzione({ canale: canale || undefined }),
    staleTime: 30_000,
  });

   const allRows = useMemo<ProduzioneRow[]>(() => listQuery.data ?? [], [listQuery.data]);


  /* ------------------------------ Filtri client ------------------------------ */
  const rows = useMemo(() => {
    let filtrate = allRows.slice();
    if (stato) filtrate = filtrate.filter((r) => r.stato_produzione === (stato as StatoProduzione));
    if (radice) filtrate = filtrate.filter((r) => radiceMenuKey(r) === radice);
    if (canale) filtrate = filtrate.filter((r) => r.canale === canale);
    if (search) filtrate = filtrate.filter((row) => matchSmart({ sku: row.sku, ean: row.ean }, search));
    filtrate.sort((a, b) => a.sku.localeCompare(b.sku, "it", { sensitivity: "base" }));
    return filtrate;
  }, [allRows, stato, radice, search, canale]);

  /* ------------------------------ Suggerimenti prodotto (debounced lato chiamante) ------------------------------ */
  async function searchProducts(q: string): Promise<ProductSuggest[]> {
    return searchProductsApi(q);
  }

  async function fetchSiteSummary(sku: string) {
    return fetchSiteSummaryApi(sku);
  }

  /* ------------------------------ Mutations (con invalidazioni mirate) ------------------------------ */

  const patchProduzioneMut = useMutation({
    mutationFn: (vars: { id: number; body: Partial<ProduzioneRow & { password?: string }> }) =>
      patchProduzioneApi(vars.id, vars.body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["produzione", "list"] }),
        qc.invalidateQueries({ queryKey: ["produzione", "row"] }),
      ]);
    },
  });

  const moveQtyMut = useMutation({
    mutationFn: (vars: { from_id: number; to_state: StatoProduzione | string; qty: number }) =>
      moveQtyApi(vars),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["produzione", "list"] });
    },
  });

  const bulkSetStateMut = useMutation({
    mutationFn: (vars: { ids: number[]; stato: StatoProduzione }) =>
      bulkSetStateApi(vars.ids, vars.stato),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["produzione", "list"] });
    },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteApi(ids),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["produzione", "list"] });
    },
  });

  const insertManualMut = useMutation({
    mutationFn: (payload: {
      canale: "Amazon Seller" | "Sito";
      sku: string;
      ean?: string;
      qty: number;
      note?: string;
      plus?: number;
      cavallotti?: boolean;
    }) => insertManualApi(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["produzione", "list"] });
    },
  });

  /* ------------------------------ Helpers extra allineati al tuo componente ------------------------------ */
  const api = {
    getProduzione,
    getLogs,
    cavallottoPdfUrl,
    // mutations (stesso naming che avevi nel componente)
    patchProduzione: patchProduzioneMut.mutateAsync,
    moveQtyToState: async (from: ProduzioneRow, toState: StatoProduzione | string, qty: number) => {
      await moveQtyMut.mutateAsync({ from_id: from.id, to_state: toState, qty });
    },
    bulkSetState: async (ids: number[], stato: StatoProduzione) =>
      bulkSetStateMut.mutateAsync({ ids, stato }),
    bulkDelete: bulkDeleteMut.mutateAsync,
    insertManual: insertManualMut.mutateAsync,
    searchProducts,
    fetchSiteSummary,
  };

  /* ------------------------------ Statistiche badge (come nel tuo JSX) ------------------------------ */
  const badge = useMemo(() => {
    // counts per stato (rispettando filtri radice/search/canale)
    const statiSet = new Set<StatoProduzione>(
      ["Da Stampare","Stampato","Calandrato","Cucito","Confezionato","Trasferito","Deposito","Rimossi"] as StatoProduzione[]
    );
    const byStato = Array.from(statiSet).map((st) => ({
      stato: st,
      count: allRows.filter(
        (r) =>
          (!radice || radiceMenuKey(r) === radice) &&
          (!search || matchSmart({ sku: r.sku, ean: r.ean }, search)) &&
          (!canale || r.canale === canale) &&
          r.stato_produzione === st
      ).length,
    }));
    const tutteStati = allRows.filter(
      (r) =>
        (!radice || radiceMenuKey(r) === radice) &&
        (!search || matchSmart({ sku: r.sku, ean: r.ean }, search)) &&
        (!canale || r.canale === canale)
    ).length;

    const radiciDisponibili = Array.from(
      new Set(
        allRows
          .filter((r) =>
            (!stato || r.stato_produzione === (stato as StatoProduzione)) &&
            (!canale || r.canale === canale)
          )
          .map((r) => radiceMenuKey(r))
      )
    )
      .filter(Boolean)
      .sort((a, b) => sortKeySku(a).localeCompare(sortKeySku(b), "it", { sensitivity: "base" }));

    const byRadice = radiciDisponibili.map((rr) => ({
      radice: rr,
      count: allRows.filter(
        (row) =>
          (!stato || row.stato_produzione === (stato as StatoProduzione)) &&
          (!canale || row.canale === canale) &&
          radiceMenuKey(row) === rr
      ).length,
    }));

    const tutteRadici = allRows.filter(
      (row) =>
        (!stato || row.stato_produzione === (stato as StatoProduzione)) &&
        (!search || matchSmart({ sku: row.sku, ean: row.ean }, search)) &&
        (!canale || row.canale === canale)
    ).length;

    return {
      byStato,
      tutteStati,
      radiciDisponibili,
      byRadice,
      tutteRadici,
    };
  }, [allRows, stato, radice, search, canale]);

  return {
    // data
    allRows,
    rows,
    // per badge/filtri UI già calcolati (opzionali)
    badge,
    // stato query (loading/error) utile per skeleton
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error as Error | null,
    // API actions
    api,
    // utils che possono servire in tabella
    sameSku,
  };
}
