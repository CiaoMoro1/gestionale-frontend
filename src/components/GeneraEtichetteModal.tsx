import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { generateEAN13Barcode } from "../utils/barcode-bwip";

type Props = {
  open: boolean;
  onClose: () => void;
  sku: string;
  ean: string;
};

// Funzione shrink font adattiva per jsPDF
function shrinkFontToFitPDF(doc: jsPDF, text: string, maxWidth: number, baseSize = 13, minSize = 7) {
  let fontSize = baseSize;
  doc.setFontSize(fontSize);
  while (doc.getTextWidth(text) > maxWidth && fontSize > minSize) {
    fontSize--;
    doc.setFontSize(fontSize);
  }
  return fontSize;
}

export default function GeneraEtichetteModalProdotto({ open, onClose, sku, ean }: Props) {
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState("1");
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);

  // Genera barcode PNG ogni volta che cambia EAN
  useEffect(() => {
    if (!ean) return;
    generateEAN13Barcode(ean, 36, 13)
      .then(setBarcodeUrl)
      .catch(() => setBarcodeUrl(null));
  }, [ean]);

  // Gestione quantità
  useEffect(() => {
    setQtyInput(String(qty));
  }, [qty]);
  function handleQtyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "");
    setQtyInput(val);
    if (val === "") return;
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0 && n <= 99) setQty(n);
  }

  // PDF ETICHETTA SINGOLA (62x29mm)
function handleStampaPdfEtichettaUnica() {
  if (!barcodeUrl) return;

  const labelW = 62; // mm
  const labelH = 29; // mm
  const marginY = 3; // mm
  const usableH = labelH - marginY * 2;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [labelW, labelH]
  });

  for (let i = 0; i < qty; i++) {
    if (i > 0) doc.addPage([labelW, labelH], "landscape");



       // Barcode
    const barcodeWidth = 48;
    const barcodeHeight = 36;
    const barcodeX = (labelW - barcodeWidth) / 2;
    const barcodeY = marginY + ((usableH - barcodeHeight) / 2); // centra nella fascia
    doc.addImage(barcodeUrl, "PNG", barcodeX, barcodeY, barcodeWidth, barcodeHeight);
    
    // SKU
    doc.setFont("courier", "bold");
    const fontSize = shrinkFontToFitPDF(doc, sku, labelW - 8, 15, 7);
    doc.setFontSize(fontSize);
    doc.text(sku, labelW / 2, marginY + 3, { align: "center" });

 

    // EAN
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(ean, labelW / 2, labelH - marginY, { align: "center" }); // 3mm dal fondo
  }

  window.open(doc.output("bloburl"), "_blank");
}

  // PDF FOGLIO 24 ETICHETTE (70x35mm ciascuna)
 function handleAnteprimaFoglio() {
  if (!barcodeUrl) return;
  const cols = 3;
  const rows = 8;
  const labelW = 70; // mm
  const labelH = 35; // mm
  const marginTop = 10; // mm margine sopra (e quindi sotto)

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  let q = qty;
  let idx = 0;
  for (let page = 0; q > 0; page++) {
  if (page > 0) doc.addPage();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (idx >= qty) break;
      const x = c * labelW;
      const y = marginTop + r * labelH;

      // === Etichetta ===
      doc.setFont("courier", "bold");
      const fontSize = shrinkFontToFitPDF(doc, sku, labelW - 8, 15, 7);
      doc.setFontSize(fontSize);

      const labelWt = 70;
      const barcodeWidth = 48;
      const barcodeX = x + (labelW - barcodeWidth) / 2; // centrato
      doc.addImage(barcodeUrl, "PNG", barcodeX, y - 4, barcodeWidth, 36);
      doc.text(sku, x + labelWt / 2, y + 4, { align: "center" });

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(ean, x + labelW / 2, y + labelH - 8, { align: "center" });

      idx++;
      q--;
      if (q <= 0) break;
    }
    if (q <= 0) break;
  }
}
  window.open(doc.output("bloburl"), "_blank");
}


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl px-5 py-6 w-full max-w-xs sm:max-w-[390px] relative flex flex-col items-center">
        <button className="absolute top-2 right-4 text-2xl text-neutral-400 hover:text-black" onClick={onClose}>×</button>
        <h3 className="font-bold text-xl text-blue-700 mb-3 text-center">Genera Etichetta</h3>
        <div className="mb-4 w-full flex flex-col items-center">
          <div
            className="border border-gray-200 shadow-sm rounded-lg bg-gray-50 py-2 px-3 flex flex-col items-center"
            style={{
              width: 248,
              height: 110,
              boxShadow: "0 1px 8px #0001",
              margin: "0 auto",
            }}
          >
            <div
              className="font-mono font-bold mb-1 text-center"
              style={{
                fontSize: `22px`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                minWidth: 0,
                maxWidth: "100%",
                lineHeight: 1.1,
                letterSpacing: "0.5px",
              }}
            >
              {sku}
            </div>
            {barcodeUrl && (
              <img
                src={barcodeUrl}
                alt="barcode"
                style={{
                  width: 198,
                  height: 40,
                  background: "#fff",
                  display: "block",
                  margin: "0 auto",
                  objectFit: "contain",
                }}
              />
            )}
            <div className="text-base tracking-widest text-center mt-1">{ean}</div>
          </div>
        </div>
        <div className="flex items-center mb-4 w-full justify-center">
          <label className="mr-2 text-xs font-semibold">Q.tà etichette</label>
          <input
            type="text"
            min={1}
            max={99}
            inputMode="numeric"
            value={qtyInput}
            onChange={handleQtyChange}
            className="border border-gray-300 rounded px-2 py-1 w-16 text-center font-bold text-lg bg-white shadow-sm focus:outline-cyan-500"
            style={{ fontSize: "17px" }}
            pattern="\d*"
            onBlur={() => {
              if (!qtyInput || qtyInput === "0") setQtyInput(String(qty > 0 ? qty : 1));
            }}
          />
        </div>
        <div className="flex gap-2 w-full">
          <button
            className="w-1/2 py-2 font-bold rounded-lg shadow bg-green-700 text-white hover:bg-green-900 transition text-sm"
            disabled={!barcodeUrl}
            onClick={handleStampaPdfEtichettaUnica}
          >
            Stampa singola etichetta (PDF)
          </button>
          <button
            className="w-1/2 py-2 font-bold rounded-lg shadow bg-cyan-700 text-white hover:bg-cyan-900 transition text-sm"
            disabled={!barcodeUrl}
            onClick={handleAnteprimaFoglio}
          >
            Genera PDF (foglio 24 etichette)
          </button>
        </div>
      </div>
    </div>
  );
}
