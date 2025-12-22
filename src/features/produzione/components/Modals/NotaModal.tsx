// src/features/produzione/components/Modals/NotaModal.tsx
import { useEffect } from "react";

export type AllocationCard = {
  sku: string;
  order_id: string | null;
  order_number: string | null;
  qty: number;
  // opzionale ma utile per mostrare nome + cognome
  customer_name?: string | null;
};

type NotaModalProps = {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  // nuove props:
  allocations?: AllocationCard[];
  skuLabel?: string | null;
  // callback per aprire il dettaglio ordine
  onOpenOrder?: (orderId: string) => void;
};

export default function NotaModal({
  open,
  value,
  onChange,
  onClose,
  onSave,
  allocations = [],
  skuLabel,
  onOpenOrder,
}: NotaModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const clickable = (alloc: AllocationCard) =>
    Boolean(alloc.order_id && onOpenOrder);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div
        className="bg-white w-full max-w-lg mx-3 rounded-2xl shadow-2xl p-5 sm:p-6 relative"
        role="dialog"
        aria-modal="true"
        aria-label="Nota e ordini collegati"
      >
        {/* Chiudi */}
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ×
        </button>

        {/* Header */}
        <div className="flex flex-col gap-1 mb-3">
          <div className="text-sm font-semibold text-gray-900 flex items-center justify-between">
            <span>Nota produzione</span>
            {skuLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                <span className="uppercase tracking-wide">SKU</span>
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded-full text-[11px]">
                  {skuLabel}
                </span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray  -500">
            Usa la nota per informazioni interne (es. motivi, anomalie, indicazioni per la produzione).
          </p>
        </div>

        {/* Campo nota */}
        <div className="space-y-1 mb-4">
          <label className="block text-xs font-medium text-gray-600">
            Nota interna
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y min-h-[80px] max-h-64"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              onChange(e.target.value)
            }
            placeholder="Scrivi qui la nota per questo lotto di produzione..."
          />
        </div>

        {/* Ordini collegati */}
        <div className="border-t border-gray-100 pt-3 mt-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Ordini collegati
              {allocations.length > 0 && (
                <span className="ml-2 text-[11px] text-gray-500">
                  ({allocations.length})
                </span>
              )}
            </div>
            {allocations.length === 0 && (
              <span className="text-[11px] text-gray-400">
                Nessun ordine collegato a questo lotto
              </span>
            )}
          </div>

          {allocations.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto pr-1">
              {allocations.map((alloc, idx) => {
                const isClickable = clickable(alloc);
                const key = alloc.order_id ?? `alloc-${idx}`;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      isClickable && alloc.order_id && onOpenOrder?.(alloc.order_id)
                    }
                    className={[
                      "w-full text-left rounded-lg border px-3 py-2 transition-all",
                      "flex flex-col gap-1",
                      isClickable
                        ? "border-indigo-200 hover:border-indigo-400 hover:shadow-sm cursor-pointer bg-indigo-50/40"
                        : "border-gray-200 bg-gray-50 cursor-default opacity-80",
                    ].join(" ")}
                  >
                    {/* Riga ordine + cliente */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-mono text-gray-600">
                          {alloc.order_number || "Ordine senza numero"}
                        </span>
                        <span className="text-xs font-semibold text-gray-900 truncate max-w-[140px]">
                          {alloc.customer_name || "Cliente sconosciuto"}
                        </span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        Q.tà{" "}
                        <span className="font-semibold">{alloc.qty}</span>
                      </span>
                    </div>

                    {/* Info extra */}
                    <div className="text-[11px] text-gray-500 flex justify-between">
                      <span className="truncate">
                        ID:{" "}
                        <span className="font-mono">
                          {alloc.order_id
                            ? alloc.order_id.slice(0, 8) + "…"
                            : "—"}
                        </span>
                      </span>
                      {isClickable ? (
                        <span className="text-indigo-600 font-medium">
                          Apri &rarr;
                        </span>
                      ) : (
                        <span className="text-gray-400">Ordine non disponibile</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer pulsanti */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-1.5 text-xs sm:text-sm rounded-full bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-sm"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
