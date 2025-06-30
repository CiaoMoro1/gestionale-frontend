import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";

// Passa qui come prop l'array "dati" del parziale!
export default function VisualizzaParzialeModal({ dati, triggerLabel = "Visualizza" }: { dati: any[], triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const componentRef = useRef<any>(null);
  const handlePrint = useReactToPrint({
    // @ts-ignore
    content: () => componentRef.current,
    documentTitle: "Lista Parziale",
  });

  return (
    <>
      <button
        className="text-blue-700 underline text-xs md:text-sm"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-4 rounded-2xl shadow-lg w-full max-w-lg relative">
            <button
              className="absolute top-2 right-4 text-xl text-gray-400 hover:text-gray-700"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-lg text-blue-900">Lista Parziale</span>
              <button
                className="px-3 py-1 rounded bg-cyan-700 text-white font-semibold text-sm hover:bg-cyan-900"
                onClick={handlePrint}
              >
                Stampa PDF
              </button>
            </div>
            {/* CONTENUTO PDF */}
            <div ref={componentRef} className="p-2 print:bg-white">
              <table className="w-full border mt-2 mb-3 text-[15px]">
                <thead>
                  <tr className="bg-cyan-50">
                    <th className="border px-2 py-1 text-left font-semibold text-sm">SKU</th>
                    <th className="border px-2 py-1 text-center font-semibold text-sm">Quantità</th>
                    <th className="border px-2 py-1 text-center font-semibold text-sm">Collo</th>
                  </tr>
                </thead>
                <tbody>
                  {dati.map((row, i) => (
                    <tr key={i}>
                      <td className="border px-2 py-1 font-mono">{row.model_number}</td>
                      <td className="border px-2 py-1 text-center">{row.quantita}</td>
                      <td className="border px-2 py-1 text-center">{row.collo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right">
              <button
                className="text-sm text-gray-500 hover:underline mt-2"
                onClick={() => setOpen(false)}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
