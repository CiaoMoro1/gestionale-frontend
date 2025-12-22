import { TrackingSummary, QuickFilter, StatusGroupFilter } from "./types";

type Props = {
  summary: TrackingSummary | null;
  loading: boolean;

  quickFilter: QuickFilter;
  onQuickFilterChange: (filter: QuickFilter) => void;

  statusGroup: StatusGroupFilter;
  onStatusGroupChange: (group: StatusGroupFilter) => void;
};

export function TrackingSummaryBar({
  summary,
  loading,
  quickFilter,
  onQuickFilterChange,
  statusGroup,
  onStatusGroupChange,
}: Props) {
  // KPI (non renderizzati qui, ma teniamo i dati perché possono servire altrove)
  const attenzione = summary?.attenzione ?? 0;
  const inRitardo = summary?.in_ritardo ?? 0;
  const contrassegno = summary?.contrassegno ?? 0;

  const pending = summary?.pending ?? 0;
  const inCorso = (summary?.in_transit ?? 0) + (summary?.out_for_delivery ?? 0);
  const consegnate = summary?.delivered ?? 0;
  const problemi =
    (summary?.on_hold ?? 0) +
    (summary?.failed_attempt ?? 0) +
    (summary?.returning ?? 0) +
    (summary?.returned ?? 0) +
    (summary?.lost_damaged ?? 0);

  const total = pending + inCorso + consegnate + problemi;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // lasciamo le funzioni (utile se un domani rimetti KPI), ma non le usiamo nell'UI
  const _toggleQuick = (q: QuickFilter) => onQuickFilterChange(quickFilter === q ? "none" : q);
  void attenzione; void inRitardo; void contrassegno; void _toggleQuick;

  const toggleGroup = (g: StatusGroupFilter) =>
    onStatusGroupChange(statusGroup === g ? "ALL" : g);

  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
        Overview
      </div>

      {/* Stato spedizioni con % + barra */}
      <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm p-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
            Stato spedizioni
          </div>
          <div className="text-[11px] text-slate-400">
            {loading ? "…" : `${total} totali`}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <DistRow
            label="Attesa"
            value={pending}
            pct={pct(pending)}
            active={statusGroup === "PENDING_ONLY"}
            onClick={() => toggleGroup("PENDING_ONLY")}
            accent="neutral"
          />
          <DistRow
            label="In corso"
            value={inCorso}
            pct={pct(inCorso)}
            active={statusGroup === "IN_PROGRESS"}
            onClick={() => toggleGroup("IN_PROGRESS")}
            accent="info"
          />
          <DistRow
            label="Consegnate"
            value={consegnate}
            pct={pct(consegnate)}
            active={statusGroup === "DELIVERED"}
            onClick={() => toggleGroup("DELIVERED")}
            accent="good"
          />
          <DistRow
            label="Con problemi"
            value={problemi}
            pct={pct(problemi)}
            active={statusGroup === "PROBLEM"}
            onClick={() => toggleGroup("PROBLEM")}
            accent="bad"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Giacenza" active={statusGroup === "ON_HOLD_ONLY"} onClick={() => toggleGroup("ON_HOLD_ONLY")} />
          <Chip label="Fallita" active={statusGroup === "FAILED_ONLY"} onClick={() => toggleGroup("FAILED_ONLY")} />
          <Chip label="Rientro" active={statusGroup === "RETURNING_ONLY"} onClick={() => toggleGroup("RETURNING_ONLY")} />
          <Chip label="Rientrato" active={statusGroup === "RETURNED_ONLY"} onClick={() => toggleGroup("RETURNED_ONLY")} />
          <Chip label="Smarr/Danno" active={statusGroup === "LOST_DAMAGED_ONLY"} onClick={() => toggleGroup("LOST_DAMAGED_ONLY")} />
        </div>
      </div>
    </div>
  );
}

function DistRow({
  label,
  value,
  pct,
  active,
  onClick,
  accent,
}: {
  label: string;
  value: number;
  pct: number;
  active: boolean;
  onClick: () => void;
  accent: "neutral" | "info" | "good" | "bad";
}) {
  const bar =
    accent === "good"
      ? "bg-emerald-400"
      : accent === "bad"
        ? "bg-rose-400"
        : accent === "info"
          ? "bg-sky-400"
          : "bg-slate-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
        active ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-800">{label}</div>
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-900">{value}</span>{" "}
          <span className="text-slate-400">({pct}%)</span>
        </div>
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`px-3 py-1.5 rounded-full text-[11px] border transition ${
        active
          ? "border-sky-200 bg-sky-50 text-sky-900"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
