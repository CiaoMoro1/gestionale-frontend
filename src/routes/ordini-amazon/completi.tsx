import { useEffect, useState } from "react";
import { Package, Download, ChevronDown, ChevronUp } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Articolo = {
  model_number: string;
  qty_ordered: number;
  qty_confirmed: number;
  vendor_product_id?: string;
};

type Riepilogo = {
  id: number;
  fulfillment_center: string;
  start_delivery: string;
  stato_ordine: string;
  po_list: string[];
};

export default function CompletatiOrdini() {
  const [dati, setDati] = useState<Riepilogo[]>([]);
  const [articoli, setArticoli] = useState<{ [id: number]: Articolo[] }>({});
  const [showAll, setShowAll] = useState<{ [id: number]: boolean }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rieps = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/completati`
      ).then(r => r.json());
      setDati(rieps);

      for (const r of rieps) {
        fetch(
          `${import.meta.env.VITE_API_URL}/api/amazon/vendor/items?po_list=${r.po_list.join(",")}`
        )
          .then(r => r.json())
          .then((arr: Articolo[]) => {
            // ORDINA PER SKU (model_number) dalla A alla Z
            arr.sort((a, b) => a.model_number.localeCompare(b.model_number));
            setArticoli(old => ({ ...old, [r.id]: arr }));
          });
      }
      setLoading(false);
    }
    load();
  }, []);

  // Export Excel
  function handleExportExcel(riep: Riepilogo) {
    const lista = articoli[riep.id] || [];
    const ws = XLSX.utils.json_to_sheet(
      lista.map(row => ({
        SKU: row.model_number,
        "Q.tà ordinata": row.qty_ordered,
        "Q.tà confermata": row.qty_confirmed,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Completato");
    function safe(str: string | number) {
      return String(str).replace(/[^a-zA-Z0-9_\-]/g, "_");
    }
    const nomeFile = `${safe(riep.fulfillment_center)}_${safe(riep.start_delivery)}.xlsx`;
    XLSX.writeFile(wb, nomeFile);
  }

  // Export PDF
  function handleExportPDF(riep: Riepilogo) {
    const lista = articoli[riep.id] || [];
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Ordine Completato", 14, 18);
    doc.setFontSize(12);
    doc.text(`Centro: ${riep.fulfillment_center}`, 14, 28);
    doc.text(`Data: ${riep.start_delivery}`, 90, 28);
    autoTable(doc, {
      head: [["SKU", "Q.tà ordinata", "Q.tà confermata"]],
      body: lista.map(row => [
        row.model_number,
        row.qty_ordered,
        row.qty_confirmed,
      ]),
      startY: 36,
      theme: "grid",
      styles: { fontSize: 12 },
      headStyles: { fillColor: [34, 197, 94] },
    });
    doc.output("dataurlnewwindow");
  }

  function toggleShowAll(id: number) {
    setShowAll(old => ({ ...old, [id]: !old[id] }));
  }

  return (
    <div className="mx-auto max-w-2xl p-2 sm:p-4">
      <h1 className="text-xl md:text-2xl font-bold mb-6 tracking-tight text-gray-800">
        Ordini Completati
      </h1>
      {loading ? (
        <div className="text-center text-neutral-400 py-12 animate-pulse">
          Caricamento...
        </div>
      ) : dati.length === 0 ? (
        <div className="text-center text-neutral-400 py-12">Nessun ordine completato.</div>
      ) : (
        dati.map((group) => {
          const listaArticoli = articoli[group.id] || [];
          const show = showAll[group.id] || false;
          const visibili = show ? listaArticoli : listaArticoli.slice(0, 5);

          return (
            <div
              key={group.id}
              className="mb-6 rounded-2xl shadow border bg-white/70 backdrop-blur-xl transition-all overflow-hidden px-2 py-3"
            >
              <div className="flex items-center gap-3 pb-1 px-2">
                <div className="shrink-0 flex items-center justify-center rounded-xl bg-gray-100 w-12 h-12 shadow">
                  <Package className="text-green-700" size={26} />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="font-bold text-lg tracking-wide text-neutral-900 uppercase">
                    {group.fulfillment_center}
                  </span>
                  <span className="text-xs text-neutral-500 font-medium">
                    {group.start_delivery}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold text-xs shadow border border-white/20">
                  {group.stato_ordine}
                </span>
              </div>

              <div className="flex gap-2 mt-2 mb-1 flex-wrap">
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 text-white font-semibold shadow hover:bg-green-900 transition"
                  onClick={() => handleExportExcel(group)}
                >
                  <Download size={18} />
                  Esporta Excel
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold shadow hover:bg-cyan-900 transition"
                  onClick={() => handleExportPDF(group)}
                >
                  <Download size={18} />
                  Esporta PDF
                </button>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm min-w-[270px] mt-2">
                  <thead>
                    <tr>
                      <th className="py-2 pl-2 text-left font-medium text-neutral-500">SKU</th>
                      <th className="py-2 text-center font-medium text-neutral-500">Q.tà ordinata</th>
                      <th className="py-2 text-center font-medium text-neutral-500">Q.tà confermata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibili.map((art, i) => (
                      <tr key={i}>
                        <td className="pl-2 py-2 font-mono text-neutral-700">{art.model_number}</td>
                        <td className="py-2 text-center">{art.qty_ordered}</td>
                        <td className="py-2 text-center">{art.qty_confirmed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {listaArticoli.length > 5 && (
                  <div className="flex justify-center my-2">
                    <button
                      className="text-xs font-semibold text-blue-700 underline flex items-center gap-1"
                      onClick={() => toggleShowAll(group.id)}
                    >
                      {show ? (
                        <>
                          Visualizza meno <ChevronUp size={14} />
                        </>
                      ) : (
                        <>
                          Visualizza di più <ChevronDown size={14} />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
