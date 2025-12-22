// src/routes/seller/OrdiniSellerEtichettati.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Ordine } from "../../types/ordini";

const API_URL = import.meta.env.VITE_API_URL as string;

type DbOrderSeller = Ordine & {
  label_urls?: string[] | string | null;
  parcel_count?: number | null;
};

const PAGE_SIZE = 100;

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

function openPdfFromDataUrl(dataUrl: string) {
  try {
    if (!dataUrl.startsWith("data:application/pdf;base64,")) {
      window.open(dataUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error("Errore apertura PDF etichette Seller:", e);
  }
}

type BulkConfirmSellerResult = {
  order_id: string;
  ok: boolean;
  message?: string;
};

type BulkConfirmSellerResponse = {
  error?: string;
  results?: BulkConfirmSellerResult[];
};

export default function OrdiniSellerEtichettati() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<DbOrderSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [printingLabels, setPrintingLabels] = useState(false);

  async function fetchOrders() {
    setErrorMsg(null);
    setInfoMsg(null);
    setRefreshing(true);

    const { data, error } = await supabase
      .from("orders_seller")
      .select("*")
      .eq("stage", "ETICHETTATO")
      .neq("order_status_raw", "Canceled")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error("Errore fetch ordini seller etichettati:", error);
      setErrorMsg(error.message || "Errore nel caricamento ordini Seller etichettati");
      setOrders([]);
    } else {
      setOrders((data || []) as DbOrderSeller[]);
    }

    setSelectedIds([]);
    setRefreshing(false);
    setLoading(false);
  }

  useEffect(() => {
    void fetchOrders();
  }, []);

  const allSelected = orders.length > 0 && selectedIds.length === orders.length;

  function toggleSelect(orderId: string) {
    setSelectedIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(orders.map((o) => String(o.id)));
  }

  async function handlePrintLabels() {
    const ids = selectedIds.length ? selectedIds : orders.map((o) => String(o.id));
    if (!ids.length) return;

    setPrintingLabels(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      // Per Seller usiamo bulk-combined-label-seller (da implementare) oppure loop su combined-label-seller.
      // Per evitare loop frontend, facciamo un semplice loop qui (è ok per 100 max).
      // Se vuoi, poi ti do anche endpoint bulk server-side.
      const allUrls: string[] = [];

      for (const id of ids) {
        const resp = await fetch(`${API_URL}/api/brt/combined-label-seller`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: id }),
        });

        const data = (await resp.json().catch(() => ({}))) as {
          combined_label_url?: string;
          error?: string;
        };

        if (!resp.ok || data.error || !data.combined_label_url) {
          setErrorMsg(data.error || `Errore stampa etichetta per ordine ${id}`);
          return;
        }

        allUrls.push(data.combined_label_url);
      }

      // unisco i pdf client-side? no: apriamo il primo e basta (semplice)
      // ✅ soluzione migliore: endpoint bulk merge server-side.
      // per ora apriamo il primo se ce n'è uno solo, altrimenti segnaliamo.
      if (allUrls.length === 1) {
        openPdfFromDataUrl(allUrls[0]);
      } else {
        setInfoMsg(
          `Ho generato ${allUrls.length} PDF. Consigliato: implementare bulk merge per Seller (come Sito) per avere un unico PDF.`
        );
        // apri comunque il primo
        openPdfFromDataUrl(allUrls[0]);
      }
    } catch (e) {
      console.error("Errore rete stampa etichette Seller:", e);
      setErrorMsg(e instanceof Error ? e.message : "Errore rete durante stampa etichette Seller");
    } finally {
      setPrintingLabels(false);
    }
  }

  async function handleConfirmShipments() {
    if (!selectedIds.length) return;

    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const resp = await fetch(`${API_URL}/api/brt/bulk-confirm-shipment-seller`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: selectedIds }),
      });

      const data: BulkConfirmSellerResponse = await resp
        .json()
        .catch(() => ({} as BulkConfirmSellerResponse));

      if (!resp.ok || data.error) {
        setErrorMsg(data.error || "Errore durante la conferma spedizioni Seller.");
        return;
      }

      const results = data.results || [];
      const failed = results.filter((r) => !r.ok);
      const ok = results.filter((r) => r.ok);

      if (failed.length) {
        setErrorMsg(
          "Alcune spedizioni NON confermate: " +
            failed.map((f) => `${f.order_id}: ${f.message || "errore"}`).join(" · ")
        );
      }

      if (ok.length) {
        setInfoMsg(`Confermate ${ok.length} spedizioni. (Ora puoi procedere a EVASO / manifest se previsto)`);
      }

      await fetchOrders();
    } catch (e) {
      console.error("Errore rete bulk-confirm-shipment-seller:", e);
      setErrorMsg(e instanceof Error ? e.message : "Errore rete durante conferma spedizioni Seller");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600">Caricamento ordini Seller etichettati…</div>
      </div>
    );
  }

  if (errorMsg && !orders.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl border border-red-200 px-4 py-3 text-sm text-red-700 max-w-md">
          <div className="font-semibold mb-1">Errore</div>
          <div>{errorMsg}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-2 sm:px-4 flex justify-center">
      <div className="w-full max-w-6xl space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Amazon Seller</div>
            <div className="text-xl font-semibold text-gray-900">Ordini etichettati</div>
            <div className="text-xs text-gray-500 mt-1">
              Stage = <span className="font-mono">ETICHETTATO</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
              ETICHETTATI: {orders.length}
            </span>

            <button
              onClick={() => void fetchOrders()}
              disabled={refreshing || submitting}
              className="px-3 py-1 rounded-full bg-white border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 shadow-sm disabled:opacity-50 disabled:cursor-default"
            >
              {refreshing ? "Aggiorno…" : "Aggiorna elenco"}
            </button>

            <button
              onClick={() => void handlePrintLabels()}
              disabled={printingLabels || (!selectedIds.length && !orders.length)}
              className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {printingLabels
                ? "Genero PDF…"
                : selectedIds.length
                ? `Stampa etichette (${selectedIds.length})`
                : "Stampa tutte le etichette"}
            </button>

            <button
              onClick={() => void handleConfirmShipments()}
              disabled={refreshing || submitting || selectedIds.length === 0}
              className="px-3 py-1 rounded-full bg-green-600 text-white text-xs font-semibold shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedIds.length === 0 ? "Seleziona almeno un ordine" : ""}
            >
              {submitting ? "Confermo…" : `Conferma spedizioni (${selectedIds.length})`}
            </button>
          </div>
        </div>

        {/* Messaggi */}
        {errorMsg && orders.length > 0 && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            {infoMsg}
          </div>
        )}

        {/* Lista ordini */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200">
          {orders.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">Nessun ordine Seller etichettato.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="px-3 py-2 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide grid grid-cols-12 gap-2">
                <div className="col-span-1 flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-gray-300 text-indigo-600"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </div>
                <div className="col-span-2">Ordine</div>
                <div className="col-span-3">Cliente</div>
                <div className="col-span-3">Indirizzo</div>
                <div className="col-span-1 text-right">Totale</div>
                <div className="col-span-2 text-right">Creato</div>
              </div>

              {orders.map((o) => {
                const idStr = String(o.id);
                const isSelected = selectedIds.includes(idStr);

                return (
                  <div
                    key={o.id}
                    onClick={() => navigate(`/seller/ordini/${o.id}`)}
                    className="w-full cursor-pointer px-3 py-3 hover:bg-indigo-50 transition-colors grid grid-cols-12 gap-2 text-xs sm:text-sm"
                  >
                    <div className="col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-gray-300 text-indigo-600"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(idStr);
                        }}
                      />

                    </div>

                    <div className="col-span-2 flex flex-col">
                      <span className="font-mono text-xs font-semibold text-gray-900">{o.number}</span>
                      <span className="text-[11px] text-gray-500">{o.channel || "—"}</span>
                      <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-semibold">
                        ETICHETTATO
                      </span>
                    </div>

                    <div className="col-span-3 flex flex-col">
                      <span className="text-gray-900">{o.customer_name}</span>
                      <span className="text-[11px] text-gray-500 truncate">{o.customer_email || "—"}</span>
                      <span className="text-[11px] text-gray-500">{o.customer_phone || "—"}</span>
                    </div>

                    <div className="col-span-3 flex flex-col">
                      <span className="text-gray-900 truncate">{o.shipping_address || "—"}</span>
                      <span className="text-[11px] text-gray-500 truncate">
                        {o.shipping_zip} {o.shipping_city} ({o.shipping_province}) – {o.shipping_country}
                      </span>
                    </div>

                    <div className="col-span-1 flex justify-end items-center">
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(o.total as number | null)}</span>
                    </div>

                    <div className="col-span-2 flex justify-end items-center">
                      <span className="text-[11px] text-gray-500">{formatDateTime(o.created_at as string | null)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
