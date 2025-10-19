/* src/features/produzione/constants.ts */
import type { Canale, StatoProduzione } from "./types";

/* Stati in ordine di flusso */
export const FLOW_STATES: StatoProduzione[] = [
  "Da Stampare",
  "Stampato",
  "Calandrato",
  "Cucito",
  "Confezionato",
  "Trasferito",
  "Deposito",
];

export const STATI_PRODUZIONE: StatoProduzione[] = [
  "Da Stampare",
  "Stampato",
  "Calandrato",
  "Cucito",
  "Confezionato",
  "Trasferito",
  "Deposito",
  "Rimossi",
];

export const TITOLO_DA_PRODURRE: Record<string, string> = {
  "": "Inseriti",
  "Da Stampare": "Da Stampare",
  Stampato: "Stampati",
  Calandrato: "Calandrati",
  Cucito: "Cuciti",
  Confezionato: "Confezionati",
  Trasferito: "Trasferiti",
  Deposito: "Deposito",
  Rimossi: "Rimossi",
};

export const CANALE_BADGE: Record<Canale, string> = {
  "Amazon Vendor": "bg-orange-100 border-orange-300 text-orange-800",
  Sito: "bg-green-100 border-green-300 text-green-800",
  "Amazon Seller": "bg-red-100 border-red-300 text-red-800",
};

/** palette per la flow map e badge stato */
export const STATE_STYLES: Record<
  StatoProduzione,
  { fill: string; stroke: string; text: string; glow: string }
> = {
  "Da Stampare":   { fill: "#dbeafe", stroke: "#60a5fa", text: "#0c4a6e", glow: "rgba(96,165,250,.35)" },
  "Stampato":      { fill: "#dcfce7", stroke: "#4ade80", text: "#065f46", glow: "rgba(74,222,128,.35)" },
  "Calandrato":    { fill: "#ede9fe", stroke: "#a78bfa", text: "#4c1d95", glow: "rgba(167,139,250,.35)" },
  "Cucito":        { fill: "#ffedd5", stroke: "#fb923c", text: "#7c2d12", glow: "rgba(251,146,60,.35)" },
  "Confezionato":  { fill: "#fce7f3", stroke: "#f472b6", text: "#831843", glow: "rgba(244,114,182,.35)" },
  "Trasferito":    { fill: "#e5e7eb", stroke: "#9ca3af", text: "#111827", glow: "rgba(156,163,175,.35)" },
  "Deposito":      { fill: "#ffdd00", stroke: "#fb923c", text: "#7c2d12", glow: "rgba(251,146,60,.25)" },
  "Rimossi":       { fill: "#fee2e2", stroke: "#f87171", text: "#7f1d1d", glow: "rgba(248,113,113,.35)" },
};
