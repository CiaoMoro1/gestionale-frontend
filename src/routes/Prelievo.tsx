//src\routes\Prelievo.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrderStatusMap } from "../hooks/useOrderStatusMap";
import { formatWithOptions } from "date-fns/fp";
import { it } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import logoBase64 from "../assets/logo_base64";
import SearchOrderModal from "../modals/SearchOrderModal";
import type { Ordine, OrderItem } from "../types/ordini";
import {
  CheckCircle,
  Search,
  Trash2,
  FileText,
  Boxes,
  ClipboardList,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const formatIt = formatWithOptions({ locale: it });

export default function Prelievo() {
  const [orders, setOrders] = useState<Ordine[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOrderOpen, setSearchOrderOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const ordersRes = await supabase
        .from("orders")
        .select("*")
        .in("stato_ordine", ["prelievo", "etichetta_generata"])

      if (!ordersRes.data) {
        setLoading(false);
        return;
      }

      const ids = ordersRes.data.map((o) => o.id);
      const itemsRes = await supabase
        .from("order_items")
        .select("*, products:product_id(sku, product_title, inventory(inventario, riservato_sito))")
        .in("order_id", ids);

      setOrders(ordersRes.data);
      if (itemsRes.data) setItems(itemsRes.data);
      setLoading(false);
    })();
  }, []);

  const { statusMap, problematicItems } = useOrderStatusMap(items);

  // Esportazione lista prelievo PDF
  const exportPicklistPDF = () => {
    const doc = new jsPDF();
    doc.addImage(logoBase64, "PNG", 150, 10, 40, 10);
    doc.setFontSize(16);
    const now = new Date().toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    doc.text(`Lista di Prelievo — ${now}`, 14, 20);

    // Raggruppa per SKU
    const picklist: Record<string, { sku: string; title: string; qty: number; inventario: number }> = {};
    for (const item of items) {
      const sku = item.products?.sku || item.sku || "—";
      const title = item.products?.product_title || "—";
      const inv = item.products?.inventory?.inventario ?? 0;
      if (!picklist[sku]) {
        picklist[sku] = { sku, title, qty: 0, inventario: inv };
      }
      picklist[sku].qty += item.quantity;
    }

    // Raggruppa per prefisso SKU
    const grouped: Record<string, { sku: string; title: string; qty: number; inventario: number }[]> = {};
    Object.values(picklist).forEach((item) => {
      const root = item.sku.split("-")[0].toUpperCase();
      if (!grouped[root]) grouped[root] = [];
      grouped[root].push(item);
    });

    let y = 30;
    for (const [prefix, list] of Object.entries(grouped).sort()) {
      doc.setFontSize(12);
      doc.text(`Categoria: ${prefix}`, 14, y);

      autoTable(doc, {
        startY: y + 4,
        head: [["SKU", "Richiesto", "Inventario", "Nome Articolo"]],
        body: list.map((item) => [
          item.sku,
          item.qty.toString(),
          item.inventario < item.qty ? `${item.inventario} (!)` : item.inventario.toString(),
          item.title,
        ]),
        styles: { fontSize: 9, cellPadding: 2 },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    doc.save("lista-prelievo.pdf");
  };

  // Esportazione dettaglio ordini PDF
  const exportOrdersPDF = () => {
    const doc = new jsPDF();
    doc.addImage(logoBase64, "PNG", 150, 10, 40, 10);
    doc.setFontSize(16);
    const now = new Date().toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    doc.text(`Dettaglio Ordini — ${now}`, 14, 20);

    let y = 30;
    for (const order of orders) {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, order.number, {
        format: "CODE128",
        displayValue: false,
        width: 1,
        height: 12,
        margin: 0,
      });
      const barcodeImg = canvas.toDataURL("image/png");

      doc.setFontSize(12);
      doc.text(`Ordine ${order.number} — ${order.customer_name}`, 14, y);
      y += 6;
      doc.addImage(barcodeImg, "PNG", 15, y, 50, 10);
      y += 20;

      doc.setFontSize(9);
      doc.text(`${order.shipping_address ?? ""}, ${order.shipping_zip ?? ""} ${order.shipping_city ?? ""} (${order.shipping_province ?? ""}) — ${order.shipping_country ?? ""}`, 14, y);
      y += 5;
      doc.text(`Email: ${order.customer_email ?? ""} — Tel: ${order.customer_phone ?? ""}`, 14, y);
      y += 6;

      const relatedItems = items.filter((i) => i.order_id === order.id);
      autoTable(doc, {
        startY: y,
        head: [["SKU", "Prodotto", "Quantità"]],
        body: relatedItems.map((item) => [
          item.products?.sku || item.sku || "—",
          item.products?.product_title || "—",
          item.quantity.toString(),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        theme: "grid",
        margin: { top: 10, left: 14, right: 14 },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    doc.save("dettaglio-ordini.pdf");
  };

  if (loading)
    return (
      <div className="p-6 text-center text-gray-600 flex items-center justify-center h-64">
        <ClipboardList size={28} className="mx-auto mb-2 opacity-60" />
        <span>Caricamento ordini...</span>
      </div>
    );

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
        <Boxes size={28} className="text-black/80" />
        Prelievo
      </h1>

      {/* Export / Ricerca / Rimuovi */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={exportPicklistPDF}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl shadow hover:scale-105 transition"
        >
          <FileText size={18} /> Esporta Lista Prelievo
        </button>
        <button
          onClick={exportOrdersPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:scale-105 transition"
        >
          <FileText size={18} /> Esporta Dettaglio Ordini
        </button>
        <button
          onClick={async () => {
            const ids = orders.map((o) => o.id);
            await supabase
              .from("orders")
              .update({ stato_ordine: "nuovo" })
              .in("id", ids);
            setOrders([]);
            setItems([]);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl shadow hover:scale-105 transition"
        >
          <Trash2 size={18} /> Rimuovi Tutto da Prelievo
        </button>
        {/* Ricerca barcode */}
        <button
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-black rounded-xl shadow hover:bg-gray-300 transition"
          onClick={() => setSearchOrderOpen(true)}
        >
          <Search size={18} /> Cerca Ordine con Barcode
        </button>
      </div>
      <SearchOrderModal open={searchOrderOpen} onClose={() => setSearchOrderOpen(false)} orders={orders}/>

      {/* Tabella Ordini */}
      <div className="overflow-x-auto bg-white shadow border rounded-xl">
        <table className="min-w-[700px] w-full text-sm">
          <thead className="bg-black/90 text-white">
            <tr>
              <th className="p-3 text-left">Ordine</th>
              <th className="p-3 text-center">Etichetta</th>
              <th className="p-3 text-center">Evadi</th>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-right">Totale</th>
              <th className="p-3 text-center">Pagamento</th>
              <th className="p-3 text-center">Data</th>
              <th className="p-3 text-center">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {orders
              .filter((o) => statusMap[o.id]?.stato === "green")
              .map((order) => {
                const stat = statusMap[order.id];
                const evadibili = stat?.disponibili ?? 0;
                const totali = stat?.tot ?? 0;

                return (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="p-3 font-semibold">{order.number}</td>
                    <td className="p-3 text-center">
            {order.stato_ordine === "etichetta_generata" ? (
              <span title="Etichetta generata, non ancora stampata">
                <FileText size={18} className="text-cyan-500 inline" />
              </span>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </td>
                    <td className="p-3 text-center">
                      <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        {evadibili}/{totali}
                      </span>
                    </td>
                    <td className="p-3">{order.customer_name}</td>
                    <td className="p-3 text-right">
                      € {order.total?.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">{order.payment_status}</td>
                    <td className="p-3 text-center">
                      {formatIt("dd/MM/yyyy")(new Date(order.created_at))}
                    </td>
                    <td className="p-3 text-center space-y-2 flex flex-col items-center">
                      <button
                        className="flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-600 text-white text-xs hover:bg-blue-700 shadow"
                        onClick={() => navigate(`/prelievo/${order.id}`)}
                      >
                        <CheckCircle size={16} /> Conferma articoli
                      </button>
                      <button
                        className="flex items-center gap-2 px-3 py-1 rounded-xl bg-red-600 text-white text-xs hover:bg-red-700 shadow"
                        onClick={async () => {
                          await supabase
                            .from("orders")
                            .update({ stato_ordine: "nuovo" })
                            .eq("id", order.id);
                          setOrders((prev) =>
                            prev.filter((o) => o.id !== order.id)
                          );
                          setItems((prev) =>
                            prev.filter((i) => i.order_id !== order.id)
                          );
                        }}
                      >
                        <Trash2 size={16} /> Rimuovi da Prelievo
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Articoli problematici */}
      {problematicItems.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl shadow p-4">
          <h2 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
            <Boxes size={20} className="text-yellow-600" />
            Articoli con scorte insufficienti
          </h2>
          {(() => {
            const skuMap: Record<
              string,
              {
                sku: string;
                title: string;
                inv: number;
                ris: number;
                ordini: Ordine[];
              }
            > = {};

            for (const item of problematicItems) {
              const sku = item.products?.sku || item.sku || "—";
              const title = item.products?.product_title || "—";
              const inv = item.products?.inventory?.inventario ?? 0;
              const ris = item.products?.inventory?.riservato_sito ?? 0;

              if (!skuMap[sku]) {
                skuMap[sku] = { sku, title, inv, ris, ordini: [] };
              }

              const ordine = orders.find((o) => o.id === item.order_id);
              if (
                ordine &&
                !skuMap[sku].ordini.some((o) => o.id === ordine.id)
              ) {
                skuMap[sku].ordini.push(ordine);
              }
            }

            return Object.values(skuMap).map((g, idx) => (
              <div key={idx} className="mb-6">
                <div className="text-sm font-semibold mb-2">
                  ({g.sku}) — Inventario {g.inv}, Riservato {g.ris}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[600px] w-full text-sm border">
                    <thead className="bg-yellow-100 text-yellow-900 border">
                      <tr>
                        <th className="p-2 text-left">Ordine</th>
                        <th className="p-2 text-left">Cliente</th>
                        <th className="p-2 text-right">Totale</th>
                        <th className="p-2 text-center">Pagamento</th>
                        <th className="p-2 text-center">Data</th>
                        <th className="p-2 text-center">Evadi</th>
                        <th className="p-2 text-center">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.ordini.map((order) => {
                        const stat = statusMap[order.id];
                        const evadibili = stat?.disponibili ?? 0;
                        const totali = stat?.tot ?? 0;

                        return (
                          <tr key={order.id} className="border-b">
                            <td className="p-2 font-semibold">
                              #{order.number}
                            </td>
                            <td className="p-2">{order.customer_name}</td>
                            <td className="p-2 text-right">
                              € {order.total?.toFixed(2)}
                            </td>
                            <td className="p-2 text-center">
                              {order.payment_status}
                            </td>
                            <td className="p-2 text-center">
                              {formatIt("dd/MM/yyyy")(
                                new Date(order.created_at)
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <span className="bg-yellow-400 text-white px-2 py-1 rounded text-xs font-semibold">
                                {evadibili}/{totali}
                              </span>
                            </td>
                            <td className="p-2 text-center space-y-1">
                              <button
                                className="flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-600 text-white text-xs hover:bg-blue-700 shadow"
                                onClick={() =>
                                  navigate(`/prelievo/${order.id}`)
                                }
                              >
                                <CheckCircle size={16} /> Conferma articoli
                              </button>
                              <button
                                className="flex items-center gap-2 px-3 py-1 rounded-xl bg-red-600 text-white text-xs hover:bg-red-700 shadow"
                                onClick={async () => {
                                  await supabase
                                    .from("orders")
                                    .update({ stato_ordine: "nuovo" })
                                    .eq("id", order.id);
                                  setOrders((prev) =>
                                    prev.filter((o) => o.id !== order.id)
                                  );
                                  setItems((prev) =>
                                    prev.filter(
                                      (i) => i.order_id !== order.id
                                    )
                                  );
                                }}
                              >
                                <Trash2 size={16} /> Rimuovi da Prelievo
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
