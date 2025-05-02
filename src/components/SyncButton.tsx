import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [skipped, setSkipped] = useState<string[]>([]);

  // Sostituisci con l’URL ottenuto da /shopify/bulk-status
  const bulkUrl = "https://storage.googleapis.com/shopify-tiers-assets-prod-us-east1/bulk-operation-outputs/1fv6cidd787hsoc05beegvfuu4q3-final?GoogleAccessId=assets-us-prod%40shopify-tiers.iam.gserviceaccount.com&Expires=1746811517&Signature=G2Xkc6hNPH7GhCcgqJdNchNCpuklSc8TXppxCnVcBsnofiXbNDkMjGLxelTg%2Fa%2FgV77MEzA1c1vJ581V9fhgt%2B%2BX3XyaA%2F%2BnoG98oyVH485z8A5pTb0pFq76bDqne3I4X%2FQrlzKaECErDO5eqGeQ7tMNrsWo5B7TLphoS4knB3V2JCLtLdWxgm9COkCV%2B7CiAnB4euceW5lFW3xVTphSujyL3pmJKOWdoGQBoedFyWerriW3cQSjqh4ZRX7agL1J8qOeOU3jO8zhj1a2XFgBrmZREqsmJrvk1LJL5KVuA9WZBb4LOthe%2BRrAnqKD0xoL7jOETthJa9K9r%2FfAmx1JIw%3D%3D&response-content-disposition=attachment%3B+filename%3D%22bulk-6437243191633.jsonl%22%3B+filename%2A%3DUTF-8%27%27bulk-6437243191633.jsonl&response-content-type=application%2Fjsonl";

  const handleSync = async () => {
    setLoading(true);
    setStatus("idle");
    setSkipped([]);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    console.log("Token:", token);

    if (!token) {
      alert("⚠️ Devi essere autenticato per sincronizzare.");
      setStatus("error");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/shopify/bulk-fetch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: bulkUrl }),
      });

      const data = await res.json();
      console.log("🧾 Risposta:", data);

      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Errore durante il fetch");
      }

      setSkipped(data.skipped_duplicates || []);
      setStatus("success");
    } catch (err) {
      console.error("❌ Errore:", err);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto text-center">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
      >
        {loading ? "Sincronizzo..." : "Sincronizza Varianti da Shopify"}
      </button>

      {status === "success" && (
        <div className="text-green-600">
          ✅ Sincronizzazione completata!
          {skipped.length > 0 && (
            <div className="mt-2 text-sm text-yellow-600">
              ⛔ Varianti duplicate ignorate: <strong>{skipped.length}</strong>
              <details className="mt-1">
                <summary className="cursor-pointer underline">Mostra SKU duplicati</summary>
                <ul className="mt-1 max-h-40 overflow-y-auto text-xs">
                  {skipped.map((sku, i) => (
                    <li key={i}>{sku}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <p className="text-red-600">❌ Errore durante la sincronizzazione</p>
      )}
    </div>
  );
}
