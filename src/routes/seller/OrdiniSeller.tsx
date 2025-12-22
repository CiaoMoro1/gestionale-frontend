// src/routes/seller/OrdiniSeller.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import SearchInput from "../../components/SearchInput";
import { OrdineRow } from "../../components/OrdineRow";
import { ToggleSelector } from "../../components/ToggleSelector";
import { useSelectedOrders } from "../../state/useSelectedOrders";
import { trackFrontendEvent } from "../../utils/trackFrontendEvent";
import { Modal } from "../../components/Modal";
import { OrdineDetailPanelSeller } from "./OrdineDetailPanelSeller";

import type { Ordine, OrderItem } from "../../types/ordini";

type OrdiniFilters = {
  search: string;
  payment: string;
  startDate: string;
  endDate: string;
};

type SupabaseProduct = {
  sku?: string | null;
  product_title?: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string | null;
  quantity: number;
  title?: string | null;
  products?: SupabaseProduct | SupabaseProduct[] | null;
};

type OrdineSeller = Ordine & {
  stage?: string | null;
  amazon_order_id?: string | null;
  order_status_raw?: string | null;
  fulfillment_status?: string | null;
  sales_channel?: string | null;
  has_catalog_issue?: boolean;
};

type MoveToPickingResultRow = {
  order_id: string;
  ok: boolean;
  message?: string;
  code?: number;
};

type MoveToPickingResponse = {
  ok?: boolean;
  error?: string;
  results?: MoveToPickingResultRow[];
};

type ToastState = { msg: string; type: "success" | "error" } | null;

const API_URL = import.meta.env.VITE_API_URL as string;
const ADMIN_PWD = "petti";

function normalizeText(x: string | null | undefined) {
  return (x || "").toLowerCase().replace(/[^a-z0-9]/gi, " ");
}

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2300);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed top-6 left-1/2 z-[100] -translate-x-1/2 px-5 py-3 rounded-xl font-bold shadow-xl border text-center
      ${
        type === "success"
          ? "bg-green-100 border-green-300 text-green-800"
          : "bg-red-100 border-red-300 text-red-700"
      }
      animate-toast-pop`}
    >
      {message}
      <style>{`
        .animate-toast-pop { animation: toast-pop .5s cubic-bezier(.4,2,.3,1) both; }
        @keyframes toast-pop {
          0% { transform: translateX(-50%) scale(0.8); opacity:0; }
          100% { transform: translateX(-50%) scale(1); opacity:1;}
        }
      `}</style>
    </div>
  );
}

function askAdminPassword(setToast: (t: ToastState) => void): boolean {
  const pwd = window.prompt("Inserisci password amministratore:");
  if (pwd === null) return false;
  const ok = pwd === ADMIN_PWD;
  if (!ok) setToast({ msg: "Password errata.", type: "error" });
  return ok;
}

function buildParcelsMap(ids: string[], defaultParcels = 1): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, defaultParcels]));
}

export default function OrdiniSeller() {
  const [orders, setOrders] = useState<OrdineSeller[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [detailOrder, setDetailOrder] = useState<OrdineSeller | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const [movingToPicking, setMovingToPicking] = useState(false);

  const [filters, setFilters] = useState<OrdiniFilters>(() => {
    try {
      const saved = sessionStorage.getItem("ordine_filters_seller");
      return saved
        ? JSON.parse(saved)
        : { search: "", payment: "", startDate: "", endDate: "" };
    } catch {
      return { search: "", payment: "", startDate: "", endDate: "" };
    }
  });

  const [onlyCatalogIssues, setOnlyCatalogIssues] = useState(false);

  const navigate = useNavigate();
  const { selected, selectMany, clear } = useSelectedOrders();

  useEffect(() => {
    sessionStorage.setItem("ordine_filters_seller", JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    (async () => {
      try {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders_seller")
          .select(
            `
            id,
            amazon_order_id,
            number,
            customer_name,
            created_at,
            payment_status,
            fulfillment_status,
            total,
            customer_email,
            customer_phone,
            shipping_address,
            shipping_city,
            shipping_zip,
            shipping_province,
            shipping_country,
            stage,
            order_status_raw,
            last_update_date,
            channel:sales_channel
          `
          )
          .eq("order_status_raw", "Unshipped")
          .eq("stage", "NUOVO")
          .order("created_at", { ascending: false });

        if (ordersError) {
          console.error("Errore caricamento ordini seller:", ordersError);
          setToast({ msg: "Errore caricamento ordini Seller.", type: "error" });
        }
        if (ordersData) setOrders(ordersData as OrdineSeller[]);

        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items_seller")
          .select("id, order_id, product_id, sku, quantity, title, products:product_id(sku, product_title)");

        if (itemsError) {
          console.error("Errore caricamento order_items_seller:", itemsError);
          setToast({ msg: "Errore caricamento righe Seller.", type: "error" });
        }

        if (itemsData) {
          const typedItems = itemsData as OrderItemRow[];
          const mapped: OrderItem[] = typedItems.map((item) => {
            const rawProducts = item.products;
            let prod: SupabaseProduct | null = null;
            if (Array.isArray(rawProducts)) prod = rawProducts[0] || null;
            else if (rawProducts) prod = rawProducts;
            return { ...item, products: prod } as OrderItem;
          });
          setOrderItems(mapped);
        }

        clear();
      } catch (e) {
        console.error("Errore caricamento Seller:", e);
        setToast({ msg: "Errore di rete nel caricamento Seller.", type: "error" });
      }
    })();
  }, [clear]);

  const skuMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const item of orderItems) {
      if (!map[item.order_id]) map[item.order_id] = [];
      const sku = item.sku || item.products?.sku;
      if (sku) map[item.order_id].push(sku.toLowerCase());
    }
    return map;
  }, [orderItems]);

  const issueByOrderId = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const item of orderItems) {
      if (!item.product_id) map[item.order_id] = true;
    }
    return map;
  }, [orderItems]);

  const itemsCountByOrderId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of orderItems) {
      map[it.order_id] = (map[it.order_id] || 0) + 1;
    }
    return map;
  }, [orderItems]);
  const filteredOrders = useMemo(() => {
    const enrichedOrders: OrdineSeller[] = orders.map((o) => ({
      ...o,
      has_catalog_issue: !!issueByOrderId[o.id],
    }));

    const tokens = normalizeText(filters.search).split(" ").filter(Boolean);

    return enrichedOrders.filter((o) => {
      if (onlyCatalogIssues && !o.has_catalog_issue) return false;

      const text = `${normalizeText(o.number)} ${normalizeText(o.customer_name)} ${normalizeText(
        o.channel
      )} ${normalizeText(o.payment_status)}`;

      const skus = (skuMap[o.id] || []).join(" ");
      const inSearch = tokens.every((k) => text.includes(k) || skus.includes(k));

      const createdAt = o.created_at ? new Date(o.created_at) : null;
      const afterStart = !filters.startDate || (createdAt && createdAt >= new Date(filters.startDate));
      const beforeEnd = !filters.endDate || (createdAt && createdAt <= new Date(filters.endDate));

      const paymentOk = !filters.payment || o.payment_status === filters.payment;

      return inSearch && afterStart && beforeEnd && paymentOk;
    });
  }, [orders, filters, skuMap, issueByOrderId, onlyCatalogIssues]);

  const visibleOrders = filteredOrders;

  const idsToSelect = useMemo(() => visibleOrders.map((o) => o.id), [visibleOrders]);

  const allSelected = idsToSelect.length > 0 && idsToSelect.every((id) => selected.includes(id));

  const selectedOrders = useMemo(() => orders.filter((o) => selected.includes(o.id)), [orders, selected]);

  const selectedWithIssues = useMemo(
    () => selectedOrders.filter((o) => !!issueByOrderId[o.id]),
    [selectedOrders, issueByOrderId]
  );

  const issueCount = useMemo(
    () => visibleOrders.filter((o) => !!issueByOrderId[o.id]).length,
    [visibleOrders, issueByOrderId]
  );

  async function handleMoveToPicking() {
    if (movingToPicking) return;
    if (selected.length === 0) return;

    if (selectedWithIssues.length > 0) {
      const preview = selectedWithIssues
        .slice(0, 3)
        .map((o) => o.number || o.amazon_order_id || o.id)
        .join(", ");

      setToast({
        msg:
          selectedWithIssues.length === 1
            ? `Bloccato: problema catalogo su ${preview}.`
            : `Bloccato: ${selectedWithIssues.length} ordini con problemi catalogo (es: ${preview}).`,
        type: "error",
      });
      return;
    }

    setMovingToPicking(true);
    try {
      const resp = await fetch(`${API_URL}/api/prelievi-seller/move-to-picking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: selected,
          parcels: buildParcelsMap(selected, 1),
        }),
      });

      const data: MoveToPickingResponse = await resp.json().catch(() => ({} as MoveToPickingResponse));

      if (!resp.ok || data.error) {
        console.error("move-to-picking seller KO:", resp.status, data);
        setToast({ msg: data.error || "Errore move-to-picking Seller", type: "error" });
        return;
      }

      const results = data.results || [];
      const failed = results.filter((r) => !r.ok);

      if (failed.length > 0) {
        const preview = failed
          .slice(0, 3)
          .map((f) => `${f.order_id}: ${f.message || "errore"}`)
          .join(" | ");

        setToast({
          msg: failed.length === 1 ? `Non spostato: ${preview}` : `Falliti ${failed.length}: ${preview}`,
          type: "error",
        });
        return;
      }

      for (const id of selected) {
        const ordine = orders.find((o) => o.id === id);
        if (ordine) {
          await trackFrontendEvent("SET_PICKING_SELLER", "order_seller", ordine.id, {
            number: ordine.number,
            from: ordine.stage ?? "NUOVO",
            to: "PICKING",
            channel: ordine.channel,
          });
        }
      }

      setToast({ msg: "PICKING + etichetta creata ✅", type: "success" });
      setTimeout(() => navigate("/seller/prelievo"), 250);
    } catch (e) {
      console.error("Errore rete move-to-picking seller:", e);
      setToast({ msg: "Errore di rete move-to-picking Seller", type: "error" });
    } finally {
      setMovingToPicking(false);
    }
  }

  return (
    <div className="px-2 max-w-6xl mx-auto pb-28">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <h1 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-center mb-2">
        📦 Ordini Amazon Seller
      </h1>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-3 text-sm">
        <span className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
          Trovati: <b>{visibleOrders.length}</b>
        </span>

        <button
          type="button"
          className={`px-3 py-1 rounded-full border ${
            onlyCatalogIssues ? "bg-yellow-100 border-yellow-300 text-yellow-900" : "bg-white border-gray-200"
          }`}
          onClick={() => setOnlyCatalogIssues((v) => !v)}
          title="Mostra solo ordini con SKU non agganciati a products"
        >
          ⚠️ Problemi catalogo: <b>{issueCount}</b>
        </button>

        {selectedWithIssues.length > 0 && (
          <span className="px-3 py-1 rounded-full bg-red-100 border border-red-200 text-red-800">
            Selezione bloccata: <b>{selectedWithIssues.length}</b>
          </span>
        )}
      </div>

      <SearchInput
        value={filters.search}
        onChange={(val: string) => setFilters((f) => ({ ...f, search: val }))}
        placeholder=" Cerca per nome, numero, canale o SKU..."
      />

      <div className="mt-4 overflow-x-auto bg-white shadow border rounded-xl">
        <table className="min-w-[700px] w-full text-[clamp(1rem,1.6vw,1.2rem)]">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-3 text-center w-[40px]">
                <ToggleSelector
                  checked={allSelected}
                  disabled={idsToSelect.length === 0}
                  onToggle={() => (allSelected ? clear() : selectMany(idsToSelect))}
                />
              </th>
              <th className="p-3 text-center">Catalogo</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-center">Cliente</th>
              <th className="p-3 text-center">Totale</th>
              <th className="p-3 text-center">Pagamento</th>
              <th className="p-3 text-center">Ordine</th>
              <th className="p-3 text-center">Canale</th>
              <th className="p-3 text-center">Data</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((order) => (
              <OrdineRow
                key={order.id}
                order={order}
                onOpenDetail={(o) => navigate(`/seller/ordini/${o.id}`)}
                showCatalogCol
                showItemsCol
                itemsCount={itemsCountByOrderId[order.id] || 0}
              />
            ))}
            {visibleOrders.length === 0 && (
              <tr>
                <td className="p-4 text-center text-gray-500 italic" colSpan={7}>
                  Nessun ordine Amazon Seller trovato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 transform transition-all duration-300 ${
          selected.length > 0 ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        } bg-green-700/90 text-white px-6 py-3 text-[clamp(1rem,2vw,1.2rem)] rounded-full shadow-lg z-[999] whitespace-nowrap`}
      >
        <b>{selected.length}</b> ordini selezionati —
        <button
          type="button"
          className={`ml-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-green-900 font-bold shadow-sm ${
            movingToPicking ? "opacity-60 pointer-events-none" : "hover:bg-green-50"
          }`}
          onClick={handleMoveToPicking}
        >
          {movingToPicking ? "⏳ Procedo..." : "✅ Procedi in prelievo"}
        </button>
      </div>

      {detailOrder && (
        <Modal
          title={`Ordine ${detailOrder.number}`}
          onClose={() => setDetailOrder(null)}
          footer={
            <>
              <button
                className="px-4 py-2 rounded-full border border-gray-300 bg-white text-gray-700 text-sm hover:bg-gray-100"
                onClick={() => setDetailOrder(null)}
              >
                Chiudi
              </button>

              <button
                className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                onClick={async () => {
                  if (!detailOrder) return;
                  if (!askAdminPassword(setToast)) return;

                  try {
                    const { data: itemsData, error: itemsError } = await supabase
                      .from("order_items_seller")
                      .select("id, quantity, plus, reserved_qty, checked_qty")
                      .eq("order_id", detailOrder.id);

                    if (itemsError) {
                      console.error("Errore lettura righe ordine seller:", itemsError);
                      setToast({ msg: "Errore lettura righe Seller.", type: "error" });
                      return;
                    }

                    const items = (itemsData || []) as {
                      id: string;
                      quantity: number | null;
                      plus: number | null;
                      reserved_qty: number | null;
                      checked_qty: number | null;
                    }[];

                    for (const it of items) {
                      const ordered = (it.quantity || 0) + (it.plus || 0);
                      const alreadyCovered = (it.reserved_qty || 0) + (it.checked_qty || 0);
                      const toReserve = Math.max(ordered - alreadyCovered, 0);
                      if (toReserve <= 0) continue;

                      const newReserved = (it.reserved_qty || 0) + toReserve;

                      const { error: updErr } = await supabase
                        .from("order_items_seller")
                        .update({ reserved_qty: newReserved })
                        .eq("id", it.id);

                      if (updErr) console.error("Errore update reserved_qty seller", updErr);
                    }

                    const { error: ordErr } = await supabase
                      .from("orders_seller")
                      .update({ stage: "PRONTO_SPEDIZIONE" })
                      .eq("id", detailOrder.id);

                    if (ordErr) {
                      console.error("Errore aggiornamento ordine seller:", ordErr);
                      setToast({ msg: "Errore aggiornamento ordine Seller.", type: "error" });
                      return;
                    }

                    setOrders((prev) => prev.filter((o) => o.id !== detailOrder.id));
                    setDetailOrder(null);
                    setToast({ msg: "Ordine forzato a PRONTO_SPEDIZIONE.", type: "success" });
                  } catch (e) {
                    console.error("Errore override PRONTO:", e);
                    setToast({ msg: "Errore rete/override PRONTO.", type: "error" });
                  }
                }}
              >
                Segna PRONTO per spedizione (admin)
              </button>
            </>
          }
        >
          <OrdineDetailPanelSeller ordine={detailOrder} items={orderItems.filter((i) => i.order_id === detailOrder.id)} />
        </Modal>
      )}
    </div>
  );
}
