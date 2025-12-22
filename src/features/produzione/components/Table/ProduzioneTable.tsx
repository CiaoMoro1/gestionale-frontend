import type { ProduzioneRow, StatoProduzione } from "@/features/produzione";
import { TITOLO_DA_PRODURRE } from "@/features/produzione";
import ProduzioneRowView from "./ProduzioneRowView";
import { ArrowUpAZ, ArrowDownAZ, ArrowUp01, ArrowDown01, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

/* ----------------------------------------------------------------------------
 * Helper top-level → evita warning react-hooks/exhaustive-deps su useMemo
 * ---------------------------------------------------------------------------- */

type MaybeDaProdurre = Partial<
  Record<"da_produrre" | "daProdurre" | "qty_da_produrre" | "toProduce" | "qty", number | string>
>;

/** Lettura robusta del valore "da produrre" con fallback su qty e poi 0. */
function readDaProdurre(r: ProduzioneRow): number {
  const m = r as unknown as MaybeDaProdurre;
  const v =
    m.da_produrre ??
    m.daProdurre ??
    m.qty_da_produrre ??
    m.toProduce ??
    m.qty ??
    0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? (n as number) : 0;
}

type Props = {
  rows: ProduzioneRow[];
  allRows: ProduzioneRow[];
  sameSku: (a?: string, b?: string) => boolean;

  flowTotalsMap?: Map<string, Record<StatoProduzione, number>>;

  selectedIds: number[];
  selectAllChecked: boolean;
  onToggleSelect: (id: number, on: boolean) => void;
  onToggleSelectAll: (on: boolean) => void;

  onInlineChangeDaStampare: (id: number, value: number) => Promise<void>;
  onOpenLogs: (rowId: number) => Promise<void>;
  onToggleCavallotti: (row: ProduzioneRow) => Promise<void>;
  onOpenCavallottoPdf: (sku: string, formato: string) => void;

  onOpenNota?: (row: ProduzioneRow) => void;
  onOpenDaProdurre?: (row: ProduzioneRow) => void;
  onOpenChangeState?: (row: ProduzioneRow) => void;

  statoLabel?: string;
};

export function ProduzioneTable({
  rows,
  allRows,
  sameSku,
  flowTotalsMap,

  selectedIds,
  selectAllChecked,
  onToggleSelect,
  onToggleSelectAll,

  onInlineChangeDaStampare,
  onOpenLogs,
  onToggleCavallotti,
  onOpenCavallottoPdf,

  onOpenNota,
  onOpenDaProdurre,
  onOpenChangeState,

  statoLabel,
}: Props) {
  // ---------------------------------------------------------------------------
  // Ordinamento
  // ---------------------------------------------------------------------------
  type SortMode = "none" | "sku_asc" | "sku_desc" | "qty_asc" | "qty_desc";

  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved =
      typeof window !== "undefined"
        ? ((localStorage.getItem("prod.sortMode") as SortMode | null) ?? null)
        : null;
    return saved ?? "none";
  });

  const setSort = (mode: SortMode) => {
    setSortMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("prod.sortMode", mode);
    }
  };

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    switch (sortMode) {
      case "sku_asc":
        arr.sort((a, b) => (a.sku || "").localeCompare(b.sku || "", "it", { sensitivity: "base" }));
        break;
      case "sku_desc":
        arr.sort((a, b) => (b.sku || "").localeCompare(a.sku || "", "it", { sensitivity: "base" }));
        break;
      case "qty_asc":
        // Usa "da produrre" come chiave di ordinamento quantità
        arr.sort((a, b) => readDaProdurre(a) - readDaProdurre(b));
        break;
      case "qty_desc":
        arr.sort((a, b) => readDaProdurre(b) - readDaProdurre(a));
        break;
      case "none":
      default:
        // mantieni l'ordine di input
        break;
    }
    return arr;
  }, [rows, sortMode]); // ✅ niente warning: readDaProdurre è top-level

  const defaultLabel = TITOLO_DA_PRODURRE[""] || "Inseriti";
  const headLabel = statoLabel ?? defaultLabel;

  const sortHint =
    sortMode === "sku_asc"
      ? "SKU ↑"
      : sortMode === "sku_desc"
      ? "SKU ↓"
      : sortMode === "qty_asc"
      ? "DA PRODURRE ↑"
      : sortMode === "qty_desc"
      ? "DA PRODURRE ↓"
      : "";

  return (
    <div
      className="rounded-2xl shadow-xl border bg-white/85 glass morph px-2 sm:px-4 py-2 mb-10 overflow-x-auto"
      style={{
        background:
          "linear-gradient(135deg, rgba(244,245,250,0.87) 60%, rgba(224,241,250,0.85) 100%)",
        boxShadow: "0 8px 32px 0 rgba(31,38,135,.16), 0 1.5px 4px #d2e3f8",
      }}
    >
      {/* Toolbar ordinamento */}
      <div className="flex items-center justify-end gap-3 px-2 sm:px-4 py-2">
        <div className="hidden sm:block text-sm font-semibold text-slate-600">Ordina per:</div>

        <div className="flex items-center gap-1 bg-white/70 rounded-2xl p-1 shadow-sm border">
          <button
            type="button"
            onClick={() => setSort(sortMode === "sku_asc" ? "sku_desc" : "sku_asc")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm font-semibold transition
              ${sortMode.startsWith("sku") ? "bg-indigo-600 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}
            title="Ordina per SKU (toggle ↑/↓)"
            aria-label="Ordina per SKU"
          >
            {sortMode === "sku_desc" ? <ArrowDownAZ size={16} /> : <ArrowUpAZ size={16} />}
            <span>SKU</span>
          </button>

          <button
            type="button"
            onClick={() => setSort(sortMode === "qty_asc" ? "qty_desc" : "qty_asc")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm font-semibold transition
              ${sortMode.startsWith("qty") ? "bg-emerald-600 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}
            title="Ordina per Da produrre (toggle ↑/↓)"
            aria-label="Ordina per Da produrre"
          >
            {sortMode === "qty_desc" ? <ArrowDown01 size={16} /> : <ArrowUp01 size={16} />}
            <span>Da produrre</span>
          </button>

          <button
            type="button"
            onClick={() => setSort("none")}
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-2xl text-sm font-medium transition
              ${sortMode === "none" ? "bg-slate-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}
            title="Ripristina ordine originale"
            aria-label="Ripristina ordine"
          >
            <RotateCcw size={16} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      <table className="w-full min-w-[1300px] text-[16px] sm:text-[18px]">
        <thead className="bg-white/70 backdrop-blur sticky top-0 z-10">
          <tr className="border-b border-gray-200 text-slate-700 whitespace-nowrap">
            {/* Seleziona tutto */}
            <th className="px-3 py-2 text-left w-[44px]">
              <input
                type="checkbox"
                checked={selectAllChecked}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
                aria-label={selectAllChecked ? "Deseleziona tutti" : "Seleziona tutti"}
              />
            </th>

            {/* SKU */}
            <th className="px-3 py-2 text-left w-52 md:w-64 lg:w-[14rem]">SKU</th>

            {/* Data */}
            <th className="px-3 py-2 text-center w-28 md:w-32">Data</th>

            {/* Canale */}
            <th className="px-3 py-2 text-center w-24 md:w-28">Canale</th>

            {/* Qty */}
            <th className="px-3 py-2 text-center w-14 md:w-20">Qty</th>

            {/* Inseriti / etichetta stato corrente */}
            <th className="px-3 py-2 text-center">
              {headLabel}
              {sortHint && (
                <span className="ml-2 inline-block text-xs font-semibold text-slate-500">
                  • {sortHint}
                </span>
              )}
            </th>

            {/* Stato */}
            <th className="px-3 py-2 text-center min-w-[160px]">Stato</th>

            {/* Nota */}
            <th className="px-3 py-2 text-center w-[110px]">Nota</th>

            {/* Cavallotti */}
            <th className="px-3 py-2 text-center w-[120px]">Cavallotti</th>

            {/* EAN */}
            <th className="px-3 py-2 text-left w-[18ch] md:w-[22ch]">EAN</th>

            {/* Azioni */}
            <th className="px-3 py-2 text-center w-[100px]">Azioni</th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((r, idx) => (
            <ProduzioneRowView
              key={r.id}
              row={r}
              allRows={allRows}
              flowTotalsMap={flowTotalsMap}
              // confini di gruppo calcolati qui → comparator molto più semplice
              isGroupStart={idx === 0 || !sameSku(sortedRows[idx - 1]?.sku, r.sku)}
              isGroupEnd={
                idx === sortedRows.length - 1 || !sameSku(sortedRows[idx + 1]?.sku, r.sku)
              }
              selected={selectedIds.includes(r.id)}
              onSelect={(on) => onToggleSelect(r.id, on)}
              onInlineChangeDaStampare={onInlineChangeDaStampare}
              onOpenLogs={onOpenLogs}
              onToggleCavallotti={onToggleCavallotti}
              onOpenCavallottoPdf={onOpenCavallottoPdf}
              onOpenNota={onOpenNota}
              onOpenDaProdurre={onOpenDaProdurre}
              onOpenChangeState={onOpenChangeState}
            />
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="text-center text-gray-400 py-6 text-lg">
                Nessun articolo in produzione trovato.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ProduzioneTable;
