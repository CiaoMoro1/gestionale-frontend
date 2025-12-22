// src/routes/tracking/types.ts
export type ShipmentStatus =
  | "PENDING"
  | "PICKUP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED_ATTEMPT"
  | "ON_HOLD"
  | "RETURNING"
  | "RETURNED"
  | "LOST_DAMAGED"
  | "UNKNOWN";

export type PeriodFilter = "7d" | "30d" | "all";
export type QuickFilter = "none" | "attenzione" | "ritardo" | "contrassegno";

export type StatusGroupFilter =
  | "ALL"
  | "PENDING_ONLY"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "PROBLEM"
  | "ON_HOLD_ONLY"
  | "FAILED_ONLY"
  | "RETURNING_ONLY"
  | "RETURNED_ONLY"
  | "LOST_DAMAGED_ONLY";



export interface ShipmentRow {
  shipment_id: string;
  order_id: string;
  channel: string;
  carrier: string;
  tracking_number: string;
  internal_status: ShipmentStatus;
  raw_status_text: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  promised_delivery_date: string | null;
  last_event_at: string | null;
  last_event_location: string | null;
  cod_amount: number | null;
  has_problem: boolean;
  is_late: boolean;
  order_created_at: string | null;
  label_created_at: string | null;
  order_number: string | null;
  shopify_order_id: number | null;
  customer_name: string | null;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_country: string | null;
  payment_status: string | null;
  order_total: number | null;
  customer_email: string | null;
  shipping_address: string | null;
  shipping_zip: string | null;
  brt_shipment_id: string | null
}

export interface TrackingSummary {
  attenzione: number;
  in_ritardo: number;
  contrassegno: number;
  pending: number;
  pickup: number;
  in_transit: number;
  out_for_delivery: number;
  delivered: number;
  failed_attempt: number;
  on_hold: number;
  returning: number;
  returned: number;
  lost_damaged: number;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  carrier: string;
  event_code: string | null;
  event_description: string | null;
  event_branch: string | null;
  event_at: string;
}

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Trasmesso a BRT",
  PICKUP: "In ritiro",
  IN_TRANSIT: "In transito",
  OUT_FOR_DELIVERY: "In consegna",
  DELIVERED: "Consegnato",
  FAILED_ATTEMPT: "Consegna fallita",
  ON_HOLD: "Giacenza / problemi",
  RETURNING: "In rientro",
  RETURNED: "Rientrato",
  LOST_DAMAGED: "Smarrimento / danneggiamento",
  UNKNOWN: "Sconosciuto",
};

// Prova a derivare una descrizione umana del problema
export function deriveProblemLabel(
  status: ShipmentStatus,
  rawStatusText: string | null,
): string | null {
  const txt = (rawStatusText || "").toUpperCase();

  if (!txt && status === "FAILED_ATTEMPT") {
    return "Mancata consegna";
  }

  if (txt.includes("FERMO DEPOSITO")) return "Fermo deposito";
  if (txt.includes("INDIRIZ") || txt.includes("SCONOSC")) {
    return "Indirizzo / destinatario errato";
  }
  if (txt.includes("CONSEGNATA PARZIALMENTE")) return "Consegna parziale";
  if (txt.includes("RIFIUTA")) return "Rifiuto consegna";
  if (txt.includes("FORZA MAGGIORE")) return "Ritardo per forza maggiore";
  if (txt.includes("BRT-FERMOPOINT")) return "Ritiro in BRT-fermopoint";

  if (status === "ON_HOLD") return "In attesa di disposizioni";
  if (status === "FAILED_ATTEMPT") return "Mancata consegna";
  if (status === "LOST_DAMAGED") return "Smarrimento / danneggiamento";

  return null;
}

export function normalizeCodAmount(value: number | null): string {
  if (value == null) return "-";
  const num =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(num)) return "-";
  return `${num.toFixed(2)} €`;
}

export function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
