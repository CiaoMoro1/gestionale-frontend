import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BarcodeScannerModal from "../modals/BarcodeScannerModal";
import ModalPDFLabel from "../components/ModalPDFLabel";
import type { Ordine, OrderItem } from "../types/ordini";
import { mergePdfBase64Array } from "../utils/mergePdf";

import OrderAddressForm from "../components/confermaordine/OrderAddressForm";
import OrderItemsList from "../components/confermaordine/OrderItemsList";
import LabelActions from "../components/confermaordine/LabelActions";
import AddressSuggestion from "../components/confermaordine/AddressSuggestion";

const GOOGLE_MAPS_EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY || "";

const initialFormData = {
  shipping_address: "",
  shipping_zip: "",
  shipping_city: "",
  shipping_province: "",
  shipping_country: "",
};

async function buildApiHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || "";
  if (!token) {
    alert("Utente non autenticato! Fai login prima di continuare.");
    throw new Error("Token mancante");
  }
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (import.meta.env.DEV) {
    headers["X-User-Id"] = "testuser123";
  }
  return headers;
}

export default function ConfermaPrelievo() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Ordine | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const [scannerOpen, setScannerOpen] = useState(false);

  const [etichetta, setEtichetta] = useState<{ labels: string[] }>({ labels: [] });
  const [, setSelectedLabelIdx] = useState(0);

  const [badge, setBadge] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [badgeTimeout, setBadgeTimeout] = useState<NodeJS.Timeout | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const [formData, setFormData] = useState(initialFormData);
  const [parcelCount, setParcelCount] = useState(1);

  const [geoSuggestion, setGeoSuggestion] = useState<any>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [modalPdfOpen, setModalPdfOpen] = useState(false);
  const [mergedPdf, setMergedPdf] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // --- LOAD DATA ---
  const loadOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: orderData } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();
    setOrder(orderData);

    const { data: itemData } = await supabase
      .from("order_items")
      .select("*, products:product_id(sku, ean, product_title)")
      .eq("order_id", id);

    setItems(itemData || []);
    let confirmedStatus: Record<string, number> = {};
    if (orderData?.label_pdf_base64) {
      confirmedStatus = (itemData || []).reduce((acc, item) => {
        acc[item.id] = item.quantity;
        return acc;
      }, {} as Record<string, number>);
    } else {
      confirmedStatus = (itemData || []).reduce((acc, item) => {
        acc[item.id] = 0;
        return acc;
      }, {} as Record<string, number>);
    }
    setConfirmed(confirmedStatus);

    setFormData({
      shipping_address: orderData?.shipping_address || "",
      shipping_zip: orderData?.shipping_zip || "",
      shipping_city: orderData?.shipping_city || "",
      shipping_province: orderData?.shipping_province || "",
      shipping_country: orderData?.shipping_country || "",
    });

    setParcelCount(orderData?.parcel_count ? Number(orderData.parcel_count) : 1);

    if (orderData?.label_pdf_base64) {
      let labels: string[] = [];
      try {
        const parsed = JSON.parse(orderData.label_pdf_base64);
        labels = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        labels = [orderData.label_pdf_base64];
      }
      setEtichetta({ labels });
      setSelectedLabelIdx(0);
    } else {
      setEtichetta({ labels: [] });
      setSelectedLabelIdx(0);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadOrder();
    return () => {
      if (badgeTimeout) clearTimeout(badgeTimeout);
    };
  }, [id, loadOrder]);

  // --- GEOCODING GOOGLE ---
  useEffect(() => {
    if (!formData.shipping_address || !formData.shipping_city) {
      setGeoSuggestion(null);
      return;
    }
    setGeoLoading(true);
    const payload = {
      address: {
        addressLines: [formData.shipping_address],
        postalCode: formData.shipping_zip,
        locality: formData.shipping_city,
        administrativeArea: formData.shipping_province,
        regionCode: formData.shipping_country,
      },
    };

    fetch(`${import.meta.env.VITE_API_URL}/api/validate-address`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        setGeoSuggestion(data && !data.error ? data : null);
      })
      .catch(() => {
        setGeoSuggestion(null);
      })
      .finally(() => setGeoLoading(false));
  }, [
    formData.shipping_address,
    formData.shipping_zip,
    formData.shipping_city,
    formData.shipping_province,
    formData.shipping_country,
  ]);

  // --- LOGICA DI CONFERMA ARTICOLO ---
  const confirmOne = (itemId: string) => {
    setConfirmed((prev) => ({
      ...prev,
      [itemId]: Math.min(
        (prev[itemId] || 0) + 1,
        items.find((i) => i.id === itemId)?.quantity ?? 1
      ),
    }));
  };

  const onScanBarcode = (code: string) => {
    const item = items.find(
      (i) => i.products?.ean === code || i.products?.sku === code || i.sku === code
    );
    if (!item) {
      alert("Articolo non trovato in questo ordine!");
      return;
    }
    confirmOne(item.id);
  };

  const allConfirmed =
    items.length > 0 &&
    items
      .filter(
        (item) =>
          !(
            item.products?.sku?.toLowerCase().includes("commissione pagamento") ||
            item.products?.product_title?.toLowerCase().includes("commissione pagamento")
          )
      )
      .every((item) => confirmed[item.id] >= item.quantity);

  const handleGeneraEtichetta = async () => {
    setApiLoading(true);
    try {
      const headers = await buildApiHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/brt/create-label`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId: id,
          shipping_address: formData.shipping_address,
          shipping_zip: formData.shipping_zip,
          shipping_city: formData.shipping_city,
          shipping_province: formData.shipping_province,
          shipping_country: formData.shipping_country,
          parcel_count: parcelCount,
        }),
      });
      const data = await res.json();
      let labels: string[] = [];
      if (Array.isArray(data.labels)) {
        labels = data.labels;
      } else if (typeof data.label === "string" && data.label) {
        labels = [data.label];
      }
      setEtichetta({ labels });
      setSelectedLabelIdx(0);

      if (!res.ok || labels.length === 0) {
        setBadge({
          type: "error",
          message: data?.error || "Errore generazione etichetta!",
        });
        setApiLoading(false);
        return;
      }
      setBadge({ type: "success", message: "Etichette create!" });
      await loadOrder();
    } catch (err) {
      setBadge({ type: "error", message: "Errore generazione etichetta!" });
    }
    if (badgeTimeout) clearTimeout(badgeTimeout);
    setBadgeTimeout(setTimeout(() => setBadge(null), 2000));
    setApiLoading(false);
  };

  const handleEliminaEtichetta = async () => {
    if (etichetta.labels.length === 0 && !order?.numeric_sender_reference) {
      setBadge({ type: "error", message: "Nessun riferimento spedizione trovato." });
      if (badgeTimeout) clearTimeout(badgeTimeout);
      setBadgeTimeout(setTimeout(() => setBadge(null), 2000));
      return;
    }
    setApiLoading(true);
    try {
      const headers = await buildApiHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/brt/delete-shipment`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          numericSenderReference: order?.numeric_sender_reference,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBadge({ type: "success", message: "Etichetta eliminata." });
        setEtichetta({ labels: [] });
        setSelectedLabelIdx(0);
        await loadOrder();
      } else {
        setBadge({
          type: "error",
          message:
            data?.error || "Errore eliminazione etichetta (verifica backend o connessione).",
        });
      }
      if (badgeTimeout) clearTimeout(badgeTimeout);
      setBadgeTimeout(setTimeout(() => setBadge(null), 1500));
    } catch (err) {
      setBadge({
        type: "error",
        message: "Errore chiamata API eliminazione (controlla la connessione o riprova più tardi).",
      });
      if (badgeTimeout) clearTimeout(badgeTimeout);
      setBadgeTimeout(setTimeout(() => setBadge(null), 2000));
    }
    setApiLoading(false);
  };

  const handleStampaEtichette = async () => {
    if (!etichetta.labels.length) {
      alert("Non ci sono etichette da stampare.");
      return;
    }
    if (order) {
      await supabase.from("orders").update({ stato_ordine: "etichette" }).eq("id", order.id);
    }

    let pdfToPrint: string | null = null;
    if (etichetta.labels.length === 1) {
      pdfToPrint = etichetta.labels[0];
    } else {
      try {
        pdfToPrint = await mergePdfBase64Array(etichetta.labels);
      } catch {
        alert("Errore durante il merge dei PDF.");
        return;
      }
    }
    if (!pdfToPrint) {
      alert("PDF non trovato!");
      return;
    }

    const byteArray = Uint8Array.from(atob(pdfToPrint), (c) => c.charCodeAt(0));
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleSaveAddress = async () => {
    if (!order) return;
    setApiLoading(true);
    const { error } = await supabase
      .from("orders")
      .update({
        shipping_address: formData.shipping_address,
        shipping_zip: formData.shipping_zip,
        shipping_city: formData.shipping_city,
        shipping_province: formData.shipping_province,
        shipping_country: formData.shipping_country,
        parcel_count: parcelCount,
      })
      .eq("id", order.id);

    if (!error) {
      setBadge({ type: "success", message: "Indirizzo (e colli) aggiornati!" });
      await loadOrder();
    } else {
      setBadge({ type: "error", message: "Errore aggiornamento indirizzo/colli" });
    }
    if (badgeTimeout) clearTimeout(badgeTimeout);
    setBadgeTimeout(setTimeout(() => setBadge(null), 2000));
    setApiLoading(false);
  };

  const mapAddressString = [
    formData.shipping_address,
    formData.shipping_city,
    formData.shipping_province,
    formData.shipping_zip,
    formData.shipping_country,
  ]
    .filter(Boolean)
    .join(", ");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-600">
        <span className="animate-spin mb-2">⏳</span> Caricamento...
      </div>
    );
  }

  if (!order)
    return <div className="text-center text-red-500 mt-12">Ordine non trovato.</div>;

  return (
    <div className="w-full max-w-full sm:max-w-2xl mx-auto px-1 py-2 sm:px-3 sm:py-4 flex flex-col gap-5">
      <h1
        className="flex items-center gap-2 font-bold text-lg sm:text-2xl leading-tight mb-1 sm:mb-3"
        style={{ fontSize: "clamp(1.3rem, 5vw, 2rem)" }}
      >
        Conferma Prelievo Ordine #{order.number}
      </h1>

      {/* MAPPA */}
      {mapAddressString && GOOGLE_MAPS_EMBED_KEY && (
        <div className="rounded-xl overflow-hidden shadow mb-2 sm:mb-3 w-full">
          <iframe
            width="100%"
            height="160"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_EMBED_KEY}&q=${encodeURIComponent(
              mapAddressString
            )}`}
          />
        </div>
      )}

      {/* FORM DATI INDIRIZZO */}
      <OrderAddressForm
        order={order}
        formData={formData}
        setFormData={setFormData}
        parcelCount={parcelCount}
        setParcelCount={setParcelCount}
        onSave={handleSaveAddress}
        loading={apiLoading}
        badge={badge}
      />

      {/* SUGGERIMENTO GOOGLE */}
      <AddressSuggestion
        formData={formData}
        geoSuggestion={geoSuggestion}
        geoLoading={geoLoading}
        onAcceptSuggestion={(newForm) => setFormData(newForm)}
        setBadge={setBadge}
      />

      {/* LISTA ARTICOLI */}
      <OrderItemsList
        items={items}
        confirmed={confirmed}
        confirmOne={confirmOne}
        onOpenScanner={() => setScannerOpen(true)}
      />

      {/* BOTTONI FINALI */}
      <div className="flex flex-col gap-2 mt-3">
        {!etichetta.labels.length ? (
          <button
            className="block w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-lg shadow transition disabled:bg-gray-300 disabled:text-gray-400"
            style={{ fontSize: "clamp(1.1rem, 4vw, 1.2rem)" }}
            disabled={!allConfirmed || apiLoading}
            onClick={handleGeneraEtichetta}
          >
            {apiLoading ? <span className="animate-spin mr-2">⏳</span> : null}
            Genera etichetta
          </button>
        ) : (
          <button
            className="block w-full bg-gray-300 text-gray-500 py-4 rounded-2xl font-bold text-lg shadow transition cursor-not-allowed"
            style={{ fontSize: "clamp(1.1rem, 4vw, 1.2rem)" }}
            disabled
          >
            Etichetta generata
          </button>
        )}
      </div>

      {/* BADGE */}
      {badge && (
        <div
          className={`mt-2 rounded-2xl px-4 py-3 font-semibold text-center shadow text-base transition
        ${
          badge.type === "success"
            ? "bg-green-200 text-green-800"
            : "bg-red-200 text-red-800"
        }`}
        >
          {badge.message}
        </div>
      )}

      {/* AZIONI ETICHETTE */}
      <LabelActions
        etichetta={etichetta}
        isMerging={isMerging}
        setMergedPdf={setMergedPdf}
        setIsMerging={setIsMerging}
        setModalPdfOpen={setModalPdfOpen}
        onPrint={handleStampaEtichette}
        onDelete={handleEliminaEtichetta}
        stato_ordine={
          typeof order?.stato_ordine === "string" && order?.stato_ordine
            ? order.stato_ordine
            : "prelievo"
        }
        apiLoading={apiLoading}
        mergePdfBase64Array={mergePdfBase64Array}
      />

      {/* MODAL PDF */}
      <ModalPDFLabel
        open={modalPdfOpen}
        onClose={() => setModalPdfOpen(false)}
        pdfBase64={mergedPdf || ""}
        orderNumber={order?.number}
        orderId={order?.id}
      />
      {modalPdfOpen && isMerging && (
        <div className="flex justify-center items-center p-4">
          <span className="animate-spin mr-2">⏳</span> Unione etichette...
        </div>
      )}

      {/* MODAL BARCODE */}
      {scannerOpen && (
        <BarcodeScannerModal
          onDetected={(code: string) => {
            onScanBarcode(code);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
