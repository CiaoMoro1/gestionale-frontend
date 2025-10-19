import { useState, useCallback } from "react";
import SearchInput from "./SearchInput";
import StatoDropdown from "./StatoDropdown";
import RadiceDropdown from "./RadiceDropdown";
import CanaleDropdown from "./CanaleDropdown";
import ManualInsertModal from "../Modals/ManualInsertModal";

import type {
  StatoProduzione,
  ProductSuggest,
  SiteOrdersSummary,
} from "@/features/produzione";

type BadgeModel = {
  byStato: { stato: StatoProduzione; count: number }[];
  tutteStati: number;
  radiciDisponibili: string[];
  byRadice: { radice: string; count: number }[];
  tutteRadici: number;
  byCanale?: { canale: string; count: number }[];
  tuttiCanali?: number;
};

type ManualPayload = {
  canale: "Amazon Seller" | "Sito";
  sku: string;
  ean?: string;
  qty: number;
  note?: string;
  plus?: number;
  cavallotti?: boolean;
};

type Props = {
  stato: string;
  radice: string;
  canale: string;

  searchLocal: string;
  onSearchChange: (v: string) => void;
  onSearchCommit: (v: string) => void;

  setStato: (v: string) => void;
  setRadice: (v: string) => void;
  setCanale: (v: string) => void;

  badge: BadgeModel;
  isLoading: boolean;

  onManualInsert: (payload: ManualPayload) => Promise<void>;
  onSearchSuggest: (q: string) => Promise<ProductSuggest[]>;
  onFetchSiteSummary: (sku: string) => Promise<SiteOrdersSummary | null>;
};

export default function FiltersBar({
  stato, radice, canale,
  searchLocal, onSearchChange, onSearchCommit,
  setStato, setRadice, setCanale,
  badge, isLoading,
  onManualInsert, onSearchSuggest, onFetchSiteSummary
}: Props) {
  const canali = ["Amazon Vendor", "Sito", "Amazon Seller"];
  const byCanale = badge.byCanale ?? canali.map(c => ({ canale: c, count: 0 }));
  const tuttiCanali = typeof badge.tuttiCanali === "number"
    ? badge.tuttiCanali
    : byCanale.reduce((a, b) => a + (b.count || 0), 0);

  const [insertOpen, setInsertOpen] = useState(false);

  // Normalizzazione query (opzionale)
  const normalizeQuery = (q: string) => {
    const raw = (q || "").trim();
    if (!raw) return raw;
    const isEan = /^\d{6,}$/.test(raw);
    const norm = isEan ? raw : raw.toUpperCase();
    return !isEan && norm.length <= 3 && !norm.endsWith(";") ? norm + ";" : norm;
  };

  // Adapter abort-aware (consuma 'signal' per evitare warning e update tardivi)
  const suggestWrapped = useCallback(
    async (q: string, signal?: AbortSignal) => {
      const effective = normalizeQuery(q);
      if (signal?.aborted) return [];
      const req = onSearchSuggest(effective);
      if (signal) {
        const abortPromise = new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
        try { return await Promise.race([req, abortPromise]); } catch { return []; }
      }
      return req;
    },
    [onSearchSuggest]
  );

  const siteSummaryWrapped = useCallback(
    (sku: string) => onFetchSiteSummary(sku),
    [onFetchSiteSummary]
  );

  return (
    <div
      className="
        bg-white rounded-3xl border border-slate-200
        shadow-[0_6px_0_0_#f2f5f9,0_20px_40px_-20px_rgba(2,6,23,0.15)]
        px-4 sm:px-5 py-3 sm:py-4 mb-5
        flex flex-wrap items-end gap-3
      "
    >
      {/* Stato */}
      <div className="min-w-[160px]">
        <StatoDropdown value={stato} onChange={setStato} counts={badge.byStato} totale={badge.tutteStati} isLoading={isLoading} />
      </div>

      {/* Canale */}
      <div className="min-w-[200px]">
        <CanaleDropdown value={canale} onChange={setCanale} items={canali} counts={byCanale} totale={tuttiCanali} />
      </div>

      {/* Radice */}
      <div className="min-w-[180px]">
        <RadiceDropdown value={radice} onChange={setRadice} items={badge.radiciDisponibili} counts={badge.byRadice} totale={badge.tutteRadici} />
      </div>

      {/* Campo ricerca */}
      <div className="flex-1 min-w-[260px]">
        <SearchInput value={searchLocal} onChange={onSearchChange} onCommit={onSearchCommit} debounce={250} idleCommitMs={900} />
      </div>

      {/* Bottone + modale */}
      <div className="ml-auto">
        <button
          type="button"
          className="px-4 py-2 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow"
          onClick={() => setInsertOpen(true)}
        >
          + Inserisci manuale
        </button>

        <ManualInsertModal
          open={insertOpen}
          onClose={() => setInsertOpen(false)}
          onSubmit={onManualInsert}
          onSuggest={suggestWrapped}
          onFetchSiteSummary={siteSummaryWrapped}
        />
      </div>
    </div>
  );
}
