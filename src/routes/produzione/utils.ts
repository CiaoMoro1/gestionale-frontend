import { LogMovimento, ProduzioneRow, StatoProduzione, FLOW_STATES, FlowGraph } from "./types";

export function delta(a?: number | null, b?: number | null, unit = "pezzi"): string {
  const x = typeof a === "number" ? a : undefined;
  const y = typeof b === "number" ? b : undefined;
  if (typeof x === "undefined" && typeof y === "undefined") return "—";
  if (typeof x === "undefined") return `${y} ${unit}`;
  if (typeof y === "undefined") return `${x} ${unit}`;
  if (x === y) return `${y} ${unit}`;
  return `${x} → ${y} ${unit}`;
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

export function matchSmart(row: { sku: string; ean: string }, query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const SKU = (row.sku || "").toUpperCase();
  const EAN = (row.ean || "").toUpperCase();
  const parts = SKU.split("-").filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : "";
  return tokens.every((tok) => {
    const exact = tok.endsWith(";");
    const t = tok.replace(/;$/, "").toUpperCase();
    if (!t) return true;
    if (exact) {
      if (/^\d+$/.test(t)) return EAN === t;
      return last === t;
    }
    return SKU.includes(t) || EAN.includes(t);
  });
}

export function movedPieces(l: LogMovimento): number | null {
  const a = typeof l.qty_vecchia === "number" ? l.qty_vecchia : null;
  const b = typeof l.qty_nuova === "number" ? l.qty_nuova : null;
  if (a === null || b === null) return null;
  return a - b;
}

export function computeTotalsByState(rows: ProduzioneRow[], sku: string, canale?: string) {
  const totals = {
    "Da Stampare": 0, "Stampato": 0, "Calandrato": 0, "Cucito": 0, "Confezionato": 0, "Trasferito": 0, "Rimossi": 0,
  } as Record<StatoProduzione, number>;
  for (const r of rows) {
    if (r.sku !== sku) continue;
    if (canale && r.canale !== canale) continue;
    totals[r.stato_produzione] += r.da_produrre || 0;
  }
  return totals;
}

export function buildFlowGraph(logs: LogMovimento[]): FlowGraph {
  const edgesMap = new Map<string, number>();
  for (const l of logs) {
    const motivo = (l.motivo ?? "").toLowerCase();
    if (!motivo.startsWith("spostamento a")) continue;
    const from = l.stato_vecchio as StatoProduzione;
    const to = l.stato_nuovo as StatoProduzione;
    if (!FLOW_STATES.includes(from) || !FLOW_STATES.includes(to)) continue;
    const a = typeof l.qty_vecchia === "number" ? l.qty_vecchia : null;
    const b = typeof l.qty_nuova === "number" ? l.qty_nuova : null;
    if (a === null || b === null) continue;
    const qty = Math.abs(a - b);
    if (qty <= 0) continue;
    const k = `${from}->${to}`;
    edgesMap.set(k, (edgesMap.get(k) ?? 0) + qty);
  }
  return {
    nodes: FLOW_STATES,
    edges: [...edgesMap.entries()].map(([k, qty]) => {
      const [from, to] = k.split("->") as [StatoProduzione, StatoProduzione];
      return { from, to, qty };
    }),
  };
}

export function getUserName(): string {
  // lato FE: leggi user-friendly name
  return (window as any).APP_USER_NAME || localStorage.getItem("userName") || "Operatore";
}

export function headersJson(): Record<string, string> {
  return { "Content-Type": "application/json", "X-USER-NAME": getUserName() };
}
