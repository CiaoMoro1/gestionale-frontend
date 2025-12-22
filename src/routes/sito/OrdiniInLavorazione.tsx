// src/routes/sito/OrdiniInLavorazione.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import SearchInput from "../../components/SearchInput";
import type { Ordine } from "../../types/ordini";

type OrdiniStatoProps = {
  title: string;
  stage: "PRONTO_SPEDIZIONE" | "IN_LAVORAZIONE";
};

type OrdiniStatoFilters = {
  search: string;
};

function OrdiniStatoSitoPage({ title, stage }: OrdiniStatoProps) {
  const [orders, setOrders] = useState<Ordine[]>([]);
  const [filters, setFilters] = useState<OrdiniStatoFilters>({
    search: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("stage", stage)
        .neq("fulfillment_status", "annullato")
        .order("created_at", { ascending: false });

      if (error || !data) {
        console.error(
          `Errore caricamento ordini ${stage}:`,
          error
        );
        setOrders([]);
        return;
      }

      setOrders(data as Ordine[]);
    })();
  }, [stage]);

  const filteredOrders = useMemo(() => {
    const search = filters.search
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, " ")
      .trim();

    if (!search) return orders;

    const tokens = search.split(/\s+/).filter(Boolean);

    const norm = (v: string | null | undefined) =>
      (v || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/gi, " ");

    return orders.filter((o) => {
      const text = [
        norm(o.number),
        norm(o.customer_name),
        norm(o.channel),
        norm(o.payment_status),
      ].join(" ");

      return tokens.every((t) => text.includes(t));
    });
  }, [orders, filters.search]);

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  return (
    <div className="px-2 max-w-6xl mx-auto pb-24">
      <h1 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-center mb-4">
        {title}
      </h1>

      <SearchInput
        value={filters.search}
        onChange={(val: string) =>
          setFilters((prev) => ({ ...prev, search: val }))
        }
        placeholder="Cerca per nome, numero, canale o pagamento..."
      />

      <p className="text-[clamp(1rem,1.8vw,1.2rem)] text-center italic mt-2 text-gray-500">
        Ordini trovati: <strong>{filteredOrders.length}</strong>
      </p>

      <div className="mt-4 overflow-x-auto bg-white shadow border rounded-xl">
        <table className="min-w-[700px] w-full text-[clamp(1rem,1.6vw,1.2rem)]">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-3 text-center">Cliente</th>
              <th className="p-3 text-center">Totale</th>
              <th className="p-3 text-center">Pagamento</th>
              <th className="p-3 text-center">Ordine</th>
              <th className="p-3 text-center">Canale</th>
              <th className="p-3 text-center">Data</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr
                key={order.id}
                className="hover:bg-gray-50 transition cursor-pointer border-b border-black/10"
                onClick={() =>
                  navigate(`/ordini/${order.id}`)
                }
              >
                <td className="text-center p-3">
                  {order.customer_name}
                </td>
                <td className="text-center p-3">
                  {Number(order.total).toFixed(2)} €
                </td>
                <td className="text-center p-3">
                  {order.payment_status}
                </td>
                <td className="text-center p-3 font-semibold">
                  {order.number}
                </td>
                <td className="text-center p-3">
                  {order.channel}
                </td>
                <td className="text-center p-3">
                  {formatDateTime(order.created_at)}
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center p-4 text-gray-400"
                >
                  Nessun ordine in questa sezione.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Pagina SITO: Ordini in lavorazione (stage = IN_LAVORAZIONE)
 */
export default function OrdiniInLavorazioneSito() {
  return (
    <OrdiniStatoSitoPage
      title="🛠️ Ordini in lavorazione"
      stage="IN_LAVORAZIONE"
    />
  );
}
