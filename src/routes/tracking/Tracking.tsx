import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

import type {
  ShipmentRow,
  ShipmentStatus,
  PeriodFilter,
  QuickFilter,
  TrackingSummary,
  ShipmentEvent,
  StatusGroupFilter,
} from "./types";

import { formatDate } from "./types";

import { TrackingTable } from "./TrackingTable";
import { TrackingDetail } from "./TrackingDetail";
import { TrackingSummaryBar } from "./TrackingSummary";

type ManifestRow = {
  id: string;
  carrier: string | null;
  manifest_number: string;
  manifest_date: string | null;
  total_shipments: number | null;
  total_cod_amount: number | null;
  pdf_url: string | null;
  created_at: string;
};

const PAGE_SIZE = 25;

export default function TrackingPage() {
  // Summary
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Table data
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "ALL">("ALL");
  const [carrierFilter, setCarrierFilter] = useState<string | "ALL">("ALL");
  const [channelFilter, setChannelFilter] = useState<string | "ALL">("ALL");
  const [period, setPeriod] = useState<PeriodFilter>("7d");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("none");
  const [statusGroup, setStatusGroup] = useState<StatusGroupFilter>("ALL");

  // Paging
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Detail
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRow | null>(null);
  const [events, setEvents] = useState<ShipmentEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Manifests
  const [manifests, setManifests] = useState<ManifestRow[]>([]);
  const [manifestsLoading, setManifestsLoading] = useState(false);
  const [manifestsError, setManifestsError] = useState<string | null>(null);

  // DateFrom
  const dateFrom = useMemo(() => {
    if (period === "all") return null;
    const now = new Date();
    const d = new Date(now);
    if (period === "7d") d.setDate(now.getDate() - 7);
    if (period === "30d") d.setDate(now.getDate() - 30);
    return d.toISOString();
  }, [period]);

  // Summary
  useEffect(() => {
    const run = async () => {
      try {
        setSummaryLoading(true);
        const { data, error } = await supabase.from("tracking_summary").select("*").single();
        if (error) throw error;
        setSummary(data as TrackingSummary);
      } catch {
        // no-op
      } finally {
        setSummaryLoading(false);
      }
    };
    run();
  }, []);

  // Manifests
  useEffect(() => {
    const run = async () => {
      try {
        setManifestsLoading(true);
        setManifestsError(null);

        const { data, error } = await supabase
          .from("manifests")
          .select(
            "id, carrier, manifest_number, manifest_date, total_shipments, total_cod_amount, pdf_url, created_at",
          )
          .eq("carrier", "BRT")
          .order("manifest_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setManifests((data || []) as ManifestRow[]);
      } catch {
        setManifestsError("Impossibile caricare i borderò recenti");
      } finally {
        setManifestsLoading(false);
      }
    };
    run();
  }, []);

  // Shipments
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from("shipments_with_orders")
          .select("*", { count: "exact" })
          .order("order_created_at", { ascending: false });

        if (statusFilter !== "ALL") query = query.eq("internal_status", statusFilter);

        // gruppi stato
        if (statusGroup === "PENDING_ONLY") query = query.eq("internal_status", "PENDING");
        else if (statusGroup === "IN_PROGRESS")
          query = query.in("internal_status", ["IN_TRANSIT", "OUT_FOR_DELIVERY"]);
        else if (statusGroup === "DELIVERED") query = query.eq("internal_status", "DELIVERED");
        else if (statusGroup === "PROBLEM") query = query.eq("has_problem", true);
        else if (statusGroup === "ON_HOLD_ONLY") query = query.eq("internal_status", "ON_HOLD");
        else if (statusGroup === "FAILED_ONLY") query = query.eq("internal_status", "FAILED_ATTEMPT");
        else if (statusGroup === "RETURNING_ONLY") query = query.eq("internal_status", "RETURNING");
        else if (statusGroup === "RETURNED_ONLY") query = query.eq("internal_status", "RETURNED");
        else if (statusGroup === "LOST_DAMAGED_ONLY") query = query.eq("internal_status", "LOST_DAMAGED");

        if (carrierFilter !== "ALL") query = query.eq("carrier", carrierFilter);
        if (channelFilter !== "ALL") query = query.eq("channel", channelFilter);

        // periodo (attuale: su data spedizione/label)
        if (dateFrom) query = query.gte("label_created_at", dateFrom);

        // quick
        if (quickFilter === "attenzione") query = query.or("has_problem.eq.true,is_late.eq.true");
        else if (quickFilter === "ritardo") query = query.eq("is_late", true);
        else if (quickFilter === "contrassegno") query = query.gt("cod_amount", 0);

        // search
        if (search.trim()) {
          const term = search.trim();
          query = query.or(
            `order_number.ilike.%${term}%,tracking_number.ilike.%${term}%,customer_name.ilike.%${term}%`,
          );
        }

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error, count } = await query.range(from, to);
        if (error) throw error;

        setRows((data || []) as ShipmentRow[]);
        setTotalCount(count ?? null);
      } catch {
        setError("Errore durante il caricamento delle spedizioni");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [
    search,
    statusFilter,
    carrierFilter,
    channelFilter,
    period,
    quickFilter,
    statusGroup,
    page,
    dateFrom,
  ]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, carrierFilter, channelFilter, period, quickFilter, statusGroup]);

  const totalPages = totalCount == null ? null : Math.ceil(totalCount / PAGE_SIZE);

  // Events
  useEffect(() => {
    const run = async () => {
      if (!selectedShipment) {
        setEvents([]);
        setEventsError(null);
        return;
      }

      try {
        setEventsLoading(true);
        setEventsError(null);

        const { data, error } = await supabase
          .from("shipment_events")
          .select("*")
          .eq("shipment_id", selectedShipment.shipment_id)
          .order("event_at", { ascending: false });

        if (error) throw error;
        setEvents((data || []) as ShipmentEvent[]);
      } catch {
        setEventsError("Errore nel caricamento degli eventi");
      } finally {
        setEventsLoading(false);
      }
    };

    run();
  }, [selectedShipment]);

  // actions
  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setCarrierFilter("ALL");
    setChannelFilter("ALL");
    setPeriod("7d");
    setQuickFilter("none");
    setStatusGroup("ALL");
  };

  const toggleQuick = (f: QuickFilter) => {
    setQuickFilter((cur) => (cur === f ? "none" : f));
    setStatusGroup("ALL");
  };

  const openManifest = (pdfUrl: string) => openPdfFromDataUrl(pdfUrl);

  // Styles
  const card =
    "rounded-3xl border border-slate-200/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]";
  const tight =
    "rounded-3xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10)]";

  const input =
    "w-full rounded-2xl bg-white border border-slate-200/70 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";

  const select =
    "rounded-2xl bg-white border border-slate-200/70 px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";

  const chipBase = "px-3 py-1.5 rounded-full border text-xs shadow-sm transition";
  const chipOff = "border-slate-200 bg-white hover:bg-slate-50 text-slate-700";
  const chipOnDanger = "border-rose-200 bg-rose-50 text-rose-700";
  const chipOnInfo = "border-sky-200 bg-sky-50 text-sky-800";

  const cntAtt = summary?.attenzione ?? 0;
  const cntLate = summary?.in_ritardo ?? 0;
  const cntCod = summary?.contrassegno ?? 0;

  return (
    <div className="min-h-screen w-full bg-transparent text-slate-900">
                    <div className="text-3xl font-semibold tracking-wide flex items-center justify-center">Tracking</div>
      {/* Header (no reset button) */}
      <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-transparent backdrop-blur-xl">
              

        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center">
  

          <div className="flex-1 flex items-center justify-center">
            <div className="text-[11px] text-slate-500">
              {totalCount != null ? `${totalCount} spedizioni` : "—"} • Pagina {page + 1}
              {totalPages ? `/${totalPages}` : ""} • Periodo:{" "}
              {dateFrom ? formatDate(dateFrom) : "Tutto"}
            </div>
          </div>
        </div>
      </div>

      {/* BODY: fixed viewport with real remaining-height table */}
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-3">
        {/* Borderò strip (compact) */}
        <div className={`${tight} px-4 py-3 shrink-0`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
              Borderò BRT
            </div>
            <div className="text-[11px] text-slate-400">
              {manifestsLoading ? "…" : String(manifests.length)}
            </div>
          </div>

          {manifestsError && <div className="text-xs text-rose-700 mb-2">{manifestsError}</div>}

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {!manifestsLoading && manifests.length === 0 && !manifestsError && (
              <div className="text-xs text-slate-500">Nessun borderò recente.</div>
            )}

            {manifests.map((m) => (
              <button
                key={m.id}
                type="button"
                className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 shadow-sm"
                onClick={() => m.pdf_url && openManifest(m.pdf_url)}
                title={m.pdf_url ? "Apri PDF" : "PDF non disponibile"}
              >
                <span className="text-xs font-semibold text-slate-900">{m.manifest_number}</span>
                <span className="text-[11px] text-slate-500">
                  {m.manifest_date ? formatDate(m.manifest_date) : "—"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Control Center (toolbar) */}
        <div className={`${tight} px-4 py-3 shrink-0`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
              Control Center
            </div>
            <button
              type="button"
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 shadow-sm"
              onClick={resetFilters}
            >
              Reset filtri
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[260px]">
              <input
                className={input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ordine, tracking, cliente…"
              />
            </div>

            <select className={select} value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)}>
              <option value="7d">Ultimi 7 giorni</option>
              <option value="30d">Ultimi 30 giorni</option>
              <option value="all">Tutto</option>
            </select>

            <select
              className={select}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ShipmentStatus | "ALL");
                setStatusGroup("ALL");
              }}
            >
              <option value="ALL">Stato: Tutti</option>
              <option value="PENDING">Trasmesso a BRT</option>
              <option value="IN_TRANSIT">In transito</option>
              <option value="OUT_FOR_DELIVERY">In consegna</option>
              <option value="DELIVERED">Consegnato</option>
              <option value="FAILED_ATTEMPT">Consegna fallita</option>
              <option value="ON_HOLD">Giacenza / problemi</option>
              <option value="RETURNING">In rientro</option>
              <option value="RETURNED">Rientrato</option>
              <option value="LOST_DAMAGED">Smarrimento / danno</option>
            </select>

            <select
              className={select}
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value as string | "ALL")}
            >
              <option value="ALL">Corriere: Tutti</option>
              <option value="BRT">BRT</option>
              <option value="GLS">GLS</option>
              <option value="AMZL">AMZL</option>
            </select>

            <select
              className={select}
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as string | "ALL")}
            >
              <option value="ALL">Canale: Tutti</option>
              <option value="SITO">Sito</option>
              <option value="AMAZON_SELLER">Amazon Seller</option>
            </select>
          </div>

          {/* Quick filters: ONE place with counts */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${chipBase} ${quickFilter === "attenzione" ? chipOnDanger : chipOff}`}
              onClick={() => toggleQuick("attenzione")}
            >
              Attenzione ({cntAtt})
            </button>
            <button
              type="button"
              className={`${chipBase} ${quickFilter === "ritardo" ? chipOnDanger : chipOff}`}
              onClick={() => toggleQuick("ritardo")}
            >
              Ritardo ({cntLate})
            </button>
            <button
              type="button"
              className={`${chipBase} ${quickFilter === "contrassegno" ? chipOnInfo : chipOff}`}
              onClick={() => toggleQuick("contrassegno")}
            >
              Contrassegno ({cntCod})
            </button>
          </div>
        </div>

        {/* MAIN: Overview left + Table right (table dominates height) */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-1">
          {/* Overview */}
          <div className={`${card} p-4 min-h-0 overflow-hidden`}>
            <div className="h-full min-h-0 overflow-auto overflow-x-hidden pr-1">
              <TrackingSummaryBar
                summary={summary}
                loading={summaryLoading}
                quickFilter={quickFilter}
                onQuickFilterChange={(f) => {
                  setQuickFilter((cur) => (cur === f ? "none" : f));
                  setStatusGroup("ALL");
                }}
                statusGroup={statusGroup}
                onStatusGroupChange={(g) => {
                  setStatusGroup((cur) => (cur === g ? "ALL" : g));
                  setStatusFilter("ALL");
                  setQuickFilter("none");
                }}
              />

            </div>
          </div>

          {/* Table */}
          <div className={`${card} min-h-0 overflow-hidden`}>
            <TrackingTable
              rows={rows}
              loading={loading}
              error={error}
              selectedShipmentId={selectedShipment?.shipment_id ?? null}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              onRowClick={(row) => setSelectedShipment(row)}
            />
          </div>
        </div>
      </div>

      <TrackingDetail
        isOpen={!!selectedShipment}
        onClose={() => setSelectedShipment(null)}
        selectedShipment={selectedShipment}
        events={events}
        eventsLoading={eventsLoading}
        eventsError={eventsError}
      />
    </div>
  );
}

function openPdfFromDataUrl(dataUrl: string) {
  try {
    if (!dataUrl.startsWith("data:")) {
      window.open(dataUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const [meta, base64] = dataUrl.split(",");
    const m = meta.match(/data:(.*);base64/);
    const contentType = m?.[1] || "application/pdf";

    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const blob = new Blob([bytes], { type: contentType });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    console.error("Impossibile aprire PDF", e);
  }
}
