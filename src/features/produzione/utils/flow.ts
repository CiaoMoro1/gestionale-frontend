/* src/features/produzione/utils/flow.ts */
import { FLOW_STATES } from "../constants";
import type {
  FlowGraph,
  LogMovimento,
  ProduzioneRow,
  StatoProduzione,
} from "../types";

/**
 * Totali per stato di un singolo SKU (opz. filtrati per canale).
 * Restituisce sempre tutte le chiavi degli stati (anche se 0).
 */
export function totalsByStateForSku(
  all: ProduzioneRow[],
  sku?: string,
  canale?: string | null
): Record<StatoProduzione, number> {
  const out: Record<StatoProduzione, number> = {
    "Da Stampare": 0,
    "Stampato": 0,
    "Calandrato": 0,
    "Cucito": 0,
    "Confezionato": 0,
    "Trasferito": 0,
    "Deposito": 0,
    "Rimossi": 0,
  };
  if (!sku) return out;

  for (const r of all) {
    if (r.sku !== sku) continue;
    if (canale && r.canale !== canale) continue;
    out[r.stato_produzione] += r.da_produrre || 0;
  }
  return out;
}

/** Riconosce log di spostamento/cambio stato */
const isMoveLog = (motivo?: string | null): boolean => {
  const m = (motivo ?? "").toLowerCase();
  return m.startsWith("spostamento a") || m.startsWith("cambio stato");
};

/**
 * Se il log non ha qty (tipico bulk), prova a stimare dai dati della riga produzione;
 * se non ricavabile, qty=0 e unknown=true (così puoi mostrare freccia senza numero).
 */
function movedPiecesOrFallback(
  l: LogMovimento,
  all: ProduzioneRow[]
): { qty: number; unknown: boolean } {
  const a = typeof l.qty_vecchia === "number" ? l.qty_vecchia : null;
  const b = typeof l.qty_nuova === "number" ? l.qty_nuova : null;

  if (a !== null && b !== null) {
    // differenza assoluta: la direzione è data dalla coppia from->to
    return { qty: Math.abs(a - b), unknown: false };
  }

  if (l.produzione_id) {
    const r = all.find((x) => x.id === l.produzione_id);
    if (r && typeof r.da_produrre === "number") {
      return { qty: Math.max(0, r.da_produrre), unknown: false };
    }
  }
  return { qty: 0, unknown: true };
}

/**
 * Costruisce il grafo di flusso dagli eventi log (solo move/cambio stato).
 * Aggrega le quantità per arco from->to.
 */
export function buildFlowGraph(
  logs: LogMovimento[],
  allRows: ProduzioneRow[]
): FlowGraph {
  const edgesMap = new Map<string, { qty: number; unknown: boolean }>();

  for (const l of logs) {
    if (!isMoveLog(l.motivo)) continue;

    const from = (l.stato_vecchio ?? "") as StatoProduzione;
    const to = (l.stato_nuovo ?? "") as StatoProduzione;

    // Considera solo archi interni al flusso noto (esclude "Rimossi" se non serve)
    if (!FLOW_STATES.includes(from) || !FLOW_STATES.includes(to)) continue;

    const { qty, unknown } = movedPiecesOrFallback(l, allRows);
    const key = `${from}->${to}`;

    const prev = edgesMap.get(key);
    if (prev) {
      edgesMap.set(key, { qty: prev.qty + qty, unknown: prev.unknown || unknown });
    } else {
      edgesMap.set(key, { qty, unknown });
    }
  }

  return {
    nodes: FLOW_STATES,
    edges: [...edgesMap.entries()].map(([k, v]) => {
      const [from, to] = k.split("->") as [StatoProduzione, StatoProduzione];
      return { from, to, qty: v.qty, unknown: v.unknown };
    }),
  };
}
