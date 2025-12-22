// src/routes/seller/OrdineDetailPanelSeller.tsx
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

// Estendo OrderItem con i campi che abbiamo su order_items_seller
type SellerOrderItem = OrderItem & {
  title?: string | null;       // titolo Amazon da order_items_seller.title
  product_id?: string | null;  // può essere null se SKU non matcha products
};

type Props = {
  ordine: Ordine;
  items: SellerOrderItem[];
};

// helper per filtrare commissioni / contrassegno / note
function isServiceOrFeeItem(item: SellerOrderItem): boolean {
  // Per Seller, usiamo prima il titolo prodotto, poi il titolo Amazon come fallback
  const rawTitle = item.products?.product_title || item.title;
  const title = (rawTitle || "").trim().toUpperCase();

  if (!title) return false; // per Seller NON scartiamo righe senza titolo

  // commissioni / contrassegno / pagamento alla consegna
  if (title.includes("COMMISSIONE")) return true;
  if (title.includes("CONTRASSEGNO")) return true;
  if (title.includes("PAGAMENTO ALLA CONSEGNA")) return true;

  return false;
}

export function OrdineDetailPanelSeller({ ordine, items }: Props) {
  // filtra via solo vere commissioni / contrassegno, NON righe senza catalogo
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
        <Glass label="Canale" value={ordine.channel || "Amazon Seller"} />
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
          {displayItems.map((item) => {
            const hasCatalogIssue = !item.product_id;
            const sku = item.sku || item.products?.sku || "—";
            const titolo =
              item.products?.product_title || item.title || "—";

            return (
              <div
                key={item.id}
                className="p-3 sm:p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 space-y-1 text-[clamp(0.9rem,2vw,1.05rem)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <strong>SKU:</strong> <span className="font-mono">{sku}</span>
                  </div>
                  {hasCatalogIssue && (
                    <span className="text-[0.7rem] sm:text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                      ⚠ Problema catalogo (nessun product_id)
                    </span>
                  )}
                </div>
                <div>
                  <strong>Prodotto:</strong> {titolo}
                </div>
                <div>
                  <strong>Quantità:</strong> {item.quantity}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
