/* src/features/produzione/utils/pdf.ts */

import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import type { ProduzioneRow } from "../types";
import { estraiMisura, parseMisura } from "./sku";
// Se nel tuo progetto il file è in src/utils/barcode-bwip.ts, questo è il path corretto:
import { generateEAN13Barcode } from "../../../utils/barcode-bwip";

/** Ordinamento supportato per l'export PDF */
export type PdfOrderBy = "az" | "misura";

/**
 * Utility di comodo: apre un Blob PDF in una nuova tab (ObjectURL + revoke).
 */
export function openPdfInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // Revoke subito dopo l'apertura: i viewer moderni copiano il contenuto
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Ordina un array di righe in base a "az" (per SKU) o "misura" (token finale tipo 2P/3P/WxH).
 */
function sortRows(rows: ProduzioneRow[], orderBy: PdfOrderBy): ProduzioneRow[] {
  const arr = rows.slice();
  arr.sort((a, b) => {
    if (orderBy === "misura") {
      const A = estraiMisura(a.sku);
      const B = estraiMisura(b.sku);
      const [a1, a2] = parseMisura(A);
      const [b1, b2] = parseMisura(B);
      if (!Number.isNaN(a1) && !Number.isNaN(b1)) {
        if (a1 !== b1) return a1 - b1;
        if (!Number.isNaN(a2) && !Number.isNaN(b2)) return a2 - b2;
      }
      return A.localeCompare(B, "it", { sensitivity: "base" });
    }
    return a.sku.localeCompare(b.sku, "it", { sensitivity: "base" });
  });
  return arr;
}

/**
 * Raggruppa le righe per `radice`.
 */
function groupByRadice(rows: ProduzioneRow[]): Record<string, ProduzioneRow[]> {
  const byRadice: Record<string, ProduzioneRow[]> = {};
  for (const r of rows) {
    const key = r.radice || "";
    if (!byRadice[key]) byRadice[key] = [];
    byRadice[key].push(r);
  }
  return byRadice;
}

/**
 * Crea un PDF con tabelle per radice.
 * - Barcode EAN in prima colonna (se generabile)
 * - Colonne: Barcode | SKU | EAN | Stato | Quantità
 * - Ordinamento per radice interno a seconda di `orderBy`
 *
 * Ritorna un Blob; usa `openPdfInNewTab(blob)` per aprirlo.
 */
export async function buildProduzionePdf(
  rows: ProduzioneRow[],
  orderBy: PdfOrderBy = "az"
): Promise<Blob> {
  // Filtra righe selezionate dal chiamante prima di passare qui (se serve)
  const byRadice = groupByRadice(rows);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let firstTable = true;

  for (const radiceKey of Object.keys(byRadice)) {
    const items = sortRows(byRadice[radiceKey] || [], orderBy);

    if (!firstTable) doc.addPage();
    firstTable = false;

    const titleY = 15;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Radice: ${radiceKey || "—"}`, 12, titleY);

    // Pre-build map EAN->dataURL per inserire immagini in didDrawCell
    const barcodeMap: Record<string, string> = {};
    for (const r of items) {
      const ean = r.ean ? String(r.ean) : "";
      if (!ean) continue;
      try {
        barcodeMap[ean] = await generateEAN13Barcode(ean, 70, 70); // PNG dataURL
      } catch {
        // ignora: niente barcode
      }
    }

    const bodyRows: Array<[string, string, string, string, number]> = items.map((r) => [
      " ", // placeholder per il barcode
      r.sku,
      r.ean,
      r.stato_produzione,
      r.da_produrre,
    ]);

    autoTable(doc, {
      startY: titleY + 3,
      head: [["Barcode", "SKU", "EAN", "Stato", "Quantità"]],
      body: bodyRows,
      theme: "grid",
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 12,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 11,
        valign: "middle",
        minCellHeight: 15,
        cellPadding: 2,
        overflow: "ellipsize",
      },
      alternateRowStyles: { fillColor: [245, 249, 255] },
      columnStyles: {
        0: { cellWidth: 40, halign: "center" },
        1: { cellWidth: 80 },
        2: { cellWidth: 50 },
        3: { cellWidth: 40 },
        4: { cellWidth: 30, halign: "center" },
      },
      didDrawCell: (data: CellHookData) => {
        if (data.section === "body" && data.column.index === 0) {
          const raw = data.row.raw as [string, string, string, string, number];
          const ean = String(raw?.[2] ?? "");
          const img = barcodeMap[ean];
          if (img) {
            // 30x10 mm dentro alla cella
            const x = data.cell.x + 2;
            const y = data.cell.y + 2;
            try {
              doc.addImage(img, "PNG", x, y, 30, 10);
            } catch {
              // in alcuni viewer possono fallire immagini non conformi: ignora
            }
          }
        }
      },
    });
  }

  return doc.output("blob");
}

/**
 * Placeholder retrocompatibile: se vuoi solo un “hook” rapido senza worker.
 * In pratica delega a `buildProduzionePdf` e apre il risultato.
 */
export async function buildPdfPlaceholder(
  rows: ProduzioneRow[],
  orderBy: PdfOrderBy = "az"
) {
  const blob = await buildProduzionePdf(rows, orderBy);
  openPdfInNewTab(blob);
}
