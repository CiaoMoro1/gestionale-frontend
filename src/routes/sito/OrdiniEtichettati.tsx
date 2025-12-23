// src/routes/sito/OrdiniEtichettati.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Ordine } from "@/types/ordini";

const API_URL = import.meta.env.VITE_API_URL as string;

type DbOrder = Ordine & {
  label_urls?: string[] | string | null;
  labels_zpl?: string[] | string | null; // ✅
  parcel_count?: number | null;
};

const PAGE_SIZE = 50;

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

function normalizeStringArray(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string" && x.length > 0);

  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
      }
    } catch {
      // non è JSON
    }
    return [value];
  }
  return [];
}



function openPdfFromDataUrl(dataUrl: string) {
  try {
    // Se non è data URL, apro direttamente
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
    console.error("Errore apertura PDF etichette:", e);
  }
}

interface BulkConfirmAndFulfillResult {
  order_id: string;
  ok: boolean;
  message?: string;
}

interface BulkConfirmAndFulfillResponse {
  error?: string;
  results?: BulkConfirmAndFulfillResult[];
}

export default function OrdiniEtichettati() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  // selezioni + submit
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fulfillMessage, setFulfillMessage] = useState<string | null>(null);

  // stampa etichette
  const [printingLabels, setPrintingLabels] = useState(false);

  async function fetchOrders() {
    setErrorMsg(null);
    setFulfillMessage(null);
    setRefreshing(true);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("stage", "ETICHETTATO") // 👈 filtro ordini etichettati
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error("Errore fetch ordini etichettati:", error);
      setErrorMsg(error.message || "Errore nel caricamento ordini etichettati");
      setOrders([]);
    } else {
      const mapped = ((data || []) as DbOrder[]).map((o) => ({
        ...o,
        label_urls: normalizeStringArray(o.label_urls),
        labels_zpl: normalizeStringArray(o.labels_zpl),
      }));
      setOrders(mapped);

    }

    // reset selezioni quando ricarico
    setSelectedIds([]);

    setRefreshing(false);
    setLoading(false);
  }

  useEffect(() => {
    void fetchOrders();
  }, []);

  const allSelected =
    orders.length > 0 && selectedIds.length === orders.length;

  function toggleSelect(orderId: string) {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((o) => String(o.id)));
    }
  }

  async function handleConfirmShipments() {
    if (!selectedIds.length) return;

    setSubmitting(true);
    setErrorMsg(null);
    setFulfillMessage(null);

    try {
      const resp = await fetch(
        `${API_URL}/api/orders/bulk-confirm-and-fulfill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_ids: selectedIds }),
        }
      );

      const data: BulkConfirmAndFulfillResponse = await resp.json();

      if (!resp.ok || data.error) {
        setErrorMsg(
          data.error ||
            "Errore durante la conferma ed evasione delle spedizioni."
        );
        return;
      }

      const results: BulkConfirmAndFulfillResult[] = data.results ?? [];
      const failed = results.filter((r) => !r.ok);
      const succeeded = results.filter((r) => r.ok);

      if (failed.length) {
        setErrorMsg(
          "Alcune spedizioni NON sono state confermate/evase: " +
            failed
              .map(
                (f) => `${f.order_id}: ${f.message ?? "errore"}`
              )
              .join(" · ")
        );
      }

      if (succeeded.length) {
        setFulfillMessage(
          `Confermate ed evase ${succeeded.length} spedizioni. Gli ordini evasi non compariranno più in questo elenco.`
        );
      }

      await fetchOrders();
    } catch (e) {
      console.error("Errore rete bulk-confirm-and-fulfill:", e);
      const message =
        e instanceof Error
          ? e.message
          : "Errore di rete durante la conferma delle spedizioni";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrintLabels() {
    // se hai selezionato qualcosa → stampo solo quelli
    // altrimenti → tutti gli ordini in lista
    const ids = selectedIds.length
      ? selectedIds
      : orders.map((o) => String(o.id));

    if (!ids.length) return;

    setPrintingLabels(true);
    setErrorMsg(null);

    try {
      const selectedOrders = (selectedIds.length ? orders.filter(o => selectedIds.includes(String(o.id))) : orders);

      const allZpl: string[] = [];
      for (const o of selectedOrders) {
        allZpl.push(...normalizeStringArray(o.labels_zpl));
      }

      if (allZpl.length > 0) {
        const mod = await import("@/lib/qzPrint");
        await mod.qzPrintZpl({ zpl: allZpl });
        return;
      }

      const resp = await fetch(
        `${API_URL}/api/brt/bulk-combined-label`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_ids: ids }),
        }
      );

      const data: { error?: string; combined_label_url?: string } =
        await resp.json();

      if (!resp.ok || data.error) {
        setErrorMsg(
          data.error ||
            "Errore durante la generazione del PDF etichette."
        );
        return;
      }

      if (!data.combined_label_url) {
        setErrorMsg("Nessuna etichetta trovata per la stampa.");
        return;
      }

      openPdfFromDataUrl(data.combined_label_url);
    } catch (e) {
      console.error("Errore rete bulk-combined-label:", e);
      const message =
        e instanceof Error
          ? e.message
          : "Errore di rete durante la stampa etichette";
      setErrorMsg(message);
    } finally {
      setPrintingLabels(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600 text-sm">
          Caricamento ordini etichettati…
        </div>
      </div>
    );
  }

  if (errorMsg && !orders.length) {
    // errore “bloccante” solo se non ho nessun ordine
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Ordini BRT
            </div>
            <div className="text-xl font-semibold text-gray-900">
              Ordini etichettati
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Mostro gli ordini con stage ={" "}
              <span className="font-mono">ETICHETTATO</span>
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

            {/* Bottone stampa etichette */}
            <button
              onClick={() => void handlePrintLabels()}
              disabled={
                printingLabels || (!selectedIds.length && !orders.length)
              }
              className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {printingLabels
                ? "Genero PDF…"
                : selectedIds.length
                ? `Stampa etichette (${selectedIds.length})`
                : "Stampa tutte le etichette"}
            </button>

            {/* Bottone conferma spedizioni */}
            <button
              onClick={() => void handleConfirmShipments()}
              disabled={refreshing || submitting}
              className="px-3 py-1 rounded-full bg-green-600 text-white text-xs font-semibold shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Confermo spedizioni…"
                : `Conferma spedizioni (${selectedIds.length})`}
            </button>
          </div>
        </div>

        {/* Messaggi globali (non bloccanti) */}
        {errorMsg && orders.length > 0 && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {errorMsg}
          </div>
        )}

        {fulfillMessage && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            {fulfillMessage}
          </div>
        )}

        {/* Lista ordini */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200">
          {orders.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              Nessun ordine etichettato al momento.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Header tabella */}
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

              {/* Righe */}
              {orders.map((o) => {
                const idStr = String(o.id);
                const isSelected = selectedIds.includes(idStr);

                return (
                  <div
                    key={o.id}
                    onClick={() => navigate(`/ordini/${o.id}`)}
                    className="w-full cursor-pointer px-3 py-3 hover:bg-indigo-50 transition-colors grid grid-cols-12 gap-2 text-xs sm:text-sm"
                  >
                    {/* Colonna: checkbox */}
                    <div className="col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-gray-300 text-indigo-600"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(idStr);
                        }}
                      />
                    </div>

                    {/* Colonna: Ordine */}
                    <div className="col-span-2 flex flex-col">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {o.number}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {o.channel || "—"}
                      </span>
                      <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-semibold">
                        ETICHETTATO
                      </span>
                    </div>

                    {/* Colonna: Cliente */}
                    <div className="col-span-3 flex flex-col">
                      <span className="text-gray-900">{o.customer_name}</span>
                      <span className="text-[11px] text-gray-500 truncate">
                        {o.customer_email || "—"}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {o.customer_phone || "—"}
                      </span>
                    </div>

                    {/* Colonna: Indirizzo */}
                    <div className="col-span-3 flex flex-col">
                      <span className="text-gray-900 truncate">
                        {o.shipping_address || "—"}
                      </span>
                      <span className="text-[11px] text-gray-500 truncate">
                        {o.shipping_zip} {o.shipping_city} ({o.shipping_province}) –{" "}
                        {o.shipping_country}
                      </span>
                    </div>

                    {/* Colonna: Totale */}
                    <div className="col-span-1 flex justify-end items-center">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(o.total as number | null)}
                      </span>
                    </div>

                    {/* Colonna: Data */}
                    <div className="col-span-2 flex justify-end items-center">
                      <span className="text-[11px] text-gray-500">
                        {formatDateTime(o.created_at as string | null)}
                      </span>
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
