import { useNavigate } from "react-router-dom";
import {
  ShipmentRow,
  ShipmentStatus,
  STATUS_LABELS,
  normalizeCodAmount,
  deriveProblemLabel,
  formatDate,
} from "./types";

type Props = {
  rows: ShipmentRow[];
  loading: boolean;
  error: string | null;
  selectedShipmentId: string | null;
  page: number;
  totalPages: number | null;
  onPageChange: (page: number) => void;
  onRowClick: (row: ShipmentRow) => void;
};

function formatChannel(ch?: string | null) {
  const v = (ch || "").toUpperCase();
  if (v === "SITO") return "Sito";
  if (v === "AMAZON_SELLER") return "Amazon Seller";
  return ch || "—";
}


export function TrackingTable({
  rows,
  loading,
  error,
  selectedShipmentId,
  page,
  totalPages,
  onPageChange,
  onRowClick,
}: Props) {
  const navigate = useNavigate();

  const rowTone = (s: ShipmentRow) => {
    // priorità: problemi > consegnato > in corso > attesa
    if (s.has_problem || s.internal_status === "ON_HOLD" || s.internal_status === "FAILED_ATTEMPT" || s.internal_status === "LOST_DAMAGED") {
      return {
        row: "bg-rose-50 hover:bg-rose-100/60",
        left: "border-l-4 border-rose-300",
      };
    }

    if (s.internal_status === "DELIVERED") {
      return {
        row: "bg-emerald-50 hover:bg-emerald-100/60",
        left: "border-l-4 border-emerald-300",
      };
    }

    if (s.internal_status === "IN_TRANSIT" || s.internal_status === "OUT_FOR_DELIVERY") {
      return {
        row: "bg-amber-50 hover:bg-amber-100/60",
        left: "border-l-4 border-amber-300",
      };
    }

    // default "attesa / pending"
    return {
      row: "bg-slate-50 hover:bg-slate-100/70",
      left: "border-l-4 border-slate-300",
    };
  };



  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold tracking-wide uppercase text-slate-600">
            Spedizioni
          </div>
          <div className="text-[11px] text-slate-500">
            Pagina {page + 1}
            {totalPages ? ` / ${totalPages}` : ""}
          </div>
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 py-2 text-sm text-rose-700 bg-rose-50 border-b border-rose-100">
          {error}
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden flex-1 min-h-0 overflow-auto p-3 space-y-2">
        {loading && rows.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-8">Caricamento…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-8">Nessuna spedizione trovata.</div>
        )}

        {rows.map((s) => {
          const selected = selectedShipmentId === s.shipment_id;
          const problem = deriveProblemLabel(s.internal_status, s.raw_status_text);
          const tone = rowTone(s);

          const brtId = s.brt_shipment_id ?? "";
          const canOpenBrt = s.carrier === "BRT" && !!brtId;

          return (
            <button
              key={s.shipment_id}
              type="button"
              onClick={() => onRowClick(s)}
              className={`w-full text-left rounded-2xl border p-3 transition border-slate-200 ${
                selected ? "border-sky-300 bg-sky-50" : tone.row
              } ${tone.left}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {s.order_number || s.order_id}
                  </div>
                    <div className="text-[11px] text-slate-500">
                      {formatChannel(s.channel)}
                    </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {s.customer_name || "—"} • {s.shipping_city || "—"}
                  </div>
                </div>
                <StatusBadge status={s.internal_status} late={s.is_late} />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-slate-700">
                  <span className="font-mono">{s.tracking_number}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Spedito: {formatDate((s.label_created_at ?? s.shipped_at) || "")}
                </div>
              </div>

              {(s.is_late || s.has_problem || problem) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.is_late && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] border border-rose-200 bg-rose-50 text-rose-700">
                      Ritardo
                    </span>
                  )}
                  {s.has_problem && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] border border-amber-200 bg-amber-50 text-amber-800">
                      Attenzione
                    </span>
                  )}
                  {problem && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 bg-slate-50 text-slate-700">
                      {problem}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/ordini/${s.order_id}`);
                  }}
                >
                  Apri ordine
                </button>

                <button
                  type="button"
                  disabled={!canOpenBrt}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 disabled:opacity-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canOpenBrt) return;
                    const url =
                      "https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.htm&Nspediz=" +
                      encodeURIComponent(brtId);
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  Tracking BRT
                </button>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200/70">
            <tr>
              <Th>Ordine</Th>
              <Th>Canale</Th>
              <Th>Tracking</Th>
              <Th className="hidden lg:table-cell">Cliente</Th>
              <Th className="hidden lg:table-cell">Località</Th>
              <Th className="hidden xl:table-cell">Data ordine</Th>
              <Th>Spedito</Th>
              <Th>Stato</Th>
              <Th className="hidden xl:table-cell text-right">COD</Th>
              <Th className="hidden lg:table-cell">Alert</Th>
            </tr>
          </thead>

          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                  Caricamento…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                  Nessuna spedizione trovata.
                </td>
              </tr>
            )}

            {rows.map((s) => {
              const selected = selectedShipmentId === s.shipment_id;
              const problem = deriveProblemLabel(s.internal_status, s.raw_status_text);
              const tone = rowTone(s);


              const brtId = s.brt_shipment_id ?? "";
              const canOpenBrt = s.carrier === "BRT" && !!brtId;

              return (
                <tr
                  key={s.shipment_id}
                  onClick={() => onRowClick(s)}
                  className={`border-b border-slate-100 transition ${
                    selected ? "bg-sky-50" : tone.row
                  } ${tone.left}`}
                  style={{ cursor: "pointer" }}
                >
                  <Td>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="text-left text-sky-700 hover:underline font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/ordini/${s.order_id}`);
                        }}
                      >
                        {s.order_number || s.order_id}
                      </button>
                    </div>
                  </Td>
<Td>
  <div className="text-xs font-semibold text-slate-900">
    {formatChannel(s.channel)}
  </div>
</Td>
                  <Td>
                    {canOpenBrt ? (
                      <button
                        type="button"
                        className="text-xs font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url =
                            "https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.htm&Nspediz=" +
                            encodeURIComponent(brtId);
                          window.open(url, "_blank", "noopener,noreferrer");
                        }}
                        title={`Apri tracking BRT: ${brtId}`}
                      >
                        {s.tracking_number}
                      </button>
                    ) : (
                      <span className="text-xs font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {s.tracking_number}
                      </span>
                    )}
                  </Td>

                  <Td className="hidden lg:table-cell">{s.customer_name}</Td>

                  <Td className="hidden lg:table-cell">
                    {s.shipping_city}
                    {s.shipping_province ? ` (${s.shipping_province})` : ""}
                  </Td>

                  <Td className="hidden xl:table-cell">
                    {formatDate(s.order_created_at || "")}
                  </Td>

                  <Td>{formatDate((s.label_created_at ?? s.shipped_at) || "")}</Td>

                  <Td>
                    <StatusBadge status={s.internal_status} late={s.is_late} />
                  </Td>

                  <Td className="hidden xl:table-cell text-right">
                    {normalizeCodAmount(s.cod_amount)}
                  </Td>

                  <Td className="hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                      {problem && <span className="text-[11px] text-rose-700">{problem}</span>}
                      {s.is_late && <span className="text-[11px] text-rose-700">Ritardo</span>}
                      {s.has_problem && <span className="text-[11px] text-amber-700">Attenzione</span>}
                      {!problem && !s.is_late && !s.has_problem && (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-200/70 bg-white/80 backdrop-blur flex items-center gap-3">
        <button
          className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
          disabled={page === 0 || loading}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          &lt; Precedente
        </button>

        <span className="text-xs text-slate-600">
          Pagina {page + 1}
          {totalPages ? ` / ${totalPages}` : ""}
        </span>

        <button
          className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
          disabled={loading || (totalPages !== null && page + 1 >= totalPages)}
          onClick={() => onPageChange(page + 1)}
        >
          Successiva &gt;
        </button>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`text-left px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-slate-600 ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top text-xs text-slate-800 ${className}`}>{children}</td>;
}

function StatusBadge({ status, late }: { status: ShipmentStatus; late: boolean }) {
  const label = STATUS_LABELS[status] ?? status;

  let cls = "border-slate-200 bg-slate-50 text-slate-700";
  if (status === "DELIVERED") cls = "border-emerald-200 bg-emerald-50 text-emerald-800";
  else if (status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY")
    cls = "border-sky-200 bg-sky-50 text-sky-800";
  else if (status === "ON_HOLD" || status === "FAILED_ATTEMPT")
    cls = "border-amber-200 bg-amber-50 text-amber-800";
  else if (status === "LOST_DAMAGED")
    cls = "border-rose-200 bg-rose-50 text-rose-700";

  if (late) cls = "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
