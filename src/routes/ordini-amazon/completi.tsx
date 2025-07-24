import { useEffect, useState } from "react";
import { Package, Download, ChevronDown, ChevronUp, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";

// ————— QUI I TIPI ——————
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
  center?: string;
};
// ————— FINE TIPI ——————

function formatDate(dt: string) {
  if (!dt) return "";
  const d = new Date(dt);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`;
}

async function fetchAllItemsByPO(po_list: string[]) {
  if (!po_list.length) return [];
  let all: Articolo[] = [];
  let offset = 0;
  const limit = 200;
  while (true) {
    const url = `${import.meta.env.VITE_API_URL}/api/amazon/vendor/items?po_list=${po_list.join(",")}&offset=${offset}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

function formatYMD(d: Date) {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function isOrderInRange(orderDate: string, selectedRange: DateRange | undefined) {
  if (!selectedRange?.from) return false;
  const fromStr = formatYMD(selectedRange.from);
  const toStr = selectedRange.to ? formatYMD(selectedRange.to) : fromStr;
  return orderDate >= fromStr && orderDate <= toStr;
}

export default function CompletatiOrdini() {
  const [dati, setDati] = useState<Riepilogo[]>([]);
  const [articoli, setArticoli] = useState<{ [id: number]: Articolo[] }>({});
  const [expanded, setExpanded] = useState<{ [data: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [loadingArticoli, setLoadingArticoli] = useState(false);
  const [filter, setFilter] = useState<FilterType>({});
  const [search, setSearch] = useState("");
  const [poModal, setPoModal] = useState<{ open: boolean; poList: any[]; titolo: string }>({ open: false, poList: [], titolo: "" });

  // Modale articoli
  const [modalArticoli, setModalArticoli] = useState<{ open: boolean; articoli: Articolo[]; titolo: string }>({
    open: false, articoli: [], titolo: ""
  });

  // CALENDARIO SEMPRE VISIBILE
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);

  // Carica solo i riepiloghi all'inizio
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
      setLoading(false);
    }
    load();
  }, []);

  // Quando selezioni intervallo, carica SOLO gli articoli dei riepiloghi mostrati
  useEffect(() => {
    setLoadingArticoli(true);

    let ordiniSelezionati: Riepilogo[] = [];
    if (selectedRange?.from) {
      ordiniSelezionati = dati.filter(o =>
        isOrderInRange(o.start_delivery, selectedRange) &&
        (!filter.center || o.fulfillment_center === filter.center)
      );
    }
    if (ordiniSelezionati.length === 0) {
      setLoadingArticoli(false);
      return;
    }

    const poList = ordiniSelezionati.flatMap(o => o.po_list);
    fetchAllItemsByPO(poList).then(items => {
      const byOrder: { [id: number]: Articolo[] } = {};
      ordiniSelezionati.forEach(order => {
        byOrder[order.id] = items.filter(it => order.po_list.includes(it.po_number || ""));
      });
      setArticoli(old => ({ ...old, ...byOrder }));
      setLoadingArticoli(false);
    });
    // eslint-disable-next-line
  }, [selectedRange, filter.center, dati]);

  const centriUnici = Array.from(new Set(dati.map(d => d.fulfillment_center))).sort();
  const dateUniche = Array.from(new Set(dati.map(d => d.start_delivery))).sort().reverse();
  const highlightedDays = dateUniche.map(d => new Date(d));

  // Raggruppa solo per le date selezionate dal calendario (range)
  const groupedByDate: { [data: string]: Riepilogo[] } = {};
  dati.forEach(r => {
    if (
      !(selectedRange?.from && isOrderInRange(r.start_delivery, selectedRange))
    ) return;
    if (filter.center && r.fulfillment_center !== filter.center) return;
    if (!groupedByDate[r.start_delivery]) groupedByDate[r.start_delivery] = [];
    groupedByDate[r.start_delivery].push(r);
  });

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

      {/* CALENDARIO RANGE SEMPRE VISIBILE */}
      <div className="flex flex-col items-center mb-6">
        <DayPicker
          mode="range"
          selected={selectedRange}
          onSelect={setSelectedRange}
          modifiers={{ highlighted: highlightedDays }}
          modifiersClassNames={{ highlighted: "bg-green-100 rounded-full" }}
          showOutsideDays
        />
        <div className="mt-2 flex gap-2">
          <span className="text-sm text-gray-600">
            {selectedRange?.from && !selectedRange?.to && `Inizio: ${selectedRange.from.toLocaleDateString()}`}
            {selectedRange?.from && selectedRange?.to && `Da ${selectedRange.from.toLocaleDateString()} a ${selectedRange.to.toLocaleDateString()}`}
            {!selectedRange?.from && "Seleziona un intervallo di date"}
          </span>
          {selectedRange?.from && (
            <button
              className="ml-2 px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-green-700 font-semibold"
              onClick={() => setSelectedRange(undefined)}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* RISULTATI */}
      {loading ? (
        <div className="text-center text-neutral-400 py-12 animate-pulse">
          Attendi sto Caricando i Completi...
        </div>
      ) : !selectedRange?.from ? (
        <div className="text-center text-neutral-400 py-12">
          Seleziona un intervallo di date per vedere gli ordini completati.
        </div>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <div className="text-center text-neutral-400 py-12">
          Nessun ordine completato per i filtri scelti.
        </div>
      ) : (
        Object.entries(groupedByDate).map(([dataRiep, rieps]) => {
          const totaliPronti = rieps.every(r => articoli[r.id]);
          const totaleGruppoOrdinato = totaliPronti
            ? rieps.reduce(
                (sum, r) => sum + ((articoli[r.id] || []).reduce((s, a) => s + (a.qty_ordered || 0), 0)),
                0
              )
            : 0;
          const totaleGruppoConfermato = totaliPronti
            ? rieps.reduce(
                (sum, r) => sum + ((articoli[r.id] || []).reduce((s, a) => s + (a.qty_confirmed || 0), 0)),
                0
              )
            : 0;
          const totaleGruppoValOrd = totaliPronti
            ? rieps.reduce(
                (sum, r) => sum + ((articoli[r.id] || []).reduce((s, a) => s + ((a.qty_ordered || 0) * (Number(a.cost) || 0)), 0)),
                0
              )
            : 0;
          const totaleGruppoValConf = totaliPronti
            ? rieps.reduce(
                (sum, r) => sum + ((articoli[r.id] || []).reduce((s, a) => s + ((a.qty_confirmed || 0) * (Number(a.cost) || 0)), 0)),
                0
              )
            : 0;

          return (
            <div key={dataRiep} className="mb-8 bg-gray-50 rounded-2xl shadow border">
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
                  {loadingArticoli || !totaliPronti ? (
                    <div className="text-xs font-medium text-gray-500 animate-pulse">
                      <span className="text-blue-700 font-bold">Caricamento totali...</span>
                    </div>
                  ) : (
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
                  )}
                </div>
                {expanded[dataRiep] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
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
                            <button
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-semibold shadow hover:bg-gray-200 transition"
                              onClick={() =>
                                setModalArticoli({
                                  open: true,
                                  articoli: listaArticoli,
                                  titolo: `Articoli - ${group.fulfillment_center} - ${group.start_delivery}`
                                })
                              }
                            >
                              Visualizza articoli ({listaArticoli.length})
                            </button>
                          </div>

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
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* === MODALE ARTICOLI === */}
      {modalArticoli.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 min-w-[340px] max-h-[80vh] overflow-auto shadow-xl relative">
            <button
              className="absolute top-2 right-2 text-2xl text-gray-400 hover:text-black"
              onClick={() => setModalArticoli({ ...modalArticoli, open: false })}
            >
              ×
            </button>
            <h2 className="font-bold text-lg mb-2 text-green-700">{modalArticoli.titolo}</h2>
            <table className="w-full mb-3 text-sm">
              <thead>
                <tr>
                  <th className="py-2 pl-2 text-left font-medium text-neutral-500">SKU</th>
                  <th className="py-2 text-center font-medium text-neutral-500">Q.tà ordinata</th>
                  <th className="py-2 text-center font-medium text-neutral-500">Q.tà confermata</th>
                  <th className="py-2 text-center font-medium text-neutral-500">Completamento</th>
                </tr>
              </thead>
              <tbody>
                {modalArticoli.articoli.map((art, i) => {
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
            <button
              onClick={() => setModalArticoli({ ...modalArticoli, open: false })}
              className="mt-2 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-green-700 font-semibold"
            >
              Chiudi
            </button>
          </div>
        </div>
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
