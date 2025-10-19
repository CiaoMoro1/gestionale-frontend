/* src/features/produzione/types.ts */

/** Utente disponibile globalmente (usato negli header) */
declare global {
  interface Window {
    APP_USER_NAME?: string;
  }
}

/* ----------------------------- Tipi dominio ----------------------------- */

export type Canale = "Amazon Vendor" | "Sito" | "Amazon Seller";

export type StatoProduzione =
  | "Da Stampare"
  | "Stampato"
  | "Calandrato"
  | "Cucito"
  | "Confezionato"
  | "Trasferito"
  | "Deposito"
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
  /** BE “stato” grezzo, tienilo se serve retrocompatibilità */
  stato: string;
  stato_produzione: StatoProduzione;
  da_produrre: number;
  cavallotti: boolean;
  note?: string | null;
  modificata_manualmente?: boolean;
  canale?: Canale;
};

export type ApiListResponse<T> = { data: T } | T;

export type ProductSuggest = {
  id: string;
  sku: string | null;
  ean: string | null;
  variant_title?: string | null;
  product_title?: string | null;
  image_url?: string | null;
  price?: number | null;
};

export type SiteOrdersSummary = {
  orders_count: number;
  total_qty: number;
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
  produzione_id?: number | null;
};

/* ------------------------------ Flow map ------------------------------ */

export type EdgeKey = `${StatoProduzione}->${StatoProduzione}`;

export type FlowEdge = {
  from: StatoProduzione;
  to: StatoProduzione;
  qty: number;        // 0 se ignota
  unknown?: boolean;  // true quando qty non ricavabile
};

export type FlowGraph = {
  nodes: StatoProduzione[];
  edges: FlowEdge[];
};

/* ------------------------------ UI helpers ----------------------------- */

export type ToastType = "success" | "error";
