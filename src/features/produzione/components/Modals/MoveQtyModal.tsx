import React, { useMemo } from "react";
import type { ProduzioneRow, StatoProduzione } from "@/features/produzione";
import { STATE_STYLES, STATI_PRODUZIONE } from "@/features/produzione";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { badgeCanale } from "@/features/produzione";

type Props = {
  open: boolean;
  row: ProduzioneRow | null;
  toState: StatoProduzione;
  setToState: (s: StatoProduzione) => void;
  qty: number;
  setQty: (n: number) => void;
  onClose: () => void;
  onMove: (row: ProduzioneRow, to: StatoProduzione, qty: number) => Promise<void>;
  statiDisponibili?: StatoProduzione[]; // opzionale
};

export default function MoveQtyModal({
  open,
  row,
  toState,
  setToState,
  qty,
  setQty,
  onClose,
  onMove,
  statiDisponibili = STATI_PRODUZIONE.filter((s) => s !== "Rimossi"),
}: Props) {
  const maxQty = useMemo(() => Math.max(0, row?.da_produrre || 0), [row]);
  const fromState = row?.stato_produzione;

  if (!open || !row) return null;

  // quantità helpers
  const dec = () => setQty(Math.max(0, qty - 1));
  const inc = () => setQty(Math.min(maxQty, qty + 1));
  const zero = () => setQty(0);
  const max = () => setQty(maxQty);

  const selectedSty = STATE_STYLES[toState];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 shadow-2xl border w-full max-w-md animate-fade-in relative">
        <button
          className="absolute top-2 right-3 text-neutral-400 hover:text-black text-2xl"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ×
        </button>

        <div className="font-bold text-lg mb-2 text-blue-900">Sposta quantità</div>

        {/* Header info: SKU • Canale • Da: stato */}
        <div className="text-xs text-gray-600 mb-4 flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-slate-900">{row.sku}</span>
          <span>•</span>
          <span>{badgeCanale(row.canale)}</span>
          <span>•</span>
          <span>
            Da: <b>{fromState}</b>
          </span>
        </div>

        {/* Selettore stato A DESTINAZIONE: griglia bottoni colorati */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-slate-600 mb-1">Sposta a</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {statiDisponibili.map((s) => {
              const sty = STATE_STYLES[s];
              const active = s === toState;
              const isSameAsFrom = s === fromState;
              return (
                <button
                  key={s}
                  type="button"
                  className={[
                    "px-2 py-2 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2",
                    active ? "ring-2 ring-cyan-300" : "",
                    isSameAsFrom ? "opacity-50 cursor-not-allowed line-through" : "hover:brightness-105",
                  ].join(" ")}
                  style={{
                    background: `linear-gradient(135deg, ${sty.fill}, #ffffff)`,
                    borderColor: sty.stroke,
                    color: sty.text,
                  }}
                  onClick={() => !isSameAsFrom && setToState(s)}
                  disabled={isSameAsFrom}
                  title={isSameAsFrom ? "Stato corrente" : `Sposta a ${s}`}
                  aria-pressed={active}
                  aria-label={isSameAsFrom ? `Stato corrente: ${s}` : `Sposta a ${s}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stato selezionato: pill informativa */}
        <div className="mb-4">
          <div className="text-xs text-slate-600 mb-1">Stato selezionato</div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold"
            style={{
              background: `linear-gradient(135deg, ${selectedSty.fill}, #ffffff)`,
              borderColor: selectedSty.stroke,
              color: selectedSty.text,
            }}
            aria-live="polite"
          >
            {toState}
          </div>
        </div>

        {/* Quantità: default = MAX + controlli [-][0][+] + pillola MAX */}
        <div className="mb-2">
          <div className="text-xs font-semibold text-slate-600 mb-1">
            Pezzi da spostare (max {maxQty})
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 rounded-lg border bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              onClick={dec}
              disabled={qty <= 0}
              title="Diminuisci"
              aria-label="Diminuisci"
            >
              <Minus className="w-4 h-4" />
            </button>

            <button
              type="button"
              className="p-2 rounded-lg border bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              onClick={zero}
              disabled={qty === 0}
              title="Imposta a 0"
              aria-label="Imposta a 0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <input
              type="number"
              min={0}
              max={maxQty}
              value={qty}
              onChange={(e) => {
                const v = Number(e.target.value);
                setQty(Number.isFinite(v) ? Math.max(0, Math.min(maxQty, v)) : 0);
              }}
              className="w-24 text-center border rounded-xl px-2 py-2 font-bold text-blue-800"
              aria-label="Quantità"
            />

            <button
              type="button"
              className="p-2 rounded-lg border bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              onClick={inc}
              disabled={qty >= maxQty}
              title="Aumenta"
              aria-label="Aumenta"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              type="button"
              className="px-3 py-1 rounded-full border text-xs bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              onClick={max}
              disabled={qty === maxQty}
              title="Imposta a massimo"
              aria-label="Imposta a massimo"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between mt-4">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
            onClick={onClose}
            type="button"
          >
            Annulla
          </button>
          <button
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow"
            onClick={() => onMove(row, toState, qty)}
            disabled={qty <= 0 || maxQty === 0 || toState === fromState}
            type="button"
          >
            Sposta
          </button>
        </div>
      </div>
    </div>
  );
}
