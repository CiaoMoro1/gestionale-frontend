import SyncButton from "../components/SyncButton";
import { supabase } from "../lib/supabase";


export default function SyncPage() {
 

  const downloadLog = async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const res = await fetch("http://localhost:5000/shopify/log", {
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
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-700">Sincronizza Prodotti</h1>
      <SyncButton />
      <button
        onClick={downloadLog}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Scarica log errori
      </button>
    </div>
  );
}
