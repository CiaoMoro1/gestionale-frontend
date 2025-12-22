// src/routes/seller/OrdiniProntiSpedizioneSeller.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Ordine } from "../../types/ordini";

type DbOrderSeller = Ordine & {
  label_urls?: string[] | string | null;
  parcel_count?: number | null;
};



const API_URL = import.meta.env.VITE_API_URL as string;
const PAGE_SIZE = 100;

// Helpers
function formatDateTime(value: string | null | undefined) {
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
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Number(value).toFixed(2)} €`;
}

export default function OrdiniProntoSpedizioneSeller() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<DbOrderSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  // selezioni
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    ok: number;
    errors: number;
    messages: string[];
  } | null>(null);
type FailRow = { order_id: string; order_number?: string; reason: string };

  const [failOpen, setFailOpen] = useState(false);
  const [failRows, setFailRows] = useState<FailRow[]>([]);

  async function fetchOrders() {
    setErrorMsg(null);
    setRefreshing(true);

    const { data, error } = await supabase
      .from("orders_seller")
      .select("*")
      .eq("stage", "PRONTO_SPEDIZIONE") // solo ordini seller pronti alla spedizione
      .neq("order_status_raw", "Canceled")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error("Errore fetch ordini seller pronto_spedizione:", error);
      setErrorMsg(
        error.message || "Errore nel caricamento ordini Seller pronti alla spedizione"
      );
      setOrders([]);
    } else {
      setOrders((data || []) as DbOrderSeller[]);
    }

    setSelectedIds(new Set()); // reset selezioni quando ricarichi
    setBulkSummary(null);
    setRefreshing(false);
    setLoading(false);
  }

  useEffect(() => {
    void fetchOrders();
  }, []);

  const allVisibleIds = orders.map((o) => o.id);
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = allVisibleIds.some((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // deseleziona tutti i visibili
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        // seleziona tutti i visibili
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // Bulk: genera etichette BRT per tutti gli ordini Seller selezionati
  async function bulkConfermaEtichetteBrt() {
    if (selectedIds.size === 0 || bulkRunning) return;

    setBulkRunning(true);
    setBulkSummary(null);
    setFailRows([]);
    setFailOpen(false);

    const ids = Array.from(selectedIds);

    const okToMark: string[] = [];
    const fails: FailRow[] = [];

    // 1) CREA etichetta per chi non ce l’ha
    for (const orderId of ids) {
      try {
        // leggo il record (per sapere se ha già label e per mostrare number in errore)
        const { data: row, error } = await supabase
          .from("orders_seller")
          .select("id, number, shipment_id, label_urls, parcel_count")
          .eq("id", orderId)
          .single();

        if (error || !row) {
          fails.push({ order_id: orderId, reason: "Ordine non trovato in DB" });
          continue;
        }

        const hasLabel = Boolean(row.shipment_id) && Boolean(row.label_urls);

        if (!hasLabel) {
          const resp = await fetch(`${API_URL}/api/brt/create-shipment-seller`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: orderId,
              parcels: row.parcel_count ?? 1,
            }),
          });

          const data = (await resp.json().catch(() => ({}))) as {
            error?: string;
            code?: number;
          };

          if (!resp.ok || data.error) {
            fails.push({
              order_id: orderId,
              order_number: row.number,
              reason: data.error || "Errore creazione etichetta BRT",
            });
            continue;
          }
        }

        okToMark.push(orderId);
      } catch (e) {
        fails.push({
          order_id: orderId,
          reason: e instanceof Error ? e.message : "Errore rete creazione etichetta",
        });
      }
    }

    // 2) MARK ETICHETTATO solo per quelli OK
    if (okToMark.length > 0) {
      const resp = await fetch(`${API_URL}/api/orders-seller/mark-etichettato`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: okToMark }),
      });

      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        results?: { order_id: string; ok: boolean; message?: string; order_number?: string }[];
      };

      if (!resp.ok || data.error) {
        // se qui fallisce, consideriamo tutto KO (raro)
        setBulkSummary({
          ok: 0,
          errors: okToMark.length,
          messages: [data.error || "Errore durante spostamento a ETICHETTATO"],
        });
        setBulkRunning(false);
        return;
      }

      const results = data.results ?? [];
      const okRows = results.filter((r) => r.ok);
      const koRows = results.filter((r) => !r.ok);

      koRows.forEach((r) => {
        fails.push({
          order_id: r.order_id,
          order_number: r.order_number,
          reason: r.message || "Non spostato",
        });
      });

      setBulkSummary({
        ok: okRows.length,
        errors: fails.length,
        messages: fails.map((f) => `${f.order_number ?? f.order_id}: ${f.reason}`),
      });
    } else {
      setBulkSummary({
        ok: 0,
        errors: fails.length,
        messages: fails.map((f) => `${f.order_number ?? f.order_id}: ${f.reason}`),
      });
    }

    if (fails.length > 0) {
      setFailRows(fails);
      setFailOpen(true);
    }

    await fetchOrders();
    setBulkRunning(false);
  }



  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600">
          Caricamento ordini Seller pronti alla spedizione…
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 shadow-sm max-w-md">
          {errorMsg}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-3 px-2 sm:px-4 flex justify-center">
      <div className="w-full max-w-6xl space-y-3">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-3 py-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wide">
              Ordini Amazon Seller
            </div>
            <div className="text-lg sm:text-xl font-semibold text-slate-900">
              Pronti per la spedizione
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Stage = <span className="font-mono">PRONTO_SPEDIZIONE</span>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1 sm:gap-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Totale: {orders.length}
              </span>
              <button
                onClick={() => void fetchOrders()}
                disabled={refreshing}
                className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50 disabled:cursor-default"
              >
                {refreshing ? "Aggiorno…" : "Aggiorna"}
              </button>
            </div>

            {/* Bulk summary */}
            {bulkSummary && (
              <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
                Etichette create:{" "}
                <span className="font-semibold text-emerald-700">{bulkSummary.ok}</span>{" "}
                • Errori:{" "}
                <span className="font-semibold text-rose-700">
                  {bulkSummary.errors}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Barra azioni bulk */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-3 py-2 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300"
                checked={allSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = !allSelected && someSelected;
                  }
                }}
                onChange={toggleSelectAllVisible}
              />
              <span>Seleziona tutti in elenco</span>
            </label>
            {selectedCount > 0 && (
              <span className="text-[11px] text-slate-500">
                Selezionati:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedCount}
                </span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold shadow-sm
                         border border-slate-200 bg-slate-100 text-slate-700
                         disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={bulkRunning || selectedCount === 0}
              onClick={bulkConfermaEtichetteBrt}
            >
              {bulkRunning
                ? "Conferma etichette…"
                : selectedCount > 0
              ? `Conferma etichette BRT (${selectedCount})`
              : "Conferma etichette BRT"}
            </button>
          </div>
        </div>

        {/* Lista ordini */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          {orders.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              Nessun ordine Seller pronto per la spedizione.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* header tabella */}
              <div className="px-3 py-2 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wide hidden sm:grid sm:grid-cols-12 sm:gap-2">
                <div className="col-span-1 flex items-center gap-2">
                  <span>Sel.</span>
                </div>
                <div className="col-span-2">Ordine</div>
                <div className="col-span-3">Cliente</div>
                <div className="col-span-3">Indirizzo</div>
                <div className="col-span-1 text-right">Colli</div>
                <div className="col-span-2 text-right">Totale</div>
              </div>

              {orders.map((o) => {
                const checked = selectedIds.has(o.id);
                const parcelCount = o.parcel_count ?? 1;

                return (
                  <div
                    key={o.id}
                    className="px-3 py-2 sm:py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-2 items-center text-xs sm:text-[13px]">
                      {/* checkbox */}
                      <div className="col-span-2 sm:col-span-1 flex items-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300"
                          checked={checked}
                          onChange={() => toggleSelectOne(o.id)}
                        />
                      </div>

                      {/* ordine */}
                      <button
                        onClick={() => navigate(`/seller/ordini/${o.id}`)}
                        className="col-span-10 sm:col-span-2 text-left flex flex-col"
                      >
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {o.number}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatDateTime(o.created_at)}
                        </span>
                      </button>

                      {/* cliente */}
                      <button
                        onClick={() => navigate(`/seller/ordini/${o.id}`)}
                        className="hidden sm:flex sm:col-span-3 flex-col text-left"
                      >
                        <span className="text-slate-900 truncate">
                          {o.customer_name}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate">
                          {o.customer_email || "—"}
                        </span>
                      </button>

                      {/* indirizzo */}
                      <button
                        onClick={() => navigate(`/seller/ordini/${o.id}`)}
                        className="hidden sm:flex sm:col-span-3 flex-col text-left"
                      >
                        <span className="text-slate-900 truncate">
                          {o.shipping_address || "—"}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate">
                          {o.shipping_zip} {o.shipping_city} ({o.shipping_province}) –{" "}
                          {o.shipping_country}
                        </span>
                      </button>

                      {/* versione mobile cliente+indirizzo */}
                      <button
                        onClick={() => navigate(`/seller/ordini/${o.id}`)}
                        className="col-span-10 sm:hidden text-left text-[11px] text-slate-600 mt-1"
                      >
                        <div className="truncate">{o.customer_name}</div>
                        <div className="truncate">
                          {o.shipping_city} ({o.shipping_province}) —{" "}
                          {formatCurrency(o.total)}
                        </div>
                      </button>

                      {/* colli */}
                      <div className="hidden sm:flex sm:col-span-1 justify-end text-slate-700">
                        {parcelCount}
                      </div>

                      {/* totale */}
                      <div className="hidden sm:flex sm:col-span-2 justify-end text-slate-900 font-semibold">
                        {formatCurrency(o.total)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* eventuali messaggi di errore dettagliati (opzionale) */}
        {bulkSummary && bulkSummary.errors > 0 && bulkSummary.messages.length > 0 && (
          <div className="bg-white border border-rose-200 rounded-2xl shadow-sm px-3 py-2 text-[11px] text-rose-800">
            <div className="font-semibold mb-1">
              Alcune etichette non sono state generate:
            </div>
            <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
              {bulkSummary.messages.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {failOpen && failRows.length > 0 && (
  <div className="fixed inset-0 z-[1200] bg-black/40 flex items-center justify-center px-3">
    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-900">
          Ordini NON spostati in ETICHETTATO
        </div>
        <button
          className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600"
          onClick={() => setFailOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="text-xs text-slate-600 mb-3">
        Questi ordini sono rimasti in <b>PRONTO_SPEDIZIONE</b> perché la creazione etichetta / validazione dati ha fallito.
      </div>

      <div className="max-h-[50vh] overflow-auto divide-y">
        {failRows.map((f) => (
          <div key={f.order_id} className="py-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-xs text-slate-900 truncate">
                {f.order_number ?? f.order_id}
              </div>
              <div className="text-xs text-rose-700">
                {f.reason}
              </div>
            </div>
            <button
              className="shrink-0 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
              onClick={() => navigate(`/seller/ordini/${f.order_id}`)}
            >
              Apri dettaglio →
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
          onClick={() => setFailOpen(false)}
        >
          Chiudi
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
