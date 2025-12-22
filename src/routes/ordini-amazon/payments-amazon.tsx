import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL as string;

type TabKey = "VENDOR" | "RESI" | "COOP" | "RAW";

type JobStatus = {
  status: "pending" | "in_progress" | "done" | "failed" | string;
  result?: { importati?: number; errors?: string[] };
  error?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
};

// ---------- RAW ----------
type PaymentRow = {
  id: number;
  job_id: string | null;
  file_origine: string;
  numero_pagamento: string;
  numero_documento: string;
  data_documento: string; // YYYY-MM-DD
  descrizione: string | null;
  codice_fornitore: string | null;
  tipo_transazione: string | null;
  importo_fattura: number;
  importo_trattenuto?: number | null;
  sconto_effettuato?: number | null;
  importo_pagato?: number | null;
  importo_residuo?: number | null;
  valuta?: string | null;
  created_at: string;
};

type DocType = "RA" | "R" | "NC_RESO_20255" | "NC_COOP_20259" | "DOC_2025" | "ALTRO";
function classifyDoc(row: PaymentRow): DocType {
  const num = (row.numero_documento || "").trim();
  const desc = (row.descrizione || "").toUpperCase();

  if (/^\d{10}R\d*$/.test(num)) return "R";
  if (/^\d{10}$/.test(num) && desc.includes("RA NUMBER")) return "RA";
  if (/^20255/.test(num)) return "NC_RESO_20255";
  if (/^20259/.test(num)) return "NC_COOP_20259";
  if (/^2025/.test(num)) return "DOC_2025";
  return "ALTRO";
}

// ---------- VENDOR ----------
type VendorInvoiceRow = {
  numero_fattura: string;
  data_fattura: string; // YYYY-MM-DD
  centro: string;
  totale_fattura: number | string;
  imponibile?: number | string | null;
  pagato_cash: number | string;
  sconti_totali: number | string;
  trattenute_totali: number | string;
  pagato: number | string; // settled
  saldo: number | string;
  stato_pagamento: "NON_TROVATA" | "APERTO" | "PARZIALE" | "CHIUSO" | string;
  chiusa_con_sconto?: boolean | null;
};

// ---------- RESI ----------
type ResoRow = {
  numero_nota: string;
  data_nota: string; // YYYY-MM-DD
  vret: string;
  fattura_collegata: string | null;
  imponibile: number | string | null;
  iva: number | string | null;
  totale: number | string;

  stato_nota: string;
  stato_cerchio: string;
  reso_completo: boolean;

  missing_r_docs?: string[] | null;
  missing_ra_docs?: string[] | null;
  unclosed_docs?: string[] | null;
};

// ---------- COOP ----------
type CoopRow = {
  id: number;
  data_nota: string; // YYYY-MM-DD
  numero_nota: string;
  invoice_number: string;
  invoice_date?: string | null;
  agreement_number?: string | null;
  funding_type?: string | null;

  imponibile: number | string;
  iva: number | string;
  totale: number | string;

  stato: string;

  applicato_nota: number | string;
  diff_nota: number | string;
  stato_nota: string;

  invoice_netto: number | string;
  stato_invoice: string;

  missing_invoice_reversal_docs?: string[] | null;
  coop_completo: boolean;
};

// ---------- helpers ----------
type ApiError = { error: string; details?: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    let parsed: ApiError | null = null;
    try { parsed = JSON.parse(text) as ApiError; } catch { parsed = null; }
    const msg = parsed?.error || `HTTP ${resp.status}`;
    const det = parsed?.details ? `: ${parsed.details}` : "";
    throw new Error(`${msg}${det}`);
  }
  try { return JSON.parse(text) as T; }
  catch { throw new Error("Risposta non valida dal server (non JSON)."); }
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function Money({ value }: { value: number | string | null | undefined }) {
  const n = toNumber(value);
  const s = n.toFixed(2);
  return n < 0 ? <span className="text-red-700">{s}</span> : <span>{s}</span>;
}

function Badge({
  label, tone,
}: { label: string; tone: "green" | "yellow" | "red" | "gray" | "blue"; }) {
  const cls =
    tone === "green" ? "bg-green-100 text-green-800 border-green-200"
    : tone === "yellow" ? "bg-yellow-100 text-yellow-800 border-yellow-200"
    : tone === "red" ? "bg-red-100 text-red-800 border-red-200"
    : tone === "blue" ? "bg-blue-100 text-blue-800 border-blue-200"
    : "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${cls}`}>
      {label}
    </span>
  );
}

function inDateRange(dateISO: string, from?: string, to?: string): boolean {
  if (from && dateISO < from) return false;
  if (to && dateISO > to) return false;
  return true;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = clamp(page, 1, totalPages);
  const start = (safePage - 1) * pageSize;
  return { totalPages, safePage, slice: items.slice(start, start + pageSize) };
}

function Pagination({
  page, totalPages, onPrev, onNext,
}: { page: number; totalPages: number; onPrev: () => void; onNext: () => void; }) {
  return (
    <div className="flex justify-between items-center mt-3 text-sm">
      <span>Pagina {page} di {totalPages}</span>
      <div className="flex gap-2">
        <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={page === 1} onClick={onPrev}>
          ‹ Prec
        </button>
        <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={page === totalPages} onClick={onNext}>
          Succ ›
        </button>
      </div>
    </div>
  );
}

// ---------- Legends ----------
function LegendVendor() {
  return (
    <details className="border rounded p-3 bg-gray-50">
      <summary className="cursor-pointer font-medium">Legenda stati (Fatture Vendor)</summary>
      <div className="mt-2 text-sm space-y-1">
        <div><b>NON_TROVATA</b>: nel ledger pagamenti non c’è ancora alcuna riga per quella fattura.</div>
        <div><b>APERTO</b>: trovata, ma pagato (settled) = 0.</div>
        <div><b>PARZIALE</b>: pagato (settled) &gt; 0 ma saldo &gt; 0.</div>
        <div><b>CHIUSO</b>: saldo ≈ 0.</div>
        <div><b>Cash vs Settled</b>: Cash = importo_pagato; Settled = cash + sconti + trattenute.</div>
      </div>
    </details>
  );
}

function LegendResi() {
  return (
    <details className="border rounded p-3 bg-gray-50">
      <summary className="cursor-pointer font-medium">Legenda stati (NC Reso 20255)</summary>
      <div className="mt-2 text-sm space-y-1">
        <div><b>stato_nota</b>: riguarda solo la tua nota 20255 nel ledger (applicata/parziale/non presente).</div>
        <div><b>stato_cerchio</b> riguarda i doc “loro” 7401 collegati:</div>
        <div>• <b>COMPLETO</b>: per tutti i doc collegati esiste RA base + reversal R* e il netto torna a 0.</div>
        <div>• <b>MANCANO_REVERSAL</b>: manca almeno un R* per qualche doc collegato.</div>
        <div>• <b>DATI_INCOMPLETI</b>: hai R* ma non trovi la RA base (o viceversa) → mancano pagamenti storici.</div>
        <div>• <b>PARZIALE</b>: RA e R* esistono ma non chiudono a 0 per uno o più doc (unclosed).</div>
      </div>
    </details>
  );
}

function LegendCoop() {
  return (
    <details className="border rounded p-3 bg-gray-50">
      <summary className="cursor-pointer font-medium">Legenda stati (NC Coop/CCOGS 20259)</summary>
      <div className="mt-2 text-sm space-y-1">
        <div><b>stato_nota</b>: riguarda solo la tua nota 20259 nel ledger.</div>
        <div><b>stato_invoice</b>: riguarda il documento “loro” 580… e i reversal 580…R*.</div>
        <div>• <b>NON_TROVATO</b>: non trovi né base invoice né reversal → non ci sono righe nel ledger per quella invoice.</div>
        <div>• <b>DATI_INCOMPLETI</b>: trovi reversal (R*) ma non trovi la base invoice (o viceversa) → mancano pagamenti storici.</div>
        <div>• <b>MANCANO_REVERSAL</b>: base invoice c’è, ma non c’è alcun R*.</div>
        <div>• <b>PARZIALE</b>: invoice e R* esistono ma non chiudono a 0.</div>
        <div>• <b>COMPLETO</b>: invoice_netto ≈ 0.</div>
      </div>
    </details>
  );
}

// ---------- Page ----------
export default function PagamentiAmazonPage() {
  // upload
  const [file, setFile] = useState<File | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  // tabs
  const [tab, setTab] = useState<TabKey>("VENDOR");

  // data
  const [vendorRows, setVendorRows] = useState<VendorInvoiceRow[]>([]);
  const [resiRows, setResiRows] = useState<ResoRow[]>([]);
  const [coopRows, setCoopRows] = useState<CoopRow[]>([]);
  const [rawRows, setRawRows] = useState<PaymentRow[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Vendor filters ---
  const [vNumero, setVNumero] = useState("");
  const [vCentro, setVCentro] = useState("");
  const [vStato, setVStato] = useState("");
  const [vFrom, setVFrom] = useState("");
  const [vTo, setVTo] = useState("");

  // --- Resi filters ---
  const [rNota, setRNota] = useState("");
  const [rVret, setRVret] = useState("");
  const [rLinked, setRLinked] = useState("");
  const [rStatoNota, setRStatoNota] = useState("");
  const [rStatoCerchio, setRStatoCerchio] = useState("");
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");

  // --- Coop filters ---
  const [cNota, setCNota] = useState("");
  const [cInvoice, setCInvoice] = useState("");
  const [cAgreement, setCAgreement] = useState("");
  const [cStatoNota, setCStatoNota] = useState("");
  const [cStatoInvoice, setCStatoInvoice] = useState("");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");

  // --- RAW filters ---
  const [filterNumeroPagamento, setFilterNumeroPagamento] = useState("");
  const [filterNumeroDocumento, setFilterNumeroDocumento] = useState("");
  const [filterTipoTransazione, setFilterTipoTransazione] = useState("");
  const [filterTipoDoc, setFilterTipoDoc] = useState<DocType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // pagination
  const PAGE_SIZE = 50;
  const [pageVendor, setPageVendor] = useState(1);
  const [pageResi, setPageResi] = useState(1);
  const [pageCoop, setPageCoop] = useState(1);
  const [pageRaw, setPageRaw] = useState(1);

  const stopPolling = () => {
    if (pollingRef.current != null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const pollJob = (jobId: string) => {
    stopPolling();
    pollingRef.current = window.setInterval(async () => {
      try {
        const data = await fetchJson<JobStatus>(`${API_BASE_URL}/api/jobs/${jobId}/status`);
        setJobStatus(data);
        if (data.status === "done" || data.status === "failed") {
          stopPolling();
          // refresh tab corrente
          await fetchTabData(tab);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Errore polling job";
        setJobStatus({ status: "failed", error: msg });
        stopPolling();
      }
    }, 1200);
  };

  const uploadFile = async () => {
    if (!file) return;

    setJobStatus(null);
    setLastJobId(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await fetchJson<{ job_id: string; status: string }>(
        `${API_BASE_URL}/api/payments_amazon/upload`,
        { method: "POST", body: formData }
      );
      setLastJobId(data.job_id);
      setJobStatus({ status: "pending" });
      pollJob(data.job_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload fallito";
      setJobStatus({ status: "failed", error: msg });
    }
  };

  // fetchers (prendiamo 1000 e filtriamo localmente per UI migliore)
  const fetchVendor = async () => {
    const url = `${API_BASE_URL}/api/recon/vendor_invoices?limit=2000`;
    const data = await fetchJson<VendorInvoiceRow[]>(url);
    setVendorRows(data || []);
    setPageVendor(1);
  };

  const fetchResi = async () => {
    const url = `${API_BASE_URL}/api/recon/resi?limit=2000`;
    const data = await fetchJson<ResoRow[]>(url);
    setResiRows(data || []);
    setPageResi(1);
  };

  const fetchCoop = async () => {
    const url = `${API_BASE_URL}/api/recon/coop?limit=2000`;
    const data = await fetchJson<CoopRow[]>(url);
    setCoopRows(data || []);
    setPageCoop(1);
  };

  const fetchRaw = async (opts?: {
    job_id?: string;
    numero_pagamento?: string;
    numero_documento?: string;
    tipo_transazione?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const p = new URLSearchParams();
    if (opts?.job_id) p.set("job_id", opts.job_id);
    if (opts?.numero_pagamento) p.set("numero_pagamento", opts.numero_pagamento);
    if (opts?.numero_documento) p.set("numero_documento", opts.numero_documento);
    if (opts?.tipo_transazione) p.set("tipo_transazione", opts.tipo_transazione);
    if (opts?.date_from) p.set("date_from", opts.date_from);
    if (opts?.date_to) p.set("date_to", opts.date_to);
    p.set("limit", "5000");

    const url = `${API_BASE_URL}/api/payments_amazon/list${p.toString() ? `?${p.toString()}` : ""}`;
    const data = await fetchJson<PaymentRow[]>(url);
    setRawRows(data || []);
    setPageRaw(1);
  };

  const fetchTabData = async (t: TabKey) => {
    setLoading(true);
    setLoadError(null);
    try {
      if (t === "VENDOR") await fetchVendor();
      if (t === "RESI") await fetchResi();
      if (t === "COOP") await fetchCoop();
      if (t === "RAW") await fetchRaw();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore caricamento";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabData(tab);
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // -------- FILTERED DATA --------
  const vendorFiltered = useMemo(() => {
    return vendorRows.filter((r) => {
      if (vNumero && !r.numero_fattura.includes(vNumero)) return false;
      if (vCentro && !(r.centro || "").toLowerCase().includes(vCentro.toLowerCase())) return false;
      if (vStato && String(r.stato_pagamento) !== vStato) return false;
      if (!inDateRange(r.data_fattura, vFrom || undefined, vTo || undefined)) return false;
      return true;
    });
  }, [vendorRows, vNumero, vCentro, vStato, vFrom, vTo]);

  const resiFiltered = useMemo(() => {
    return resiRows.filter((r) => {
      if (rNota && !String(r.numero_nota).includes(rNota)) return false;
      if (rVret && !String(r.vret || "").includes(rVret)) return false;
      if (rLinked) {
        const fc = (r.fattura_collegata || "").replace(/\s+/g, "");
        if (!fc.includes(rLinked.replace(/\s+/g, ""))) return false;
      }
      if (rStatoNota && String(r.stato_nota) !== rStatoNota) return false;
      if (rStatoCerchio && String(r.stato_cerchio) !== rStatoCerchio) return false;
      if (!inDateRange(r.data_nota, rFrom || undefined, rTo || undefined)) return false;
      return true;
    });
  }, [resiRows, rNota, rVret, rLinked, rStatoNota, rStatoCerchio, rFrom, rTo]);

  const coopFiltered = useMemo(() => {
    return coopRows.filter((r) => {
      if (cNota && !String(r.numero_nota).includes(cNota)) return false;
      if (cInvoice && !String(r.invoice_number).includes(cInvoice)) return false;
      if (cAgreement && !String(r.agreement_number || "").includes(cAgreement)) return false;
      if (cStatoNota && String(r.stato_nota) !== cStatoNota) return false;
      if (cStatoInvoice && String(r.stato_invoice) !== cStatoInvoice) return false;
      if (!inDateRange(r.data_nota, cFrom || undefined, cTo || undefined)) return false;
      return true;
    });
  }, [coopRows, cNota, cInvoice, cAgreement, cStatoNota, cStatoInvoice, cFrom, cTo]);

  const rawFiltered = useMemo(() => {
    return rawRows.filter((r) => {
      if (filterNumeroPagamento && !r.numero_pagamento.includes(filterNumeroPagamento)) return false;
      if (filterNumeroDocumento && !r.numero_documento.includes(filterNumeroDocumento)) return false;
      if (
        filterTipoTransazione &&
        !(r.tipo_transazione || "").toLowerCase().includes(filterTipoTransazione.toLowerCase())
      ) return false;
      if (dateFrom && r.data_documento < dateFrom) return false;
      if (dateTo && r.data_documento > dateTo) return false;
      if (filterTipoDoc && classifyDoc(r) !== filterTipoDoc) return false;
      return true;
    });
  }, [rawRows, filterNumeroPagamento, filterNumeroDocumento, filterTipoTransazione, dateFrom, dateTo, filterTipoDoc]);

  const vendorPage = useMemo(() => paginate(vendorFiltered, pageVendor, PAGE_SIZE), [vendorFiltered, pageVendor]);
  const resiPage = useMemo(() => paginate(resiFiltered, pageResi, PAGE_SIZE), [resiFiltered, pageResi]);
  const coopPage = useMemo(() => paginate(coopFiltered, pageCoop, PAGE_SIZE), [coopFiltered, pageCoop]);
  const rawPage = useMemo(() => paginate(rawFiltered, pageRaw, PAGE_SIZE), [rawFiltered, pageRaw]);

  // -------- UI --------
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Riconciliazione Amazon</h1>

      {/* Upload */}
      <div className="p-4 border rounded bg-white space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <label className="block text-sm font-medium mb-1">
              File Payments (.xls/.xlsx) <span className="text-red-600">*</span>
            </label>
            <input type="file" accept=".xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50" disabled={!file} onClick={uploadFile}>
            Carica e importa
          </button>
          {lastJobId && (
            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded"
              onClick={() => {
                setTab("RAW");
                fetchRaw({ job_id: lastJobId }).catch(() => {});
              }}
            >
              Vedi ultimo job (RAW)
            </button>
          )}
        </div>

        {jobStatus && (
          <div className="text-sm">
            <b>Status job:</b> {jobStatus.status}{" "}
            {jobStatus.status === "done" && <Badge label="Import OK" tone="green" />}
            {jobStatus.status === "failed" && <Badge label="Errore" tone="red" />}
            {jobStatus.result?.importati != null && <div>Righe importate: {jobStatus.result.importati}</div>}
            {jobStatus.error && <div className="text-red-700">Errore: {jobStatus.error}</div>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border rounded">
        <div className="flex gap-2 p-2 border-b flex-wrap">
          {([
            ["VENDOR", "Fatture Vendor"],
            ["RESI", "NC Reso (20255…)"],
            ["COOP", "NC Coop/CCOGS (20259…)"],
            ["RAW", "Movimenti (RAW)"],
          ] as Array<[TabKey, string]>).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-2 rounded text-sm ${tab === k ? "bg-gray-900 text-white" : "bg-gray-100"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 border-b space-y-3">
          {tab === "VENDOR" && (
            <>
              <LegendVendor />
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Numero fattura</label>
                  <input className="border rounded px-2 py-1 w-full" value={vNumero} onChange={(e) => setVNumero(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Centro</label>
                  <input className="border rounded px-2 py-1 w-full" value={vCentro} onChange={(e) => setVCentro(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stato</label>
                  <select className="border rounded px-2 py-1 w-full" value={vStato} onChange={(e) => setVStato(e.target.value)}>
                    <option value="">Tutti</option>
                    <option value="CHIUSO">CHIUSO</option>
                    <option value="PARZIALE">PARZIALE</option>
                    <option value="APERTO">APERTO</option>
                    <option value="NON_TROVATA">NON_TROVATA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dal</label>
                  <input type="date" className="border rounded px-2 py-1 w-full" value={vFrom} onChange={(e) => setVFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Al</label>
                  <input type="date" className="border rounded px-2 py-1 w-full" value={vTo} onChange={(e) => setVTo(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {tab === "RESI" && (
            <>
              <LegendResi />
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Numero nota</label>
                  <input className="border rounded px-2 py-1 w-full" value={rNota} onChange={(e) => setRNota(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">VRET/Return-ID</label>
                  <input className="border rounded px-2 py-1 w-full" value={rVret} onChange={(e) => setRVret(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fattura collegata contiene</label>
                  <input className="border rounded px-2 py-1 w-full" value={rLinked} onChange={(e) => setRLinked(e.target.value)} placeholder="es. 7401887283" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stato nota</label>
                  <input className="border rounded px-2 py-1 w-full" value={rStatoNota} onChange={(e) => setRStatoNota(e.target.value)} placeholder="APPLICATA..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stato cerchio</label>
                  <input className="border rounded px-2 py-1 w-full" value={rStatoCerchio} onChange={(e) => setRStatoCerchio(e.target.value)} placeholder="COMPLETO..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Dal</label>
                    <input type="date" className="border rounded px-2 py-1 w-full" value={rFrom} onChange={(e) => setRFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Al</label>
                    <input type="date" className="border rounded px-2 py-1 w-full" value={rTo} onChange={(e) => setRTo(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "COOP" && (
            <>
              <LegendCoop />
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Numero nota</label>
                  <input className="border rounded px-2 py-1 w-full" value={cNota} onChange={(e) => setCNota(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Invoice</label>
                  <input className="border rounded px-2 py-1 w-full" value={cInvoice} onChange={(e) => setCInvoice(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Agreement</label>
                  <input className="border rounded px-2 py-1 w-full" value={cAgreement} onChange={(e) => setCAgreement(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stato nota</label>
                  <input className="border rounded px-2 py-1 w-full" value={cStatoNota} onChange={(e) => setCStatoNota(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stato invoice</label>
                  <input className="border rounded px-2 py-1 w-full" value={cStatoInvoice} onChange={(e) => setCStatoInvoice(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Dal</label>
                    <input type="date" className="border rounded px-2 py-1 w-full" value={cFrom} onChange={(e) => setCFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Al</label>
                    <input type="date" className="border rounded px-2 py-1 w-full" value={cTo} onChange={(e) => setCTo(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "RAW" && (
            <>
              <details className="border rounded p-3 bg-gray-50">
                <summary className="cursor-pointer font-medium">Legenda (RAW)</summary>
                <div className="mt-2 text-sm space-y-1">
                  <div>Qui vedi i movimenti grezzi del file Payments. I TAB sopra sono la vista “interpretata”.</div>
                </div>
              </details>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Numero pagamento</label>
                  <input className="border rounded px-2 py-1 w-full" value={filterNumeroPagamento} onChange={(e) => setFilterNumeroPagamento(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Numero documento</label>
                  <input className="border rounded px-2 py-1 w-full" value={filterNumeroDocumento} onChange={(e) => setFilterNumeroDocumento(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo transazione</label>
                  <input className="border rounded px-2 py-1 w-full" value={filterTipoTransazione} onChange={(e) => setFilterTipoTransazione(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo doc</label>
                  <select className="border rounded px-2 py-1 w-full" value={filterTipoDoc} onChange={(e) => setFilterTipoDoc(e.target.value as DocType | "")}>
                    <option value="">Tutti</option>
                    <option value="RA">RA</option>
                    <option value="R">R (R1/R2/...)</option>
                    <option value="NC_RESO_20255">NC Reso (20255)</option>
                    <option value="NC_COOP_20259">NC Coop (20259)</option>
                    <option value="DOC_2025">Altri 2025…</option>
                    <option value="ALTRO">Altro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Dal</label>
                  <input type="date" className="border rounded px-2 py-1 w-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Al</label>
                  <input type="date" className="border rounded px-2 py-1 w-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button
                    className="bg-gray-900 text-white px-3 py-2 rounded w-full"
                    onClick={() =>
                      fetchRaw({
                        numero_pagamento: filterNumeroPagamento || undefined,
                        numero_documento: filterNumeroDocumento || undefined,
                        tipo_transazione: filterTipoTransazione || undefined,
                        date_from: dateFrom || undefined,
                        date_to: dateTo || undefined,
                      }).catch(() => {})
                    }
                  >
                    Applica (server)
                  </button>
                  <button
                    className="bg-gray-200 px-3 py-2 rounded w-full"
                    onClick={() => {
                      setFilterNumeroPagamento("");
                      setFilterNumeroDocumento("");
                      setFilterTipoTransazione("");
                      setFilterTipoDoc("");
                      setDateFrom("");
                      setDateTo("");
                      fetchRaw().catch(() => {});
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </>
          )}

          {loading && <div className="text-sm text-gray-600">Caricamento…</div>}
          {loadError && <div className="text-sm text-red-700">Errore: {loadError}</div>}
        </div>

        <div className="p-4 overflow-x-auto">
          {tab === "VENDOR" && (
            <>
              <div className="font-semibold mb-2">Righe: {vendorFiltered.length}</div>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Fattura</th>
                    <th className="p-2">Data</th>
                    <th className="p-2 text-right">Totale</th>
                    <th className="p-2 text-right">Imponibile</th>
                    <th className="p-2 text-right">Cash</th>
                    <th className="p-2 text-right">Sconto</th>
                    <th className="p-2 text-right">Settled</th>
                    <th className="p-2 text-right">Saldo</th>
                    <th className="p-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorPage.slice.map((r) => (
                    <tr key={r.numero_fattura} className="border-t">
                      <td className="p-2 font-mono">{r.numero_fattura}</td>
                      <td className="p-2">{r.data_fattura}</td>
                      <td className="p-2 text-right"><Money value={r.totale_fattura} /></td>
                      <td className="p-2 text-right"><Money value={r.imponibile ?? 0} /></td>
                      <td className="p-2 text-right"><Money value={r.pagato_cash} /></td>
                      <td className="p-2 text-right"><Money value={r.sconti_totali} /></td>
                      <td className="p-2 text-right"><Money value={r.pagato} /></td>
                      <td className="p-2 text-right"><Money value={r.saldo} /></td>
                      <td className="p-2">
                        {r.stato_pagamento === "CHIUSO" && <Badge label="CHIUSO" tone="green" />}
                        {r.stato_pagamento === "PARZIALE" && <Badge label="PARZIALE" tone="yellow" />}
                        {r.stato_pagamento === "APERTO" && <Badge label="APERTO" tone="red" />}
                        {r.stato_pagamento === "NON_TROVATA" && <Badge label="NON TROVATA" tone="gray" />}
                        {r.chiusa_con_sconto ? <span className="ml-2"><Badge label="con sconto" tone="blue" /></span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={vendorPage.safePage}
                totalPages={vendorPage.totalPages}
                onPrev={() => setPageVendor((p) => Math.max(1, p - 1))}
                onNext={() => setPageVendor((p) => Math.min(vendorPage.totalPages, p + 1))}
              />
            </>
          )}

          {tab === "RESI" && (
            <>
              <div className="font-semibold mb-2">Righe: {resiFiltered.length}</div>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Nota</th>
                    <th className="p-2">Data</th>
                    <th className="p-2 text-left">Fatture collegate</th>
                    <th className="p-2 text-right">Imponibile</th>
                    <th className="p-2 text-right">IVA</th>
                    <th className="p-2 text-right">Totale</th>
                    <th className="p-2">Stato nota</th>
                    <th className="p-2">Stato cerchio</th>
                    <th className="p-2 text-center">Manca R</th>
                    <th className="p-2 text-center">Manca RA</th>
                    <th className="p-2 text-center">Non chiusi</th>
                    <th className="p-2">Completo</th>
                  </tr>
                </thead>
                <tbody>
                  {resiPage.slice.map((r) => {
                    const missR = r.missing_r_docs?.length ?? 0;
                    const missRA = r.missing_ra_docs?.length ?? 0;
                    const unclosed = r.unclosed_docs?.length ?? 0;

                    const cerchioTone =
                      r.stato_cerchio === "COMPLETO" ? "green"
                      : r.stato_cerchio === "MANCANO_REVERSAL" ? "red"
                      : "yellow";

                    return (
                      <tr key={r.numero_nota} className="border-t">
                        <td className="p-2 font-mono">{r.numero_nota}</td>
                        <td className="p-2">{r.data_nota}</td>
                        <td className="p-2 font-mono">{r.fattura_collegata || "—"}</td>
                        <td className="p-2 text-right"><Money value={r.imponibile} /></td>
                        <td className="p-2 text-right"><Money value={r.iva} /></td>
                        <td className="p-2 text-right"><Money value={r.totale} /></td>
                        <td className="p-2">
                          <Badge label={r.stato_nota} tone={r.stato_nota === "APPLICATA" ? "green" : "yellow"} />
                        </td>
                        <td className="p-2">
                          <Badge label={r.stato_cerchio} tone={cerchioTone} />
                        </td>
                        <td className="p-2 text-center">{missR}</td>
                        <td className="p-2 text-center">{missRA}</td>
                        <td className="p-2 text-center">{unclosed}</td>
                        <td className="p-2">
                          {r.reso_completo ? <Badge label="SI" tone="green" /> : <Badge label="NO" tone="red" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={resiPage.safePage}
                totalPages={resiPage.totalPages}
                onPrev={() => setPageResi((p) => Math.max(1, p - 1))}
                onNext={() => setPageResi((p) => Math.min(resiPage.totalPages, p + 1))}
              />
            </>
          )}

          {tab === "COOP" && (
            <>
              <div className="font-semibold mb-2">Righe: {coopFiltered.length}</div>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Nota</th>
                    <th className="p-2">Data nota</th>
                    <th className="p-2">Invoice</th>
                    <th className="p-2">Invoice date</th>
                    <th className="p-2 text-right">Imponibile</th>
                    <th className="p-2 text-right">IVA</th>
                    <th className="p-2 text-right">Totale</th>
                    <th className="p-2 text-right">Manca nota</th>
                    <th className="p-2">Stato nota</th>
                    <th className="p-2">Stato invoice</th>
                    <th className="p-2 text-right">Invoice netto</th>
                    <th className="p-2">Completo</th>
                  </tr>
                </thead>
                <tbody>
                  {coopPage.slice.map((r) => {
                    const invTone =
                      r.stato_invoice === "COMPLETO" ? "green"
                      : r.stato_invoice === "MANCANO_REVERSAL" ? "red"
                      : "yellow";

                    return (
                      <tr key={r.numero_nota} className="border-t">
                        <td className="p-2 font-mono">{r.numero_nota}</td>
                        <td className="p-2">{r.data_nota}</td>
                        <td className="p-2 font-mono">{r.invoice_number}</td>
                        <td className="p-2">{r.invoice_date || "—"}</td>
                        <td className="p-2 text-right"><Money value={r.imponibile} /></td>
                        <td className="p-2 text-right"><Money value={r.iva} /></td>
                        <td className="p-2 text-right"><Money value={r.totale} /></td>
                        <td className="p-2 text-right"><Money value={r.diff_nota} /></td>
                        <td className="p-2">
                          <Badge label={r.stato_nota} tone={r.stato_nota === "APPLICATA" ? "green" : r.stato_nota === "PARZIALE" ? "yellow" : "gray"} />
                        </td>
                        <td className="p-2">
                          <Badge label={r.stato_invoice} tone={invTone} />
                        </td>
                        <td className="p-2 text-right"><Money value={r.invoice_netto} /></td>
                        <td className="p-2">
                          {r.coop_completo ? <Badge label="SI" tone="green" /> : <Badge label="NO" tone="red" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={coopPage.safePage}
                totalPages={coopPage.totalPages}
                onPrev={() => setPageCoop((p) => Math.max(1, p - 1))}
                onNext={() => setPageCoop((p) => Math.min(coopPage.totalPages, p + 1))}
              />
            </>
          )}

          {tab === "RAW" && (
            <>
              <div className="font-semibold mb-2">Righe: {rawFiltered.length}</div>
              <table className="w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Doc</th>
                    <th className="p-2">Tipo doc</th>
                    <th className="p-2">Data</th>
                    <th className="p-2">Pagamento</th>
                    <th className="p-2 text-left">Descrizione</th>
                    <th className="p-2 text-left">Tipo transazione</th>
                    <th className="p-2 text-right">Imp. fattura</th>
                    <th className="p-2 text-right">Imp. pagato</th>
                    <th className="p-2 text-right">Residuo</th>
                    <th className="p-2 text-left">File</th>
                  </tr>
                </thead>
                <tbody>
                  {rawPage.slice.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 font-mono">{r.numero_documento}</td>
                      <td className="p-2">{classifyDoc(r)}</td>
                      <td className="p-2">{r.data_documento}</td>
                      <td className="p-2 font-mono">{r.numero_pagamento}</td>
                      <td className="p-2">{r.descrizione}</td>
                      <td className="p-2">{r.tipo_transazione}</td>
                      <td className="p-2 text-right"><Money value={r.importo_fattura} /></td>
                      <td className="p-2 text-right"><Money value={r.importo_pagato ?? 0} /></td>
                      <td className="p-2 text-right"><Money value={r.importo_residuo ?? 0} /></td>
                      <td className="p-2 truncate max-w-xs" title={r.file_origine}>{r.file_origine}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={rawPage.safePage}
                totalPages={rawPage.totalPages}
                onPrev={() => setPageRaw((p) => Math.max(1, p - 1))}
                onNext={() => setPageRaw((p) => Math.min(rawPage.totalPages, p + 1))}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
