import React, { useState, useRef, useMemo, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

type NotaCoop = {
  id: number;
  data_nota: string;
  numero_nota: string;
  invoice_number: string;
  invoice_date?: string | null;
  agreement_number?: string | null;
  agreement_title?: string | null;
  funding_type?: string | null;
  imponibile: number;
  iva: number;
  totale: number;
  codice_destinatario: string;
  xml_url: string;
  stato: string;
  job_id?: string | null;
  created_at: string;
};

type JobResult = {
  generate?: number;
  note?: NotaCoop[];
};

type JobStatus = {
  status: string;
  result?: JobResult;
  error?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
};

type SortKey =
  | "data_nota"
  | "numero_nota"
  | "invoice_number"
  | "imponibile"
  | "totale";

export default function NoteCreditoCoopPage() {
  const [file, setFile] = useState<File | null>(null);

  const [aliquota, setAliquota] = useState<string>("22");
  const [creditCol, setCreditCol] = useState<string>("");
  const [saldoMode, setSaldoMode] = useState<"imponibile" | "lordo">("imponibile");

  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [note, setNote] = useState<NotaCoop[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [dataNota, setDataNota] = useState<string>(""); // 👈 NUOVO


  // filtri lista
  const [filterInvoice, setFilterInvoice] = useState<string>("");
  const [filterStato, setFilterStato] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [filterJobId, setFilterJobId] = useState<string>("");
  const [notaFrom, setNotaFrom] = useState<string>("");
  const [notaTo, setNotaTo] = useState<string>("");

  // paginazione
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 25;

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("data_nota");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const pollingRef = useRef<number | null>(null);
  const headerCbRef = useRef<HTMLInputElement | null>(null);

  // ====== Upload Excel & Job ======
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const uploadFile = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("aliquota", aliquota || "22");
    if (creditCol.trim()) formData.append("credit_col", creditCol.trim());
    formData.append("saldo_trattato_come", saldoMode);
    if (dataNota) formData.append("data_nota", dataNota); // 👈 NUOVO


    setJobStatus(null);
    setNote([]);
    setSelectedIds([]);
    setLastJobId(null);
    setCurrentPage(1);

    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_coop/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();
    if (!resp.ok || data.error) {
      setJobStatus({ status: "failed", error: data.error || "Upload fallito" });
      return;
    }

    if (data?.job_id) {
      setLastJobId(data.job_id);
      pollJob(data.job_id);
    } else {
      setJobStatus({ status: "failed", error: "ID job mancante nella risposta" });
    }
  };

  const pollJob = (jobId: string) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    const interval = window.setInterval(async () => {
      const resp = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`);
      const data: JobStatus = await resp.json();
      setJobStatus(data);
      if (data.status === "done" || data.status === "failed") {
        window.clearInterval(interval);
        pollingRef.current = null;
        // dopo DONE: mostra solo le note di quel job
        fetchNoteList({ job_id: jobId });
      }
    }, 1500);
    pollingRef.current = interval;
  };

  // ====== Fetch lista ======
  const fetchNoteList = async (opts?: {
    invoice_number?: string;
    stato?: string;
    date_from?: string;
    date_to?: string;
    job_id?: string;
    nota_from?: string;
    nota_to?: string;
  }) => {
    const p = new URLSearchParams();
    if (opts?.invoice_number) p.set("invoice_number", opts.invoice_number);
    if (opts?.stato) p.set("stato", opts.stato);
    if (opts?.date_from) p.set("date_from", opts.date_from);
    if (opts?.date_to) p.set("date_to", opts.date_to);
    if (opts?.job_id) p.set("job_id", opts.job_id);
    if (opts?.nota_from) p.set("nota_from", opts.nota_from);
    if (opts?.nota_to) p.set("nota_to", opts.nota_to);

    const resp = await fetch(
      `${API_BASE_URL}/api/notecredito_amazon_coop/list${p.toString() ? `?${p}` : ""}`
    );
    const data: NotaCoop[] = await resp.json();
    setNote(data || []);
    setSelectedIds([]);
    setCurrentPage(1);
  };

  // ====== Download singolo & ZIP ======
  const downloadXML = (id: number) => {
    window.open(`${API_BASE_URL}/api/notecredito_amazon_coop/download/${id}`, "_blank");
  };

  const downloadZIP = async () => {
    if (!selectedIds.length) return;
    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_coop/download_zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    if (!resp.ok) return;
    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "NC_CoOp_Selected.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  };

  // ====== Selezione ======
  const toggleId = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // ====== Sort & pagination ======
  const sortedNotes = useMemo(() => {
    const arr = [...note];
    arr.sort((a, b) => {
      let va: number | string = "";
      let vb: number | string = "";
      switch (sortKey) {
        case "data_nota":
          va = a.data_nota;
          vb = b.data_nota;
          break;
        case "numero_nota":
          va = a.numero_nota;
          vb = b.numero_nota;
          break;
        case "invoice_number":
          va = a.invoice_number;
          vb = b.invoice_number;
          break;
        case "imponibile":
          va = a.imponibile;
          vb = b.imponibile;
          break;
        case "totale":
          va = a.totale;
          vb = b.totale;
          break;
      }

      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      } else {
        return sortDir === "asc"
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      }
    });
    return arr;
  }, [note, sortKey, sortDir]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedNotes.length / PAGE_SIZE)),
    [sortedNotes.length]
  );

  const paginatedNotes = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedNotes.slice(start, end);
  }, [sortedNotes, currentPage]);

  // ====== Seleziona tutti visibili ======
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
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const renderCurrency = (value: number | undefined | null) => {
    if (value == null || isNaN(value as number)) return "—";
    return (value as number).toFixed(2);
  };

  const handleSortClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Note di Credito CoOp Amazon (CCOGS)</h1>

      {/* Upload & parametri */}
      <div className="mb-6 p-4 border rounded bg-white space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium mb-1">
              File Excel CoOp (.xls/.xlsx) <span className="text-red-600">*</span>
            </label>
            <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} />
          </div>
          <div>
            <label className="block font-medium mb-1">Aliquota IVA (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={aliquota}
              onChange={(e) => setAliquota(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">
              Colonna &quot;request for credit&quot; (opzionale)
            </label>
            <input
              type="text"
              placeholder="es. N. richiesta credito"
              value={creditCol}
              onChange={(e) => setCreditCol(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div>
            <label className="block font-medium mb-1">
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
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-4 items-center">
            <span className="font-medium">Saldo trattato come:</span>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="saldoMode"
                value="imponibile"
                checked={saldoMode === "imponibile"}
                onChange={() => setSaldoMode("imponibile")}
              />
              <span>Imponibile (già netto IVA)</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="saldoMode"
                value="lordo"
                checked={saldoMode === "lordo"}
                onChange={() => setSaldoMode("lordo")}
              />
              <span>Lordo (comprensivo di IVA)</span>
            </label>
          </div>

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!file}
            onClick={uploadFile}
          >
            Carica e genera NC CoOp
          </button>
        </div>
      </div>

      {/* Job status */}
      {jobStatus && (
        <div className="mb-4 p-3 border rounded bg-white">
          <div>
            <b>Status job:</b> {jobStatus.status}
            {jobStatus.status === "done" && (
              <span className="ml-2 text-green-700">Note generate!</span>
            )}
            {jobStatus.status === "failed" && (
              <span className="ml-2 text-red-700">Errore!</span>
            )}
          </div>
          {jobStatus.error && <div className="text-red-600">Errore: {jobStatus.error}</div>}
          {jobStatus.result?.generate != null && (
            <div className="text-sm mt-1">
              Note generate dal job: {jobStatus.result.generate}
            </div>
          )}
        </div>
      )}

      {/* Filtri lista */}
      <div className="mb-6 p-4 border rounded bg-white space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">N. fattura Amazon</label>
            <input
              type="text"
              value={filterInvoice}
              onChange={(e) => setFilterInvoice(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stato</label>
            <input
              type="text"
              value={filterStato}
              onChange={(e) => setFilterStato(e.target.value)}
              placeholder="es. pronta"
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data nota - dal</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data nota - al</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">N. Nota - da</label>
            <input
              type="text"
              value={notaFrom}
              onChange={(e) => setNotaFrom(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">N. Nota - a</label>
            <input
              type="text"
              value={notaTo}
              onChange={(e) => setNotaTo(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Job ID (debug)</label>
            <input
              type="text"
              value={filterJobId}
              onChange={(e) => setFilterJobId(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div className="flex gap-2 items-end">
            <button
              className="bg-gray-700 text-white px-3 py-2 rounded w-full"
              onClick={() =>
                fetchNoteList({
                  invoice_number: filterInvoice || undefined,
                  stato: filterStato || undefined,
                  date_from: dateFrom || undefined,
                  date_to: dateTo || undefined,
                  job_id: filterJobId || undefined,
                  nota_from: notaFrom || undefined,
                  nota_to: notaTo || undefined,
                })
              }
            >
              Applica filtri
            </button>
            <button
              className="bg-gray-400 text-white px-3 py-2 rounded w-full"
              onClick={() => {
                setFilterInvoice("");
                setFilterStato("");
                setDateFrom("");
                setDateTo("");
                setFilterJobId("");
                setNotaFrom("");
                setNotaTo("");
                fetchNoteList();
              }}
            >
              Reset
            </button>
            {lastJobId && (
              <button
                className="bg-indigo-600 text-white px-3 py-2 rounded w-full"
                title="Mostra solo le note generate dall'ultimo job"
                onClick={() => fetchNoteList({ job_id: lastJobId })}
              >
                Ultimo job
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabella NC CoOp */}
      {note.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Note CoOp: {note.length}</span>
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
                  <th
                    className="cursor-pointer"
                    onClick={() => handleSortClick("numero_nota")}
                  >
                    N. Nota {sortKey === "numero_nota" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    className="cursor-pointer"
                    onClick={() => handleSortClick("data_nota")}
                  >
                    Data NC {sortKey === "data_nota" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    className="cursor-pointer"
                    onClick={() => handleSortClick("invoice_number")}
                  >
                    N. Fattura Amazon{" "}
                    {sortKey === "invoice_number" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th>Data fattura</th>
                  <th>N. Accordo</th>
                  <th>Titolo accordo</th>
                  <th>Tipo finanziamento</th>
                  <th
                    className="cursor-pointer"
                    onClick={() => handleSortClick("imponibile")}
                  >
                    Imponibile {sortKey === "imponibile" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    className="cursor-pointer"
                    onClick={() => handleSortClick("totale")}
                  >
                    Totale {sortKey === "totale" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
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
                    <td>{n.invoice_number}</td>
                    <td>{n.invoice_date || "—"}</td>
                    <td>{n.agreement_number || "—"}</td>
                    <td>{n.agreement_title || "—"}</td>
                    <td>{n.funding_type || "—"}</td>
                    <td>{renderCurrency(n.imponibile)}</td>
                    <td>{renderCurrency(n.totale)}</td>
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
                    <td colSpan={12} className="text-center py-4">
                      Nessuna nota nella pagina corrente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginazione */}
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
