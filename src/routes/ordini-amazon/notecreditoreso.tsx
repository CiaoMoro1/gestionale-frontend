import React, { useState, useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

type Articolo = { prezzo_totale?: number };

type Nota = {
  id: number;
  data_nota: string;
  numero_nota: string;
  po: string;
  vret: string;
  xml_url: string;
  imponibile?: number;
  iva?: number;
  totale?: number;
  articoli?: Articolo[];
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

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

    setJobStatus(null);
    setNote([]);
    setSelectedIds([]);
    setLastJobId(null);

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
    if (pollingRef.current) clearInterval(pollingRef.current);
    const interval = setInterval(async () => {
      const resp = await fetch(`${API_BASE_URL}/api/jobs/${jid}/status`);
      const data: JobStatus = await resp.json();
      setJobStatus(data);
      if (data.status === "done" || data.status === "failed") {
        clearInterval(interval);
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

  return (
    <div className="max-w-3xl mx-auto p-6">
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

        <button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={!itemsFile} onClick={uploadFiles}>
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
              onClick={() => fetchNoteList({ date_from: dateFrom || undefined, date_to: dateTo || undefined })}
            >
              Filtra per data
            </button>
          </div>
          <div className="flex gap-2">
            <button className="bg-gray-400 text-white px-3 py-2 rounded w-full" onClick={() => fetchNoteList()}>
              Mostra tutte
            </button>
            {lastJobId && (
              <button
                className="bg-indigo-600 text-white px-3 py-2 rounded w-full"
                onClick={() => fetchNoteList({ job_id: lastJobId })}
                title="Mostra solo le note generate dall'ultimo job"
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
              className="bg-green-600 text-white px-3 py-1 rounded"
              disabled={!selectedIds.length}
              onClick={downloadZIP}
            >
              Download ZIP ({selectedIds.length})
            </button>
          </div>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-200">
                <th></th>
                <th>Numero</th>
                <th>Data</th>
                <th>PO</th>
                <th>VRET</th>
                <th>Totale</th>
                <th>Stato</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {note.map((n) => (
                <tr key={n.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(n.id)}
                      onChange={() => toggleId(n.id)}
                    />
                  </td>
                  <td>{n.numero_nota}</td>
                  <td>{n.data_nota}</td>
                  <td>{n.po}</td>
                  <td>{n.vret}</td>
                  <td>{renderTotale(n)}</td>
                  <td>{n.stato}</td>
                  <td>
                    <button className="bg-blue-500 text-white px-2 py-1 rounded" onClick={() => downloadXML(n.id)}>
                      XML
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
