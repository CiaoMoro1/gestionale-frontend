import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";

// Passa qui come prop l'array "dati" del parziale!
export default function VisualizzaParzialeModal({
  dati,
  triggerLabel = "Visualizza",
}: { dati: any[]; triggerLabel?: string }) {
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-2">
          <div
            className="bg-white p-3 rounded-2xl shadow-lg w-full max-w-lg relative flex flex-col"
            style={{
              maxHeight: "78vh",
              minWidth: "0",
              width: "100%",
            }}
          >
            <button
              className="absolute top-2 right-4 text-xl text-gray-400 hover:text-gray-700"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <div className="flex justify-between items-center mb-2 pr-6">
              <span className="font-bold text-lg text-blue-900">Lista Parziale</span>
              <button
                className="px-3 py-1 rounded bg-cyan-700 text-white font-semibold text-sm hover:bg-cyan-900"
                onClick={handlePrint}
              >
                Stampa PDF
              </button>
            </div>
            {/* CONTENUTO PDF */}
            <div
              ref={componentRef}
              className="p-1 print:bg-white flex-1 overflow-y-auto"
              style={{
                minHeight: 0,
                maxHeight: "56vh",
              }}
            >
              <table className="w-full border text-[15px] min-w-[330px]">
                <thead>
                  <tr className="bg-cyan-50 sticky top-0 z-10">
                    <th className="border px-2 py-1 text-left font-semibold text-xs md:text-sm">SKU</th>
                    <th className="border px-2 py-1 text-center font-semibold text-xs md:text-sm">Quantità</th>
                    <th className="border px-2 py-1 text-center font-semibold text-xs md:text-sm">Collo</th>
                  </tr>
                </thead>
                <tbody>
                  {dati.map((row, i) => (
                    <tr key={i} className="bg-white">
                      <td className="border px-2 py-1 font-mono break-all">{row.model_number}</td>
                      <td className="border px-2 py-1 text-center">{row.quantita}</td>
                      <td className="border px-2 py-1 text-center">{row.collo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right mt-2">
              <button
                className="text-sm text-gray-500 hover:underline"
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
