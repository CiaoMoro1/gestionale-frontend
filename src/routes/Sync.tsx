import { useState } from "react";
import { supabase } from "../lib/supabase";
import SyncButton from "../components/SyncButton";
import SyncOrdersButton from "../components/SyncOrdersButton";

export default function SyncPage() {
  const [tab, setTab] = useState<"prodotti" | "ordini">("prodotti");
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
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-gray-700">Sincronizzazione Shopify</h1>

      <div className="flex gap-4">
        <button
          onClick={() => setTab("prodotti")}
          className={`px-4 py-2 rounded ${
            tab === "prodotti" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
          }`}
        >
          Prodotti
        </button>
        <button
          onClick={() => setTab("ordini")}
          className={`px-4 py-2 rounded ${
            tab === "ordini" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
          }`}
        >
          Ordini
        </button>
      </div>

      {tab === "prodotti" && (
        <div className="space-y-4">
          <SyncButton />
        </div>
      )}

      {tab === "ordini" && (
        <div className="space-y-4">
          <SyncOrdersButton />
        </div>
      )}

      <button
        onClick={downloadLog}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Scarica log errori
      </button>
    </div>
  );
}