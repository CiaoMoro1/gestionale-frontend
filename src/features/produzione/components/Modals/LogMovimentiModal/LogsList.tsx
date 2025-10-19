import { delta } from "@/features/produzione";
import type { LogMovimento } from "@/features/produzione";

function movedPieces(l: LogMovimento): number | null {
  const a = typeof l.qty_vecchia === "number" ? l.qty_vecchia : null;
  const b = typeof l.qty_nuova === "number" ? l.qty_nuova : null;
  if (a === null || b === null) return null;
  return a - b;
}

export default function LogsList({ logs }: { logs: LogMovimento[] }) {
  return (
    <div className="grid gap-2 max-h-[32vh] overflow-y-auto pr-1">
      {logs.map((log, i) => {
        const when = log.created_at ? new Date(log.created_at) : null;
        const dataStr = when ? when.toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "—";
        const qta = delta(log.qty_vecchia, log.qty_nuova, "pezzi");
        const pls = delta(log.plus_vecchio, log.plus_nuovo, "plus");
        const motivo = (log.motivo ?? "").toLowerCase();
        const isSpost = motivo.startsWith("spostamento a");
        const moved = movedPieces(log);
        const tag =
          isSpost && moved !== null && moved !== 0
            ? moved > 0
              ? `${moved} spostati`
              : `${-moved} rientrati`
            : null;

        return (
          <div key={`${log.id ?? ""}-${i}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 min-w-[170px] inline-block">{dataStr}</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  isSpost ? "bg-sky-50 text-sky-800 border-sky-200" : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                {log.motivo}
              </span>
              {(log.canale ?? log.canale_label) && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {log.canale ?? log.canale_label}
                </span>
              )}
              {tag && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {tag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-600">
                Stato: <b>{log.stato_vecchio || "—"}</b> → <b>{log.stato_nuovo || "—"}</b>
              </span>
              <span className="text-xs text-slate-600">Qty: <b>{qta}</b></span>
              <span className="text-xs text-slate-600">Plus: <b>{pls}</b></span>
              <span className="text-xs text-slate-500">Utente: <b>{log.utente || "Sistema"}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
