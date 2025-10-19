/// <reference lib="webworker" />
// Vite: usa `new Worker(new URL('@/workers/pdfExport.worker.ts', import.meta.url), { type: 'module' })`

import type { ProduzioneRow } from "@/features/produzione";
import { buildProduzionePdf } from "@/features/produzione/utils/pdf";

type InMsg = { rows: ProduzioneRow[]; orderBy: "az" | "misura" };
type OutMsg =
  | { success: true; blob: Blob }
  | { success: false; error: string };

self.onmessage = async (e: MessageEvent<InMsg>) => {
  try {
    const { rows, orderBy } = e.data;
    const blob = await buildProduzionePdf(rows, orderBy);
    // Non puoi passare Blob direttamente tra thread in tutti gli env -> usiamo ArrayBuffer
    const buf = await blob.arrayBuffer();
    const out: OutMsg = { success: true, blob: new Blob([buf], { type: "application/pdf" }) };
    (self as unknown as Worker).postMessage(out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore export PDF";
    const out: OutMsg = { success: false, error: msg };
    (self as unknown as Worker).postMessage(out);
  }
};
