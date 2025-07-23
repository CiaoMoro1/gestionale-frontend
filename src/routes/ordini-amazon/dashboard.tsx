import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { UploadCloud, Loader2 } from "lucide-react";

const DashboardAmazonVendor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Job queue state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  // Stato riepilogo ordini
  const [orders, setOrders] = useState<any[]>([]);
  const navigate = useNavigate();

  // Fetch riepiloghi all’avvio
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/dashboard`)
      .then(res => res.json())
      .then(setOrders);
  }, []);

  // Polling stato job (quando c'è un job_id)
  useEffect(() => {
    if (!jobId) return;
    setLog(["Job inviato, attendo completamento..."]);
    setJobStatus("pending");

    const interval = setInterval(async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/jobs/${jobId}/status`);
      const data = await res.json();
      setJobStatus(data.status);

      if (data.status === "done" || data.status === "failed") {
        clearInterval(interval);
        setLoading(false);

        if (data.status === "done") {
          const result = data.result || {};
          setLog([
            `✅ Importazione completata!`,
            `${result.importati ?? 0} articoli importati correttamente.`,
            `(${result.po_unici ?? 0} PO/ordini unici importati)`,
            ...(result.doppioni?.length ? ["⚠️ Doppioni saltati:", ...result.doppioni] : []),
            ...(result.errors?.length ? ["❌ Errori:", ...result.errors] : []),
          ]);
          // Ricarica riepilogo dopo upload
          fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/dashboard`)
            .then(res => res.json())
            .then(setOrders);
        } else {
          setLog([`❌ Errore: ${data.error || "Errore sconosciuto"}`]);
        }
      } else {
        setLog([`⏳ Job in corso... (${data.status})`]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  // Upload file Excel
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setLog([]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setLog(["Seleziona prima un file Excel."]);
      return;
    }
    setLoading(true);
    setLog(["Caricamento in corso..."]);
    setJobId(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setLog([`Errore HTTP: ${res.status}`]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.job_id) {
        setJobId(data.job_id); // Polling job!
      } else {
        setLog([`❌ Errore: ${data.error || "Errore sconosciuto"}`]);
        setLoading(false);
      }
    } catch (err: any) {
      setLog([`❌ Errore durante l’upload: ${err.message}`]);
      setLoading(false);
    }
  };

  // Helpers per gruppi dashboard (come prima)
  function filterGroup(t: number) {
    switch (t) {
      case 1: return orders.filter(o => o.stato_ordine === "nuovo" && o.numero_parziale == null);
      case 2: return orders.filter(o => o.stato_ordine === "nuovo" && o.numero_parziale != null && (o.colli_totali ?? 0) > 0 && (o.colli_confermati ?? 0) < (o.colli_totali ?? 0));
      case 3: return orders.filter(o => o.stato_ordine === "parziale" && o.numero_parziale != null && (o.colli_totali ?? 0) > 0 && (o.colli_confermati ?? 0) === (o.colli_totali ?? 0));
      case 4: return orders.filter(o => o.stato_ordine === "parziale" && o.numero_parziale != null && (o.colli_totali ?? 0) > 0 && (o.colli_confermati ?? 0) < (o.colli_totali ?? 0));
      default: return [];
    }
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 pb-16">
      <Card>
        <CardContent className="p-6 flex flex-col gap-4">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <UploadCloud size={28} className="text-blue-600" />
            Carica Ordini Amazon Vendor
          </h1>
          <p className="text-sm text-muted-foreground">
            Seleziona un file Excel (.xls/.xlsx) scaricato dal portale Amazon Vendor.
            <br />
            <b>NB:</b> Solo le colonne principali verranno importate.
          </p>

          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
            className="mb-2"
            disabled={loading}
          />

          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-fit"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} /> Caricamento...
              </>
            ) : (
              "Carica ordini"
            )}
          </Button>
            {jobStatus && (
              <div className="text-xs text-gray-500 mt-1">
                Stato job: {jobStatus}
              </div>
            )}
          {log.length > 0 && (
            <div className="bg-muted rounded p-3 mt-4 text-sm space-y-1 max-h-52 overflow-auto">
              {log.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DASHBOARD riepilogo */}
      <div className="mt-10 space-y-8">
        <DashboardGroup
          title="1) Ordini nuovi non ancora gestiti"
          orders={filterGroup(1)}
          navigate={navigate}
        />
        <DashboardGroup
          title="2) Ordini nuovi con colli non confermati"
          orders={filterGroup(2)}
          navigate={navigate}
        />
        <DashboardGroup
          title="3) Ordini parziali con tutti i colli confermati"
          orders={filterGroup(3)}
          navigate={navigate}
        />
        <DashboardGroup
          title="4) Ordini parziali con colli non confermati"
          orders={filterGroup(4)}
          navigate={navigate}
        />
      </div>
      <style>
        {`
        .glass {
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(10px);
          border: 1.5px solid rgba(120,180,255,0.14);
          box-shadow: 0 8px 32px 0 rgba(54,80,180,0.10), 0 2px 4px rgba(0,0,0,0.04);
        }
        `}
      </style>
    </div>
  );
};

function DashboardGroup({ title, orders, navigate }: { title: string, orders: any[], navigate: any }) {
  if (orders.length === 0) return null;
  return (
    <div>
      <h2 className="font-bold text-base mb-3">{title}</h2>
      <div className="glass rounded-2xl overflow-x-auto p-1 shadow-md transition-all">
        <table className="min-w-[660px] w-full text-sm bg-transparent">
          <thead>
            <tr>
              <th className="px-3 py-2">Centro</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Parziale</th>
              <th className="px-3 py-2">Colli</th>
              <th className="px-3 py-2">Confermati</th>
              <th className="px-3 py-2">PO totali</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr
                key={i}
                className={
                  o.colli_confermati === o.colli_totali && o.colli_totali > 0
                    ? "bg-gradient-to-r from-green-50/70 via-white to-green-100/60"
                    : o.colli_confermati === 0
                    ? "bg-gradient-to-r from-slate-50/80 to-blue-100/40"
                    : "bg-gradient-to-r from-yellow-50/90 to-orange-100/30"
                }
              >
                <td className="border px-3 py-2 font-semibold text-blue-800">{o.fulfillment_center}</td>
                <td className="border px-3 py-2">{o.start_delivery}</td>
                <td className="border px-3 py-2">
                  {o.numero_parziale != null ? (
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                      #{o.numero_parziale}
                    </span>
                  ) : (
                    <span className="bg-gray-200 text-gray-500 px-2 py-1 rounded-full text-xs">-</span>
                  )}
                </td>
                <td className="border px-3 py-2">{o.colli_totali ?? 0}</td>
                <td className="border px-3 py-2">
                  <span
                    className={
                      o.colli_confermati === o.colli_totali && o.colli_totali > 0
                        ? "bg-green-200 text-green-900 px-2 py-1 rounded-full text-xs font-bold"
                        : o.colli_confermati > 0
                        ? "bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-bold"
                        : "bg-gray-200 text-gray-500 px-2 py-1 rounded-full text-xs"
                    }
                  >
                    {o.colli_confermati ?? 0}
                  </span>
                </td>
                <td className="border px-3 py-2">{o.po_list?.length ?? 0}</td>
                <td className="border px-3 py-2">
                  <button
                  type="button"
                  className="underline text-blue-700 font-semibold hover:bg-blue-50 transition px-3 py-1 rounded"
                  onClick={() => navigate(`/ordini-amazon/dettaglio/${o.fulfillment_center}/${o.start_delivery}`)}
                >
                  Apri
                </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DashboardAmazonVendor;
