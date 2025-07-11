import { useEffect, useState } from "react";
import { Package, Download, ChevronDown, ChevronUp, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Articolo = {
  model_number: string;
  qty_ordered: number;
  qty_confirmed: number;
  cost?: number | string;
  vendor_product_id?: string;
  po_number?: string;
};

type Riepilogo = {
  id: number;
  fulfillment_center: string;
  start_delivery: string;
  stato_ordine: string;
  po_list: string[];
  created_at: string;
};

type FilterType = {
  data?: string;
  center?: string;
};

function formatDate(dt: string) {
  if (!dt) return "";
  const d = new Date(dt);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`;
}

export default function CompletatiOrdini() {
  const [dati, setDati] = useState<Riepilogo[]>([]);
  const [articoli, setArticoli] = useState<{ [id: number]: Articolo[] }>({});
  const [showAll, setShowAll] = useState<{ [id: number]: boolean }>({});
  const [expanded, setExpanded] = useState<{ [data: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>({});
  const [search, setSearch] = useState("");

  // Modale PO
  const [poModal, setPoModal] = useState<{ open: boolean; poList: any[]; titolo: string }>({ open: false, poList: [], titolo: "" });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rieps = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/completati`
      ).then(r => r.json());

      rieps.sort((a: Riepilogo, b: Riepilogo) => {
        if (b.start_delivery > a.start_delivery) return 1;
        if (b.start_delivery < a.start_delivery) return -1;
        if ((b.created_at || "") > (a.created_at || "")) return 1;
        if ((b.created_at || "") < (a.created_at || "")) return -1;
        return 0;
      });

      setDati(rieps);

      for (const r of rieps) {
        fetch(
          `${import.meta.env.VITE_API_URL}/api/amazon/vendor/items?po_list=${r.po_list.join(",")}`
        )
          .then(r => r.json())
          .then((arr: Articolo[]) => {
            setArticoli(old => ({
              ...old,
              [r.id]: arr.sort((a, b) => a.model_number.localeCompare(b.model_number))
            }));
          });
      }
      setLoading(false);
    }
    load();
  }, []);

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

  // Mostra Modale PO
  function showPoModal(articoliGruppo: Articolo[], titolo: string) {
    // Raggruppa per PO con quantità totali
    const poDettaglio: Record<string, { ordinata: number; confermata: number }> = {};
    articoliGruppo.forEach(a => {
      const po = a.po_number || "-";
      if (!poDettaglio[po]) poDettaglio[po] = { ordinata: 0, confermata: 0 };
      poDettaglio[po].ordinata += a.qty_ordered || 0;
      poDettaglio[po].confermata += a.qty_confirmed || 0;
    });
    const elenco = Object.entries(poDettaglio).map(([po, vals]) => ({ po, ...vals }))
      .sort((a, b) => a.po.localeCompare(b.po));
    setPoModal({
      open: true,
      poList: elenco,
      titolo,
    });
  }

  // Raggruppa per data (start_delivery)
  const groupedByDate: { [data: string]: Riepilogo[] } = {};
  dati.forEach(r => {
    if (
      (filter.data && r.start_delivery !== filter.data) ||
      (filter.center && r.fulfillment_center !== filter.center)
    ) return;
    if (!groupedByDate[r.start_delivery]) groupedByDate[r.start_delivery] = [];
    groupedByDate[r.start_delivery].push(r);
  });

  // Filtri
  const centriUnici = Array.from(new Set(dati.map(d => d.fulfillment_center))).sort();
  const dateUniche = Array.from(new Set(dati.map(d => d.start_delivery))).sort().reverse();

  return (
    <div className="mx-auto max-w-2xl p-2 sm:p-4">
      <h1 className="text-xl md:text-2xl font-bold mb-6 tracking-tight text-gray-800">
        Ordini Completati
      </h1>

      {/* FILTRI */}
      <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
        <select
          className="border rounded-lg p-2 text-sm"
          value={filter.center || ""}
          onChange={e => setFilter(f => ({ ...f, center: e.target.value || undefined }))}
        >
          <option value="">Tutti i Centri</option>
          {centriUnici.map(center => (
            <option key={center} value={center}>{center}</option>
          ))}
        </select>
        <select
          className="border rounded-lg p-2 text-sm"
          value={filter.data || ""}
          onChange={e => setFilter(f => ({ ...f, data: e.target.value || undefined }))}
        >
          <option value="">Tutte le Date</option>
          {dateUniche.map(dt => (
            <option key={dt} value={dt}>{dt}</option>
          ))}
        </select>
        <div className="relative w-full sm:w-auto">
          <input
            type="text"
            className="border rounded-lg p-2 text-sm w-full"
            placeholder="Cerca SKU, centro o PO"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search className="absolute right-3 top-3 text-gray-400" size={16} />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-neutral-400 py-12 animate-pulse">
          Caricamento...
        </div>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <div className="text-center text-neutral-400 py-12">
          Nessun ordine completato per i filtri scelti.
        </div>
      ) : (
        Object.entries(groupedByDate).map(([dataRiep, rieps]) => {
          // Totale raggruppamento per header
          const totaleGruppoOrdinato = rieps.reduce(
            (sum, r) => sum + ((articoli[r.id] || []).reduce((s, a) => s + (a.qty_ordered || 0), 0)),
            0
          );
          const totaleGruppoConfermato = rieps.reduce(
            (sum, r) => sum + ((articoli[r.id] || []).reduce((s, a) => s + (a.qty_confirmed || 0), 0)),
            0
          );
          const totaleGruppoValOrd = rieps.reduce(
            (sum, r) => sum + ((articoli[r.id] || []).reduce((s, a) => s + ((a.qty_ordered || 0) * (Number(a.cost) || 0)), 0)),
            0
          );
          const totaleGruppoValConf = rieps.reduce(
            (sum, r) => sum + ((articoli[r.id] || []).reduce((s, a) => s + ((a.qty_confirmed || 0) * (Number(a.cost) || 0)), 0)),
            0
          );
          // Tutti gli articoli di questo gruppo

          return (
            <div key={dataRiep} className="mb-8 bg-gray-50 rounded-2xl shadow border">
              {/* Intestazione raggruppamento */}
              <button
                className="w-full text-left px-4 py-3 flex justify-between items-center bg-gray-100 rounded-t-2xl focus:outline-none"
                onClick={() =>
                  setExpanded(prev => ({
                    ...prev,
                    [dataRiep]: !prev[dataRiep],
                  }))
                }
              >
                <div>
                  <div className="font-bold text-base text-gray-800">
                    Data consegna: {dataRiep}
                  </div>
                  <div className="text-xs font-medium text-gray-500">
                    Tot. ordinato: <span className="text-blue-700 font-bold">{totaleGruppoOrdinato}</span> | 
                    Tot. confermato: <span className="text-green-700 font-bold">{totaleGruppoConfermato}</span>
                    <br />
                    Val. ordinato: <span className="text-blue-700 font-bold">
                      € {totaleGruppoValOrd.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {" | "}
                    Val. confermato: <span className="text-green-700 font-bold">
                      € {totaleGruppoValConf.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                {expanded[dataRiep] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {/* Lista ordini di quel gruppo data */}
              {expanded[dataRiep] && (
                <div className="p-2">
                  {rieps
                    .filter(
                      r =>
                        !search ||
                        r.fulfillment_center.toLowerCase().includes(search.toLowerCase()) ||
                        r.po_list.join(",").toLowerCase().includes(search.toLowerCase()) ||
                        (articoli[r.id] || []).some(a =>
                          a.model_number.toLowerCase().includes(search.toLowerCase())
                        )
                    )
                    .map(group => {
                      const listaArticoli = (articoli[group.id] || []).slice().sort((a, b) =>
                        a.model_number.localeCompare(b.model_number)
                      );
                      const show = showAll[group.id] || false;
                      const visibili = show ? listaArticoli : listaArticoli.slice(0, 5);
                      // Totali per il footer singolo ordine
                      const totOrd = listaArticoli.reduce((sum, x) => sum + (x.qty_ordered || 0), 0);
                      const totConf = listaArticoli.reduce((sum, x) => sum + (x.qty_confirmed || 0), 0);
                      const percTot =
                        totOrd > 0
                          ? Math.min(Math.round((totConf / totOrd) * 100), 100)
                          : 0;

                      return (
                        <div
                          key={group.id}
                          className="mb-6 rounded-2xl shadow border bg-white/80 backdrop-blur-xl transition-all overflow-hidden px-2 py-3"
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
                              {group.created_at && (
                                <span className="text-xs text-blue-700 font-semibold mt-1">
                                  Creato il: {formatDate(group.created_at)}
                                </span>
                              )}
                            </div>
                            {/* Pulsante PO */}
                            <button
                              className="mr-2 px-2 py-1 rounded bg-blue-100 text-blue-700 font-bold text-xs hover:bg-blue-200 transition"
                              onClick={() =>
                                showPoModal(
                                  listaArticoli,
                                  `Dettaglio PO - ${group.fulfillment_center} - ${group.start_delivery}`
                                )
                              }
                            >
                              PO
                            </button>
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
                                  <th className="py-2 text-center font-medium text-neutral-500">Completamento</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visibili.map((art, i) => {
                                  const completamento =
                                    art.qty_ordered > 0
                                      ? Math.min(
                                          Math.round((art.qty_confirmed / art.qty_ordered) * 100),
                                          100
                                        )
                                      : 0;
                                  return (
                                    <tr key={i}>
                                      <td className="pl-2 py-2 font-mono text-neutral-700">{art.model_number}</td>
                                      <td className="py-2 text-center">{art.qty_ordered}</td>
                                      <td className="py-2 text-center">{art.qty_confirmed}</td>
                                      <td className="py-2 text-center align-middle w-[100px]">
                                        <div className="relative w-full max-w-[90px] h-4 bg-gray-100 rounded-full overflow-hidden mx-auto">
                                          <div
                                            className="h-4 rounded-full bg-green-400"
                                            style={{
                                              width: `${completamento}%`,
                                              transition: "width 0.4s"
                                            }}
                                          ></div>
                                          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                                            {completamento}%
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            {/* Totale ordine */}
                            <div className="flex flex-col sm:flex-row gap-2 justify-between items-center border-t mt-3 pt-2">
                              <div className="font-semibold text-sm text-neutral-700">
                                Totale ordinato: <span className="text-blue-700">{totOrd}</span> | Totale confermato: <span className="text-green-700">{totConf}</span>
                                <br />
                                <span className="text-xs font-medium text-gray-500">
                                  Valore ordinato:{" "}
                                  <span className="text-blue-700 font-bold">
                                    € {listaArticoli.reduce((sum, x) => sum + ((x.qty_ordered || 0) * (Number(x.cost) || 0)), 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>{" "}
                                  | Valore confermato:{" "}
                                  <span className="text-green-700 font-bold">
                                    € {listaArticoli.reduce((sum, x) => sum + ((x.qty_confirmed || 0) * (Number(x.cost) || 0)), 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </span>
                              </div>
                              <div className="w-full sm:w-1/2 max-w-[210px]">
                                <div className="relative w-full h-5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-5 rounded-full bg-green-500"
                                    style={{
                                      width: `${percTot}%`,
                                      transition: "width 0.4s"
                                    }}
                                  ></div>
                                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
                                    {percTot}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            {listaArticoli.length > 5 && (
                              <div className="flex justify-center my-2">
                                <button
                                  className="text-xs font-semibold text-blue-700 underline flex items-center gap-1"
                                  onClick={() => setShowAll(old => ({ ...old, [group.id]: !old[group.id] }))}
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
                    })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* === MODALE PO DETTAGLIO === */}
      {poModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 min-w-[340px] shadow-xl relative">
            <button
              className="absolute top-2 right-2 text-2xl text-gray-400 hover:text-black"
              onClick={() => setPoModal({ ...poModal, open: false })}
            >
              ×
            </button>
            <h2 className="font-bold text-lg mb-2 text-blue-700">{poModal.titolo}</h2>
            <table className="w-full mb-3 text-sm">
              <thead>
                <tr>
                  <th className="text-left py-1">PO</th>
                  <th className="text-center py-1">Q. ordinata</th>
                  <th className="text-center py-1">Q. confermata</th>
                </tr>
              </thead>
              <tbody>
                {poModal.poList.map((po, idx) => (
                  <tr key={idx}>
                    <td className="font-mono">{po.po}</td>
                    <td className="text-center">{po.ordinata ?? "-"}</td>
                    <td className="text-center">{po.confermata ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setPoModal({ ...poModal, open: false })}
              className="mt-2 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-blue-700 font-semibold"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
