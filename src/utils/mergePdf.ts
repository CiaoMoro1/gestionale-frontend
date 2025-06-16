import { PDFDocument } from 'pdf-lib';

/**
 * Unisce più PDF codificati base64 in un unico PDF (sempre in base64).
 * @param pdfBase64Arr Array di PDF in base64
 * @returns PDF unico in base64
 */
export async function mergePdfBase64Array(pdfBase64Arr: string[]): Promise<string> {
  const mergedPdf = await PDFDocument.create();

  for (const base64 of pdfBase64Arr) {
    // Decodifica base64 in byte array
    const pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    // Carica ogni PDF
    const pdf = await PDFDocument.load(pdfBytes);
    // Copia tutte le pagine
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedBytes = await mergedPdf.save();
  // Ricodifica il PDF unito in base64
  return btoa(String.fromCharCode(...mergedBytes));
}
