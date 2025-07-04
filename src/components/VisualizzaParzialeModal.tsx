import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useState } from "react";

export default function VisualizzaParzialeModal({
  dati,
  center,
  numeroParziale,
  data,
  triggerLabel = "Visualizza",
}: {
  dati: any[];
  center: string;
  numeroParziale: number;
  data: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleExportExcel = () => {
    // Prepara i dati come prima
    const ws = XLSX.utils.json_to_sheet(
      dati.map(row => ({
        SKU: row.model_number,
        Quantità: row.quantita,
        Collo: row.collo
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parziale");
    
    // Pulizia dei caratteri non validi nei nomi file
    function safe(str: string | number) {
      return String(str).replace(/[^a-zA-Z0-9_\-]/g, "_");
    }

    // Genera nome file
    const nomeFile = `${safe(center)}_${safe(numeroParziale)}_${safe(data)}.xlsx`;

    XLSX.writeFile(wb, nomeFile);
  };

  const handleVisualizzaPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Lista Parziale`, 14, 18);
    doc.setFontSize(12);
    doc.text(`Centro: ${center || ""}`, 14, 28);
    doc.text(`N° Parziale: ${numeroParziale || ""}`, 70, 28);
    doc.text(`Data: ${data || ""}`, 130, 28);
    autoTable(doc, {
      head: [["SKU", "Quantità", "Collo"]],
      body: dati.map(row => [row.model_number, row.quantita, row.collo]),
      startY: 36,
      theme: "grid",
      styles: { fontSize: 12 },
      headStyles: { fillColor: [6, 182, 212] },
    });
    doc.output("dataurlnewwindow");
  };

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
          <div className="bg-white p-3 rounded-2xl shadow-lg w-full max-w-lg relative flex flex-col"
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
            <div className="flex justify-between items-center mb-2 pr-6 gap-2">
              <span className="font-bold text-lg text-blue-900">Lista Parziale</span>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 rounded bg-green-700 text-white font-semibold text-sm hover:bg-green-900"
                  onClick={handleExportExcel}
                >
                  Esporta Excel
                </button>
                <button
                  className="px-3 py-1 rounded bg-cyan-700 text-white font-semibold text-sm hover:bg-cyan-900"
                  onClick={handleVisualizzaPDF}
                >
                  Visualizza PDF
                </button>
              </div>
            </div>
            <div
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
