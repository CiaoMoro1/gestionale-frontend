import { useEffect, useMemo, useState } from "react";
import { ProduzioneRow, StatoProduzione } from "./types";
import { matchSmart } from "./utils";

export function useProduzioneData(apiUrl: string, canale: string) {
  const [all, setAll] = useState<ProduzioneRow[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const url = new URL(`${apiUrl}/api/produzione`);
    if (canale) url.searchParams.set("canale", canale);
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => setAll(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => setAll([]));
  }, [apiUrl, canale, tick]);

  return { all, refresh: () => setTick((x) => x + 1) };
}

export function filterRows(
  all: ProduzioneRow[],
  opts: { stato?: StatoProduzione | string; radice?: string; search?: string; canale?: string }
) {
  let rows = all;
  if (opts.stato) rows = rows.filter((r) => r.stato_produzione === opts.stato);
  if (opts.radice) rows = rows.filter((r) => r.radice === opts.radice);
  if (opts.canale) rows = rows.filter((r) => r.canale === opts.canale);
  if (opts.search) rows = rows.filter((r) => matchSmart({ sku: r.sku, ean: r.ean }, opts.search!));

  // ordinamento più leggibile: data (NULL first) poi SKU
  rows = [...rows].sort((a, b) => {
    const ad = a.start_delivery ?? "";
    const bd = b.start_delivery ?? "";
    const cmp = ad.localeCompare(bd);
    if (cmp !== 0) return cmp;
    return a.sku.localeCompare(b.sku, "it", { sensitivity: "base" });
  });
  return rows;
}

export function useBadges(
  all: ProduzioneRow[],
  filters: { radice?: string; search?: string; canale?: string; stato?: string }
) {
  const badgeStati = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of all) {
      if (filters.radice && r.radice !== filters.radice) continue;
      if (filters.canale && r.canale !== filters.canale) continue;
      if (filters.search && !matchSmart({ sku: r.sku, ean: r.ean }, filters.search)) continue;
      by.set(r.stato_produzione, (by.get(r.stato_produzione) ?? 0) + 1);
    }
    return by;
  }, [all, filters]);

  const badgeRadici = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of all)
