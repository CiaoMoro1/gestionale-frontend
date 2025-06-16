import { CheckCircle, ScanBarcode } from "lucide-react";
import type { OrderItem } from "../../types/ordini";

type OrderItemsListProps = {
  items: OrderItem[];
  confirmed: Record<string, number>;
  confirmOne: (itemId: string) => void;
  onOpenScanner: () => void;
};

export default function OrderItemsList({
  items,
  confirmed,
  confirmOne,
  onOpenScanner,
}: OrderItemsListProps) {
  // Escludi articoli "commissione pagamento"
  const itemsToPick = items.filter(
    item =>
      !(item.products?.sku?.toLowerCase().includes("commissione pagamento") ||
        item.products?.product_title?.toLowerCase().includes("commissione pagamento"))
  );

  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-4">
      <h2 className="text-fluid-base font-bold mb-3">Articoli da prelevare</h2>
      {itemsToPick.length === 0 && (
        <div className="text-gray-500">Nessun articolo da prelevare.</div>
      )}
      {itemsToPick.map((item) => (
        <div
          key={item.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between border-b last:border-0 py-3"
        >
          <div>
            <div className="text-fluid-sm max-w-xs">
              {item.products?.product_title || "—"}
            </div>
            <div className="font-semibold text-gray-900">
              SKU: {item.products?.sku}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <span className="text-fluid-base font-mono bg-gray-200 rounded px-3 py-2">
              {confirmed[item.id]}/{item.quantity} confermati
            </span>
            <button
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-fluid-base font-semibold shadow transition"
              disabled={confirmed[item.id] >= item.quantity}
              onClick={() => confirmOne(item.id)}
            >
              <CheckCircle size={18} /> Conferma
            </button>
          </div>
        </div>
      ))}
      <button
        className="flex items-center justify-center gap-2 mt-4 mx-auto bg-black text-white rounded-xl px-6 py-3 font-bold shadow hover:scale-105 transition text-fluid-base w-full sm:w-auto"
        onClick={onOpenScanner}
      >
        <ScanBarcode size={22} /> Scannerizza Barcode Articolo
      </button>
    </div>
  );
}
