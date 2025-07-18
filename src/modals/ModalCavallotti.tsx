// src/modals/ModalCavallotti.tsx
import { useState } from "react";
import Barcode from "react-barcode";

// Sostituisci con le tue icone lavaggio (base64, svg, png, ...)
const WASH_ICONS = [
  "data:image/png;base64,IVBORw0KGgoAAAANSUhEUgA...", // Icona esempio
  // "data:image/svg+xml;..." // Altre icone qui
];

type Props = {
  open: boolean;
  onClose: () => void;
  dati: {
    imageUrl: string;
    logoUrl: string;
    productTitle: string;
    variantTitle?: string;
    sku: string;
    barcode: string; // EAN o altro
    washIcons?: string[];
  };
};

const FORMAT_CONFIG = {
  A5: {
    card: "w-[21cm] h-[14.8cm] text-xs",
    logo: "max-h-[75px]",
    title: "text-base",
    barcode: "max-w-[84px]",
  },
  A4: {
    card: "w-[29.7cm] h-[21cm] text-base",
    logo: "max-h-[120px]",
    title: "text-2xl",
    barcode: "max-w-[150px]",
  },
  A3: {
    card: "w-[42cm] h-[29.7cm] text-2xl",
    logo: "max-h-[180px]",
    title: "text-4xl",
    barcode: "max-w-[260px]",
  },
};

export default function ModalCavallotti({ open, onClose, dati }: Props) {
  const [formato, setFormato] = useState<"A5" | "A4" | "A3">("A4");

  if (!open) return null;

  const config = FORMAT_CONFIG[formato];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:bg-transparent">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-5xl w-full relative print:rounded-none print:shadow-none print:bg-white">
        {/* Close btn */}
        <button className="absolute top-2 right-4 text-2xl text-gray-400 hover:text-black print:hidden" onClick={onClose}>×</button>

        {/* Intestazione */}
        <div className="flex items-center gap-4 mb-4 print:hidden">
          <b className="text-lg text-cyan-900">Preview Cavallotto</b>
          <div className="flex gap-2 ml-6">
            {(["A5", "A4", "A3"] as const).map(f =>
              <button
                key={f}
                onClick={() => setFormato(f)}
                className={`px-4 py-2 rounded-lg font-bold border ${formato === f ? "bg-cyan-600 text-white border-cyan-700" : "bg-gray-100 text-cyan-700 border-cyan-200"} transition`}
              >{f}</button>
            )}
          </div>
          <button
            className="ml-auto px-5 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-800 transition print:hidden"
            onClick={() => window.print()}
          >🖨️ Stampa</button>
        </div>

        {/* CARD PREVIEW */}
        <div className={`flex rounded-3xl shadow-lg bg-white overflow-hidden ${config.card} mx-auto border print:rounded-none print:shadow-none print:bg-white`} style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23eb9c00' fill-opacity='0.1' fill-rule='nonzero'%3E%3Cpath d='M29 58.58l7.38-7.39A30.95 30.95 0 0 1 29 37.84a30.95 30.95 0 0 1-7.38 13.36l7.37 7.38zm1.4 1.41l.01.01h-2.84l-7.37-7.38A30.95 30.95 0 0 1 6.84 60H0v-1.02a28.9 28.9 0 0 0 18.79-7.78L0 32.41v-4.84L18.78 8.79A28.9 28.9 0 0 0 0 1.02V0h6.84a30.95 30.95 0 0 1 13.35 7.38L27.57 0h2.84l7.39 7.38A30.95 30.95 0 0 1 51.16 0H60v27.58-.01V60h-8.84a30.95 30.95 0 0 1-13.37-7.4L30.4 60zM29 1.41l-7.4 7.38A30.95 30.95 0 0 1 29 22.16 30.95 30.95 0 0 1 36.38 8.8L29 1.4zM58 1A28.9 28.9 0 0 0 39.2 8.8L58 27.58V1.02zm-20.2 9.2A28.9 28.9 0 0 0 30.02 29h26.56L37.8 10.21zM30.02 31a28.9 28.9 0 0 0 7.77 18.79l18.79-18.79H30.02zm9.18 20.2A28.9 28.9 0 0 0 58 59V32.4L39.2 51.19zm-19-1.4a28.9 28.9 0 0 0 7.78-18.8H1.41l18.8 18.8zm7.78-20.8A28.9 28.9 0 0 0 20.2 10.2L1.41 29h26.57z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
        }}>
          {/* IMMAGINE PRODOTTO */}
          <div className="flex-1 flex items-center justify-center bg-white p-2">
            <img src={dati.imageUrl} alt="Immagine prodotto" className="max-w-[96%] max-h-[96%] rounded-2xl border shadow" />
          </div>
          {/* INFO */}
          <div className="flex-1 flex flex-col items-center justify-between py-[4.5%] px-5 text-center">
            {/* LOGO */}
            <img src={dati.logoUrl} className={`mx-auto mb-3 ${config.logo}`} alt="Logo" />
            {/* TITOLI */}
            <div className="flex-1 flex flex-col justify-center items-center w-full">
              <div className={`font-extrabold mb-2 tracking-wide text-gray-900 ${config.title}`}>{dati.productTitle}</div>
              {dati.variantTitle && <div className="text-gray-700 mb-2 font-semibold">{dati.variantTitle}</div>}
              <div className="mb-2 text-cyan-800 font-mono font-bold">SKU: {dati.sku}</div>
            </div>
            {/* BARCODE + ICONS */}
            <div className="flex flex-col items-center mt-5">
              {dati.barcode && (
                <Barcode
                  value={dati.barcode}
                  format="EAN13"
                  height={52}
                  width={2}
                  displayValue={true}
                  fontSize={18}
                  className={`mx-auto ${config.barcode}`}
                />
              )}
              <div className="flex gap-2 mt-2 justify-center">
                {(dati.washIcons || WASH_ICONS).map((ic, i) => (
                  <img key={i} src={ic} className="h-9 w-auto" alt="Icona lavaggio" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
