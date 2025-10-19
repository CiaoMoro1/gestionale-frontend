import type { ProduzioneRow } from "@/features/produzione";

type Props = {
  open: boolean;
  selectedRows: ProduzioneRow[];
  onClose: () => void;
  onExport: (orderBy: "az" | "misura") => Promise<void>;
};

export default function ExportMassivoModal({ open, selectedRows, onClose, onExport }: Props) {
  if (!open) return null;

  const count = selectedRows.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center relative" role="dialog" aria-modal>
        <button
          className="absolute top-2 right-3 text-2xl text-gray-300 hover:text-black"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ×
        </button>
        <div className="mb-4 font-bold text-lg text-blue-800">Esporta selezione PDF</div>
        <div className="mb-2 text-sm text-gray-600">{count} righe selezionate</div>
        <div className="mb-4">Scegli ordinamento</div>
        <div className="flex flex-col gap-2 mb-3">
          <button
            className="bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-800 font-semibold py-2 rounded-xl"
            onClick={async () => { await onExport("az"); onClose(); }}
          >
            Ordina per SKU (A-Z)
          </button>
          <button
            className="bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-800 font-semibold py-2 rounded-xl"
            onClick={async () => { await onExport("misura"); onClose(); }}
          >
            Ordina per misura finale (es. 2P, 3P, …)
          </button>
        </div>
      </div>
    </div>
  );
}
