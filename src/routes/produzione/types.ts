export type Canale = "Amazon Vendor" | "Amazon Seller" | "Sito";

export type StatoProduzione =
  | "Da Stampare"
  | "Stampato"
  | "Calandrato"
  | "Cucito"
  | "Confezionato"
  | "Trasferito"
  | "Rimossi";

export type ProduzioneRow = {
  id: number;
  sku: string;
  ean: string;
  qty: number;
  plus?: number | null;
  riscontro?: number | null;
  radice: string;
  start_delivery: string | null;
  stato: string;
  stato_produzione: StatoProduzione;
  da_produrre: number;
  cavallotti: boolean;
  note?: string | null;
  modificata_manualmente?: boolean;
  canale?: Canale;
};

export type LogMovimento = {
  id?: number;
  created_at?: string;
  motivo?: string;
  stato_vecchio?: string | null;
  stato_nuovo?: string | null;
  qty_vecchia?: number | null;
  qty_nuova?: number | null;
  plus_vecchio?: number | null;
  plus_nuovo?: number | null;
  utente?: string | null;
  canale?: string | null;
  canale_label?: string | null;
};

export const FLOW_STATES: StatoProduzione[] = [
  "Da Stampare",
  "Stampato",
  "Calandrato",
  "Cucito",
  "Confezionato",
  "Trasferito",
];

export const STATE_COLORS: Record<
  StatoProduzione,
  { bg: string; stroke: string; text: string }
> = {
  "Da Stampare": { bg: "#E0F2FE", stroke: "#38BDF8", text: "#0C4A6E" },
  "Stampato": { bg: "#DCFCE7", stroke: "#22C55E", text: "#065F46" },
  "Calandrato": { bg: "#EDE9FE", stroke: "#8B5CF6", text: "#4C1D95" },
  "Cucito": { bg: "#FFEDD5", stroke: "#FB923C", text: "#7C2D12" },
  "Confezionato": { bg: "#FCE7F3", stroke: "#F472B6", text: "#831843" },
  "Trasferito": { bg: "#E5E7EB", stroke: "#6B7280", text: "#111827" },
  "Rimossi": { bg: "#FEE2E2", stroke: "#F87171", text: "#7F1D1D" },
};

export type FlowEdge = { from: StatoProduzione; to: StatoProduzione; qty: number };
export type FlowGraph = { nodes: StatoProduzione[]; edges: FlowEdge[] };
