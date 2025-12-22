import { useNavigate } from "react-router-dom";
import {
  ShipmentRow,
  ShipmentEvent,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  deriveProblemLabel,
} from "./types";
import { useEffect } from "react";


type Props = {
  isOpen: boolean;
  onClose: () => void;

  selectedShipment: ShipmentRow | null;
  events: ShipmentEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
};

export function TrackingDetail({
  isOpen,
  onClose,
  selectedShipment,
  events,
  eventsLoading,
  eventsError,
}: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // evita "saltello" layout quando sparisce la scrollbar
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen]);



  const brtId = selectedShipment?.brt_shipment_id ?? "";
  const canOpenBrt = selectedShipment?.carrier === "BRT" && !!brtId;

  const isSeller = (selectedShipment?.channel || "").toUpperCase() === "AMAZON_SELLER";

  const orderPath = selectedShipment?.order_id
    ? (isSeller ? `/seller/ordini/${selectedShipment.order_id}` : `/ordini/${selectedShipment.order_id}`)
    : "/tracking";

  return (
    <div className={`fixed inset-0 z-[60] ${isOpen ? "" : "pointer-events-none"}`}>
      {/* overlay */}
      <div
        className={`absolute inset-0 bg-black/25 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[560px] bg-white/90 backdrop-blur-xl border-l border-slate-200/70 shadow-[0_30px_90px_rgba(15,23,42,0.18)] transition-transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* header (più basso) */}
        <div className="px-4 py-2.5 border-b border-slate-200/70 bg-white/80 backdrop-blur flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
              Dettaglio spedizione
            </div>
            <div className="text-sm font-semibold text-slate-900 truncate">
              {selectedShipment?.order_number || selectedShipment?.order_id || "—"}
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 shadow-sm"
            onClick={onClose}
          >
            Chiudi
          </button>
        </div>

        {!selectedShipment && (
          <div className="p-4 text-sm text-slate-500">
            Seleziona una spedizione dalla tabella.
          </div>
        )}

        {selectedShipment && (
          <div className="h-[calc(100%-52px)] min-h-0 flex flex-col">
            {/* INFO (più compatto, stesso contenuto) */}
            <div className="shrink-0 px-4 py-3 border-b border-slate-200/70 space-y-2">
              {/* riga: stato + azioni */}
              <div className="flex items-center justify-between gap-2">
                <span className="px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] text-slate-700">
                  {STATUS_LABELS[selectedShipment.internal_status] ?? selectedShipment.internal_status}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 shadow-sm"
                    onClick={() => navigate(orderPath)}
                  >
                    Apri ordine
                  </button>

                  <button
                    type="button"
                    disabled={!canOpenBrt}
                    className="px-3 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 shadow-sm disabled:opacity-40"
                    onClick={() => {
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
              </div>

              {/* blocco compatto 2 colonne (niente card grosse) */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <InfoInline label="Tracking" value={selectedShipment.tracking_number || "—"} mono />
                <InfoInline label="Corriere" value={selectedShipment.carrier || "—"} />

                <InfoInline label="Data ordine" value={formatDate(selectedShipment.order_created_at || "")} />
                <InfoInline
                  label="Spedito"
                  value={formatDate((selectedShipment.label_created_at ?? selectedShipment.shipped_at) || "")}
                />

                {selectedShipment.delivered_at ? (
                  <InfoInline label="Consegnato" value={formatDate(selectedShipment.delivered_at)} />
                ) : (
                  <div />
                )}

                <InfoInline label="Cliente" value={selectedShipment.customer_name || "—"} />
              </div>

              {/* destinazione + stato BRT (testo) */}
              <div className="text-xs text-slate-700 space-y-1">
                <div>
                  <span className="text-[11px] text-slate-500">Destinazione:</span>{" "}
                  {`${selectedShipment.shipping_city || ""}${
                    selectedShipment.shipping_province ? ` (${selectedShipment.shipping_province})` : ""
                  } – ${selectedShipment.shipping_country || ""}`}
                </div>

                {selectedShipment.raw_status_text && (
                  <div>
                    <span className="text-[11px] text-slate-500">Stato BRT:</span>{" "}
                    <span className="font-medium">{selectedShipment.raw_status_text}</span>
                    {selectedShipment.last_event_location ? ` – ${selectedShipment.last_event_location}` : ""}
                  </div>
                )}
              </div>

              {/* problemi/alert */}
              {deriveProblemLabel(selectedShipment.internal_status, selectedShipment.raw_status_text) && (
                <div className="text-xs text-rose-700">
                  Problema:{" "}
                  {deriveProblemLabel(selectedShipment.internal_status, selectedShipment.raw_status_text)}
                </div>
              )}

              {(selectedShipment.is_late || selectedShipment.has_problem) && (
                <div className="flex flex-wrap gap-2">
                  {selectedShipment.is_late && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] border border-rose-200 bg-rose-50 text-rose-700">
                      In ritardo
                    </span>
                  )}
                  {selectedShipment.has_problem && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] border border-amber-200 bg-amber-50 text-amber-800">
                      Attenzione
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* TIMELINE (più spazio) */}
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                  Timeline eventi BRT
                </div>
                <div className="text-[11px] text-slate-400">
                  {eventsLoading ? "…" : `${events.length}`}
                </div>
              </div>

              {eventsLoading && <div className="text-sm text-slate-600">Caricamento eventi…</div>}
              {eventsError && <div className="text-sm text-rose-700">{eventsError}</div>}
              {!eventsLoading && events.length === 0 && !eventsError && (
                <div className="text-sm text-slate-500">Nessun evento registrato.</div>
              )}

              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id} className="relative pl-5">
                    <span className="absolute left-1.5 top-2 w-2 h-2 rounded-full bg-slate-400" />
                    <span className="absolute left-[9px] top-4 bottom-[-10px] w-px bg-slate-200" />

                    <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm px-3 py-2">
                      <div className="text-[11px] font-semibold text-slate-900">
                        {formatDateTime(ev.event_at)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-700">
                        {ev.event_description || "—"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {ev.event_branch ? ev.event_branch : "—"}
                        {ev.event_code ? ` • (${ev.event_code})` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoInline({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-xs font-semibold text-slate-900 truncate ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
