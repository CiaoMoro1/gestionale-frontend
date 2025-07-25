import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Package, Download, ChevronDown, ChevronUp, AlertCircle, X } from "lucide-react";
import { useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

type RiepilogoFattura = {
  fulfillment_center: string;
  start_delivery: string;
  po_list: string[];
  totale_articoli: number;
  valore_totale: number;
};

type Fattura = {
  id: number;
  numero_fattura: string;
  data_fattura: string;
  centro: string;
  start_delivery: string;
  po_list: string[];
  totale_fattura: number;
  imponibile: number;
  articoli_ordinati: number;
  articoli_confermati: number;
  stato: string;
  errore?: string;
  xml_url: string;
};

type POItem = {
  po_number: string;
  qty_ordered: number;
  qty_confirmed: number;
  cost?: number | string;
  fulfillment_center: string;
  start_delivery: string;
};


const savedFilters = (() => {
  try { return JSON.parse(localStorage.getItem("fatture-filtri") || "{}"); }
  catch { return {}; }
})();

export default function FattureVendorPage() {
  const [showDaFatturare, setShowDaFatturare] = useState(false);
  const [conferma, setConferma] = useState<null | RiepilogoFattura>(null);
  const [jobPolling, setJobPolling] = useState<string | null>(null);

  // Filtri
const [filterYear, setFilterYear] = useState<string>(savedFilters.filterYear || "");
const [filterMonth, setFilterMonth] = useState<string>(savedFilters.filterMonth || "");
const [filterDay, setFilterDay] = useState<string>(savedFilters.filterDay || "");
const [filterCenter, setFilterCenter] = useState<string>(savedFilters.filterCenter || "");
const [search, setSearch] = useState(savedFilters.search || "");
const [sortBy, setSortBy] = useState<"data" | "imponibile">(savedFilters.sortBy || "data");
const [sortDir, setSortDir] = useState<"asc" | "desc">(savedFilters.sortDir || "desc");
const [filtriAttivi, setFiltriAttivi] = useState(false);


useEffect(() => {
  const filters = {
    filterYear,
    filterMonth,
    filterDay,
    filterCenter,
    search,
    sortBy,
    sortDir
  };
  localStorage.setItem("fatture-filtri", JSON.stringify(filters));
}, [filterYear, filterMonth, filterDay, filterCenter, search, sortBy, sortDir]);



  // --- DATA ---
  const { data: fatturePronte = [], isLoading: loadingRiepilogo, refetch: refetchFatturePronte } = useQuery({
    queryKey: ["fatture-pronte"],
    queryFn: async () => {
        const { data, error } = await supabase.rpc("lista_fatture_pronte");
        if (error) throw error;
        return data as RiepilogoFattura[];
    }
    });

  const { data: fattureEsistenti = [], refetch: refetchFatture, isLoading: loadingFatture } = useQuery({
    queryKey: ["fatture-esistenti"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE_URL}/api/fatture_amazon_vendor/list`);
      return res.data as Fattura[];
    }
  });

  const { data: poItems = [] } = useQuery({
    queryKey: ["ordini_vendor_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordini_vendor_items")
        .select("po_number,qty_ordered,qty_confirmed,fulfillment_center,start_delivery,cost");
      if (error) throw error;
      return data as POItem[];
    }
  });

  // --- UTILITY ARTICOLI ORDINATI/CONFIRMATI ---
  function getTotOrdinato(item: RiepilogoFattura) {
    return poItems.filter(itm =>
      item.po_list.includes(itm.po_number) &&
      itm.fulfillment_center === item.fulfillment_center &&
      itm.start_delivery === item.start_delivery
    ).reduce((sum, itm) => sum + (itm.qty_ordered || 0), 0);
  }
  function getTotConfermato(item: RiepilogoFattura) {
    return poItems.filter(itm =>
      item.po_list.includes(itm.po_number) &&
      itm.fulfillment_center === item.fulfillment_center &&
      itm.start_delivery === item.start_delivery
    ).reduce((sum, itm) => sum + (itm.qty_confirmed || 0), 0);
  }

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toITDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getJobIdForItem(item: { fulfillment_center: string, start_delivery: string, po_list: string[] }) {
  return `${item.fulfillment_center}|${item.start_delivery}|${item.po_list.join("-")}`;
}

  // --- FILTRI E DROPDOWN UNICI ---
  // Tutte le date uniche (NO DUPLICATI tra centri!)
  const tutteLeDateUniche = Array.from(
    new Set([
      ...fatturePronte.map(f => f.start_delivery),
      ...fattureEsistenti.map(f => f.start_delivery),
    ])
  ).sort().reverse();


  
  // Raggruppo date per anno/mese per dropdown senza duplicati inutili
  const anniDisponibili = Array.from(new Set(tutteLeDateUniche.map(d => d.substring(0, 4)))).sort().reverse();
  const mesiDisponibili: { [anno: string]: string[] } = {};
  anniDisponibili.forEach(anno => {
    mesiDisponibili[anno] = Array.from(
      new Set(tutteLeDateUniche
        .filter(d => d.startsWith(anno))
        .map(d => d.substring(5, 7))
      )
    ).sort();
  });
  const giorniDisponibili: { [yearMonth: string]: string[] } = {};
  anniDisponibili.forEach(anno => {
    mesiDisponibili[anno]?.forEach(mese => {
      const key = `${anno}-${mese}`;
      giorniDisponibili[key] = Array.from(
        new Set(tutteLeDateUniche.filter(d => d.startsWith(key)))
      ).sort().reverse();
    });
  });
  const centriDisponibili = Array.from(
    new Set([
      ...fatturePronte.map(f => f.fulfillment_center),
      ...fattureEsistenti.map(f => f.centro)
    ])
  ).sort();

  // --- FILTRI APPLICATI ALLE TABELLE ---
  function filtraFattureDaFatturare() {
    return fatturePronte.filter(f =>
      (!filterCenter || f.fulfillment_center === filterCenter) &&
      (!filterYear || f.start_delivery.startsWith(filterYear)) &&
      (!filterMonth || f.start_delivery.substring(5, 7) === filterMonth) &&
      (!filterDay || f.start_delivery === filterDay) &&
      (
        search === "" ||
        f.po_list.join(",").toLowerCase().includes(search.toLowerCase()) ||
        f.fulfillment_center.toLowerCase().includes(search.toLowerCase()) ||
        f.start_delivery.toLowerCase().includes(search.toLowerCase())
      )
    ).sort((a, b) => {
      if (sortBy === "data") {
        return sortDir === "asc"
          ? a.start_delivery.localeCompare(b.start_delivery)
          : b.start_delivery.localeCompare(a.start_delivery);
      } else {
        return sortDir === "asc"
          ? a.valore_totale - b.valore_totale
          : b.valore_totale - a.valore_totale;
      }
    });
  }
  function filtraFattureGenerate() {
    return fattureEsistenti.filter(f =>
      (!filterCenter || f.centro === filterCenter) &&
      (!filterYear || f.start_delivery.startsWith(filterYear)) &&
      (!filterMonth || f.start_delivery.substring(5, 7) === filterMonth) &&
      (!filterDay || f.start_delivery === filterDay) &&
      (
        search === "" ||
        (f.po_list || []).join(",").toLowerCase().includes(search.toLowerCase()) ||
        f.centro?.toLowerCase().includes(search.toLowerCase()) ||
        f.data_fattura?.toLowerCase().includes(search.toLowerCase()) ||
        f.numero_fattura?.toLowerCase().includes(search.toLowerCase())
      )
    ).sort((a, b) => {
      if (sortBy === "data") {
        return sortDir === "asc"
          ? a.data_fattura.localeCompare(b.data_fattura)
          : b.data_fattura.localeCompare(a.data_fattura);
      } else {
        return sortDir === "asc"
          ? (a.imponibile || 0) - (b.imponibile || 0)
          : (b.imponibile || 0) - (a.imponibile || 0);
      }
    });
  }

  // Solo le ultime 5 fatture generate
  const ultime5Fatture = useMemo(() => {
    return fattureEsistenti
      .sort((a, b) => b.data_fattura.localeCompare(a.data_fattura))
      .slice(0, 5);
  }, [fattureEsistenti]);

  // --- GESTIONE FILTRI ---
  function handleVisualizzaFiltri() {
    setShowDaFatturare(false); // Chiudi daFatturare se aperto
    setFiltriAttivi(true);
  }
  function handleResetFiltri() {
  setFilterCenter("");
  setFilterYear("");
  setFilterMonth("");
  setFilterDay("");
  setSearch("");
  setFiltriAttivi(false);
  setShowDaFatturare(false);
  localStorage.removeItem("fatture-filtri");
}

  // Se selezioni direttamente una data precisa, applica i filtri subito
  function onChangeDayAutoApply(e: React.ChangeEvent<HTMLSelectElement>) {
    setFilterDay(e.target.value);
    setFiltriAttivi(!!e.target.value);
    setShowDaFatturare(false);
  }

  // --- GENERA FATTURA E POLLING JOB ---
const generaFattura = async (item: RiepilogoFattura) => {
  try {
    setJobPolling(getJobIdForItem(item));
    const toastId = toast.loading("Generazione in corso...");
    const res = await axios.post(`${API_BASE_URL}/api/fatture_amazon_vendor/genera`, {
      centro: item.fulfillment_center,
      start_delivery: item.start_delivery,
      po_list: item.po_list
    });

    const jobId = res.data?.job_id;
    if (!jobId) throw new Error("Job ID non restituito!");

    toast.dismiss(toastId);
    toast.success("Job avviato! In attesa completamento...");
    setJobPolling(jobId);

    const status = await pollJobStatus(jobId);
    if (status === "done") {
      toast.success("✅ Fattura generata con successo");
      await refetchFatture();
      await refetchFatturePronte();
    } else if (status === "failed") {
      toast.error("❌ Errore durante la generazione della fattura");
    } else {
      toast.error("⏱ Timeout: stato job non aggiornato");
    }
  } catch (e) {
    toast.error("Errore nella generazione");
    console.error(e);
  } finally {
    setJobPolling(null); // solo questa riga qui!
  }
};

  const pollJobStatus = async (jobId: string): Promise<"done" | "failed" | "timeout"> => {
    const timeout = 20000;
    const interval = 1500;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const res = await axios.get(`${API_BASE_URL}/api/jobs/${jobId}/status`);
      const status = res.data?.status as "done" | "failed" | undefined;
      if (status === "done" || status === "failed") return status;
      await new Promise((r) => setTimeout(r, interval));
    }
    return "timeout";
  };

  // --- MOBILE RESPONSIVE CHECK ---
    // --- const isMobile = typeof window !== "undefined" && window.innerWidth < 750; ---

  // --- UI ---
  return (
    <div className="w-full max-w-4xl mx-auto px-2 pb-24 font-sans">
      <Toaster />

      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Package className="text-blue-600" size={28} />
        <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight">
          Fatture Amazon Vendor
        </h2>
      </div>

      {/* Banner ordini da fatturare */}
      {fatturePronte.length > 0 && !showDaFatturare && !filtriAttivi && (
        <div
          className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 mb-5 cursor-pointer shadow transition hover:bg-yellow-100"
          onClick={() => {
            setShowDaFatturare(true);
            setFiltriAttivi(false);
          }}
          tabIndex={0}
        >
          <AlertCircle className="text-yellow-600" size={28} />
          <div className="flex-1">
            <div className="font-bold text-yellow-800">
              Ci sono {fatturePronte.length} {fatturePronte.length === 1 ? "fattura" : "fatture"} da generare!
            </div>
            <div className="text-sm text-yellow-800">
              Clicca qui per visualizzare e generare le nuove fatture.
            </div>
          </div>
        </div>
      )}

      {/* --- FILTRI --- */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        {/* Centro */}
        <select
          className="border rounded-lg p-2 text-sm"
          value={filterCenter}
          onChange={e => setFilterCenter(e.target.value)}
        >
          <option value="">Tutti i Centri</option>
          {centriDisponibili.map(center => {
        const hasOrders = fatturePronte.some(f => f.fulfillment_center === center);
        return (
            <option key={center} value={center} className={hasOrders ? "font-bold text-blue-800" : ""}>
            {hasOrders ? "● " : ""}
            {center}
            </option>
        );
        })}
        </select>
        {/* Anno */}
        <select
          className="border rounded-lg p-2 text-sm"
          value={filterYear}
          onChange={e => {
            setFilterYear(e.target.value);
            setFilterMonth("");
            setFilterDay("");
          }}
        >
          <option value="">Tutti gli anni</option>
          {anniDisponibili.map(y => {
            const hasOrders = fatturePronte.some(f => f.start_delivery.startsWith(y));
            return (
                <option key={y} value={y} className={hasOrders ? "font-bold text-blue-800" : ""}>
                {hasOrders ? "● " : ""}
                {y}
                </option>
            );
            })}
        </select>
        {/* Mese */}
        {filterYear && (
          <select
            className="border rounded-lg p-2 text-sm"
            value={filterMonth}
            onChange={e => {
              setFilterMonth(e.target.value);
              setFilterDay("");
            }}
          >
            <option value="">Tutti i mesi</option>
            {(mesiDisponibili[filterYear] || []).map(m => {
                const key = `${filterYear}-${m}`;
                const hasOrders = fatturePronte.some(f => f.start_delivery.startsWith(key));
                return (
                    <option key={m} value={m} className={hasOrders ? "font-bold text-blue-800" : ""}>
                    {hasOrders ? "● " : ""}
                    {capitalize(new Date(`2020-${m}-01`).toLocaleString("it-IT", { month: "long" }))}
                    </option>
                );
                })}
          </select>
        )}
        {/* Giorno */}
        {filterYear && filterMonth && (
          <select
            className="border rounded-lg p-2 text-sm"
            value={filterDay}
            onChange={onChangeDayAutoApply}
          >
            <option value="">Tutti i giorni</option>
            {(giorniDisponibili[`${filterYear}-${filterMonth}`] || []).map(d => {
            const hasOrders = fatturePronte.some(f => f.start_delivery === d);
            return (
                <option key={d} value={d} className={hasOrders ? "font-bold text-blue-800" : ""}>
                {hasOrders ? "● " : ""}
                {d}
                </option>
            );
            })}
          </select>
        )}
        {/* Ricerca */}
        <div className="relative w-full sm:w-auto">
          <input
            type="text"
            className="border rounded-lg p-2 text-sm w-full"
            placeholder="Cerca PO, centro, data, numero fattura…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Bottoni filtri */}
        <Button className="bg-blue-700 text-white hover:bg-blue-900 px-4" onClick={handleVisualizzaFiltri}>
          Visualizza
        </Button>
        <Button className="ml-1 border border-gray-400 bg-red-700 text-gray-700 hover:bg-gray-100" onClick={handleResetFiltri}>
          <X className="inline mr-1" size={16}/> Reset
        </Button>
        {/* Ordina */}
        <div className="flex items-center gap-1 text-xs ml-auto">
          <span className="font-semibold text-gray-700">Ordina per:</span>
          <button
            className={`px-2 py-1 rounded ${sortBy === "data" ? "bg-blue-200 font-bold" : ""}`}
            onClick={() => setSortBy("data")}
          >Data {sortBy === "data" && (sortDir === "asc" ? <ChevronUp size={15}/> : <ChevronDown size={15}/>)} </button>
          <button
            className={`px-2 py-1 rounded ${sortBy === "imponibile" ? "bg-blue-200 font-bold" : ""}`}
            onClick={() => setSortBy("imponibile")}
          >Totale {sortBy === "imponibile" && (sortDir === "asc" ? <ChevronUp size={15}/> : <ChevronDown size={15}/>)} </button>
          <button
            className="px-2 py-1 rounded bg-gray-200"
            onClick={() => setSortDir(dir => dir === "asc" ? "desc" : "asc")}
            title="Inverti ordinamento"
          >⇅</button>
        </div>
      </div>

      {/* --- TABELLE / CARDS --- */}
      {/* --- CASE 1: All'avvio: banner + ultime 5 --- */}
      {!showDaFatturare && !filtriAttivi && (
        <div className="bg-white rounded-2xl shadow border p-4">
          <h3 className="text-lg font-bold mb-3 text-blue-800">
            Ultime 5 Fatture Generate
          </h3>
          {loadingFatture ? (
            <div className="text-center text-blue-700 py-6 font-semibold">
              Caricamento fatture...
            </div>
          ) : ultime5Fatture.length === 0 ? (
            <div className="text-neutral-400 text-sm">Nessuna fattura generata.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-[16px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="py-3 px-3 text-center">Numero</th>
                    <th className="py-3 px-3 text-center">Data</th>
                    <th className="py-3 px-3 text-center">Centro</th>
                    <th className="py-3 px-3 text-center">PO</th>
                    <th className="py-3 px-3 text-center">Ordinati</th>
                    <th className="py-3 px-3 text-center">Accettati</th>
                    <th className="py-3 px-3 text-center">Imponibile</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Totale (IVA)</th>
                    <th className="py-3 px-3 text-center">Stato</th>
                    <th className="py-3 px-3 text-center">Errore</th>
                    <th className="py-3 px-3 text-center">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {ultime5Fatture.map((f, idx) => (
                    <tr key={f.id} className={`border-b ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                      <td className="px-3 py-3 font-bold">{f.numero_fattura}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{toITDate(f.data_fattura)}</td>
                      <td className="px-3 py-3">{f.centro}</td>
                      <td className="px-3 py-3 font-mono">{Array.from(new Set(f.po_list)).join(", ")}</td>
                      <td className="px-3 py-3 text-center">{f.articoli_ordinati ?? "-"}</td>
                      <td className="px-3 py-3 text-center">{f.articoli_confermati ?? "-"}</td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        € {(f.imponibile ?? f.totale_fattura / 1.22).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        € {f.totale_fattura.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-center">{f.stato}</td>
                      <td className="px-3 py-3 text-center text-red-500">{f.errore || "-"}</td>
                      <td className="px-3 py-3 text-center">
                        <a className="btn btn-sm btn-outline" href={`${API_BASE_URL}/api/fatture_amazon_vendor/download/${f.id}`} target="_blank" rel="noopener noreferrer">
                          <Download className="inline mr-1" size={16} /> Scarica
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- CASE 2: Banner cliccato -> mostra solo da fatturare --- */}
      {showDaFatturare && !filtriAttivi && (
        <div className="bg-white rounded-2xl shadow border p-4">
          <h3 className="text-lg font-bold mb-3 text-cyan-800">
            Ordini Completati (da fatturare)
          </h3>
          {loadingRiepilogo ? (
            <div className="text-center text-blue-700 py-6 font-semibold">
              Caricamento dati...
            </div>
          ) : filtraFattureDaFatturare().length === 0 ? (
            <div className="text-neutral-400 text-sm">Nessun ordine pronto da fatturare.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-[16px]">
                <thead>
                  <tr>
                    <th className="py-3 px-3 text-center">Centro</th>
                    <th className="py-3 px-3 text-center">Consegna</th>
                    <th className="py-3 px-3 text-center">PO</th>
                    <th className="py-3 px-3 text-center">Ordinati</th>
                    <th className="py-3 px-3 text-center">Accettati</th>
                    <th className="py-3 px-3 text-center">Imponibile</th>
                    <th className="py-3 px-3 text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtraFattureDaFatturare().map((item, i) => (
                    <tr key={i} className={`border-b ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                      <td className="px-3 py-3">{item.fulfillment_center}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{toITDate(item.start_delivery)}</td>
                      <td className="px-3 py-3 font-mono">{Array.from(new Set(item.po_list)).join(", ")}</td>
                      <td className="px-3 py-3 text-center">{getTotOrdinato(item)}</td>
                      <td className="px-3 py-3 text-center">{getTotConfermato(item)}</td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        € {item.valore_totale.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {jobPolling === getJobIdForItem(item) ? (
                            <span className="flex items-center gap-2 text-blue-700 font-bold">
                            <svg className="animate-spin h-5 w-5 text-blue-700" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Sto generando...
                            </span>
                        ) : (
                            <Button
                            className="btn-sm"
                            disabled={!!jobPolling}
                            onClick={() => setConferma(item)}
                            >
                            Genera Fattura
                            </Button>
                        )}
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- CASE 3: Filtri attivi -> mostra entrambe le tabelle --- */}
      {filtriAttivi && (
        <>
          <div className="bg-white rounded-2xl shadow border p-4 mb-8">
            <h3 className="text-lg font-bold mb-3 text-cyan-800">
              Ordini Completati (da fatturare)
            </h3>
            {loadingRiepilogo ? (
              <div className="text-center text-blue-700 py-6 font-semibold">
                Caricamento dati...
              </div>
            ) : filtraFattureDaFatturare().length === 0 ? (
              <div className="text-neutral-400 text-sm">Nessun ordine pronto da fatturare.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-[16px]">
                  <thead>
                    <tr>
                      <th className="py-3 px-3 text-center">Centro</th>
                      <th className="py-3 px-3 text-center">Consegna</th>
                      <th className="py-3 px-3 text-center">PO</th>
                      <th className="py-3 px-3 text-center">Ordinati</th>
                      <th className="py-3 px-3 text-center">Accettati</th>
                      <th className="py-3 px-3 text-center">Imponibile</th>
                      <th className="py-3 px-3 text-center">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtraFattureDaFatturare().map((item, i) => (
                      <tr key={i} className={`border-b ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                        <td className="px-3 py-3">{item.fulfillment_center}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{toITDate(item.start_delivery)}</td>
                        <td className="px-3 py-3 font-mono">{Array.from(new Set(item.po_list)).join(", ")}</td>
                        <td className="px-3 py-3 text-center">{getTotOrdinato(item)}</td>
                        <td className="px-3 py-3 text-center">{getTotConfermato(item)}</td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          € {item.valore_totale.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <Button className="btn-sm" disabled={jobPolling !== null} onClick={() => setConferma(item)}>
                            Genera Fattura
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow border p-4">
            <h3 className="text-lg font-bold mb-3 text-blue-800">
              Fatture Generate
            </h3>
            {loadingFatture ? (
              <div className="text-center text-blue-700 py-6 font-semibold">
                Caricamento fatture...
              </div>
            ) : filtraFattureGenerate().length === 0 ? (
              <div className="text-neutral-400 text-sm">Nessuna fattura generata.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-[16px]">
                  <thead>
                    <tr>
                      <th className="py-3 px-3 text-center">Numero</th>
                      <th className="py-3 px-3 text-center">Data</th>
                      <th className="py-3 px-3 text-center">Centro</th>
                      <th className="py-3 px-3 text-center">PO</th>
                      <th className="py-3 px-3 text-center">Ordinati</th>
                      <th className="py-3 px-3 text-center">Accettati</th>
                      <th className="py-3 px-3 text-center">Imponibile</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Totale (IVA)</th>
                      <th className="py-3 px-3 text-center">Stato</th>
                      <th className="py-3 px-3 text-center">Errore</th>
                      <th className="py-3 px-3 text-center">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtraFattureGenerate().map((f, idx) => (
                      <tr key={f.id} className={`border-b ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                        <td className="px-3 py-3 font-bold">{f.numero_fattura}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{toITDate(f.data_fattura)}</td>
                        <td className="px-3 py-3">{f.centro}</td>
                        <td className="px-3 py-3 font-mono">{Array.from(new Set(f.po_list)).join(", ")}</td>
                        <td className="px-3 py-3 text-center">{f.articoli_ordinati ?? "-"}</td>
                        <td className="px-3 py-3 text-center">{f.articoli_confermati ?? "-"}</td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          € {(f.imponibile ?? f.totale_fattura / 1.22).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          € {f.totale_fattura.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-center">{f.stato}</td>
                        <td className="px-3 py-3 text-center text-red-500">{f.errore || "-"}</td>
                        <td className="px-3 py-3 text-center">
                          <a className="btn btn-sm btn-outline" href={`${API_BASE_URL}/api/fatture_amazon_vendor/download/${f.id}`} target="_blank" rel="noopener noreferrer">
                            <Download className="inline mr-1" size={16} /> Scarica
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modale conferma */}
      {conferma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-lg w-full max-w-sm border flex flex-col relative">
            <button
              className="absolute top-3 center-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setConferma(null)}
            >×</button>
            <div className="mb-2 font-bold text-blue-700 text-lg">Conferma generazione fattura</div>
            <div className="mb-2">Centro: <strong>{conferma.fulfillment_center}</strong></div>
            <div className="mb-2">Data consegna: <strong>{conferma.start_delivery}</strong></div>
            <div className="mb-2">PO: <span className="font-mono">{Array.from(new Set(conferma.po_list)).join(", ")}</span></div>
            <div className="mb-2">Articoli ordinati: <strong>{getTotOrdinato(conferma)}</strong></div>
            <div className="mb-2">Articoli accettati: <strong>{getTotConfermato(conferma)}</strong></div>
            <div className="mb-4">Valore stimato: <strong>€ {conferma.valore_totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</strong></div>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => {
                setConferma(null);         // Chiude SUBITO il modale
                generaFattura(conferma);  // Avvia la generazione in background
                }} className="bg-blue-700 hover:bg-blue-900">
                Conferma
              </Button>
              <button className="btn" onClick={() => setConferma(null)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nessun ordine da fatturare */}
      {!loadingRiepilogo && fatturePronte.length === 0 && (
        <div className="bg-gray-100 border border-gray-300 rounded-xl p-5 mt-8 flex items-center justify-center">
          <span className="text-gray-700 text-lg font-semibold">
            Non ci sono ordini da fatturare.
          </span>
        </div>
      )}
    </div>
  );
}
