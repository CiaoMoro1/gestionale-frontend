type Props = {
  open: boolean;
  sku: string | null;
  onClose: () => void;
  onOpenPdf: (sku: string, formato: string) => void;
  loading?: boolean;
};

export default function CavallottoModal({ open, sku, onClose, onOpenPdf, loading }: Props) {
  if (!open || !sku) return null;

  const formati: Array<"A5" | "A4" | "A3"> = ["A5", "A4", "A3"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center relative" role="dialog" aria-modal>
        <button
          className="absolute top-2 right-3 text-2xl text-gray-300 hover:text-black"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ×
        </button>
        <div className="mb-4 font-bold text-lg text-blue-800">Stampa Cavallotto</div>
        <div className="mb-4">Scegli il formato</div>
        <div className="flex flex-col gap-2 mb-3">
          {formati.map((formato) => (
            <button
              key={formato}
              className="bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-800 font-semibold py-2 rounded-xl disabled:opacity-60"
              onClick={() => onOpenPdf(sku, formato)}
              disabled={loading}
            >
              {formato}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
