import React, { useState, useRef, useMemo, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

type Articolo = { prezzo_totale?: number };

type Nota = {
  id: number;
  data_nota: string;
  numero_nota: string;
  po: string;                    // qui oggi hai il tracking, lo lasciamo anche se non lo mostriamo
  vret: string;                  // QUI c’è il Return ID (ID reso)
  xml_url: string;
  imponibile?: number;
  iva?: number;
  totale?: number;
  articoli?: Articolo[];
  fattura_collegata?: string;    // <- opzionale: se aggiungi la colonna lato backend
  stato: string;
  created_at: string;
};

type JobResult = { note_generate?: number; note?: Nota[] };
type JobStatus = {
  status: string;
  result?: JobResult;
  error?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
};

// helper: estrai VRET dal nome file XML (es. "notecredito/xml/NC0001_VRET1234.xml")
const getVretFromXmlUrl = (xmlUrl: string): string => {
  if (!xmlUrl) return "";
  const file = xmlUrl.split("/").pop() || "";   // "NC0001_VRET1234.xml"
  const noExt = file.replace(/\.xml$/i, "");
  const parts = noExt.split("_");               // ["NC0001", "VRET1234"]
  return parts.length >= 2 ? parts[1] : "";
};

export default function NoteCreditoResoPage() {
  const [itemsFile, setItemsFile] = useState<File | null>(null);
  const [summaryFile, setSummaryFile] = useState<File | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [note, setNote] = useState<Nota[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  // filtri data
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // 👉 NUOVO: data nota credito (opzionale)
  const [dataNota, setDataNota] = useState<string>("");

  // paginazione
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 25;

  const pollingRef = useRef<number | null>(null);
  const headerCbRef = useRef<HTMLInputElement | null>(null);

  const handleItemsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setItemsFile(e.target.files?.[0] || null);
  };
  const handleSummaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSummaryFile(e.target.files?.[0] || null);
  };

  const uploadFiles = async () => {
    if (!itemsFile) return;
    const formData = new FormData();
    formData.append("return_items", itemsFile);
    if (summaryFile) formData.append("return_summary", summaryFile);
    if (dataNota) formData.append("data_nota", dataNota); // 👈 NUOVO

    setJobStatus(null);
    setNote([]);
    setSelectedIds([]);
    setLastJobId(null);
    setCurrentPage(1);

    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_reso/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (data?.job_id) {
      setLastJobId(data.job_id);
      pollJob(data.job_id);
    } else {
      setJobStatus({ status: "failed", error: "Upload fallito" });
    }
  };

  const pollJob = (jid: string) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    const interval = window.setInterval(async () => {
      const resp = await fetch(`${API_BASE_URL}/api/jobs/${jid}/status`);
      const data: JobStatus = await resp.json();
      setJobStatus(data);
      if (data.status === "done" || data.status === "failed") {
        window.clearInterval(interval);
        pollingRef.current = null;
        // dopo DONE: mostra SOLO quelle di quel job
        fetchNoteList({ job_id: jid });
      }
    }, 1500);
    pollingRef.current = interval;
  };

  // carica lista con filtri opzionali
  const fetchNoteList = async (opts?: { job_id?: string; date_from?: string; date_to?: string }) => {
    const p = new URLSearchParams();
    if (opts?.job_id) p.set("job_id", opts.job_id);
    if (opts?.date_from) p.set("date_from", opts.date_from);
    if (opts?.date_to) p.set("date_to", opts.date_to);

    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_reso/list${p.toString() ? `?${p}` : ""}`);
    const data: Nota[] = await resp.json();
    setNote(data || []);
    setSelectedIds([]);
    setCurrentPage(1); // reset pagina dopo ogni nuova fetch
  };

  const downloadXML = (id: number) => {
    window.open(`${API_BASE_URL}/api/notecredito_amazon_reso/download/${id}`, "_blank");
  };

  const downloadZIP = async () => {
    if (!selectedIds.length) return;
    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_reso/download_zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "NoteCredito_AmazonReso.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  };

  const toggleId = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const renderTotale = (n: Nota) => {
    if (typeof n.totale === "number") return n.totale.toFixed(2);
    const sum = (n.articoli || []).reduce((acc, a) => acc + (a.prezzo_totale || 0), 0);
    if (sum > 0) return sum.toFixed(2);
    return "—";
  };

  // ======= PAGINAZIONE CLIENT-SIDE =======
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(note.length / PAGE_SIZE)),
    [note.length]
  );

  const paginatedNotes = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return note.slice(start, end);
  }, [note, currentPage]);

  // ======= SELEZIONA TUTTI (solo visibili in pagina) =======
  const visibleIds = useMemo(() => paginatedNotes.map((n) => n.id), [paginatedNotes]);

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id)),
    [visibleIds, selectedIds]
  );

  const someVisibleSelected = useMemo(
    () => selectedIds.some((id) => visibleIds.includes(id)) && !allVisibleSelected,
    [visibleIds, selectedIds, allVisibleSelected]
  );

  useEffect(() => {
    if (headerCbRef.current) {
      headerCbRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      // deseleziona solo i visibili, preserva selezioni di altre pagine
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // seleziona tutti i visibili in aggiunta ai già selezionati
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // Cleanup polling all'unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Note di Credito Amazon Vendor - VRET</h1>

      {/* Upload files */}
      <div className="mb-6 p-4 border rounded bg-white">
        <div className="mb-3">
          <label className="block font-medium mb-2">Carica file Return_Items.csv (obbligatorio)</label>
          <input type="file" accept=".csv" onChange={handleItemsChange} />
        </div>
        
        <div className="mb-4">
          <label className="block font-medium mb-2">Carica Return_Summary (opzionale: .xls/.xlsx)</label>
          <input type="file" accept=".xls,.xlsx" onChange={handleSummaryChange} />
        </div>
        {/* NUOVO: data nota di credito */}
        <div className="mb-4">
          <label className="block font-medium mb-2">
            Data nota di credito (opzionale)
          </label>
          <input
            type="date"
            value={dataNota}
            onChange={(e) => setDataNota(e.target.value)}
            className="border rounded px-2 py-1 w-48"
          />
          <p className="text-xs text-gray-500 mt-1">
            Se lasci vuoto, verrà usata la data di oggi.
          </p>
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={!itemsFile}
          onClick={uploadFiles}
        >
          Carica e genera note
        </button>
      </div>

      {/* Filtri */}
      <div className="mb-6 p-4 border rounded bg-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Dal</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Al</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              className="bg-gray-700 text-white px-3 py-2 rounded w-full"
              onClick={() =>
                fetchNoteList({ date_from: dateFrom || undefined, date_to: dateTo || undefined })
              }
            >
              Filtra per data
            </button>
          </div>
          <div className="flex gap-2">
            <button
              className="bg-gray-400 text-white px-3 py-2 rounded w-full"
              onClick={() => fetchNoteList()}
            >
              Mostra tutte
            </button>
            {lastJobId && (
              <button
                className="bg-indigo-600 text-white px-3 py-2 rounded w-full"
                onClick={() => fetchNoteList({ job_id: lastJobId })}
                title="Mostra solo le note generate dall&apos;ultimo job"
              >
                Ultimo job
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Job status */}
      {jobStatus && (
        <div className="mb-4">
          <div>
            <b>Status job:</b> {jobStatus.status}
            {jobStatus.status === "done" && <span className="ml-2 text-green-700">Note generate!</span>}
            {jobStatus.status === "failed" && <span className="ml-2 text-red-700">Errore!</span>}
          </div>
          {jobStatus.error && <div className="text-red-600">Errore: {jobStatus.error}</div>}
        </div>
      )}

      {/* Notes table */}
      {note.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Note di credito: {note.length}</span>
            <button
              className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
              disabled={!selectedIds.length}
              onClick={downloadZIP}
            >
              Download ZIP ({selectedIds.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="w-10 text-center">
                    <input
                      ref={headerCbRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Seleziona tutte le note visibili"
                    />
                  </th>
                  <th>Numero</th>
                  <th>Data</th>
                  <th>Id Reso</th>
                  <th>VRET</th>
                  <th>Fattura collegata</th>
                  <th>Totale</th>
                  <th>Stato</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {paginatedNotes.map((n) => (
                  <tr key={n.id} className="border-t">
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(n.id)}
                        onChange={() => toggleId(n.id)}
                        aria-label={`Seleziona nota ${n.numero_nota}`}
                      />
                    </td>
                    <td>{n.numero_nota}</td>
                    <td>{n.data_nota}</td>
                    <td>{n.vret}</td> {/* qui c'è il Return ID */}
                    <td>{getVretFromXmlUrl(n.xml_url)}</td> {/* qui estraiamo il VRET dal filename */}
                    <td>{n.fattura_collegata || "—"}</td>
                    <td>{renderTotale(n)}</td>
                    <td>{n.stato}</td>
                    <td>
                      <button
                        className="bg-blue-500 text-white px-2 py-1 rounded"
                        onClick={() => downloadXML(n.id)}
                      >
                        XML
                      </button>
                    </td>
                  </tr>
                ))}

                {paginatedNotes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-4">
                      Nessuna nota nella pagina corrente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Controlli paginazione */}
          <div className="flex justify-between items-center mt-3 text-sm">
            <span>
              Pagina {currentPage} di {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                ‹ Prec
              </button>
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                disabled={currentPage === totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Succ ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
