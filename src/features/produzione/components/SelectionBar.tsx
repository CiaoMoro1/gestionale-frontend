/* src/features/produzione/components/SelectionBar.tsx */
import React, { useRef } from "react";
import type { StatoProduzione } from "@/features/produzione";
import { STATE_STYLES } from "@/features/produzione";
import { Trash2, Upload, FileText, X, ChevronLeft, ChevronRight } from "lucide-react";

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
  /** stato corrente (opzionale): quello non selezionabile */
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

  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollByX = (dx: number) => scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

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
      {/* Testata */}
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

      {/* Stati: scorrimento semplice con frecce, niente scrollbar visibile */}
      <div className="relative">
        <button
          type="button"
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white/90 border shadow hover:bg-slate-50"
          onClick={() => scrollByX(-240)}
          aria-label="Scorri a sinistra"
          title="Scorri a sinistra"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={scrollerRef}
          className="w-full min-w-0 overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: "none" as const }}
        >
          <div className="flex items-center gap-2 pr-1 whitespace-nowrap">
            {states.map((st) => {
              const isCurrent = !!currentState && st === currentState;
              return (
                <button
                  key={st}
                  type="button"
                  className={`
                    shrink-0
                    px-2.5 py-1.5
                    rounded-xl font-bold text-xs sm:text-sm
                    border shadow transition
                    focus:outline-none focus:ring-2 focus:ring-cyan-300
                    ${isCurrent ? "opacity-60 cursor-not-allowed" : "hover:brightness-105"}
                  `}
                  style={stateButtonStyle(st)}
                  onClick={() => !isCurrent && !disabled && onBulkSetState(st)}
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
                >
                  Segna come {stateLabels[st]}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white/90 border shadow hover:bg-slate-50"
          onClick={() => scrollByX(240)}
          aria-label="Scorri a destra"
          title="Scorri a destra"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
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

      {/* nasconde le scrollbar webkit della riga stati */}
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none;}`}</style>
    </div>
  );
}
