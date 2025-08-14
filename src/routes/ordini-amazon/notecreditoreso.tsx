import React, { useState, useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

type Articolo = {
  prezzo_totale?: number;
};

type Nota = {
  id: number;
  data_nota: string;
  numero_nota: string;
  po: string;
  vret: string;
  xml_url: string;
  imponibile?: number;
  iva?: number;
  totale?: number;          // potrebbe non esserci
  articoli?: Articolo[];    // <-- nuovo: arriva dal backend
  stato: string;
  created_at: string;
};

type JobResult = {
  note_generate?: number;
  note?: Nota[];
};

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
  const [summaryFile, setSummaryFile] = useState<File | null>(null); // <-- nuovo opzionale
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [note, setNote] = useState<Nota[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 1) choose files
  const handleItemsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setItemsFile(e.target.files?.[0] || null);
  };
  const handleSummaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSummaryFile(e.target.files?.[0] || null);
  };

  // 2) upload both (items required, summary optional) — field names MUST match backend
  const uploadFiles = async () => {
    if (!itemsFile) return;
    const formData = new FormData();
    formData.append("return_items", itemsFile);        // <-- NOME CAMPO CORRETTO
    if (summaryFile) formData.append("return_summary", summaryFile); // <-- opzionale

    setJobStatus(null);
    setNote([]);
    setSelectedIds([]);

    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_reso/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (data?.job_id) {
      pollJob(data.job_id);
    } else {
      setJobStatus({ status: "failed", error: "Upload fallito" });
    }
  };

  // 3) poll job
  const pollJob = (jid: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const interval = setInterval(async () => {
      const resp = await fetch(`${API_BASE_URL}/api/jobs/${jid}/status`);
      const data: JobStatus = await resp.json();
      setJobStatus(data);
      if (data.status === "done" || data.status === "failed") {
        clearInterval(interval);
        fetchNoteList();
      }
    }, 1500);
    pollingRef.current = interval;
  };

  // 4) list notes
  const fetchNoteList = async () => {
    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_reso/list`);
    const data: Nota[] = await resp.json();
    setNote(data || []);
  };

  // 5) download single / zip
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

  // calcolo totale lato client se il backend non lo invia
  const renderTotale = (n: Nota) => {
    if (typeof n.totale === "number") return n.totale.toFixed(2);
    const sum = (n.articoli || []).reduce((acc, a) => acc + (a.prezzo_totale || 0), 0);
    if (sum > 0) return sum.toFixed(2);
    return "—";
    // (volendo potresti mostrare imponibile+iva se presenti)
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

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={!itemsFile}
          onClick={uploadFiles}
        >
          Carica e genera note
        </button>
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
            <span className="font-semibold">Note di credito generate: {note.length}</span>
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
                    <button
                      className="bg-blue-500 text-white px-2 py-1 rounded"
                      onClick={() => downloadXML(n.id)}
                    >
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
