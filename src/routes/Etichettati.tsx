import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import { FileText, Search, ScanBarcode, Copy } from "lucide-react";
import SearchOrderModal from "../modals/SearchOrderModal";
import BarcodeScannerModal from "../modals/BarcodeScannerModal";

export default function Etichettati() {
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["orders", "etichettati"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, customer_name, shipping_address, total, created_at, parcel_id")
        .eq("stato_ordine", "etichette")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data || []).filter((order: any) =>
    (order.number?.toLowerCase().includes(search.toLowerCase()) ||
     order.customer_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleBarcode = (code: string) => {
    setSearch(code);
    setScannerOpen(false);
  };

  // CARD (mobile)
  function OrderCard({ order }: { order: any }) {
    let trackingList: string[] = [];
    try {
      if (order.parcel_id?.startsWith("[")) trackingList = JSON.parse(order.parcel_id);
      else if (order.parcel_id) trackingList = [order.parcel_id];
    } catch {
      trackingList = order.parcel_id ? [order.parcel_id] : [];
    }
    return (
      <div className="bg-white rounded-xl shadow border px-4 py-3 mb-3 flex flex-col gap-1">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-black text-lg flex items-center gap-2">
            <FileText size={18} className="text-cyan-500" /> #{order.number}
          </span>
          <span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</span>
        </div>
        <div className="font-semibold text-black">{order.customer_name}</div>
        <div className="text-xs text-gray-500">{order.shipping_address}</div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {trackingList.length ? trackingList.map(tid=> (
            <span key={tid} className="inline-flex items-center gap-1 font-mono text-cyan-900 bg-cyan-100/90 px-2 py-0.5 rounded-md text-xs border border-cyan-200 mr-1">
              {/* Se vuoi tracking cliccabile su BRT, decommenta la riga sotto */}
              {/* <a href={`https://vas.brt.it/vas/sped_det_show.hsm?referer=spedtracking&ColloID=${tid}`} target="_blank" rel="noopener noreferrer">{tid}</a> */}
              {tid}
              <button
                className="hover:bg-cyan-200 p-1 rounded"
                title="Copia Tracking"
                onClick={() => navigator.clipboard.writeText(tid)}
              >
                <Copy size={13} />
              </button>
            </span>
          )) : <span className="text-gray-400 text-xs">—</span>}
        </div>
        <div className="flex justify-between items-end mt-3">
          <span className="font-semibold text-lg text-cyan-700">€ {order.total}</span>
          <Link
            to={`/prelievo/${order.id}`}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl shadow font-bold transition"
          >
            Apri
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-center flex items-center justify-center gap-2 mb-2">
        <FileText size={26} className="text-cyan-500" />
        Etichettati
      </h1>

      {/* Azioni e ricerca */}
      <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
        <div className="flex flex-1 w-full items-center bg-white border rounded-xl shadow px-3 py-2">
          <Search size={18} className="text-cyan-600 mr-2" />
          <input
            type="text"
            className="w-full bg-transparent focus:outline-none"
            placeholder="Cerca ordine o cliente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          className="flex items-center gap-1 bg-black text-white rounded-xl px-4 py-2 text-sm font-semibold shadow hover:scale-105 transition mt-2 sm:mt-0"
          onClick={() => setScannerOpen(true)}
        >
          <ScanBarcode size={16} /> Scannerizza barcode
        </button>
        <button
          className="flex items-center gap-1 bg-gray-200 text-black rounded-xl px-3 py-2 text-sm font-semibold shadow hover:bg-gray-300 transition mt-2 sm:mt-0"
          onClick={() => setSearchModalOpen(true)}
        >
          <Search size={15} /> Ricerca avanzata
        </button>
      </div>

      {/* Scanner modal */}
      {scannerOpen && (
        <BarcodeScannerModal
          onDetected={handleBarcode}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Ricerca avanzata modal */}
      {searchModalOpen && (
        <SearchOrderModal
          open={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          orders={data || []}
        />
      )}

      {/* CARD LISTA MOBILE */}
      <div className="sm:hidden">
        {filtered.map(order => <OrderCard key={order.id} order={order} />)}
      </div>

      {/* DESKTOP: tabella come Prelievo */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto bg-white shadow border rounded-xl">
          <table className="min-w-[700px] w-full text-sm">
            <thead className="bg-black/90 text-white">
              <tr>
                <th className="p-3 text-left">Ordine</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Tracking</th>
                <th className="p-3 text-left">Indirizzo</th>
                <th className="p-3 text-right">Totale</th>
                <th className="p-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order: any) => {
                let trackingList: string[] = [];
                try {
                  if (order.parcel_id?.startsWith("[")) trackingList = JSON.parse(order.parcel_id);
                  else if (order.parcel_id) trackingList = [order.parcel_id];
                } catch {
                  trackingList = order.parcel_id ? [order.parcel_id] : [];
                }
                return (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="p-3 font-semibold text-black">{order.number}</td>
                    <td className="p-3">{order.customer_name}</td>
                    <td className="p-3 text-cyan-800 font-mono flex items-center gap-2">
                      {trackingList.length ? trackingList.map(tid => (
                        <span key={tid} className="inline-flex items-center gap-1">
                          {/* <a href={`https://vas.brt.it/vas/sped_det_show.hsm?referer=spedtracking&ColloID=${tid}`} target="_blank" rel="noopener noreferrer">{tid}</a> */}
                          {tid}
                          <button
                            className="ml-1 hover:bg-cyan-100 p-1 rounded"
                            title="Copia Tracking"
                            onClick={() => navigator.clipboard.writeText(tid)}
                          >
                            <Copy size={13} />
                          </button>
                        </span>
                      )) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="p-3">{order.shipping_address}</td>
                    <td className="p-3 text-right font-bold text-cyan-700">
                      € {order.total}
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        to={`/prelievo/${order.id}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-xl text-xs shadow transition"
                      >
                        Apri
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
