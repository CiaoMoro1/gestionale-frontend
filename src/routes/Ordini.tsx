import { useEffect, useState, useMemo, useDeferredValue } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function Ordini() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDeferredValue(search);
  const navigate = useNavigate();

  useEffect(() => {
    const loadOrders = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, created_at, customer_name, channel, total, payment_status, fulfillment_status")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Errore nel caricamento ordini:", error);
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    };

    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9]/gi, " ").split(/\s+/).join(" ");
    const tokens = normalize(debouncedSearch).split(" ");

    return orders.filter((order) => {
      const fullText = normalize(
        `${order.number} ${order.customer_name} ${order.channel} ${order.payment_status} ${order.fulfillment_status}`
      );

      const matchesSearch = tokens.every((t) => fullText.includes(t));
      const matchesPayment = paymentFilter ? order.payment_status === paymentFilter : true;
      const matchesStart = startDate ? new Date(order.created_at) >= new Date(startDate) : true;
      const matchesEnd = endDate ? new Date(order.created_at) <= new Date(endDate) : true;
      const matchesAnnullato = showAll ? true : order.fulfillment_status !== "annullato";

      return matchesSearch && matchesPayment && matchesStart && matchesEnd && matchesAnnullato;
    });
  }, [orders, debouncedSearch, paymentFilter, startDate, endDate, showAll]);

  if (loading)
    return <div className="p-6 text-black text-center">Caricamento Ordini...</div>;

  return (
    <div className="text-black/70 px-2 pb-10 max-w-6xl mx-auto">
      {/* Tabs Attivi / Tutti */}
      <div className="text-center mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">Ordini</h1>
        <div className="flex justify-center gap-2 sm:gap-4 text-sm flex-wrap">
          <button
            onClick={() => setShowAll(false)}
            className={`px-3 py-1 rounded-full font-semibold transition ${
              !showAll ? "bg-black text-white" : "bg-white text-black border"
            }`}
          >
            📦 Attivi
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-3 py-1 rounded-full font-semibold transition ${
              showAll ? "bg-black text-white" : "bg-white text-black border"
            }`}
          >
            🗃️ Tutti
          </button>
        </div>
      </div>

      {/* Campo ricerca */}
      <div className="mb-2 max-w-md mx-auto">
        <input
          type="text"
          placeholder="🔍 Cerca per nome, numero, stato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg shadow-sm text-sm"
        />
      </div>

      {/* Toggle filtri */}
      <div className="text-center mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1 mx-auto"
        >
          {showFilters ? "Nascondi filtri" : "Mostra filtri"}
          {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Filtri visibili */}
      {showFilters && (
        <div className="mb-4 max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">

          {/* Filtro pagamento con dropdown mobile-friendly */}
          <div className="flex flex-col">
            <label htmlFor="payment-select" className="mb-1 text-black font-medium">Pagamento</label>
            <div className="relative">
              <select
                id="payment-select"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-4 py-2 pr-10 border rounded-lg text-sm bg-white text-black shadow-sm appearance-none"
                style={{
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  appearance: "none",
                }}
              >
                <option value="">Tutti i pagamenti</option>
                <option value="pagato">Pagato</option>
                <option value="in attesa">In attesa</option>
                <option value="fallito">Fallito</option>
              </select>
              <div className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-500">
                ▼
              </div>
            </div>
          </div>

          {/* Data inizio */}
          <div className="flex flex-col">
            <label htmlFor="start-date" className="mb-1 text-black font-medium">Data inizio</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border rounded-lg shadow-sm text-sm w-full"
            />
          </div>

          {/* Data fine */}
          <div className="flex flex-col">
            <label htmlFor="end-date" className="mb-1 text-black font-medium">Data fine</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border rounded-lg shadow-sm text-sm w-full"
            />
          </div>
        </div>
      )}


      {/* Totale risultati */}
      <p className="text-sm text-gray-600 text-center mt-2 italic">
        Ordini trovati: <strong>{filteredOrders.length}</strong>
      </p>

      {/* Tabella ordini */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-md border border-gray-100 mt-4">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-black text-white uppercase tracking-wide text-xs">
            <tr>
              <th className="px-4 py-3 text-center">Cliente</th>
              <th className="px-4 py-3 text-center">Totale</th>
              <th className="px-4 py-3 text-center">Pagamento</th>
              <th className="px-4 py-3 text-center">Ordine</th>
              <th className="px-4 py-3 text-center">Canale</th>
              <th className="px-4 py-3 text-center">Evasione</th>
              <th className="px-4 py-3 text-center">Data</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr
                key={order.id}
                className="hover:bg-gray-50 transition cursor-pointer border-b border-black/60"
                onClick={() => navigate(`/ordini/${order.id}`)}
              >
                <td className="px-4 py-3 text-center">{order.customer_name}</td>
                <td className="px-4 py-3 text-center">{Number(order.total).toFixed(2)} €</td>
                <td className="px-4 py-3 text-center">{order.payment_status}</td>
                <td className="px-4 py-3 text-center font-semibold">{order.number}</td>
                <td className="px-4 py-3 text-center">{order.channel}</td>
                <td className="px-4 py-3 text-center">{order.fulfillment_status}</td>
                <td className="px-4 py-3 text-center">{formatDate(order.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  function formatDate(dateString: string = "") {
    return new Date(dateString).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
