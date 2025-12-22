// src/routes/sito/OrdiniSito.tsx

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import SearchInput from "../../components/SearchInput";
import { OrdineRow } from "../../components/OrdineRow";
import { ToggleSelector } from "../../components/ToggleSelector";
import { useSelectedOrders } from "../../state/useSelectedOrders";
import { trackFrontendEvent } from "../../utils/trackFrontendEvent";
import { Modal } from "../../components/Modal";
import { OrdineDetailPanel } from "./OrdineDetailPanel";

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
  products?: SupabaseProduct | SupabaseProduct[] | null;
};

export default function OrdiniSito() {
  const [orders, setOrders] = useState<Ordine[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [detailOrder, setDetailOrder] = useState<Ordine | null>(null);

  const [filters, setFilters] = useState<OrdiniFilters>(() => {
    try {
      const saved = sessionStorage.getItem("ordine_filters_sito");
      return saved
        ? JSON.parse(saved)
        : {
            search: "",
            payment: "",
            startDate: "",
            endDate: "",
          };
    } catch {
      return {
        search: "",
        payment: "",
        startDate: "",
        endDate: "",
      };
    }
  });

  const navigate = useNavigate();
  const { selected, selectMany, clear } = useSelectedOrders();

  useEffect(() => {
    sessionStorage.setItem("ordine_filters_sito", JSON.stringify(filters));
  }, [filters]);

  // Caricamento ordini + righe
  useEffect(() => {
    (async () => {
      // stessa query che avevi prima, così vedi gli stessi ordini
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .in("stato_ordine", ["nuovo", null])
      .neq("fulfillment_status", "annullato")
      .neq("fulfillment_status", "evaso")  // 👈 escludo gli evasi
      .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Errore caricamento ordini sito:", ordersError);
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, sku, quantity, products:product_id(sku, product_title)"
        );

      if (itemsError) {
        console.error("Errore caricamento order_items:", itemsError);
      }

      if (ordersData) {
        setOrders(ordersData as Ordine[]);
      }

      if (itemsData) {
        const typedItems = itemsData as OrderItemRow[];

        const mapped: OrderItem[] = typedItems.map((item) => {
          const rawProducts = item.products;

          let prod: SupabaseProduct | null = null;
          if (Array.isArray(rawProducts)) {
            prod = rawProducts.length > 0 ? rawProducts[0] : null;
          } else if (rawProducts) {
            prod = rawProducts;
          }

          return {
            ...item,
            products: prod,
          } as OrderItem;
        });

        setOrderItems(mapped);
      }

      clear();
    })();
  }, [clear]);

  // Mappa order_id -> SKUs (per la ricerca)
  const skuMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const item of orderItems) {
      if (!map[item.order_id]) map[item.order_id] = [];
      const sku = item.sku || item.products?.sku;
      if (sku) map[item.order_id].push(sku.toLowerCase());
    }
    return map;
  }, [orderItems]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const t = (x: string | null | undefined) =>
        (x || "").toLowerCase().replace(/[^a-z0-9]/gi, " ");

      const text = `${t(o.number)} ${t(o.customer_name)} ${t(
        o.channel
      )} ${t(o.payment_status)}`;
      const skus = skuMap[o.id]?.join(" ") || "";
      const tokens = t(filters.search)
        .split(" ")
        .filter(Boolean);

      const inSearch = tokens.every(
        (k) => text.includes(k) || skus.includes(k)
      );

      const createdAt = o.created_at ? new Date(o.created_at) : null;
      const afterStart =
        !filters.startDate ||
        (createdAt && createdAt >= new Date(filters.startDate));
      const beforeEnd =
        !filters.endDate ||
        (createdAt && createdAt <= new Date(filters.endDate));

      const paymentOk =
        !filters.payment || o.payment_status === filters.payment;

      return inSearch && afterStart && beforeEnd && paymentOk;
    });
  }, [orders, filters, skuMap]);

  const visibleOrders = filteredOrders;

  const idsToSelect = useMemo(
    () => visibleOrders.map((o) => o.id),
    [visibleOrders]
  );

  const allSelected =
    idsToSelect.length > 0 &&
    idsToSelect.every((id) => selected.includes(id));

  return (
    <div className="px-2 max-w-6xl mx-auto pb-28">
      <h1 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-center mb-4">
        📦 Ordini Sito
      </h1>

      <SearchInput
        value={filters.search}
        onChange={(val: string) =>
          setFilters((f: OrdiniFilters) => ({ ...f, search: val }))
        }
        placeholder=" Cerca per nome, numero, canale o SKU..."
      />

      <p className="text-[clamp(1rem,1.8vw,1.2rem)] text-center italic mt-2 text-gray-500">
        Ordini trovati: <strong>{visibleOrders.length}</strong>
      </p>

      <div className="mt-4 overflow-x-auto bg-white shadow border rounded-xl">
        <table className="min-w-[700px] w-full text-[clamp(1rem,1.6vw,1.2rem)]">
            <thead className="bg-black text-white">
            <tr>
                <th className="p-3 text-center w-[40px]">
                <ToggleSelector
                    checked={allSelected}
                    disabled={idsToSelect.length === 0}
                    onToggle={() =>
                    allSelected ? clear() : selectMany(idsToSelect)
                    }
                />
                </th>
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
                onOpenDetail={setDetailOrder}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Barra inferiore azioni */}
      <div
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 transform transition-all duration-300 ${
          selected.length > 0
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        } bg-green-600/80 text-white px-6 py-3 text-[clamp(1rem,2vw,1.2rem)] rounded-full shadow-lg z-[999] whitespace-nowrap`}
      >
        {selected.length} ordini selezionati —
        <button
        className="underline ml-2"
        onClick={async () => {
            if (selected.length === 0) return;

            const { error } = await supabase
            .from("orders")
            .update({ stato_ordine: "prelievo" }) // <-- solo questo
            .in("id", selected);

            if (error) {
            console.error("Errore aggiornamento ordini in prelievo:", error);
            return;
            }

            for (const id of selected) {
            const ordine = orders.find((o) => o.id === id);
            if (ordine) {
                await trackFrontendEvent("SET_PICKING_SITO", "order", ordine.id, {
                number: ordine.number,
                from: ordine.stato_ordine ?? "NUOVO",
                to: "prelievo",
                channel: ordine.channel,
                });
            }
            }

            navigate("/sito/PrelievoSito");
        }}
        >
        Procedi
        </button>
      </div>

      {/* Modale dettaglio ordine */}
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

            // 1) carico tutte le righe dell’ordine
            const { data: itemsData, error: itemsError } = await supabase
              .from("order_items")
              .select("id, quantity, plus, reserved_qty, checked_qty")
              .eq("order_id", detailOrder.id);

            if (itemsError) {
              console.error("Errore lettura righe ordine:", itemsError);
              return;
            }

            const items = (itemsData || []) as {
              id: string;
              quantity: number | null;
              plus: number | null;
              reserved_qty: number | null;
              checked_qty: number | null;
            }[];

            // 2) aggiorno reserved_qty per coprire tutte le quantity+plus
            for (const it of items) {
              const ordered =
                (it.quantity || 0) + (it.plus || 0);
              const alreadyCovered =
                (it.reserved_qty || 0) + (it.checked_qty || 0);
              const toReserve = Math.max(
                ordered - alreadyCovered,
                0
              );
              if (toReserve <= 0) continue;

              const newReserved =
                (it.reserved_qty || 0) + toReserve;

              const { error: updErr } = await supabase
                .from("order_items")
                .update({ reserved_qty: newReserved })
                .eq("id", it.id);

              if (updErr) {
                console.error(
                  "Errore update reserved_qty",
                  updErr
                );
              }
            }

            // 3) metto l’ordine in PRONTO_SPEDIZIONE lato gestionale
            const { error: ordErr } = await supabase
              .from("orders")
              .update({
                stage: "PRONTO_SPEDIZIONE",
                stato_ordine: "pronto_spedizione",
              })
              .eq("id", detailOrder.id);

            if (ordErr) {
              console.error(
                "Errore aggiornamento ordine:",
                ordErr
              );
              return;
            }

            // 4) rimuovo l'ordine dalla lista locale (non più "nuovo")
            setOrders((prev) =>
              prev.filter((o) => o.id !== detailOrder.id)
            );

            // chiudo il modale
            setDetailOrder(null);
          }}
        >
          Segna PRONTO per spedizione
        </button>
      </>
    }
  >
    <OrdineDetailPanel
      ordine={detailOrder}
      items={orderItems.filter((i) => i.order_id === detailOrder.id)}
    />
  </Modal>
)}

    </div>
  );
}
