import { useEffect, useState, useMemo, useDeferredValue } from "react";
import { supabase } from "../lib/supabase";
import { ChevronDown, ChevronUp } from "lucide-react";
import SearchInput from "../components/SearchInput";
import OrdineRow from "../components/OrdineRow"; // ✅ deve esistere

export default function Ordini() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [evadibiliOnly, setEvadibiliOnly] = useState(false);

  const debouncedSearch = useDeferredValue(search);

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
    return <div className="p-6 text-black/70 text-center text-[clamp(1rem,2vw,1.2rem)]">Caricamento Ordini...</div>;

  return (
    <div className="text-black/70 px-2 pb-10 max-w-6xl mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-[clamp(1.5rem,4vw,2.2rem)] font-bold text-black/70 mb-2">Ordini</h1>
        <div className="flex justify-center gap-2 sm:gap-4 flex-wrap">
          <button
            onClick={() => setShowAll(false)}
            className={`px-4 py-2 rounded-full ${
              !showAll
                ? "bg-white/60 border border-black/20 shadow text-black/70"
                : "bg-white/30 border border-black/10 text-black/70"
            }`}
          >
            Attivi
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-4 py-2 rounded-full ${
              showAll
                ? "bg-white/60 border border-black/20 shadow text-black/70"
                : "bg-white/30 border border-black/10 text-black/70"
            }`}
          >
            Tutti
          </button>
          <button
            onClick={() => setEvadibiliOnly((v) => !v)}
            className={`px-4 py-2 rounded-full ${
              evadibiliOnly
                ? "bg-green-100 border border-green-400 shadow text-green-800"
                : "bg-white/30 border border-black/10 text-black/70"
            }`}
          >
            Solo evadibili
          </button>
        </div>
      </div>

      <SearchInput
        value={search}
        onChange={(val: string) => setSearch(val)}
        placeholder=" Cerca per nome, numero, stato..."
      />

      <div className="text-center mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-[clamp(0.8rem,2vw,1rem)] text-black/70 font-medium rounded-full px-4 py-2 backdrop-blur-md bg-white/50 border border-black/20 shadow-sm flex items-center justify-center gap-1 mx-auto"
        >
          {showFilters ? "Nascondi filtri" : "Mostra filtri"}
          {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex flex-col">
            <label htmlFor="payment-select" className="mb-1 text-black/70 font-medium">Pagamento</label>
            <select
              id="payment-select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-4 py-2 border rounded-full text-black/70"
            >
              <option value="">Tutti</option>
              <option value="pagato">Pagato</option>
              <option value="contrassegno">Contrassegno</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="start-date" className="mb-1 text-black/70 font-medium">Data inizio</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border rounded-full"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="end-date" className="mb-1 text-black/70 font-medium">Data fine</label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border rounded-full"
            />
          </div>
        </div>
      )}

      <p className="text-[clamp(0.85rem,2vw,1rem)] text-gray-600 text-center mt-2 italic">
        Ordini trovati: <strong>{filteredOrders.length}</strong>
      </p>

      <div className="w-full rounded-xl bg-white shadow-md border border-gray-100 mt-4 overflow-x-auto">
        <table className="min-w-[600px] w-full text-[clamp(1rem,2vw,1.2rem)] border-collapse">
          <thead className="bg-black text-white uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-center">Evadi</th>
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
              <OrdineRow key={order.id} order={order} evadibiliOnly={evadibiliOnly} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
