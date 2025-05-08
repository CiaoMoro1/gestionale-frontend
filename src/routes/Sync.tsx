import { useState } from "react";
import { supabase } from "../lib/supabase";
import SyncButton from "../components/SyncButton";
import SyncOrdersButton from "../components/SyncOrdersButton";

export default function SyncPage() {
  const [tab, setTab] = useState<"prodotti" | "ordini">("prodotti");
  const [syncStatus, setSyncStatus] = useState<null | { status: string; message: string }>(null);
  const api = import.meta.env.VITE_API_URL;

  const downloadLog = async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      alert("Devi essere autenticato per scaricare il log.");
      return;
    }

    const res = await fetch(`${api}/shopify/log`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (data?.log) {
      const blob = new Blob([data.log], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "log_errori_shopify.txt";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert("Nessun log disponibile.");
    }
  };

  return (
    <div className="text-black/70 space-y-6 px-6 py-8 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-black">Sincronizzazione Shopify</h1>
        <p className="text-sm text-black/70">
          Sincronizza prodotti o ordini manualmente. Usa questa funzione solo se necessario.
        </p>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => setTab("prodotti")}
          className={`px-5 py-2 rounded font-semibold text-sm shadow-sm transition ${
            tab === "prodotti"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Prodotti
        </button>
        <button
          onClick={() => setTab("ordini")}
          className={`px-5 py-2 rounded font-semibold text-sm shadow-sm transition ${
            tab === "ordini"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Ordini
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow px-6 py-6 space-y-4">
        {tab === "prodotti" && <SyncButton />}
        {tab === "ordini" && (
          <SyncOrdersButton onSyncStatus={(status, message) => setSyncStatus({ status, message })} />
        )}

        {syncStatus && (
          <div
            className={`text-sm px-4 py-3 rounded text-center border shadow transition ${
              syncStatus.status === "success"
                ? "bg-green-100 text-green-800"
                : syncStatus.status === "error"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {syncStatus.message}
          </div>
        )}
      </div>

      <div className="text-center">
        <button
          onClick={downloadLog}
          className="px-5 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
        >
          Scarica log errori
        </button>
      </div>
    </div>
  );
}
