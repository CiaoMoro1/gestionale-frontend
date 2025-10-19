import { useEffect } from "react";

type Props = {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  loading?: boolean;
};

export default function NotaModal({ open, value, onChange, onClose, onSave, loading }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xs relative" role="dialog" aria-modal>
        <button
          className="absolute top-2 right-2 text-2xl text-gray-400 hover:text-black"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ×
        </button>
        <div className="font-bold text-lg mb-3">Nota produzione</div>
        <textarea
          className="w-full border rounded-xl p-2 mb-3"
          rows={4}
          placeholder="Scrivi una nota..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300" onClick={onClose}>
            Annulla
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-800 disabled:opacity-60"
            onClick={onSave}
            disabled={loading}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
