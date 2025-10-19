/* src/features/produzione/components/SelectionBar.tsx */
import React from "react";
import type { StatoProduzione } from "@/features/produzione";
import { STATE_STYLES } from "@/features/produzione";
import { Trash2, Upload, FileText, X } from "lucide-react";

type Props = {
  count: number;
  states: StatoProduzione[];
  stateLabels: Record<string, string>;
  onClear: () => void;
  onBulkSetState: (stato: StatoProduzione) => void;
  onBulkDelete: () => void;
  onExportPdf: (orderBy: "az" | "misura") => void;
  onBulkCaricaMagazzino: () => void;
  disabled?: boolean;
  /** Stato corrente (quello non selezionabile e barrato). Se vuoto, nessuno disabilitato */
  currentState?: StatoProduzione | "";
};

function stateButtonStyle(st: StatoProduzione) {
  const sty = STATE_STYLES[st];
  return {
    background: `linear-gradient(135deg, ${sty.fill}, #ffffff)`,
    borderColor: sty.stroke,
    color: sty.text,
  } as const;
}

export default function SelectionBar({
  count,
  states,
  stateLabels,
  onClear,
  onBulkSetState,
  onBulkDelete,
  onExportPdf,
  onBulkCaricaMagazzino,
  disabled = false,
  currentState = "",
}: Props) {
  if (count <= 0) return null;

  // suddividi in due righe (bilanciate)
  const mid = Math.ceil(states.length / 2);
  const rowA = states.slice(0, mid);
  const rowB = states.slice(mid);

  const renderRow = (row: StatoProduzione[]) => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {row.map((st) => {
        const isCurrent = !!currentState && st === currentState;
        return (
          <button
            key={st}
            type="button"
            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm border shadow transition
                        focus:outline-none focus:ring-2 focus:ring-cyan-300
                        ${isCurrent ? "opacity-60 cursor-not-allowed line-through pointer-events-none" : "hover:brightness-105"}`}
            style={stateButtonStyle(st)}
            onClick={() => {
              if (!isCurrent && !disabled) onBulkSetState(st);
            }}
            title={
              isCurrent
                ? `Stato corrente: ${stateLabels[st]}`
                : `Segna i selezionati come ${stateLabels[st]}`
            }
            aria-label={
              isCurrent
                ? `Stato corrente: ${stateLabels[st]}`
                : `Segna i selezionati come ${stateLabels[st]}`
            }
            disabled={disabled || isCurrent}
            aria-disabled={disabled || isCurrent}
          >
            Segna come {stateLabels[st]}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="
        sticky top-2 z-40
        w-full max-w-full min-w-0
        bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border
        px-3 sm:px-4 py-2 sm:py-3 mb-4
        flex flex-col gap-2
        overflow-x-hidden
      "
    >
      {/* Testata: conteggio + deselect */}
      <div className="flex items-center justify-between min-w-0">
        <div className="text-base sm:text-lg font-bold text-cyan-800 truncate">
          {count} selezionat{count === 1 ? "o" : "i"}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          onClick={onClear}
          title="Deseleziona tutte le righe"
          aria-label="Deseleziona tutte le righe"
          disabled={disabled}
        >
          <X className="w-4 h-4" />
          Deseleziona
        </button>
      </div>

      {/* Stati: due righe centrate, senza scroll né frecce */}
      <div className="w-full min-w-0">
        {renderRow(rowA)}
        <div className="mt-2">{renderRow(rowB)}</div>
      </div>

      {/* Export a sinistra, Carica/Rimuovi a destra */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm bg-white border text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            onClick={() => onExportPdf("az")}
            title="Esporta selezionati (ordinati per SKU A-Z)"
            aria-label="Esporta selezionati (ordinati per SKU A-Z)"
            disabled={disabled}
          >
            <FileText className="w-4 h-4" />
            Export A-Z
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm bg-white border text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            onClick={() => onExportPdf("misura")}
            title="Esporta selezionati (ordinati per misura finale)"
            aria-label="Esporta selezionati (ordinati per misura finale)"
            disabled={disabled}
          >
            <FileText className="w-4 h-4" />
            Export per misura
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow focus:outline-none focus:ring-2 focus:ring-emerald-300"
            onClick={onBulkCaricaMagazzino}
            title="Carica su magazzino (Supabase) i selezionati"
            aria-label="Carica su magazzino i selezionati"
            disabled={disabled}
          >
            <Upload className="w-4 h-4" />
            Carica a magazzino
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm bg-red-600 text-white hover:bg-red-700 shadow focus:outline-none focus:ring-2 focus:ring-red-300"
            onClick={onBulkDelete}
            title="Rimuovi dalla produzione i selezionati"
            aria-label="Rimuovi dalla produzione i selezionati"
            disabled={disabled}
          >
            <Trash2 className="w-4 h-4" />
            Rimuovi
          </button>
        </div>
      </div>
    </div>
  );
}
