import { ShipmentStatus, PeriodFilter, STATUS_LABELS } from "./types";

type Props = {
  search: string;
  statusFilter: ShipmentStatus | "ALL";
  carrierFilter: string | "ALL";
  channelFilter: string | "ALL";
  period: PeriodFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ShipmentStatus | "ALL") => void;
  onCarrierChange: (value: string | "ALL") => void;
  onChannelChange: (value: string | "ALL") => void;
  onPeriodChange: (value: PeriodFilter) => void;
};

export function TrackingFilters({
  search,
  statusFilter,
  carrierFilter,
  channelFilter,
  period,
  onSearchChange,
  onStatusChange,
  onCarrierChange,
  onChannelChange,
  onPeriodChange,
}: Props) {
  const hasAny =
    !!search.trim() ||
    statusFilter !== "ALL" ||
    carrierFilter !== "ALL" ||
    channelFilter !== "ALL" ||
    period !== "all";

  const input =
    "w-full rounded-2xl bg-white border border-slate-200/70 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        <Field label="Ricerca">
          <div className="relative">
            <input
              className={input}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ordine, tracking, cliente…"
            />
            {search.trim() && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                onClick={() => onSearchChange("")}
                title="Svuota"
              >
                ✕
              </button>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Periodo">
            <select
              className={input}
              value={period}
              onChange={(e) => onPeriodChange(e.target.value as PeriodFilter)}
            >
              <option value="7d">Ultimi 7 giorni</option>
              <option value="30d">Ultimi 30 giorni</option>
              <option value="all">Tutto</option>
            </select>
          </Field>

          <Field label="Stato">
            <select
              className={input}
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as ShipmentStatus | "ALL")}
            >
              <option value="ALL">Tutti</option>
              <option value="PENDING">Trasmesso a BRT</option>
              <option value="IN_TRANSIT">In transito</option>
              <option value="OUT_FOR_DELIVERY">In consegna</option>
              <option value="DELIVERED">Consegnato</option>
              <option value="FAILED_ATTEMPT">Consegna fallita</option>
              <option value="ON_HOLD">Giacenza / problemi</option>
              <option value="RETURNING">In rientro</option>
              <option value="RETURNED">Rientrato</option>
              <option value="LOST_DAMAGED">Smarrimento / danno</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Corriere">
            <select
              className={input}
              value={carrierFilter}
              onChange={(e) => onCarrierChange(e.target.value as string | "ALL")}
            >
              <option value="ALL">Tutti</option>
              <option value="BRT">BRT</option>
              <option value="GLS">GLS</option>
              <option value="AMZL">Amazon Logistics</option>
            </select>
          </Field>

          <Field label="Canale">
            <select
              className={input}
              value={channelFilter}
              onChange={(e) => onChannelChange(e.target.value as string | "ALL")}
            >
              <option value="ALL">Tutti</option>
              <option value="SITO">Sito</option>
              <option value="AMAZON_SELLER">Amazon Seller</option>
            </select>
          </Field>
        </div>

        {hasAny && (
          <>
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-500">Filtri attivi</div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 shadow-sm"
                onClick={() => {
                  onSearchChange("");
                  onStatusChange("ALL");
                  onCarrierChange("ALL");
                  onChannelChange("ALL");
                  onPeriodChange("all");
                }}
              >
                Pulisci tutto
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {search.trim() && (
                <ActiveChip label={`Ricerca: ${search.trim()}`} onClear={() => onSearchChange("")} />
              )}
              {statusFilter !== "ALL" && (
                <ActiveChip
                  label={`Stato: ${STATUS_LABELS[statusFilter] ?? statusFilter}`}
                  onClear={() => onStatusChange("ALL")}
                />
              )}
              {carrierFilter !== "ALL" && (
                <ActiveChip label={`Corriere: ${carrierFilter}`} onClear={() => onCarrierChange("ALL")} />
              )}
              {channelFilter !== "ALL" && (
                <ActiveChip label={`Canale: ${channelFilter}`} onClear={() => onChannelChange("ALL")} />
              )}
              {period !== "all" && (
                <ActiveChip
                  label={period === "7d" ? "Periodo: 7 giorni" : "Periodo: 30 giorni"}
                  onClear={() => onPeriodChange("all")}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-200 bg-sky-50 text-[11px] text-sky-900 hover:bg-sky-100"
      onClick={onClear}
      title="Rimuovi"
    >
      <span>{label}</span>
      <span className="text-sky-700">✕</span>
    </button>
  );
}
