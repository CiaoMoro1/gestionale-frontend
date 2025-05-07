import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SyncOrdersButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const api = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const syncOrders = async () => {
    setStatus("loading");

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      setMessage("⚠️ Devi essere autenticato.");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch(`${api}/shopify/manual-sync-orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || data.status !== "ok") {
        throw new Error(data.message || "Errore nella sincronizzazione ordini.");
      }

      setStatus("success");
      setMessage(`✅ ${data.imported} ordini importati (${data.skipped} già presenti)`);
    } catch (err: any) {
      console.error("Errore:", err);
      setStatus("error");
      setMessage(err.message || "Errore sconosciuto");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={syncOrders}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Sincronizzazione in corso..." : "Sincronizza ordini da Shopify"}
      </button>
      {message && (
        <div className="text-sm text-center px-4 py-2 bg-gray-100 border rounded text-blue-800 shadow">
          {message}
        </div>
      )}
    </div>
  );
}
