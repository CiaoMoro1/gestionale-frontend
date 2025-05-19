import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "launching" | "waiting" | "importing" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  // ✅ Supporta fallback a localhost in sviluppo
  const api = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const showToast = (msg: string, duration = 4000) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), duration);
  };

  const handleSync = async () => {
    setLoading(true);
    setStatus("launching");

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      showToast("⚠️ Devi essere autenticato per sincronizzare.");
      setStatus("error");
      setLoading(false);
      return;
    }

    try {
      // 1. Avvia bulk
      const launchRes = await fetch(`${api}/shopify/bulk-launch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const launchData = await launchRes.json();

      const userErrors = launchData.data?.bulkOperationRunQuery?.userErrors;
      if (userErrors?.length > 0) {
        throw new Error(`Shopify: ${userErrors[0].message}`);
      }

      const bulkId = launchData.data?.bulkOperationRunQuery?.bulkOperation?.id;
      if (!launchRes.ok || !bulkId) {
        throw new Error("Errore nell'avvio della bulk operation");
      }

      // 2. Poll stato fino a COMPLETED
      setStatus("waiting");
      showToast("⌛ Attendere... preparazione dei dati Shopify");
      let completed = false;
      let fileUrl = "";

      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 15000));
        const statusRes = await fetch(`${api}/shopify/bulk-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const statusData = await statusRes.json();
        const op = statusData.data?.currentBulkOperation;

        if (op?.status === "COMPLETED" && op?.url) {
          fileUrl = op.url;
          completed = true;
          break;
        }
      }

      if (!completed || !fileUrl || !fileUrl.startsWith("https://")) {
        throw new Error("Timeout o URL file bulk non valido");
      }

      // 3. Importa dati
      setStatus("importing");
      showToast("📥 Importazione dati in corso...");
      const importRes = await fetch(`${api}/shopify/bulk-fetch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: fileUrl }),
      });

      const importData = await importRes.json();
      if (!importRes.ok || importData.status !== "success") {
        throw new Error(importData.message || "Errore durante l'importazione");
      }

      setStatus("success");
      showToast(importData.message || "✅ Importazione completata!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("❌ Errore sync bulk:", message);
      showToast(message || "Errore sconosciuto");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { label: "1️⃣ Bulk avviata", key: "launching" },
    { label: "2️⃣ In attesa completamento", key: "waiting" },
    { label: "3️⃣ Importazione dati", key: "importing" },
    { label: "✅ Completato", key: "success" },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? "Sincronizzazione in corso..." : "Sincronizza tutto da Shopify (Bulk)"}
      </button>

      <div className="flex flex-col gap-1 text-sm text-center">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`transition ${
              status === step.key ? "text-blue-700 font-semibold" : "text-gray-500"
            }`}
          >
            {step.label}
          </div>
        ))}
      </div>

      {message && (
        <div className="text-sm text-center mt-2 px-4 py-2 bg-gray-100 border rounded text-blue-800 shadow">
          {message}
        </div>
      )}

      {status === "error" && (
        <p className="text-red-600 text-sm text-center">
          ❌ Errore durante la sincronizzazione.
        </p>
      )}
    </div>
  );
}
