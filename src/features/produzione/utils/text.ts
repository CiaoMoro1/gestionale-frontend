/* src/features/produzione/utils/text.ts */
import type { LogMovimento } from "../types";

/** “a → b pezzi”, con fallback sensati */
export function delta(oldV?: number | null, newV?: number | null, unit = "pezzi"): string {
  const a = typeof oldV === "number" ? oldV : undefined;
  const b = typeof newV === "number" ? newV : undefined;
  if (typeof a === "undefined" && typeof b === "undefined") return "—";
  if (typeof a === "undefined") return `${b} ${unit}`;
  if (typeof b === "undefined") return `${a} ${unit}`;
  if (a === b) return `${b} ${unit}`;
  return `${a} → ${b} ${unit}`;
}

export function normalizeMotivo(raw?: string | null): string {
  const s = (raw ?? "").toLowerCase();
  if (!s) return "Aggiornamento automatico (sistema)";
  if (s.startsWith("trigger insert")) return "Creazione riga (sistema)";
  if (s.startsWith("trigger update")) return "Aggiornamento automatico (sistema)";
  if (s.includes("spostamento a")) return raw!;
  if (s.includes("cambio stato")) return "Cambio stato";
  if (s.includes("modifica quantità")) return "Modifica quantità";
  if (s.includes("modifica plus")) return "Modifica plus";
  if (s.includes("inserimento manuale")) return "Inserimento manuale";
  return raw || "Aggiornamento";
}

export function normalizeUtente(u?: string | null): string {
  const x = (u ?? "").trim().toLowerCase();
  if (!x || ["postgres", "postgrest", "supabase", "system", "sistema"].includes(x)) return "Sistema";
  return (u ?? "").trim();
}

/** Dedupe log con chiave compatta su timestamp e variazioni */
export function dedupeLogs(input: LogMovimento[]): LogMovimento[] {
  const seen = new Set<string>();
  const out: LogMovimento[] = [];
  for (const l of input) {
    const t = l.created_at ? Math.floor(new Date(l.created_at).getTime() / 1000) : 0;
    const key = [
      t,
      normalizeMotivo(l.motivo),
      l.stato_vecchio ?? "-",
      l.stato_nuovo ?? "-",
      String(l.qty_vecchia ?? "-"),
      String(l.qty_nuova ?? "-"),
      String(l.plus_vecchio ?? "-"),
      String(l.plus_nuovo ?? "-"),
    ].join("|");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(l);
    }
  }
  return out;
}
