import React, { useRef, useEffect, useState } from "react";
import jsPDF from "jspdf";
import { generateEAN13Barcode } from "../utils/barcode-bwip";

type Props = {
  open: boolean;
  onClose: () => void;
  sku: string;
  ean: string;
};

const DPI = 300; // Usa 203 se la tua stampante non è Brother QL
const LABEL_W_MM = 62;
const LABEL_H_MM = 29;
const MM_TO_INCH = 1 / 25.4;

const LABEL_W = Math.round(LABEL_W_MM * MM_TO_INCH * DPI); // 732 px
const LABEL_H = Math.round(LABEL_H_MM * MM_TO_INCH * DPI); // 342 px

function shrinkFontToFit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, baseSize = 60, minSize = 14) {
  let size = baseSize;
  ctx.font = `bold ${size}px monospace`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 1;
    ctx.font = `bold ${size}px monospace`;
  }
  return size;
}

export default function GeneraEtichetteModalProdotto({ open, onClose, sku, ean }: Props) {
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState("1");
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);

  // Genera barcode PNG
  useEffect(() => {
    if (!ean) return;
    generateEAN13Barcode(ean, LABEL_W - Math.round(DPI * 0.36), Math.round(DPI * 0.68))
      .then(setBarcodeUrl)
      .catch(() => setBarcodeUrl(null));
  }, [ean]);

  // Preview etichetta su canvas, esporta PNG
  const canvasRef = useRef<HTMLCanvasElement>(null);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas || !barcodeUrl) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, LABEL_W, LABEL_H);

  // Sfondo
  ctx.fillStyle = "#fafbfc";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);

  // SKU
  let fontSize = shrinkFontToFit(ctx, sku, LABEL_W - DPI * 0.6, 60, 14);
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillStyle = "#222";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const skuY = Math.round(DPI * 0.13);
  ctx.fillText(sku, LABEL_W / 2, skuY);

  // Barcode (deve essere disegnato PRIMA dell'EAN)
const barcodeImg = new window.Image();
barcodeImg.onload = () => {
  // Nuove dimensioni barcode:
  const barcodeH = 120; // o 100-120, NON di più!
  const barcodeY = skuY + fontSize + 18; // subito dopo lo SKU (18px di gap)
  const barcodeX = 30; // margine sinistro
  const barcodeW = LABEL_W - 60; // margine destro uguale (30+30)

  ctx.drawImage(barcodeImg, barcodeX, barcodeY, barcodeW, barcodeH);

    // EAN (solo DOPO aver disegnato il barcode!)
  ctx.font = `bold ${Math.round(DPI * 0.16)}px monospace`; // 48px se DPI=300
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const eanY = barcodeY + barcodeH + 10; // 10px di gap sotto barcode
  ctx.fillText(ean, LABEL_W / 2, eanY);

  setCanvasUrl(canvas.toDataURL("image/png"));
};
barcodeImg.src = barcodeUrl;
}, [sku, ean, barcodeUrl]);

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

  // PDF foglio 24 etichette
  function handleAnteprimaFoglio() {
    if (!barcodeUrl) return;
    const cols = 3;
    const rows = 8;
    const labelW = 70; // mm
    const labelH = 35; // mm
    const marginTop = 5; // mm

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

          doc.setDrawColor(210);
          doc.rect(x, y, labelW, labelH);

          // SKU
          doc.setFontSize(13);
          doc.setFont("courier", "bold");
          doc.text(sku, x + labelW / 2, y + 11, { align: "center" });

          // Barcode
          doc.addImage(barcodeUrl, "PNG", x + 6, y + 14, labelW - 12, 13);

          // EAN
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text(ean, x + labelW / 2, y + labelH - 4, { align: "center" });

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
          <canvas
            ref={canvasRef}
            width={LABEL_W}
            height={LABEL_H}
            style={{
              display: "block",
              border: "1px solid #ddd",
              background: "#fafbfc",
              marginBottom: 12,
              boxShadow: "0 1px 8px #0001",
              maxWidth: 400, // responsive preview
              height: "auto"
            }}
          />
          {canvasUrl && (
            <div className="flex flex-col items-center gap-2 w-full">
              <a
                href={canvasUrl}
                download={`etichetta_${sku}_${ean}.png`}
                className="px-3 py-2 bg-cyan-700 rounded text-white font-bold text-xs text-center w-full"
              >
                Scarica come PNG
              </a>
              <button
                className="px-3 py-2 bg-green-700 rounded text-white font-bold text-xs w-full"
                onClick={() => {
                  const win = window.open();
                  win?.document.write(
                    `<img src="${canvasUrl}" style="width:${LABEL_W}px;height:${LABEL_H}px"/>`
                  );
                  setTimeout(() => win?.print(), 400);
                }}
              >
                Stampa subito (PNG)
              </button>
            </div>
          )}
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
        <button
          className="w-full mt-3 py-2 font-bold rounded-lg shadow bg-cyan-600 text-white hover:bg-cyan-800 transition text-sm"
          onClick={handleAnteprimaFoglio}
          disabled={!barcodeUrl}
        >
          Genera PDF (foglio 24 etichette)
        </button>
      </div>
    </div>
  );
}
