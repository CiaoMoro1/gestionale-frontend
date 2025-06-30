// src/components/GeneraEtichetteModal.tsx
import { useRef, useEffect, useState } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  open: boolean;
  onClose: () => void;
  sku: string;
  ean: string;
};

export default function GeneraEtichetteModal({ open, onClose, sku, ean }: Props) {
  const [qty, setQty] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && ean && canvasRef.current) {
      try {
        JsBarcode(canvasRef.current, ean, {
          format: "EAN13",
          width: 2.5,
          height: 80,
          fontSize: 20,
          displayValue: true,
          margin: 12
        });
      } catch (err) {
        // Se l'EAN non è valido
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx?.fillText("EAN non valido", 10, 40);
      }
    }
  }, [ean, open, qty]);

  function handleDownload() {
    if (!canvasRef.current) return;
    for (let i = 0; i < qty; i++) {
      const link = document.createElement("a");
      link.download = `${sku}_barcode_${ean}_${i+1}.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl px-6 py-6 min-w-[340px] w-full max-w-xs relative flex flex-col items-center">
        <button className="absolute top-2 right-4 text-2xl text-neutral-400 hover:text-black" onClick={onClose}>×</button>
        <h3 className="font-bold text-lg text-blue-700 mb-2 text-center">Genera Etichetta</h3>
        <div className="mb-1 font-mono text-xl text-center">{sku}</div>
        <canvas ref={canvasRef} className="block mb-2 bg-white" width={210} height={110} />
        <div className="mb-3 text-xs text-neutral-700 text-center">EAN: <b>{ean}</b></div>
        <div className="flex items-center mb-4 w-full justify-center">
          <label className="mr-2 text-xs font-bold">Q.tà etichette</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={e => setQty(Math.max(1, Number(e.target.value)))}
            className="border rounded px-2 py-1 w-16 text-center font-bold"
          />
        </div>
        <button
          className="w-full py-2 font-bold rounded-lg shadow bg-blue-600 text-white hover:bg-blue-800 transition"
          onClick={handleDownload}
        >
          Scarica {qty === 1 ? "Etichetta" : `Etichette (${qty})`}
        </button>
      </div>
    </div>
  );
}
