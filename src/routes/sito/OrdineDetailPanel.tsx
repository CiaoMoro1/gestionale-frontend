// src/components/sito/OrdineDetailPanel.tsx
import type { Ordine, OrderItem } from "../../types/ordini";

function formatDate(dateString: string = "") {
  return new Date(dateString).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Glass({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="p-3 sm:p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="text-[clamp(0.75rem,2vw,0.95rem)] font-semibold text-gray-500 mb-1">
        {label}
      </div>
      <div className="text-[clamp(0.9rem,2.5vw,1.1rem)] font-medium text-gray-900">
        {value !== undefined && value !== null && value !== "" ? value : "—"}
      </div>
    </div>
  );
}

type Props = {
  ordine: Ordine;
  items: OrderItem[];
};

// helper per filtrare commissioni / contrassegno / note
function isServiceOrFeeItem(item: OrderItem): boolean {
  const rawTitle = item.products?.product_title;
  const title = (rawTitle || "").trim().toUpperCase();

  // niente titolo → probabilmente nota / riga tecnica
  if (!title || title === "—") return true;

  // commissioni / contrassegno / pagamento alla consegna
  if (title.includes("COMMISSIONE")) return true;
  if (title.includes("CONTRASSEGNO")) return true;
  if (title.includes("PAGAMENTO ALLA CONSEGNA")) return true;

  return false;
}

export function OrdineDetailPanel({ ordine, items }: Props) {
  // filtra via commissioni / contrassegno / note
  const displayItems = items.filter((item) => !isServiceOrFeeItem(item));

  const totalQty = displayItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  return (
    <div className="space-y-6">
      <h1 className="font-bold text-[clamp(1.1rem,3vw,1.6rem)] text-gray-900 text-center">
        Ordine {ordine.number}
      </h1>

      {/* Info principali */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-gray-900">
        <Glass label="Cliente" value={ordine.customer_name} />
        <Glass label="Canale" value={ordine.channel} />
        <Glass
          label="Totale"
          value={
            ordine.total !== null && ordine.total !== undefined
              ? `${Number(ordine.total).toFixed(2)} €`
              : "—"
          }
        />
        <Glass label="Pagamento" value={ordine.payment_status} />
        <Glass label="Evasione" value={ordine.fulfillment_status} />
        <Glass
          label="Data"
          value={ordine.created_at ? formatDate(ordine.created_at) : "—"}
        />
      </div>

      {/* Articoli */}
      <div>
        <h2 className="text-[clamp(1rem,2.6vw,1.3rem)] font-semibold text-gray-900 mt-4 mb-2">
          Articoli ({displayItems.length}) — Totale pezzi: {totalQty}
        </h2>

        <div className="grid grid-cols-1 gap-2">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className="p-3 sm:p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 space-y-1 text-[clamp(0.9rem,2vw,1.05rem)]"
            >
              <div className="flex items-center gap-2">
                <strong>SKU:</strong> {item.sku || item.products?.sku || "—"}
              </div>
              <div>
                <strong>Prodotto:</strong>{" "}
                {item.products?.product_title || "—"}
              </div>
              <div>
                <strong>Quantità:</strong> {item.quantity}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
