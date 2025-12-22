// src/routes/seller/OrdineSellerDetail.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Ordine } from "../../types/ordini";
import type React from "react";

type ProductInfo = {
  product_title?: string | null;
  variant_title?: string | null;
};

type DbOrderSeller = Ordine & {
  shipment_id?: string | null;
  parcel_ids?: string[] | string | null;
  labels_zpl?: string[] | string | null;
  label_urls?: string[] | string | null;
  parcel_count?: number | null;
  confirmed_at?: string | null;
  delivered_at?: string | null;
  stage?: string | null;
  amazon_order_id?: string | null;
  order_status_raw?: string | null;
  marketplace_id?: string | null;
  sales_channel?: string | null;
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


type MarkEtichettatoResultRow = {
  order_id: string;
  ok: boolean;
  message?: string;
};

type MarkEtichettatoResponse = {
  error?: string;
  results?: MarkEtichettatoResultRow[];
};

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
    if (!dataUrl.startsWith("data:application/pdf;base64,")) {
      window.open(dataUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
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
    return "completo";
  }
  if (covered <= 0) return "manca";
  if (covered >= ordered) return "completo";
  return "parziale";
}

export default function OrdineSellerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<DbOrderSeller | null>(null);
  const [items, setItems] = useState<DbOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [addressCheck, setAddressCheck] = useState<AddressCheckResult | null>(null);
  const [checkingAddress, setCheckingAddress] = useState(false);

  const [savingAddress, setSavingAddress] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [labelUrls, setLabelUrls] = useState<string[]>([]);
  const [labelsZpl, setLabelsZpl] = useState<string[]>([]);




  const [confirmingShipment, setConfirmingShipment] = useState(false);
  const [confirmResultMsg, setConfirmResultMsg] = useState<string | null>(null);

  const [brtParcels, setBrtParcels] = useState<number>(1);

  const [shippingForm, setShippingForm] = useState({
    address: "",
    city: "",
    zip: "",
    province: "",
    country: "",
  });

  // Carica ordine + righe (SELLER)
  useEffect(() => {
    if (!id) {
      setErrorMsg("ID ordine non valido");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1) Ordine Seller
      const { data: ordineData, error: ordineErr } = await supabase
        .from("orders_seller")
        .select(`
          id,
          amazon_order_id,
          number,
          customer_name,
          created_at,
          payment_status,
          fulfillment_status,
          total,
          customer_email,
          customer_phone,
          shipping_address,
          shipping_city,
          shipping_zip,
          shipping_province,
          shipping_country,
          stage,
          order_status_raw,
          last_update_date,
          marketplace_id,
          sales_channel,
          channel:sales_channel,

          shipment_id,
          parcel_count,
          parcel_ids,
          label_urls,
          labels_zpl,
          confirmed_at,
          delivered_at
        `)
        .eq("id", id)
        .single();


      if (ordineErr || !ordineData) {
        setErrorMsg(ordineErr?.message || "Ordine Seller non trovato");
        setLoading(false);
        return;
      }

      const dbOrder = ordineData as unknown as DbOrderSeller;

      // 2) Righe Seller con join ai prodotti
      const { data: itemsData, error: itemsErr } = await supabase
        .from("order_items_seller")
        .select(
          "id, order_id, product_id, sku, quantity, plus, reserved_qty, checked_qty, price, products:product_id(product_title, variant_title)"
        )
        .eq("order_id", id);

      if (itemsErr) {
        setErrorMsg(itemsErr.message || "Errore nel caricamento articoli");
        setLoading(false);
        setOrder(dbOrder);
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

      setOrder(dbOrder);
      setItems(mapped);

      // Form indirizzo
      setShippingForm({
        address: dbOrder.shipping_address || "",
        city: dbOrder.shipping_city || "",
        zip: dbOrder.shipping_zip || "",
        province: dbOrder.shipping_province || "",
        country: dbOrder.shipping_country || "",
      });

      // Label URLs
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
          urls = [rawLabelUrls];
        }
      }

      setLabelUrls(urls);
      setLabelUrl(urls[0] || null);

      // Labels ZPL (stessa logica di label_urls)
      const rawLabelsZpl = dbOrder.labels_zpl;
      let zpls: string[] = [];

      if (Array.isArray(rawLabelsZpl)) {
        zpls = rawLabelsZpl.filter((z): z is string => typeof z === "string");
      } else if (typeof rawLabelsZpl === "string" && rawLabelsZpl.length > 0) {
        try {
          const parsed = JSON.parse(rawLabelsZpl) as unknown;
          if (Array.isArray(parsed)) {
            zpls = parsed.filter((z): z is string => typeof z === "string");
          } else {
            zpls = [rawLabelsZpl];
          }
        } catch {
          zpls = [rawLabelsZpl];
        }
      }

      setLabelsZpl(zpls);


      const parcelCount = dbOrder.parcel_count;
      if (typeof parcelCount === "number" && parcelCount > 0) {
        setBrtParcels(parcelCount);
      } else {
        setBrtParcels(1);
      }

      setLoading(false);
    })();
  }, [id]);

  const isInLavorazione = order?.stage === "IN_LAVORAZIONE";
  const isProntoSpedizione = order?.stage === "PRONTO_SPEDIZIONE";
  const isEtichettato = !!order?.shipment_id && labelUrls.length > 0;
  const isMovedToEtichettati = (order?.stage || "").toUpperCase() === "ETICHETTATO";
  const isShipmentConfirmed = !!order?.confirmed_at; // conferma spedizione già fatta

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

    if (order.stage === newStage) {
      return;
    }

    const { error } = await supabase
      .from("orders_seller")
      .update({ stage: newStage })
      .eq("id", order.id);

    if (error) {
      console.error("Errore aggiornamento stage ordine Seller:", error);
      return;
    }

    setOrder((prev) =>
      prev
        ? {
            ...prev,
            stage: newStage,
          }
        : prev
    );
  }

  // Aggiorna coperti (riscontro) per singola riga via backend Seller
  async function updateItemCoverage(
    itemId: string,
    newCoveredRaw: number,
    current: EnhancedItem
  ) {
    if (!order) return;

    const ordered = current.ordered;
    const clamped = Math.max(0, Math.min(newCoveredRaw, ordered));

    try {
      const resp = await fetch(`${API_URL}/api/orders-seller/update-coverage`, {
        // 👆 endpoint SELLER da implementare in backend
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

      const data = (await resp.json().catch(() => ({}))) as {
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
        };
      };

      if (!resp.ok || data.error) {
        console.error("Errore update coverage backend Seller:", data.error || resp.statusText);
        return;
      }

      const updatedRow = data.row;
      if (!updatedRow) {
        console.error("Risposta backend Seller senza row aggiornata:", data);
        return;
      }

      const newReserved = Number(updatedRow.reserved_qty || 0);

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

      const updatedOrder = data.order;
      if (updatedOrder) {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                stage: updatedOrder.stage ?? prev.stage,
              }
            : prev
        );
      } else {
        await recalcAndUpdateOrderStage(updatedEnhanced);
      }
    } catch (e) {
      console.error("Errore di rete su update-coverage Seller:", e);
    }
  }

  // Verifica indirizzo con BRT usando shippingForm (endpoint Seller dedicato)
  async function verifyAddressWithBrt() {
    if (!order) return;
    setCheckingAddress(true);
    setAddressCheck(null);

    try {
      const resp = await fetch(`${API_URL}/api/brt/verify-address-seller`, {
        // 👆 endpoint Seller da implementare
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
          message: err?.error || "Errore nella verifica indirizzo con BRT (Seller)",
        });
        setCheckingAddress(false);
        return;
      }

      const data = (await resp.json()) as AddressCheckResult;

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
      console.error("Errore verifica BRT Seller:", e);
      setAddressCheck({
        ok: false,
        message: "Errore di rete verso backend BRT (Seller)",
      });
    } finally {
      setCheckingAddress(false);
    }
  }

  async function saveAddressToDb() {
    if (!order) return;

    setSavingAddress(true);
    setSaveMsg(null);

    const { error } = await supabase
      .from("orders_seller")
      .update({
        shipping_address: shippingForm.address,
        shipping_city: shippingForm.city,
        shipping_zip: shippingForm.zip,
        shipping_province: shippingForm.province,
        shipping_country: shippingForm.country,
      })
      .eq("id", order.id);

    if (error) {
      console.error("Errore salvataggio indirizzo Seller:", error);
      setSaveMsg("Errore salvataggio indirizzo.");
    } else {
      setSaveMsg("Indirizzo salvato ✅");

      // aggiorna anche lo state "order" per coerenza UI
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              shipping_address: shippingForm.address,
              shipping_city: shippingForm.city,
              shipping_zip: shippingForm.zip,
              shipping_province: shippingForm.province,
              shipping_country: shippingForm.country,
            }
          : prev
      );
    }

    setSavingAddress(false);
  }



  // Auto-verifica quando l'ordine viene caricato
  useEffect(() => {
    if (order) {
      void verifyAddressWithBrt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  // Genera etichetta BRT (CREATE spedizione) - endpoint Seller
  async function generateBrtLabel() {
    if (!order) return;
    setGeneratingLabel(true);
    setLabelUrl(null);
    setConfirmResultMsg(null);

    try {
      const resp = await fetch(`${API_URL}/api/brt/create-shipment-seller`, {
        // 👆 endpoint Seller da implementare
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
        console.error("Errore crea spedizione BRT Seller:", err);
        setGeneratingLabel(false);
        return;
      }

      const data = (await resp.json()) as {
        shipment_id?: string;
        label_url?: string;
        label_urls?: string[];
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
    } catch (e) {
      console.error("Errore di rete su crea spedizione BRT Seller:", e);
    } finally {
      setGeneratingLabel(false);
    }
  }

  // Annulla spedizione BRT Seller
  async function deleteBrtShipment() {
    if (!order) return;
    setGeneratingLabel(true);

    try {
      const resp = await fetch(`${API_URL}/api/brt/delete-shipment-seller`, {
        // 👆 endpoint Seller da implementare
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
        }),
      });

        const data: { error?: string } = await resp
        .json()
        .catch(() => ({ error: "Errore sconosciuto" }));

        if (!resp.ok || data.error) {
        console.error("Errore annullamento spedizione BRT Seller:", data);
        return;
        }

      setLabelUrl(null);
      setLabelUrls([]);
      setLabelsZpl([]);
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              shipment_id: null,
              parcel_ids: null,
              label_urls: null,
              labels_zpl: null,
              confirmed_at: null,
              delivered_at: null,
              stage: "PRONTO_SPEDIZIONE",
              fulfillment_status: "inevaso",
            }
          : prev
      );

setConfirmResultMsg("Etichetta eliminata. Ordine tornato in PRONTO_SPEDIZIONE ✅");
    } catch (e) {
      console.error("Errore di rete su delete-shipment BRT Seller:", e);
    } finally {
      setGeneratingLabel(false);
    }
  }

  // Conferma spedizione BRT Seller
  async function confirmBrtShipment() {
    if (!order) return;
    setConfirmingShipment(true);
    setConfirmResultMsg(null);

    try {
      const resp = await fetch(`${API_URL}/api/brt/confirm-shipment-seller`, {
        // 👆 endpoint Seller da implementare
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        shipment_id?: string;
        code?: number;
        message?: string;
        error?: string;
      };

      if (!resp.ok || data.error) {
        setConfirmResultMsg(
          data.error || "Errore nella conferma della spedizione BRT Seller"
        );
        return;
      }

      if (data.code != null && data.code < 0) {
        setConfirmResultMsg(
          `Conferma BRT Seller fallita (code=${data.code}): ${
            data.message || "Errore"
          }`
        );
        return;
      }

      setConfirmResultMsg(
        `Spedizione BRT Seller confermata. ID: ${data.shipment_id || "-"}${
          data.message ? ` (${data.message})` : ""
        }`
      );
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              confirmed_at: new Date().toISOString(),
              // opzionale: se il tuo backend porta subito EVASO:
              // stage: "EVASO",
              // fulfillment_status: "evaso",
            }
          : prev
      );

    } catch (e) {
      console.error("Errore di rete su conferma spedizione BRT Seller:", e);
      setConfirmResultMsg("Errore di rete verso backend BRT Seller");
    } finally {
      setConfirmingShipment(false);
    }
  }


  async function markEtichettato() {
    if (!order) return;

    const resp = await fetch(`${API_URL}/api/orders-seller/mark-etichettato`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_ids: [order.id] }),
    });

    const data: MarkEtichettatoResponse = await resp
      .json()
      .catch(() => ({} as MarkEtichettatoResponse));
    if (!resp.ok || data.error) {
      console.error("mark-etichettato KO:", data);
      setConfirmResultMsg(data.error || "Errore spostamento in ETICHETTATO");
      return;
    }

    const r = (data.results || [])[0];
    if (r && r.ok) {
      setOrder((prev) => (prev ? { ...prev, stage: "ETICHETTATO" } : prev));
      setConfirmResultMsg("Ordine spostato in ETICHETTATO ✅");
    } else {
      setConfirmResultMsg(r?.message || "Impossibile spostare in ETICHETTATO");
    }
  }



  async function openBrtShipment(url?: string) {
    if (url) {
      openPdfFromDataUrl(url);
      return;
    }

    if (labelUrls.length > 1) {
      try {
        const resp = await fetch(`${API_URL}/api/brt/combined-label-seller`, {
          // 👆 endpoint Seller da implementare
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ order_id: order?.id }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => null);
          console.error("Errore combined-label BRT Seller:", err);
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
          console.error("Errore combined-label BRT Seller:", data.error);
          if (labelUrl) {
            openPdfFromDataUrl(labelUrl);
          }
          return;
        }

        openPdfFromDataUrl(data.combined_label_url);
        return;
      } catch (e) {
        console.error("Errore rete combined-label BRT Seller:", e);
        if (labelUrl) {
          openPdfFromDataUrl(labelUrl);
        }
        return;
      }
    }

    if (labelUrl) {
      openPdfFromDataUrl(labelUrl);
    }
  }

  // UI identica a OrdineDetail Sito, ma per Seller
  if (loading) {
    return (
      <div className="p-6 text-center text-gray-600">
        Caricamento ordine Amazon Seller…
      </div>
    );
  }

  if (errorMsg || !order) {
    return (
      <div className="p-6 text-center text-red-600">
        {errorMsg || "Ordine Seller non trovato"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-2 sm:px-4 flex justify-center">
      <div className="w-full max-w-5xl space-y-4">
        {/* Header + stato */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
          <div>
            <div className="text-xs text-gray-500">Ordine Amazon Seller</div>
            <div className="text-xl font-semibold text-gray-900">
              {order.number}
            </div>
            <div className="text-xs text-gray-500">
              Creato il {formatDateTime(order.created_at)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {(() => {
              const stageLabel =
                isProntoSpedizione
                  ? "PRONTO PER LA SPEDIZIONE"
                  : isInLavorazione
                  ? "IN LAVORAZIONE"
                  : String(order.stage || "NUOVO");

              const stageClass =
                isProntoSpedizione
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : isInLavorazione
                  ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                  : "bg-gray-100 text-gray-700 border border-gray-300";

              return (
                <>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${stageClass}`}>
                    {stageLabel}
                  </span>

                  {isEtichettato && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                      Etichetta pronta
                    </span>
                  )}
                </>
              );
            })()}

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

        {/* Verifica indirizzo BRT Seller */}
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
              {checkingAddress ? "Verifico…" : "Riverrifica con BRT Seller"}
            </button>

<button
  className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-black shadow-sm"
  onClick={saveAddressToDb}
  disabled={savingAddress}
>
  {savingAddress ? "Salvo…" : "Salva indirizzo"}
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


          {saveMsg && (
  <div className="mt-2 text-xs rounded-xl px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800">
    {saveMsg}
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
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
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

                  <div className="mt-1 space-y-0.5">
                    <div className="text-[13px] font-semibold text-gray-900 truncate">
                      {it.product_title || "—"}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {it.variant_title || "—"}
                    </div>
                  </div>

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
                        key={`${it.id}-${it.covered}`}
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

        {/* Etichetta + conferma BRT Seller */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between">
            <div className="flex-1 space-y-1">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                Flusso BRT Seller (Create / Confirm)
              </div>
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold">1)</span> Genera etichetta ={" "}
                <span className="font-medium">CREA</span> spedizione in BRT per Seller.
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
                <button
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-sm
                    ${isMovedToEtichettati
                      ? "bg-slate-200 text-slate-600 border border-slate-300 cursor-default"
                      : "bg-blue-800 text-white hover:bg-blue-900"}`}
                  onClick={() => {
                    if (isMovedToEtichettati) return;
                    void markEtichettato();
                  }}
                  disabled={!isEtichettato || isMovedToEtichettati}
                  title={
                    !isEtichettato
                      ? "Prima crea/stampa l'etichetta"
                      : isMovedToEtichettati
                      ? "Già spostato in ETICHETTATO"
                      : "Sposta l'ordine nella lista ETICHETTATI"
                  }
                >
                  {isMovedToEtichettati ? "Già in ETICHETTATI ✅" : "Sposta in ETICHETTATI"}
                </button>

                <button
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-sm
                    ${isShipmentConfirmed
                      ? "bg-slate-200 text-slate-600 border border-slate-300 cursor-default"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                  onClick={() => {
                    if (isShipmentConfirmed) return;
                    void confirmBrtShipment();
                  }}
                  disabled={confirmingShipment || isShipmentConfirmed}
                  title={isShipmentConfirmed ? "Spedizione già confermata" : "Conferma spedizione BRT"}
                >
                  {confirmingShipment
                    ? "Confermo…"
                    : isShipmentConfirmed
                    ? "Spedizione confermata ✅"
                    : "Conferma spedizione BRT"}
                </button>

                
              </div>

{labelUrl && (
  <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
    {labelsZpl.length > 0 ? (
      <button
        className="px-4 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-black shadow-sm"
        onClick={async () => {
          try {
            const mod = await import("@/lib/qzPrint");
            await mod.qzPrintZpl({ zpl: labelsZpl });
          } catch (e) {
            console.error("Stampa ZPL fallita, fallback PDF:", e);
            openBrtShipment();
          }
        }}
      >
        Stampa Zebra (ZPL)
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
            Etichetta PDF {idx + 1}
          </button>
        ))}
      </div>
    )}
  </div>
)}

            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
