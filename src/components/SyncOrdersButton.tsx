import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SyncOrdersButton({
  onSyncStatus,
}: {
  onSyncStatus?: (status: string, message: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const api = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const syncOrders = async () => {
    setStatus("loading");
    onSyncStatus?.("loading", "⏳ Sincronizzazione in corso...");

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      const msg = "⚠️ Devi essere autenticato.";
      setMessage(msg);
      setStatus("error");
      onSyncStatus?.("error", msg);
      return;
    }

    try {
      const res = await fetch(`${api}/shopify/manual-sync-orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || !["ok", "success"].includes(data.status)) {
        throw new Error(data.message || "Errore nella sincronizzazione ordini.");
      }

      const msg = `✅ ${data.imported} nuovi, ${data.updated} aggiornati, ${data.skipped} saltati`;
      setStatus("success");
      setMessage(msg);
      onSyncStatus?.("success", msg);
      } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Errore:", msg);
      setStatus("error");
      setMessage(msg);
      onSyncStatus?.("error", msg);
    }
  };

  return (
    <div className="text-center">
      <button
        onClick={syncOrders}
        className="px-5 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 font-medium shadow-sm transition"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Sincronizzazione in corso..." : "Sincronizza ordini da Shopify"}
      </button>

      {message && (
        <div className="mt-3 text-sm px-4 py-2 bg-gray-100 border rounded text-blue-800 shadow inline-block">
          {message}
        </div>
      )}
    </div>
  );
}
