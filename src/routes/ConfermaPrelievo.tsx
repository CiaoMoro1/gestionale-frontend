import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Loader2, CheckCircle, ScanBarcode } from "lucide-react";
import BarcodeScannerModal from "../modals/BarcodeScannerModal"; // Puoi riutilizzare uno scanner già fatto o lo adatti
import type { Order, OrderItem } from "../types";

export default function ConfermaPrelievo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Stato di conferma per ogni articolo (idArticolo: pezzi confermati)
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    console.log("Fetching ordine/pezzi per id:", id);
    (async () => {
      setLoading(true);
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
      setOrder(orderData);

      const { data: itemData } = await supabase
        .from("order_items")
        .select("*, products:product_id(sku, ean, product_title)")
        .eq("order_id", id);
      setItems(itemData || []);
      // All’inizio nessun pezzo confermato
      setConfirmed(
        (itemData || []).reduce((acc, item) => {
          acc[item.id] = 0;
          return acc;
        }, {} as Record<string, number>)
      );
      setLoading(false);
    })();
  }, [id]);

  // Calcola se tutti confermati
  const allConfirmed =
    items.length > 0 &&
    items.every((item) => confirmed[item.id] >= item.quantity);

  // Handler conferma manuale
  const confirmOne = (itemId: string) => {
    setConfirmed((prev) => ({
      ...prev,
      [itemId]: Math.min((prev[itemId] || 0) + 1, items.find(i => i.id === itemId)?.quantity ?? 1),
    }));
  };

  // Handler scanner barcode articolo
  const onScanBarcode = (code: string) => {
    // Cerca articolo tramite SKU o EAN
    const item = items.find(
      (i) => i.products?.ean === code || i.products?.sku === code || i.sku === code
    );
    if (!item) {
      alert("Articolo non trovato in questo ordine!");
      return;
    }
    confirmOne(item.id);
  };

  // Conferma tutto su Supabase
  const handleConfermaPrelievo = async () => {
    await supabase
      .from("orders")
      .update({ stato_ordine: "evaso" })
      .eq("id", id);
    navigate("/prelievo");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-600">
        <Loader2 className="animate-spin mb-2" /> Caricamento...
      </div>
    );
  }

  if (!order) return <div className="text-center text-red-500 mt-12">Ordine non trovato.</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        Conferma Prelievo Ordine #{order.number}
      </h1>
      <div className="bg-gray-100 rounded-xl p-4 space-y-1 shadow">
        <div className="text-sm">
          <span className="font-semibold">Cliente:</span> {order.customer_name}
        </div>
        <div className="text-sm">
          <span className="font-semibold">Indirizzo:</span> {order.shipping_address}, {order.shipping_zip} {order.shipping_city} ({order.shipping_province})
        </div>
        <div className="text-sm">
          <span className="font-semibold">Email:</span> {order.customer_email}
        </div>
        <div className="text-sm">
          <span className="font-semibold">Telefono:</span> {order.customer_phone}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="text-lg font-bold mb-2">Articoli da prelevare</h2>
        {items.map((item) => (
          <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between border-b last:border-0 py-3">
            <div>
              <div className="text-xs max-w-xs">{item.products?.product_title || "—"}</div>
              <div className="font-semibold  text-gray-900">SKU: {item.products?.sku}</div>
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <span className="text-sm font-mono bg-gray-200 rounded px-2 py-1">
                {confirmed[item.id]}/{item.quantity} confermati
              </span>
              <button
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-2 py-1 text-xs font-semibold shadow transition"
                disabled={confirmed[item.id] >= item.quantity}
                onClick={() => confirmOne(item.id)}
              >
                <CheckCircle size={15} /> Conferma
              </button>
            </div>
          </div>
        ))}
        <button
          className="flex items-center gap-2 mt-4 mx-auto bg-black text-white rounded-xl px-5 py-2 font-bold shadow hover:scale-105 transition"
          onClick={() => setScannerOpen(true)}
        >
          <ScanBarcode size={18} /> Scannerizza Barcode Articolo
        </button>
      </div>

      {/* Bottone finale */}
      <button
        className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-lg mt-6 shadow transition disabled:bg-gray-300 disabled:text-gray-400"
        disabled={!allConfirmed}
        onClick={handleConfermaPrelievo}
      >
        Conferma Prelievo Completo
      </button>

      {/* Modale scanner barcode articolo */}
      {scannerOpen && (
        <BarcodeScannerModal
          onDetected={(code: string) => {
            onScanBarcode(code);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
