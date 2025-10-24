import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import {
  Boxes, ArrowLeft, RefreshCw, Search, ArrowLeftRight, Filter, X, Download,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ScanLine
} from "lucide-react";

/* =============================== ENDPOINTS =============================== */
const EP = {
  GIACENZE: `${import.meta.env.VITE_API_URL}/api/magazzino/giacenze`,     // GET (?mode=esteso)
  TRASFERS: `${import.meta.env.VITE_API_URL}/api/magazzino/trasferisci`,  // POST trasferimenti
};

/* ================================= TIPI ================================= */
type GiacenzaEstesa = {
  sku: string;
  ean?: string | null;
  giacenza_totale?: number;
  prenotati_totali?: number;
  vendor_qta?: number;
  vendor_prenotati?: number;
  sito_qta?: number;
  sito_prenotati?: number;
  seller_qta?: number;
  seller_prenotati?: number;
};


const CHANNELS = ["all", "vendor", "sito", "seller"] as const;
type ChannelFilter = typeof CHANNELS[number];

function isChannelFilter(x: string): x is ChannelFilter {
  return (CHANNELS as readonly string[]).includes(x);
}


function isItemsResponse(x: unknown): x is { items: GiacenzaEstesa[] } {
  return typeof x === "object" && x !== null && Array.isArray((x as { items?: unknown }).items);
}

type PoolKey = "vendor" | "sito" | "seller";
type SortKey =
  | "sku" | "ean"
  | "giacenza_totale" | "prenotati_totali"
  | "vendor_qta" | "vendor_prenotati"
  | "sito_qta" | "sito_prenotati"
  | "seller_qta" | "seller_prenotati";

/* =============================== UTILS/UI ================================ */
const SERVER_PAGE = 50;
const CLIENT_SIZES = [25, 50, 100];

function fmt(n?: number): string {
  return new Intl.NumberFormat("it-IT").format(n ?? 0);
}
function useDebounced<T>(v: T, d = 300) {
  const [deb, setDeb] = useState(v);
  useEffect(() => { const id = setTimeout(() => setDeb(v), d); return () => clearTimeout(id); }, [v, d]);
  return deb;
}
function Chip({ label, sub, tone = "blue" }: { label: string; sub?: string; tone?: "blue"|"emerald"|"amber" }) {
  const map = {
    blue:   "bg-blue-50 text-blue-800 border-blue-200",
    emerald:"bg-emerald-50 text-emerald-800 border-emerald-200",
    amber:  "bg-amber-50 text-amber-800 border-amber-200",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${map[tone]}`}>
      {label}{sub ? <span className="opacity-70"> · {sub}</span> : null}
    </span>
  );
}
function SortCaret({ active, dir }: { active: boolean; dir: "asc"|"desc" }) {
  return <span className={`text-[10px] translate-y-px ${active ? "opacity-100" : "opacity-30"}`}>{active ? (dir==="asc" ? "▲" : "▼") : "↕"}</span>;
}

/* =============================== PAGINA ================================= */
export default function GestioneMagazzinoPage() {
  const navigate = useNavigate();

  // server data
  const [loading, setLoading] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const [rows, setRows] = useState<GiacenzaEstesa[]>([]);

  // ricerca globale (server)
  const [query, setQuery] = useState("");
  const debQ = useDebounced(query, 300);

  // FILTRI NUOVI
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [minQty, setMinQty] = useState<string>(""); // numeri come string per input facile
  const [maxQty, setMaxQty] = useState<string>("");

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("sku");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");

  // client paging
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(1);

  // scanner
  const [scannerOpen, setScannerOpen] = useState(false);

  // trasferimento
  const [txOpen, setTxOpen] = useState(false);
  const [rowSel, setRowSel] = useState<GiacenzaEstesa | null>(null);
  const [qta, setQta] = useState<string>("");
  const [fromPool, setFromPool] = useState<PoolKey>("vendor");
  const [toPool, setToPool] = useState<PoolKey>("sito");

  /* -------------------------- LOAD SERVER PAGE -------------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (debQ.trim()) p.set("q", debQ.trim());
      p.set("offset", String(serverOffset));
      p.set("limit", String(SERVER_PAGE));
      const res = await fetch(`${EP.GIACENZE}?${p.toString()}&mode=esteso`);
      const data: unknown = await res.json();
      let arr: GiacenzaEstesa[] = [];
      if (Array.isArray(data)) arr = data as GiacenzaEstesa[];
      else if (isItemsResponse(data)) arr = data.items;
      setRows(arr);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debQ, serverOffset]);

  useEffect(() => { load(); }, [load]);

  /* ------------------------- FILTER + SORT VIEW ------------------------- */
  const filtered = useMemo(() => {
    // figure out which numeric to filter on, based on selected channel
    function qtyForChannel(r: GiacenzaEstesa): number {
      switch (channelFilter) {
        case "vendor": return r.vendor_qta ?? 0;
        case "sito":   return r.sito_qta ?? 0;
        case "seller": return r.seller_qta ?? 0;
        default:       return r.giacenza_totale ?? 0; // "all" => filtra sul totale
      }
    }
    const min = minQty ? Number(minQty) : -Infinity;
    const max = maxQty ? Number(maxQty) : Infinity;

    return rows.filter(r => {
      const q = qtyForChannel(r);
      if (q < min || q > max) return false;
      // channel filter does not exclude rows; it only defines which qty the filter applies to
      return true;
    });
  }, [rows, channelFilter, minQty, maxQty]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (sortKey === "sku" || sortKey === "ean") {
        return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
      }
      return (Number(av ?? 0) - Number(bv ?? 0)) * dir || a.sku.localeCompare(b.sku) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageClamped - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageClamped, pageSize]);

  /* ----------------------------- ACTIONS -------------------------------- */
  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  function exportCsv() {
    const headers = ["SKU","EAN","Totale","Pren.","Vendor","Pren.Vendor","Sito","Pren.Sito","Seller","Pren.Seller"];
    const lines = sorted.map(r => [
      r.sku, r.ean ?? "",
      r.giacenza_totale ?? 0, r.prenotati_totali ?? 0,
      r.vendor_qta ?? 0, r.vendor_prenotati ?? 0,
      r.sito_qta ?? 0, r.sito_prenotati ?? 0,
      r.seller_qta ?? 0, r.seller_prenotati ?? 0,
    ].join(";"));
    const csv = [headers.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "giacenze.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function availableFrom(r: GiacenzaEstesa, pool: PoolKey): number {
    if (pool === "vendor") return r.vendor_qta ?? 0;
    if (pool === "sito")   return r.sito_qta ?? 0;
    return r.seller_qta ?? 0;
  }

  async function confermaTrasferimento() {
    if (!rowSel) return;
    const qty = Math.max(0, Number(qta || "0"));
    if (qty <= 0) return;
    const available = availableFrom(rowSel, fromPool);
    if (qty > available) { alert(`Quantità oltre il disponibile nel pool "${fromPool}". Max: ${available}`); return; }
    setLoading(true);
    try {
      await fetch(EP.TRASFERS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: rowSel.sku, ean: rowSel.ean, from: fromPool, to: toPool, quantita: qty }),
      });
      setTxOpen(false); setRowSel(null); setQta("");
      await load();
    } finally { setLoading(false); }
  }

  /* ============================== RENDER ================================ */
  return (
    <div className="mx-auto max-w-[1400px] px-2 pb-24">
        {/* TOOLBAR (responsive, mobile-first) */}
        <div className="sticky top-0 z-40 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 border-b">
        <div className="px-2 py-2 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            {/* Colonna SX: back + titolo (sempre su una riga, mai si spezza) */}
            <div className="flex items-center gap-2 min-w-0 shrink-0">
            <button
                onClick={() => navigate(-1)}
                className="shrink-0 gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 inline-flex items-center"
            >
                <ArrowLeft size={18} />
                <span className="hidden sm:inline">Indietro</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
                <Boxes className="text-cyan-700 shrink-0" />
                <h1 className="text-base sm:text-lg font-bold text-cyan-900 truncate">
                Gestione Magazzino
                </h1>
            </div>
            </div>

            {/* Colonna DX: azioni (impilata su mobile, allineata su tablet/desktop) */}
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            {/* Search: prende tutta la larghezza su mobile/tablet stretto */}
            <div className="flex items-stretch rounded-lg overflow-hidden border min-w-0">
                <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca SKU o EAN"
                className="px-3 py-2 outline-none flex-1 min-w-0"
                autoComplete="off"
                />
                <button
                onClick={() => load()}
                className="px-3 py-2 bg-cyan-600 text-white hover:bg-cyan-700 inline-flex items-center gap-1 shrink-0"
                >
                <Search size={16} />
                <span className="hidden md:inline">Cerca</span>
                </button>
            </div>

            {/* Pulsanti compatti; non si spezzano, ma vanno a nuova riga in modo pulito */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                onClick={() => setScannerOpen(true)}
                className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 inline-flex items-center"
                >
                <ScanLine size={18} />
                <span className="hidden md:inline">Scanner</span>
                </button>

                <button
                onClick={exportCsv}
                className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 inline-flex items-center"
                >
                <Download size={16} />
                <span className="hidden md:inline">Esporta</span>
                </button>

                <button
                onClick={() => setFiltersOpen((o) => !o)}
                className={`gap-2 rounded-lg px-3 py-2 inline-flex items-center ${
                    filtersOpen
                    ? "bg-cyan-50 border border-cyan-300 text-cyan-800"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                }`}
                >
                <Filter size={16} />
                <span className="hidden md:inline">Filtri</span>
                </button>

                <button
                onClick={load}
                disabled={loading}
                className="gap-2 rounded-lg px-3 py-2 bg-cyan-600 text-white hover:bg-cyan-700 inline-flex items-center disabled:opacity-50"
                >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                <span className="hidden md:inline">Aggiorna</span>
                </button>
            </div>
            </div>
        </div>
        </div>
      {/* FILTRI (mobile full width / desktop compatto) */}
      {filtersOpen && (
        <div className="rounded-2xl border bg-white shadow p-3 mt-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500">Canale</label>
              <select
                value={channelFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const v = e.target.value;
                    if (isChannelFilter(v)) setChannelFilter(v);
                }}
                className="border rounded-lg px-2 py-2 w-full"
              >
                <option value="all">Tutti (filtra su Totale)</option>
                <option value="vendor">Vendor</option>
                <option value="sito">Sito</option>
                <option value="seller">Seller</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500">Quantità Min</label>
              <input
                value={minQty}
                onChange={(e) => setMinQty(e.target.value.replace(/\D+/g, ""))}
                inputMode="numeric" pattern="\d*"
                className="border rounded-lg px-2 py-2 w-full text-right"
                placeholder="es. 10"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500">Quantità Max</label>
              <input
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value.replace(/\D+/g, ""))}
                inputMode="numeric" pattern="\d*"
                className="border rounded-lg px-2 py-2 w-full text-right"
                placeholder="es. 100"
              />
            </div>

            <div className="sm:ms-auto">
              <button
                onClick={() => { setChannelFilter("all"); setMinQty(""); setMaxQty(""); }}
                className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-3 py-2 flex items-center w-full sm:w-auto"
              >
                <X size={16} /> Pulisci filtri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LISTA MOBILE (card) */}
      <div className="sm:hidden mt-3 space-y-2">
        {paged.map(r => (
          <div key={r.sku + (r.ean ?? "")} className="rounded-xl border bg-white shadow p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="font-mono font-semibold truncate">{r.sku}</div>
                <div className="font-mono text-xs text-slate-500 truncate">{r.ean ?? "—"}</div>
              </div>
              <button
                className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1 flex-shrink-0"
                title="Trasferisci"
                onClick={() => { setRowSel(r); setTxOpen(true); setQta(""); setFromPool("vendor"); setToPool("sito"); }}
              >
                <ArrowLeftRight size={16} /> Trasferisci
              </button>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="font-semibold">Tot: {fmt(r.giacenza_totale)}</div>
              <div className="text-slate-600">Pren: {fmt(r.prenotati_totali)}</div>
            </div>
            <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-1">
                <span className="text-[11px] text-slate-500">Vendor</span>
                <Chip label={fmt(r.vendor_qta)} sub={`pren ${fmt(r.vendor_prenotati)}`} tone="blue" />
            </div>
            <div className="inline-flex items-center gap-1">
                <span className="text-[11px] text-slate-500">Sito</span>
                <Chip label={fmt(r.sito_qta)} sub={`pren ${fmt(r.sito_prenotati)}`} tone="emerald" />
            </div>
            <div className="inline-flex items-center gap-1">
                <span className="text-[11px] text-slate-500">Seller</span>
                <Chip label={fmt(r.seller_qta)} sub={`pren ${fmt(r.seller_prenotati)}`} tone="amber" />
            </div>
            </div>
          </div>
        ))}
        {paged.length === 0 && (
          <div className="text-center py-10 text-slate-400">Nessun risultato</div>
        )}
      </div>

      {/* TABELLA DESKTOP */}
      <div className="hidden sm:block rounded-2xl border bg-white shadow mt-3 overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          {/* RICHIESTA: niente top-[54px]. Lascio sticky, ma con top-0. */}
          <thead className="bg-slate-50 sticky top-0 z-30">
            <tr>
              <ThSort label="SKU" k="sku" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ThSort label="EAN" k="ean" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ThSort right label="Totale" k="giacenza_totale" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ThSort right label="Pren."  k="prenotati_totali" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              {/* ORDINAMENTO ANCHE SUI CANALI */}
              <ThSort right label="Vendor" k="vendor_qta"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ThSort right label="Sito"   k="sito_qta"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ThSort right label="Seller" k="seller_qta"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map(r => (
              <tr key={r.sku + (r.ean ?? "")} className="border-t hover:bg-cyan-50/40">
                <td className="px-3 py-2 font-mono">{r.sku}</td>
                <td className="px-3 py-2 font-mono text-slate-500">{r.ean ?? "—"}</td>
                <td className="px-3 py-2 text-right font-bold">{fmt(r.giacenza_totale)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.prenotati_totali)}</td>
                <td className="px-3 py-2 text-right">
                  <Chip label={fmt(r.vendor_qta)} sub={`pren ${fmt(r.vendor_prenotati)}`} tone="blue" />
                </td>
                <td className="px-3 py-2 text-right">
                  <Chip label={fmt(r.sito_qta)} sub={`pren ${fmt(r.sito_prenotati)}`} tone="emerald" />
                </td>
                <td className="px-3 py-2 text-right">
                  <Chip label={fmt(r.seller_qta)} sub={`pren ${fmt(r.seller_prenotati)}`} tone="amber" />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1"
                    title="Trasferisci"
                    onClick={() => { setRowSel(r); setTxOpen(true); setQta(""); setFromPool("vendor"); setToPool("sito"); }}
                  >
                    <ArrowLeftRight size={16} /> <span className="hidden md:inline">Trasferisci</span>
                  </button>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400">Nessun risultato</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINAZIONE */}
      <div className="flex flex-wrap items-center justify-between mt-3 gap-2">
        {/* server pager */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Server:</span>
          <button
            onClick={() => setServerOffset(o => Math.max(0, o - SERVER_PAGE))}
            className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-2 py-1 disabled:opacity-40"
            disabled={serverOffset <= 0} title="Pagina precedente (server)"
          ><ChevronLeft size={16}/></button>
          <span className="text-xs">{serverOffset}</span>
          <button
            onClick={() => setServerOffset(o => o + SERVER_PAGE)}
            className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-2 py-1"
            title="Pagina successiva (server)"
          ><ChevronRight size={16}/></button>
        </div>

        {/* client pager */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Client:</span>
          <button onClick={() => setPage(1)} className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-2 py-1" title="Prima pagina"><ChevronsLeft size={16}/></button>
          <button onClick={() => setPage(p => Math.max(1, p-1))} className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-2 py-1" title="Indietro"><ChevronLeft size={16}/></button>
          <span className="text-sm">Pagina {pageClamped} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-2 py-1" title="Avanti"><ChevronRight size={16}/></button>
          <button onClick={() => setPage(totalPages)} className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-lg px-2 py-1" title="Ultima pagina"><ChevronsRight size={16}/></button>

          <select
            value={pageSize}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border rounded-lg px-2 py-1"
            title="Righe/pagina (client)"
          >
            {CLIENT_SIZES.map(n => <option key={n} value={n}>{n}/pag</option>)}
          </select>
        </div>
      </div>

      {/* MODALE TRASFERIMENTO */}
      {txOpen && rowSel && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center px-2">
          <div className="bg-white rounded-2xl shadow-xl border p-4 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold">Trasferimento — <span className="font-mono">{rowSel.sku}</span></div>
              <button className="text-2xl text-slate-400 hover:text-black" onClick={() => { setTxOpen(false); setRowSel(null); }}>×</button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-xs text-slate-500">Totale</div><div className="text-right font-bold">{fmt(rowSel.giacenza_totale)}</div>
              <div className="text-xs text-slate-500">Prenotati</div><div className="text-right">{fmt(rowSel.prenotati_totali)}</div>
              <div className="text-xs text-slate-500">Disponibile da <b className="normal-case">{fromPool}</b></div>
              <div className="text-right">{fmt(availableFrom(rowSel, fromPool))}</div>
            </div>

            <label className="block text-xs mb-1">Da</label>
            <select className="w-full border rounded-lg px-2 py-2 mb-2" value={fromPool} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFromPool(e.target.value as PoolKey)}>
              <option value="vendor">Vendor</option>
              <option value="sito">Sito</option>
              <option value="seller">Seller</option>
            </select>

            <label className="block text-xs mb-1">A</label>
            <select className="w-full border rounded-lg px-2 py-2 mb-2" value={toPool} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setToPool(e.target.value as PoolKey)}>
              <option value="vendor">Vendor</option>
              <option value="sito">Sito</option>
              <option value="seller">Seller</option>
            </select>

            <label className="block text-xs mb-1">Quantità</label>
            <input
              type="text" inputMode="numeric" pattern="\d*"
              value={qta}
              onChange={(ev) => setQta(ev.target.value.replace(/\D+/g, ""))}
              className="w-full border rounded-lg p-2 text-center font-bold"
              placeholder="0"
            />

            <div className="mt-3 flex gap-2">
              <button onClick={confermaTrasferimento} className="flex-1 rounded-lg px-3 py-2 bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50" disabled={loading}>
                Conferma
              </button>
              <button onClick={() => { setTxOpen(false); setRowSel(null); }} className="flex-1 rounded-lg px-3 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCANNER */}
      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onFound={(code, setErr) => {
        const found = rows.find(r => r.ean === code) || rows.find(r => r.sku === code);
        if (found) { setScannerOpen(false); setRowSel(found); setTxOpen(true); }
        else setErr("Articolo non trovato");
      }} />
    </div>
  );
}

/* ========================= SUBCOMPONENTI ========================= */
function ThSort({
  label, k, sortKey, sortDir, onSort, right = false,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onSort: (k: SortKey) => void; right?: boolean;
}) {
  const active = sortKey === k;
  return (
    <th className={`px-3 py-2 ${right ? "text-right" : "text-left"} text-slate-600 font-semibold`}>
      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => onSort(k)} title="Ordina">
        <span>{label}</span>
        <SortCaret active={active} dir={sortDir} />
      </button>
    </th>
  );
}
