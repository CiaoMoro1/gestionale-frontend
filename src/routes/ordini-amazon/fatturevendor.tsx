import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Package, Download, Search, ChevronDown, ChevronUp } from "lucide-react";

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
  stato: string;
  errore?: string;
  xml_url: string;
};

export default function FattureVendorPage() {
  const [conferma, setConferma] = useState<null | RiepilogoFattura>(null);
  const [jobPolling, setJobPolling] = useState<string | null>(null);
  const [filterCenter, setFilterCenter] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"data" | "valore">("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: fatturePronte = [], isLoading: loadingRiepilogo } = useQuery({
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

  // Centri e date uniche per dropdown
  const centriUnici = Array.from(new Set(fatturePronte.map(f => f.fulfillment_center))).sort();
  const dateUniche = Array.from(new Set(fatturePronte.map(f => f.start_delivery))).sort().reverse();

  // Filtri + ricerca + ordinamento per tabella "completati"
  let fattureFiltrate = fatturePronte.filter(f =>
    (!filterCenter || f.fulfillment_center === filterCenter) &&
    (!filterDate || f.start_delivery === filterDate) &&
    (
      search === "" ||
      f.po_list.join(",").toLowerCase().includes(search.toLowerCase()) ||
      f.fulfillment_center.toLowerCase().includes(search.toLowerCase()) ||
      f.start_delivery.toLowerCase().includes(search.toLowerCase())
    )
  );
  fattureFiltrate = fattureFiltrate.sort((a, b) => {
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

  // Filtri, ricerca, ordinamento per tabella "fatture generate"
  let fattureGenFiltrate = fattureEsistenti.filter(f =>
    (!filterCenter || f.centro === filterCenter) &&
    (!filterDate || f.start_delivery === filterDate) &&
    (
      search === "" ||
      (f.po_list || []).join(",").toLowerCase().includes(search.toLowerCase()) ||
      f.centro?.toLowerCase().includes(search.toLowerCase()) ||
      f.data_fattura?.toLowerCase().includes(search.toLowerCase()) ||
      f.numero_fattura?.toLowerCase().includes(search.toLowerCase())
    )
  );
  fattureGenFiltrate = fattureGenFiltrate.sort((a, b) => {
    if (sortBy === "data") {
      return sortDir === "asc"
        ? a.data_fattura.localeCompare(b.data_fattura)
        : b.data_fattura.localeCompare(a.data_fattura);
    } else {
      return sortDir === "asc"
        ? a.totale_fattura - b.totale_fattura
        : b.totale_fattura - a.totale_fattura;
    }
  });

  const generaFattura = async (item: RiepilogoFattura) => {
    try {
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
      } else if (status === "failed") {
        toast.error("❌ Errore durante la generazione della fattura");
      } else {
        toast.error("⏱ Timeout: stato job non aggiornato");
      }
    } catch (e) {
      toast.error("Errore nella generazione");
      console.error(e);
    } finally {
      setConferma(null);
      setJobPolling(null);
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

  return (
    <div className="w-full max-w-3xl mx-auto px-2 pb-24 font-sans">
      <Toaster />

      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Package className="text-blue-600" size={28} />
        <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight">
          Fatture Amazon Vendor
        </h2>
      </div>

      {/* FILTRI */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select
          className="border rounded-lg p-2 text-sm"
          value={filterCenter}
          onChange={e => setFilterCenter(e.target.value)}
        >
          <option value="">Tutti i Centri</option>
          {centriUnici.map(center => (
            <option key={center} value={center}>{center}</option>
          ))}
        </select>
        <select
          className="border rounded-lg p-2 text-sm"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
        >
          <option value="">Tutte le Date</option>
          {dateUniche.map(date => (
            <option key={date} value={date}>{date}</option>
          ))}
        </select>
        <div className="relative w-full sm:w-auto">
          <input
            type="text"
            className="border rounded-lg p-2 text-sm w-full"
            placeholder="Cerca PO, centro, data, numero fattura…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search className="absolute right-3 top-3 text-gray-400" size={16} />
        </div>
        <div className="flex items-center gap-1 text-xs ml-auto">
          <span className="font-semibold text-gray-700">Ordina per:</span>
          <button
            className={`px-2 py-1 rounded ${sortBy === "data" ? "bg-blue-200 font-bold" : ""}`}
            onClick={() => setSortBy("data")}
          >Data {sortBy === "data" && (sortDir === "asc" ? <ChevronUp size={15}/> : <ChevronDown size={15}/>)} </button>
          <button
            className={`px-2 py-1 rounded ${sortBy === "valore" ? "bg-blue-200 font-bold" : ""}`}
            onClick={() => setSortBy("valore")}
          >Valore {sortBy === "valore" && (sortDir === "asc" ? <ChevronUp size={15}/> : <ChevronDown size={15}/>)} </button>
          <button
            className="px-2 py-1 rounded bg-gray-200"
            onClick={() => setSortDir(dir => dir === "asc" ? "desc" : "asc")}
            title="Inverti ordinamento"
          >⇅</button>
        </div>
      </div>

      {/* Riepilogo Ordini Completati */}
      <div className="bg-white rounded-2xl shadow border p-4 mb-10">
        <h3 className="text-lg font-bold mb-3 text-cyan-800">
          Ordini Completati (da fatturare)
        </h3>
        {loadingRiepilogo ? (
          <div className="text-center text-blue-700 py-6 font-semibold">
            Caricamento dati...
          </div>
        ) : fattureFiltrate.length === 0 ? (
          <div className="text-neutral-400 text-sm">Nessun ordine pronto da fatturare.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-[16px]">
              <thead>
                <tr>
                  <th className="py-2 px-2 text-left text-neutral-700 font-semibold text-sm">Centro</th>
                  <th className="py-2 text-left text-neutral-700 font-semibold text-sm">Consegna</th>
                  <th className="py-2 text-left text-neutral-700 font-semibold text-sm">PO</th>
                  <th className="py-2 text-center text-neutral-700 font-semibold text-sm">Articoli</th>
                  <th className="py-2 text-center text-neutral-700 font-semibold text-sm">Valore Totale</th>
                  <th className="py-2 text-center text-neutral-700 font-semibold text-sm">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {fattureFiltrate.map((item, i) => {
                  const giàGenerata = fattureEsistenti.some(
                    (f) =>
                      f.centro === item.fulfillment_center &&
                      f.start_delivery === item.start_delivery
                  );
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-2">{item.fulfillment_center}</td>
                      <td className="px-2 py-2">{item.start_delivery}</td>
                      <td className="px-2 py-2 font-mono">{item.po_list.join(", ")}</td>
                      <td className="px-2 py-2 text-center">{item.totale_articoli}</td>
                      <td className="px-2 py-2 text-center">
                        € {item.valore_totale.toLocaleString("it-IT", {
                          minimumFractionDigits: 2
                        })}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {giàGenerata ? (
                          <span className="text-sm text-green-600 font-semibold">✅ Già emessa</span>
                        ) : (
                          <Button
                            className="btn-sm"
                            disabled={jobPolling !== null}
                            onClick={() => setConferma(item)}
                          >
                            Genera Fattura
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fatture generate */}
      <div className="bg-white rounded-2xl shadow border p-4">
        <h3 className="text-lg font-bold mb-3 text-blue-800">
          Fatture Generate
        </h3>
        {loadingFatture ? (
          <div className="text-center text-blue-700 py-6 font-semibold">
            Caricamento fatture...
          </div>
        ) : fattureGenFiltrate.length === 0 ? (
          <div className="text-neutral-400 text-sm">Nessuna fattura generata.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-[16px]">
              <thead>
                <tr>
                  <th className="py-2 text-left">Numero</th>
                  <th className="py-2 text-left">Data</th>
                  <th className="py-2 text-left">Centro</th>
                  <th className="py-2 text-right">Totale</th>
                  <th className="py-2 text-center">Stato</th>
                  <th className="py-2 text-center">Errore</th>
                  <th className="py-2 text-center">Download</th>
                </tr>
              </thead>
              <tbody>
                {fattureGenFiltrate.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="py-2">{f.numero_fattura}</td>
                    <td className="py-2">{f.data_fattura}</td>
                    <td className="py-2">{f.centro}</td>
                    <td className="py-2 text-right">
                      € {f.totale_fattura.toLocaleString("it-IT", {
                        minimumFractionDigits: 2
                      })}
                    </td>
                    <td className="py-2 text-center">{f.stato}</td>
                    <td className="py-2 text-center text-sm text-red-500">
                      {f.errore || "-"}
                    </td>
                    <td className="py-2 text-center">
                      <a
                        className="btn btn-sm btn-outline"
                        href={`${API_BASE_URL}/api/fatture_amazon_vendor/download/${f.id}`}
                        target="_blank"
                      >
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

      {/* Modale conferma */}
      {conferma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-lg w-full max-w-sm border flex flex-col relative">
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setConferma(null)}
            >×</button>
            <div className="mb-2 font-bold text-blue-700 text-lg">Conferma generazione fattura</div>
            <div className="mb-2">Centro: <strong>{conferma.fulfillment_center}</strong></div>
            <div className="mb-2">Data consegna: <strong>{conferma.start_delivery}</strong></div>
            <div className="mb-2">Totale articoli: <strong>{conferma.totale_articoli}</strong></div>
            <div className="mb-4">Valore stimato: <strong>€ {conferma.valore_totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</strong></div>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => generaFattura(conferma)} className="bg-blue-700 hover:bg-blue-900">
                Conferma
              </Button>
              <button className="btn" onClick={() => setConferma(null)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
