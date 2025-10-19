/* src/features/produzione/utils/sku.ts */
import type { ProduzioneRow } from "../types";

/** Estrae la misura dall’ultimo token dello SKU, es. “...-2P” -> “2P” */
export function estraiMisura(sku: string): string {
  const parts = (sku || "").split("-");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/** Converte “WxH” in numeri (se presenti), altrimenti NaN */
export function parseMisura(misura: string): [number, number] {
  const m = misura.match(/^(\d+)[xX](\d+)$/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [Number.NaN, Number.NaN];
}

// --- Helpers sorting/filtri "MZ-" + grouping radici ---
export function stripMZ(sku: string): string {
  return (sku || "").replace(/^MZ-?/i, ""); // toglie MZ- o MZ
}

// Usato per ordinare chiavi radice ignorando l’eventuale prefisso MZ-
export function sortKeySku(s: string): string {
  return stripMZ(s).toUpperCase();
}

// Mappa di "collasso" radici come richiesto
const RADICE_COLLAPSE: Record<string, string> = {
  CCSCDN: "CCSCD",
  CENTRO: "CENTROTAVOLA",
  CENTROTAVOLAN: "CENTROTAVOLA",
  CENTROD: "CENTROTAVOLA",
  CLFDN: "CLFD",
  CPRFDN: "CPRFD",
  CPRFLLDN: "CPRFLLD",
  RNNCDN: "RNNCD",
  TOVCDN: "TOVCD",
  CFD: "CFDM",
  TPCDN: "TPCD",
};

// Collassa la radice
function collapseRadice(radice: string | undefined | null): string {
  const r = (radice || "").toUpperCase().trim();
  return RADICE_COLLAPSE[r] ?? r;
}

// Radice grezza ricavata dallo SKU, ignorando MZ-
function radiceFromSku(sku: string): string {
  const base = stripMZ(sku).toUpperCase();
  const first = base.split("-")[0] || "";
  return first.trim();
}

// Radice finale per UI/filtri: MZ-ignorata + collasso
export function radiceFromRow(r: ProduzioneRow): string {
  return collapseRadice(radiceFromSku(r.sku));
}

/**
 * Radice “per menu”: per SKU MZ-<TOK> usa la radice calcolata dal primo token
 * (ignorando MZ-), su tutti gli altri usa la radice ricalcolata e collassata.
 */
export function radiceMenuKey(row: ProduzioneRow): string {
  // preferiamo la radice derivata dallo SKU per coerenza con Prelievo
  return radiceFromRow(row) || (row.radice || "").toUpperCase();
}

/** Confronto SKU case-insensitive/trim */
export function sameSku(a?: string, b?: string): boolean {
  return (a ?? "").trim().toUpperCase() === (b ?? "").trim().toUpperCase();
}
