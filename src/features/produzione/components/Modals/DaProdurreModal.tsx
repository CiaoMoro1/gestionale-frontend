type Props = {
  open: boolean;
  qtyPrelievo: number;
  plus: number;
  value: number;
  statoCorrente: string;
  requirePassword: boolean;
  password: string;
  setValue: (v: number) => void;
  setPassword: (v: string) => void;
  error?: string;
  loading?: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
};

export default function DaProdurreModal({
  open, qtyPrelievo, plus, value, statoCorrente,
  requirePassword, password, setValue, setPassword,
  error, loading, onClose, onSave
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white/90 rounded-2xl p-6 shadow-xl border max-w-xs w-full relative" role="dialog" aria-modal>
        <button
          className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ×
        </button>
        <div className="mb-2 text-xl font-bold text-blue-900">Modifica quantità</div>
        <div className="text-xs text-gray-500 mb-4">
          Quantità richiesta dal prelievo: <b>{qtyPrelievo}</b>
          {plus > 0 && <span className="ml-2 text-cyan-800 font-semibold">+ {plus} da plus</span>}
          <div className="mt-1 text-[11px] text-gray-500">Stato attuale: <b>{statoCorrente}</b></div>
        </div>
        <div className="mb-3">
          <label className="block text-xs mb-1 font-semibold">Nuovo valore</label>
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              setValue(Number.isFinite(n) ? Math.max(0, n) : 0);
            }}
            className="input input-bordered w-full px-3 py-2 rounded-xl text-lg font-bold text-blue-800"
            autoFocus
          />
        </div>
        {requirePassword && (
          <div className="mb-3">
            <label className="block text-xs mb-1 font-semibold">Password autorizzazione</label>
            <input
              type="password"
              className="input input-bordered w-full px-3 py-2 rounded-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        {error && <div className="text-red-600 mb-2 text-sm">{error}</div>}
        <div className="flex gap-2 mt-4 justify-between">
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300" onClick={onClose}>
            Annulla
          </button>
          <button
            className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-800 disabled:opacity-60"
            onClick={onSave}
            disabled={loading || (requirePassword && password.trim().length === 0)}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
