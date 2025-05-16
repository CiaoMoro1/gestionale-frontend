// src/routes/Ordini.tsx
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import SearchInput from "../components/SearchInput";
import { OrdineRow } from "../components/OrdineRow";
import { useOrderStatusMap } from "../hooks/useOrderStatusMap";
import { useSelectedOrders } from "../state/useSelectedOrders";
import { ToggleSelector } from "../components/ToggleSelector";
import { useNavigate } from "react-router-dom";
import { trackFrontendEvent } from "../utils/trackFrontendEvent";

type OrdiniFilters = {
  search: string;
  payment: string;
  startDate: string;
  endDate: string;
  evadibiliOnly: boolean;
};

export default function Ordini() {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [filters, setFilters] = useState<OrdiniFilters>(() => {
    try {
      const saved = sessionStorage.getItem("ordine_filters");
      return saved ? JSON.parse(saved) : {
        search: "",
        payment: "",
        startDate: "",
        endDate: "",
        evadibiliOnly: false,
      };
    } catch {
      return {
        search: "",
        payment: "",
        startDate: "",
        endDate: "",
        evadibiliOnly: false,
      };
    }
  });

  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.setItem("ordine_filters", JSON.stringify(filters));
  }, [filters]);

  const { selected, selectMany, clear } = useSelectedOrders();

  useEffect(() => {
    (async () => {
      const [ordersRes, itemsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .in("stato_ordine", ["nuovo", null])
          .neq("fulfillment_status", "annullato")
          .order("created_at", { ascending: false }),
        supabase
          .from("order_items")
          .select("order_id, quantity, products:product_id(sku, product_title, inventory(inventario, disponibile, riservato_sito))"),
      ]);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (itemsRes.data) setOrderItems(itemsRes.data);
      clear();
    })();
  }, [clear]);

  const { statusMap } = useOrderStatusMap(orderItems);


  const skuMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const item of orderItems) {
      if (!map[item.order_id]) map[item.order_id] = [];
      if (item.products?.sku) map[item.order_id].push(item.products.sku.toLowerCase());
    }
    return map;
  }, [orderItems]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const t = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/gi, " ");
      const text = `${t(o.number)} ${t(o.customer_name)} ${t(o.channel)} ${t(o.payment_status)}`;
      const skus = skuMap[o.id]?.join(" ") || "";
      const tokens = t(filters.search).split(" ").filter(Boolean);

      return tokens.every((k) => text.includes(k) || skus.includes(k)) &&
        (!filters.payment || o.payment_status === filters.payment) &&
        (!filters.startDate || new Date(o.created_at) >= new Date(filters.startDate)) &&
        (!filters.endDate || new Date(o.created_at) <= new Date(filters.endDate));
    });
  }, [orders, filters, skuMap]);

  const visibleOrders = useMemo(() => {
    return filteredOrders.filter(
      (o) => !filters.evadibiliOnly || statusMap[o.id]?.stato !== "red"
    );
  }, [filteredOrders, filters.evadibiliOnly, statusMap]);

  const idsToSelect = useMemo(() => {
    return visibleOrders
      .filter((o) => ["green", "yellow"].includes(statusMap[o.id]?.stato))
      .map((o) => o.id);
  }, [visibleOrders, statusMap]);

  const allSelected = idsToSelect.every((id) => selected.includes(id)) && idsToSelect.length > 0;

  return (
    <div className="px-2 max-w-6xl mx-auto pb-28">
      <h1 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-center mb-4">📦 Ordini</h1>

      <div className="flex flex-wrap justify-center gap-2 mb-4">
        <button
          onClick={() => setFilters((f: OrdiniFilters) => ({ ...f, evadibiliOnly: !f.evadibiliOnly }))}
          className={`text-[clamp(1rem,2vw,1.2rem)] px-4 py-2 rounded-full ${
            filters.evadibiliOnly
              ? "bg-green-100 text-green-800 border border-green-400 shadow"
              : "bg-gray-100 text-black border border-gray-300"
          }`}
        >
          ✅ Solo evadibili
        </button>
      </div>

      <SearchInput
        value={filters.search}
        onChange={(val: string) => setFilters((f: OrdiniFilters) => ({ ...f, search: val }))}
        placeholder=" Cerca per nome, numero, canale o SKU..."
      />

      <p className="text-[clamp(1rem,1.8vw,1.2rem)] text-center italic mt-2 text-gray-500">
        Ordini trovati: <strong>{visibleOrders.length}</strong>
      </p>

      <div className="mt-4 overflow-x-auto bg-white shadow border rounded-xl">
        <table className="min-w-[700px] w-full text-[clamp(1rem,1.6vw1.2rem)]">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-3 text-center">
                <ToggleSelector
                  checked={allSelected}
                  disabled={idsToSelect.length === 0}
                  onToggle={() => (allSelected ? clear() : selectMany(idsToSelect))}
                />
              </th>
              <th className="p-3 text-center">Evadi</th>
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
              <OrdineRow key={order.id} order={order} status={statusMap[order.id]} />
            ))}
          </tbody>
        </table>
      </div>

      <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 transform transition-all duration-300 ${selected.length > 0 ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"} bg-green-600/80 text-white px-6 py-3 text-[clamp(1rem,2vw,1.2rem)] rounded-full shadow-lg z-[999] whitespace-nowrap`}>
        {selected.length} ordini selezionati —
        <button
          className="underline ml-2"
          onClick={async () => {
            if (selected.length === 0) return;

            // Aggiorna lo stato degli ordini selezionati
            await supabase
              .from("orders")
              .update({ stato_ordine: "prelievo" })
              .in("id", selected);

            // Audit log per ciascun ordine
            for (const id of selected) {
              const ordine = orders.find(o => o.id === id);
              if (ordine) {
                await trackFrontendEvent(
                  "SET_PRELIEVO",
                  "order",
                  ordine.id,
                  { number: ordine.number, from: "nuovo", to: "prelevato" }
                );
              }
            }


            // Naviga verso /prelievo
            navigate("/prelievo", { state: { orderIds: selected } });
          }}
        >
          Procedi
        </button>


      </div>
    </div>
  );
}
