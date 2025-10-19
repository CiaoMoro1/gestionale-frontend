import FlowMap from "./FlowMap";
import LogsList from "./LogsList";
import type { FlowGraph, LogMovimento, ProduzioneRow } from "@/features/produzione";

type Props = {
  open: boolean;
  sku?: string;
  ean?: string | null;
  start_delivery?: string | null;
  canale?: string | null;
  canaliDisponibili?: string[];
  selectedCanale?: string | null;
  setSelectedCanale: (c: string | null) => void;
  data: LogMovimento[];
  graph: FlowGraph | null;
  allRows: ProduzioneRow[];
  onClose: () => void;
};

export default function LogMovimentiModal({
  open, sku, canale, canaliDisponibili, selectedCanale, setSelectedCanale,
  data, graph, allRows, onClose
}: Props) {
  if (!open) return null;

  const channels = Array.isArray(canaliDisponibili) ? canaliDisponibili : [];
  const active = selectedCanale ?? canale ?? (channels[0] ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-[1400px] relative p-0 overflow-hidden" role="dialog" aria-modal>
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-br from-slate-50 to-white flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xl font-extrabold text-slate-900 tracking-tight">
            Flusso movimenti · <span className="font-mono font-black">{sku || "—"}</span>
          </div>

          {channels.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Canale:</span>
              <div className="flex gap-1 flex-wrap">
                {channels.map((c) => {
                  const isActive = c === (active ?? c);
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedCanale(c)}
                      className={`px-3 py-1 rounded-full border text-xs font-bold shadow-sm ${
                        isActive ? "bg-cyan-600 border-cyan-700 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            className="text-2xl text-slate-400 hover:text-slate-700"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        {/* Flow map */}
        <div className="px-6 py-5 bg-slate-50/60">
          {graph && graph.edges.length > 0 ? (
            <FlowMap graph={graph} sku={sku} selectedCanale={active} allRows={allRows} />
          ) : (
            <div className="text-center text-slate-500 py-10">Nessun movimento registrato.</div>
          )}
        </div>

        {/* Lista log */}
        <div className="px-6 pb-5">
          <div className="text-sm font-semibold text-slate-700 mb-2">Dettaglio eventi (compresso)</div>
          <LogsList logs={data} />
        </div>
      </div>
    </div>
  );
}
