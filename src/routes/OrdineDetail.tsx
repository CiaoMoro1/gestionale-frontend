// src/routes/OrdineDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Ordine } from "../types/ordini";
import type React from "react";

type ProductInfo = {
  product_title?: string | null;
  variant_title?: string | null;
};

type DbOrder = Ordine & {
  label_urls?: string[] | string | null;
  labels_zpl?: string[] | string | null; // ✅
  parcel_count?: number | null;
};

type RawOrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string | null;
  quantity: number | null;
  plus: number | null;
  reserved_qty: number | null;
  checked_qty: number | null;
  price: number | null;
  products?: ProductInfo[] | ProductInfo | null;
};

type DbOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string;
  quantity: number;
  plus: number;
  reserved_qty: number;
  checked_qty: number;
  price: number;
  product_title: string | null;
  variant_title: string | null;
};

type ItemStatus = "manca" | "parziale" | "completo";

type EnhancedItem = DbOrderItem & {
  ordered: number;
  covered: number;
  missing: number;
  status: ItemStatus;
  rowTotal: number;
};

type AddressCheckResult = {
  ok: boolean;
  message: string;
  normalizedAddress?: {
    address: string;
    city: string;
    zip: string;
    province: string;
    country: string;
  };
  code?: number;
};


interface FulfillOrderResult {
  order_id: string;
  ok: boolean;
  message?: string;
}

interface FulfillOrdersResponse {
  error?: string;
  results?: FulfillOrderResult[];
}

const API_URL = import.meta.env.VITE_API_URL as string;

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
function openPdfFromDataUrl(dataUrl: string) {
  try {
    // Se non è una data URL, apri direttamente
    if (!dataUrl.startsWith("data:application/pdf;base64,")) {
      window.open(dataUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const base64 = dataUrl.split(",")[1]; // prendi solo la parte base64
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    window.open(url, "_blank", "noopener,noreferrer");
    // opzionale: URL.revokeObjectURL(url) dopo un po'
  } catch (e) {
    console.error("Errore apertura PDF etichetta:", e);
  }
}


// Valuta stato riga
function getItemStatus(
  sku: string | null | undefined,
  ordered: number,
  covered: number
): ItemStatus {
  const cleanedSku = (sku || "").trim().toUpperCase();
  if (cleanedSku === "COMMISSIONE PAGAMENTO ALLA CONSEGNA") {
    // commissione contrassegno: mai "mancante"
    return "completo";
  }
  if (covered <= 0) return "manca";
  if (covered >= ordered) return "completo";
  return "parziale";
}

export default function OrdineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Ordine | null>(null);
  const [items, setItems] = useState<DbOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [addressCheck, setAddressCheck] = useState<AddressCheckResult | null>(null);
  const [checkingAddress, setCheckingAddress] = useState(false);

  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [labelUrls, setLabelUrls] = useState<string[]>([]);



  // Stato per conferma spedizione BRT
  const [confirmingShipment, setConfirmingShipment] = useState(false);
  const [confirmResultMsg, setConfirmResultMsg] = useState<string | null>(null);

  const [labelsZpl, setLabelsZpl] = useState<string[]>([]);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [printingZpl, setPrintingZpl] = useState(false);

  const [brtParcels, setBrtParcels] = useState<number>(1);

  // NUOVO: stato per indirizzo editabile
  const [shippingForm, setShippingForm] = useState({
    address: "",
    city: "",
    zip: "",
    province: "",
    country: "",
  });

  // Carica ordine + righe
  useEffect(() => {
    if (!id) {
      setErrorMsg("ID ordine non valido");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1) Ordine
      const { data: ordineData, error: ordineErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (ordineErr || !ordineData) {
        setErrorMsg(ordineErr?.message || "Ordine non trovato");
        setLoading(false);
        return;
      }

      // 2) Righe con join ai prodotti
      const { data: itemsData, error: itemsErr } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, sku, quantity, plus, reserved_qty, checked_qty, price, products:product_id(product_title, variant_title)"
        )
        .eq("order_id", id);

      if (itemsErr) {
        setErrorMsg(itemsErr.message || "Errore nel caricamento articoli");
        setLoading(false);
        setOrder(ordineData as Ordine);
        setItems([]);
        return;
      }

      const raw = (itemsData as unknown as RawOrderItemRow[]) || [];

      const mapped: DbOrderItem[] = raw.map((row) => {
        let product_title: string | null = null;
        let variant_title: string | null = null;

        const p = row.products;
        if (Array.isArray(p)) {
          if (p[0]) {
            product_title = p[0].product_title ?? null;
            variant_title = p[0].variant_title ?? null;
          }
        } else if (p) {
          product_title = p.product_title ?? null;
          variant_title = p.variant_title ?? null;
        }

        return {
          id: String(row.id),
          order_id: String(row.order_id),
          product_id: row.product_id ?? null,
          sku: (row.sku || "").toString(),
          quantity: Number(row.quantity ?? 0),
          plus: Number(row.plus ?? 0),
          reserved_qty: Number(row.reserved_qty ?? 0),
          checked_qty: Number(row.checked_qty ?? 0),
          price: Number(row.price ?? 0),
          product_title,
          variant_title,
        };
      });

      const dbOrder = ordineData as DbOrder;

      setOrder(dbOrder);
      setItems(mapped);
      // Labels ZPL dal DB
      const rawLabelsZpl = dbOrder.labels_zpl;
      let zpls: string[] = [];

      if (Array.isArray(rawLabelsZpl)) {
        zpls = rawLabelsZpl.filter((z): z is string => typeof z === "string");
      } else if (typeof rawLabelsZpl === "string" && rawLabelsZpl.length > 0) {
        try {
          const parsed = JSON.parse(rawLabelsZpl) as unknown;
          if (Array.isArray(parsed)) zpls = parsed.filter((z): z is string => typeof z === "string");
          else zpls = [rawLabelsZpl];
        } catch {
          zpls = [rawLabelsZpl];
        }
      }

      setLabelsZpl(zpls);


      // inizializza il form indirizzo con i dati ordine
      setShippingForm({
        address: dbOrder.shipping_address || "",
        city: dbOrder.shipping_city || "",
        zip: dbOrder.shipping_zip || "",
        province: dbOrder.shipping_province || "",
        country: dbOrder.shipping_country || "",
      });

      // Inizializza etichette dal DB (label_urls)
      const rawLabelUrls = dbOrder.label_urls;
      let urls: string[] = [];

      if (Array.isArray(rawLabelUrls)) {
        urls = rawLabelUrls.filter((u): u is string => typeof u === "string");
      } else if (typeof rawLabelUrls === "string" && rawLabelUrls.length > 0) {
        try {
          const parsed = JSON.parse(rawLabelUrls);
          if (Array.isArray(parsed)) {
            urls = parsed.filter((u): u is string => typeof u === "string");
          } else {
            urls = [rawLabelUrls];
          }
        } catch {
          // se non è JSON valido, trattiamolo come singola URL
          urls = [rawLabelUrls];
        }
      }

      setLabelUrls(urls);
      setLabelUrl(urls[0] || null);

      // Inizializza numero colli da DB se presente
      const parcelCount = dbOrder.parcel_count;
      if (typeof parcelCount === "number" && parcelCount > 0) {
        setBrtParcels(parcelCount);
      } else {
        setBrtParcels(1);
      }

      setLoading(false);

    })();
  }, [id]);

  const isInLavorazione =
    order?.stage === "IN_LAVORAZIONE" || order?.stato_ordine === "in_lavorazione";
  const isProntoSpedizione =
    order?.stage === "PRONTO_SPEDIZIONE" || order?.stato_ordine === "pronto_spedizione";
  const isEtichettato =
    order?.stato_ordine === "etichetta_generata";

  const enhancedItems: EnhancedItem[] = useMemo(
    () =>
      items.map((it) => {
        const ordered = it.quantity + it.plus;
        const covered = it.reserved_qty + it.checked_qty;
        const rowTotal = it.price * it.quantity;
        const status = getItemStatus(it.sku, ordered, covered);

        return {
          ...it,
          ordered,
          covered,
          missing: Math.max(ordered - covered, 0),
          status,
          rowTotal,
        };
      }),
    [items]
  );

  const totalOrderRows = useMemo(
    () => enhancedItems.reduce((sum, it) => sum + it.rowTotal, 0),
    [enhancedItems]
  );

  async function recalcAndUpdateOrderStage(currentItems: EnhancedItem[]) {
    if (!order) return;

    let allCovered = true;

    for (const it of currentItems) {
      const skuClean = it.sku.trim().toUpperCase();
      if (skuClean === "COMMISSIONE PAGAMENTO ALLA CONSEGNA") {
        continue;
      }
      if (it.covered < it.ordered) {
        allCovered = false;
        break;
      }
    }

    const newStage = allCovered ? "PRONTO_SPEDIZIONE" : "IN_LAVORAZIONE";
    const newStato = allCovered ? "pronto_spedizione" : "in_lavorazione";

    // 👇 Se è già uguale, non fare nulla
    if (order.stage === newStage && order.stato_ordine === newStato) {
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        stage: newStage,
        stato_ordine: newStato,
      })
      .eq("id", order.id);

    if (error) {
      console.error("Errore aggiornamento stage ordine:", error);
      return;
    }

    setOrder((prev) =>
      prev
        ? {
            ...prev,
            stage: newStage,
            stato_ordine: newStato,
          }
        : prev
    );
  }

  // Aggiorna coperti (riscontro) per singola riga via backend
  // Aggiorna coperti (riscontro) per singola riga via backend
  async function updateItemCoverage(itemId: string, newCoveredRaw: number, current: EnhancedItem) {
    if (!order) return;

    const ordered = current.ordered;
    const clamped = Math.max(0, Math.min(newCoveredRaw, ordered));

    console.log("updateItemCoverage", { itemId, newCoveredRaw, clamped, sku: current.sku });

    try {
      const resp = await fetch(`${API_URL}/api/orders/update-coverage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
          item_id: itemId,
          covered: clamped,
        }),
      });

      const data = (await resp.json()) as {
        error?: string;
        row?: {
          id: string;
          sku: string;
          quantity: number;
          plus: number;
          reserved_qty: number;
          checked_qty: number;
        };
        order?: {
          id: string;
          stage?: string | null;
          stato_ordine?: string | null;
        };
      };

      if (!resp.ok || data.error) {
        console.error("Errore update coverage backend:", data.error || resp.statusText);
        return;
      }

      const updatedRow = data.row;
      if (!updatedRow) {
        console.error("Risposta backend senza row aggiornata:", data);
        return;
      }

      const newReserved = Number(updatedRow.reserved_qty || 0);

      // 1) aggiorna la riga in stato locale
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                reserved_qty: newReserved,
              }
            : it
        )
      );

      // 2) ricalcola covered / status in base al nuovo reserved_qty
      const updatedEnhanced = enhancedItems.map((it) => {
        if (it.id !== itemId) return it;
        const covered = newReserved + it.checked_qty;
        const status = getItemStatus(it.sku, it.ordered, covered);
        return {
          ...it,
          reserved_qty: newReserved,
          covered,
          missing: Math.max(it.ordered - covered, 0),
          status,
        };
      });

      // 3) aggiorna lo stato ordine locale con i dati del backend (se ci sono)
      const updatedOrder = data.order;
      if (updatedOrder) {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                stage: updatedOrder.stage ?? prev.stage,
                stato_ordine: updatedOrder.stato_ordine ?? prev.stato_ordine,
              }
            : prev
        );
      } else {
        // fallback: ricalcolo locale se per qualche motivo il backend non ha mandato l'ordine
        await recalcAndUpdateOrderStage(updatedEnhanced);
      }
    } catch (e) {
      console.error("Errore di rete su update-coverage:", e);
    }
  }



  // Verifica indirizzo con BRT usando shippingForm
  async function verifyAddressWithBrt() {
    if (!order) return;
    setCheckingAddress(true);
    setAddressCheck(null);

    try {
      const resp = await fetch(`${API_URL}/api/brt/verify-address`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
          address: shippingForm.address,
          city: shippingForm.city,
          zip: shippingForm.zip,
          province: shippingForm.province,
          country: shippingForm.country,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        setAddressCheck({
          ok: false,
          message: err?.error || "Errore nella verifica indirizzo con BRT",
        });
        setCheckingAddress(false);
        return;
      }

      const data = (await resp.json()) as AddressCheckResult;

      // se BRT ci dà una versione normalizzata, aggiorniamo il form
      if (data.ok && data.normalizedAddress) {
        setShippingForm({
          address: data.normalizedAddress.address,
          city: data.normalizedAddress.city,
          zip: data.normalizedAddress.zip,
          province: data.normalizedAddress.province,
          country: data.normalizedAddress.country,
        });
      }

      setAddressCheck(data);
    } catch (e) {
      console.error("Errore verifica BRT:", e);
      setAddressCheck({
        ok: false,
        message: "Errore di rete verso backend BRT",
      });
    } finally {
      setCheckingAddress(false);
    }
  }

  // Auto-verifica quando l'ordine viene caricato
  useEffect(() => {
    if (order) {
      // non aspettiamo l'utente: verifichiamo subito con BRT
      void verifyAddressWithBrt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  useEffect(() => {
    setPrintMsg(null);
    setPrintingZpl(false);
  }, [order?.id, labelUrl, labelsZpl.length]);


  // Genera etichetta BRT (CREATE spedizione)
  async function generateBrtLabel() {
    if (!order) return;
    setGeneratingLabel(true);
    setLabelUrl(null);
    setConfirmResultMsg(null); // reset eventuali messaggi di conferma

    try {
      const resp = await fetch(`${API_URL}/api/brt/create-shipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
          parcels: brtParcels,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        console.error("Errore crea spedizione BRT:", err);
        setGeneratingLabel(false);
        return;
      }

      const data = (await resp.json()) as {
        shipment_id?: string;
        label_url?: string;
        label_urls?: string[];
        labels_zpl?: string[] | string; // ✅ aggiungi
        create?: { code?: number; message?: string };
      };


      if (data.label_urls && data.label_urls.length > 0) {
        setLabelUrls(data.label_urls);
        setLabelUrl(data.label_urls[0]);
        openPdfFromDataUrl(data.label_urls[0]);
      } else if (data.label_url) {
        setLabelUrls([data.label_url]);
        setLabelUrl(data.label_url);
        openPdfFromDataUrl(data.label_url);
      }

      // ✅ Aggiorna anche ZPL nello state (così compare subito "Stampa Zebra")
      const raw = data.labels_zpl;
      let zpls: string[] = [];

      if (Array.isArray(raw)) {
        zpls = raw.filter((z): z is string => typeof z === "string");
      } else if (typeof raw === "string" && raw.length > 0) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            zpls = parsed.filter((z): z is string => typeof z === "string");
          } else {
            zpls = [raw];
          }
        } catch {
          zpls = [raw];
        }
      }

      setLabelsZpl(zpls);


      // stato ordine → ETICHETTATI
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              stato_ordine: "etichetta_generata",
            }
          : prev
      );
   
    } catch (e) {
      console.error("Errore di rete su crea spedizione BRT:", e);
    } finally {
      setGeneratingLabel(false);
    }
  }



  async function deleteBrtShipment() {
    if (!order) return;
    setGeneratingLabel(true); // riuso lo stesso stato per disabilitare bottone

    try {
      const resp = await fetch(`${API_URL}/api/brt/delete-shipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
        }),
      });

      const data = await resp.json();

      if (!resp.ok || data.error) {
        console.error("Errore annullamento spedizione BRT:", data);
        // opzionale: mostrare un messaggio all'utente
        return;
      }

      // se ok, pulisci labelUrl localmente
      setLabelUrl(null);
      setLabelUrls([]);
      setLabelsZpl([]);  // ✅
      setPrintMsg(null); // ✅
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              stato_ordine: "pronto_spedizione",
            }
          : prev
      );
    } catch (e) {
      console.error("Errore di rete su delete-shipment BRT:", e);
    } finally {
      setGeneratingLabel(false);
    }
  }

  // Conferma spedizione BRT (CONFIRM esplicito)
  async function confirmBrtShipment() {
    if (!order) return;
    setConfirmingShipment(true);
    setConfirmResultMsg(null);

    try {
      const resp = await fetch(
        `${API_URL}/api/orders/bulk-confirm-and-fulfill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_ids: [order.id] }),
        }
      );

      const data: FulfillOrdersResponse = await resp.json();

      if (!resp.ok || data.error) {
        setConfirmResultMsg(
          data.error ||
            "Errore durante la conferma ed evasione della spedizione."
        );
        return;
      }

      const result = (data.results ?? [])[0];

      if (!result || !result.ok) {
        setConfirmResultMsg(
          result?.message ||
            "Conferma ed evasione non riuscita per questo ordine."
        );
        return;
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              fulfillment_status: "evaso",
              stato_ordine: "evaso",
              stage: "EVASO",
            }
          : prev
      );

      setConfirmResultMsg(
        "Spedizione BRT confermata ed ordine evaso (Shopify + gestionale)."
      );
    } catch (e) {
      console.error(
        "Errore rete bulk-confirm-and-fulfill (singolo ordine):",
        e
      );
      const message =
        e instanceof Error
          ? e.message
          : "Errore di rete durante la conferma della spedizione";
      setConfirmResultMsg(message);
    } finally {
      setConfirmingShipment(false);
    }
  }



  async function openBrtShipment(url?: string) {
    // se passo una URL esplicita (caso "Etichetta BRT 1"), apro solo quella
    if (url) {
      openPdfFromDataUrl(url);
      return;
    }

    // se ho più di una etichetta, provo a usare il PDF combinato dal backend
    if (labelUrls.length > 1) {
      try {
        const resp = await fetch(`${API_URL}/api/brt/combined-label`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order_id: order?.id }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => null);
          console.error("Errore combined-label BRT:", err);
          // fallback: usa solo la prima
          if (labelUrl) {
            openPdfFromDataUrl(labelUrl);
          }
          return;
        }

        const data = (await resp.json()) as {
          combined_label_url?: string;
          error?: string;
        };

        if (data.error || !data.combined_label_url) {
          console.error("Errore combined-label BRT:", data.error);
          if (labelUrl) {
            openPdfFromDataUrl(labelUrl);
          }
          return;
        }

        openPdfFromDataUrl(data.combined_label_url);
        return;
      } catch (e) {
        console.error("Errore rete combined-label BRT:", e);
        if (labelUrl) {
          openPdfFromDataUrl(labelUrl);
        }
        return;
      }
    }

    // se ho solo 1 etichetta (riepilogo o BRT), uso quella
    if (labelUrl) {
      openPdfFromDataUrl(labelUrl);
    }
  }



  if (loading) {
    return (
      <div className="p-6 text-center text-gray-600">
        Caricamento ordine…
      </div>
    );
  }

  if (errorMsg || !order) {
    return (
      <div className="p-6 text-center text-red-600">
        {errorMsg || "Ordine non trovato"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-2 sm:px-4 flex justify-center">
      <div className="w-full max-w-5xl space-y-4">
        {/* Header + stato */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
          <div>
            <div className="text-xs text-gray-500">Ordine</div>
            <div className="text-xl font-semibold text-gray-900">
              {order.number}
            </div>
            <div className="text-xs text-gray-500">
              Creato il {formatDateTime(order.created_at)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isEtichettato
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : isProntoSpedizione
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : isInLavorazione
                  ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                  : "bg-gray-100 text-gray-700 border border-gray-300"
              }`}
            >
              {isEtichettato
                ? "ETICHETTATI"
                : isProntoSpedizione
                ? "PRONTO PER LA SPEDIZIONE"
                : isInLavorazione
                ? "IN LAVORAZIONE"
                : String(order.stage || "NUOVO")}
            </span>
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-1 rounded-full bg-white border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 shadow-sm"
            >
              ⬅️ Torna indietro
            </button>
          </div>
        </div>

        {/* Dati ordine */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1">Cliente</div>
            <div className="text-sm font-semibold text-gray-900">
              {order.customer_name}
            </div>
            <div className="text-xs text-gray-500">
              {order.customer_email}
            </div>
            <div className="text-xs text-gray-500">
              {order.customer_phone}
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1">Pagamento</div>
            <div className="text-sm font-semibold text-gray-900">
              {order.payment_status}
            </div>
            <div className="text-xs text-gray-500 mt-2">Totale ordine</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatCurrency(order.total)}
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1">Canale</div>
            <div className="text-sm font-semibold text-gray-900">
              {order.channel}
            </div>
            <div className="text-xs text-gray-500 mt-2">Evasione</div>
            <div className="text-sm font-semibold text-gray-900">
              {order.fulfillment_status || "—"}
            </div>
          </div>
        </div>

        {/* Verifica indirizzo BRT */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-3 space-y-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex-1 space-y-1">
              <div className="text-xs text-gray-500">Indirizzo spedizione</div>

              <input
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm"
                value={shippingForm.address}
                onChange={(e) =>
                  setShippingForm((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Indirizzo"
              />

              <div className="flex flex-wrap gap-2">
                <input
                  className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-2 py-1 text-xs"
                  value={shippingForm.zip}
                  onChange={(e) =>
                    setShippingForm((prev) => ({ ...prev, zip: e.target.value }))
                  }
                  placeholder="CAP"
                />
                <input
                  className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-2 py-1 text-xs"
                  value={shippingForm.city}
                  onChange={(e) =>
                    setShippingForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="Città"
                />
                <input
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs"
                  value={shippingForm.province}
                  onChange={(e) =>
                    setShippingForm((prev) => ({ ...prev, province: e.target.value }))
                  }
                  placeholder="Prov."
                />
                <input
                  className="flex-1 min-w-[80px] border border-gray-300 rounded-lg px-2 py-1 text-xs"
                  value={shippingForm.country}
                  onChange={(e) =>
                    setShippingForm((prev) => ({ ...prev, country: e.target.value }))
                  }
                  placeholder="Nazione"
                />
              </div>
            </div>

            <button
              className="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm"
              onClick={verifyAddressWithBrt}
              disabled={checkingAddress}
            >
              {checkingAddress ? "Verifico…" : "Riverrifica con BRT"}
            </button>
          </div>

          {addressCheck && (
            <div
              className={`mt-2 text-xs rounded-xl px-3 py-2 ${
                addressCheck.ok
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {addressCheck.message}
            </div>
          )}
        </div>

{/* Articoli */}
<div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-3">
  <div className="flex justify-between items-center mb-2">
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-semibold text-gray-900">
        Articoli
      </span>
      <span className="text-[11px] text-gray-500">
        ({enhancedItems.length})
      </span>
    </div>
    <div className="text-[11px] text-gray-500">
      Totale righe:{" "}
      <span className="font-semibold text-gray-900">
        {formatCurrency(totalOrderRows)}
      </span>
    </div>
  </div>

  <div className="space-y-2">
    {enhancedItems.map((it) => {
      const badgeClass =
        it.status === "completo"
          ? "bg-green-50 text-green-700 border-green-200"
          : it.status === "parziale"
          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
          : "bg-red-50 text-red-700 border-red-200";

      const badgeLabel =
        it.status === "completo"
          ? "COMPLETO"
          : it.status === "parziale"
          ? "PARZIALE"
          : "MANCA";

      return (
        <div
          key={it.id}
          className="rounded-xl border border-gray-200 bg-gray-50 px-2 py-2"
        >
          {/* RIGA 1: SKU + BADGE + PREZZI */}
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* SKU grande e leggibile */}
              <span className="font-mono text-sm font-semibold text-gray-900">
                {it.sku || "—"}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}
              >
                {badgeLabel}
              </span>
            </div>

            <div className="text-right text-xs leading-tight min-w-[80px]">
              <div className="text-[11px] text-gray-500">
                Prezzo
              </div>
              <div className="font-semibold text-gray-900">
                {formatCurrency(it.price)}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Totale
              </div>
              <div className="font-semibold text-gray-900">
                {formatCurrency(it.rowTotal)}
              </div>
            </div>
          </div>

          {/* RIGA 2: TITOLO + VARIANTE */}
          <div className="mt-1 space-y-0.5">
            <div className="text-[13px] font-semibold text-gray-900 truncate">
              {it.product_title || "—"}
            </div>
            <div className="text-[11px] text-gray-500 truncate">
              {it.variant_title || "—"}
            </div>
          </div>

          {/* RIGA 3: QUANTITÀ + CONTROLLI (inline, super compatto) */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-2">
            <div className="text-[11px] text-gray-600 space-y-0.5">
              <div>
                <span className="font-semibold text-gray-900">
                  Ord:
                </span>{" "}
                {it.ordered}
              </div>
              <div>
                <span className="font-semibold text-gray-900">
                  Coperti:
                </span>{" "}
                {it.covered}/{it.ordered}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-xs hover:bg-gray-100"
                onClick={() =>
                  updateItemCoverage(it.id, it.covered - 1, it)
                }
                disabled={it.covered <= 0}
              >
                −
              </button>

              <input
                key={`${it.id}-${it.covered}`} // forza remount quando cambia covered
                type="number"
                min={0}
                max={it.ordered}
                defaultValue={it.covered}
                onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                  updateItemCoverage(
                    it.id,
                    Number(e.target.value || "0"),
                    it
                  )
                }
                className="w-14 text-center border border-gray-300 rounded-lg text-sm py-1 bg-white"
              />

              <button
                className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-xs hover:bg-gray-100"
                onClick={() =>
                  updateItemCoverage(it.id, it.covered + 1, it)
                }
                disabled={it.covered >= it.ordered}
              >
                +
              </button>
            </div>
          </div>
        </div>
      );
    })}

    {enhancedItems.length === 0 && (
      <div className="text-center text-gray-400 text-sm py-4">
        Nessun articolo per questo ordine.
      </div>
    )}
  </div>
</div>



        {/* Etichetta + conferma BRT */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between">
            <div className="flex-1 space-y-1">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                Flusso BRT (Create / Confirm)
              </div>
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold">1)</span> Genera etichetta ={" "}
                <span className="font-medium">CREA</span> spedizione in BRT.
              </p>
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold">2)</span> Conferma spedizione ={" "}
                invia la <span className="font-medium">CONFERMA esplicita</span> a BRT
                (può avvenire anche in un secondo momento).
              </p>
              {confirmResultMsg && (
                <div className="mt-2 rounded-xl px-3 py-2 bg-slate-50 border border-slate-200 text-[11px] text-slate-800 max-w-md">
                  {confirmResultMsg}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
              <div className="flex flex-wrap gap-2 items-center justify-end">
                {/* Input colli */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600">Colli</span>
                  <input
                    type="number"
                    min={1}
                    value={brtParcels}
                    onChange={(e) =>
                      setBrtParcels(Math.max(1, Number(e.target.value || "1")))
                    }
                    className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs text-right bg-slate-50"
                  />
                </div>

                {/* Toggle genera/elimina etichetta */}
                {labelUrl ? (
                  <button
                    className="px-4 py-2 rounded-full bg-rose-600 text-white text-xs sm:text-sm font-semibold hover:bg-rose-700 shadow-sm"
                    onClick={deleteBrtShipment}
                    disabled={generatingLabel}
                  >
                    {generatingLabel
                      ? "Annullamento…"
                      : "Elimina etichetta BRT"}
                  </button>
                ) : (
                  <button
                    className="px-4 py-2 rounded-full bg-orange-500 text-white text-xs sm:text-sm font-semibold hover:bg-orange-600 shadow-sm"
                    onClick={generateBrtLabel}
                    disabled={generatingLabel}
                  >
                    {generatingLabel
                      ? "Generazione…"
                      : "Genera etichetta BRT"}
                  </button>
                )}

                {/* Conferma spedizione */}
                <button
                  className="px-4 py-2 rounded-full bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 shadow-sm"
                  onClick={confirmBrtShipment}
                  disabled={confirmingShipment}
                >
                  {confirmingShipment
                    ? "Confermo…"
                    : "Conferma spedizione BRT"}
                </button>
              </div>

              {labelUrl && (
                <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
                  {printMsg && (
                    <div className="mt-2 rounded-xl px-3 py-2 bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-800 max-w-md">
                      {printMsg}
                    </div>
                  )}

                  {labelsZpl.length > 0 ? (
                    <button
                      className="px-4 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-black shadow-sm"
                      disabled={printingZpl}
                      onClick={async () => {
                        setPrintMsg(null);
                        setPrintingZpl(true);
                        try {
                          setPrintMsg("Connessione a QZ Tray…");
                          const mod = await import("@/lib/qzPrint");
                          setPrintMsg(`Invio stampa Zebra: ${labelsZpl.length} etichette…`);
                          await mod.qzPrintZpl({ zpl: labelsZpl });
                          setPrintMsg(`✅ Job inviato a Zebra (${labelsZpl.length} etichette).`);
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : String(e);
                          setPrintMsg(`❌ Errore stampa Zebra: ${msg}`);
                        } finally {
                          setPrintingZpl(false);
                        }
                      }}
                    >
                      {printingZpl ? "Stampo…" : "Stampa Zebra (ZPL)"}
                    </button>
                  ) : (
                    <button
                      className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
                      onClick={() => openBrtShipment()}
                    >
                      {labelUrls.length > 1 ? "Stampa tutte le etichette" : "Stampa etichetta"}
                    </button>
                  )}

                  {labelUrls.length > 1 && (
                    <div className="flex flex-wrap gap-2 justify-end mt-1">
                      {labelUrls.slice(1).map((url, idx) => (
                        <button
                          key={idx}
                          className="px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-800 border border-slate-300 hover:bg-slate-200"
                          onClick={() => openBrtShipment(url)}
                        >
                          Etichetta BRT {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </section>

        {/* Footer spacing */}
      </div>
    </div>
  );
}
