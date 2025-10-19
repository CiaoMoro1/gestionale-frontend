import type { ProduzioneRow, StatoProduzione } from "@/features/produzione";
import { TITOLO_DA_PRODURRE } from "@/features/produzione";
import ProduzioneRowView from "./ProduzioneRowView";

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
  const defaultLabel = TITOLO_DA_PRODURRE[""] || "Inseriti";
  const headLabel = statoLabel ?? defaultLabel;

  return (
    <div
      className="rounded-2xl shadow-xl border bg-white/85 glass morph px-2 sm:px-4 py-2 mb-10 overflow-x-auto"
      style={{
        background:
          "linear-gradient(135deg, rgba(244,245,250,0.87) 60%, rgba(224,241,250,0.85) 100%)",
        boxShadow: "0 8px 32px 0 rgba(31,38,135,.16), 0 1.5px 4px #d2e3f8",
      }}
    >
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

            {/* Canale */}
            <th className="px-3 py-2 text-center w-24 md:w-28">Canale</th>

            {/* Qty */}
            <th className="px-3 py-2 text-center w-14 md:w-20">Qty</th>

            {/* Inseriti / etichetta stato corrente */}
            <th className="px-3 py-2 text-center">{headLabel}</th>

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
          {rows.map((r, idx) => (
            <ProduzioneRowView
              key={r.id}
              row={r}
              allRows={allRows}
              flowTotalsMap={flowTotalsMap}
              // confini di gruppo calcolati qui → comparator molto più semplice
              isGroupStart={idx === 0 || !sameSku(rows[idx - 1]?.sku, r.sku)}
              isGroupEnd={idx === rows.length - 1 || !sameSku(rows[idx + 1]?.sku, r.sku)}
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
