import { useState, useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

type Nota = {
  id: number;
  data_nota: string;
  numero_nota: string;
  po: string;
  vret: string;
  xml_url: string;
  imponibile?: number;
  iva?: number;
  totale?: number; // può non esserci: tienilo opzionale
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
  // ↓↓↓ CAMBIATO: due file separati
  const [returnItemsFile, setReturnItemsFile] = useState<File | null>(null);
  const [returnSummaryFile, setReturnSummaryFile] = useState<File | null>(null);

  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [note, setNote] = useState<Nota[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const uploadFiles = async () => {
    if (!returnItemsFile) return; // obbligatorio

    const formData = new FormData();
    formData.append("return_items", returnItemsFile);
    if (returnSummaryFile) {
      formData.append("return_summary", returnSummaryFile);
    }

    setJobStatus(null);
    setNote([]);
    setSelectedIds([]);

    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_reso/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (data?.job_id) pollJob(data.job_id);
  };

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

  const fetchNoteList = async () => {
    const resp = await fetch(`${API_BASE_URL}/api/notecredito_amazon_reso/list`);
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
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Note di Credito Amazon Vendor - VRET</h1>

      {/* Upload files */}
      <div className="mb-6 p-4 border rounded bg-white space-y-3">
        <div>
          <label className="block font-medium mb-1">Return_Items.csv (obbligatorio)</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setReturnItemsFile(e.target.files?.[0] || null)}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Return_Summary (.xls/.xlsx) — opzionale</label>
          <input
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setReturnSummaryFile(e.target.files?.[0] || null)}
          />
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={!returnItemsFile}
          onClick={uploadFiles}
        >
          Carica e genera note
        </button>
      </div>

      {/* Stato job */}
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

      {/* Lista note */}
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
                  <td>{n.totale != null ? n.totale.toFixed(2) : "-"}</td>
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
