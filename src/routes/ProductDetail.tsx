import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useState, useEffect, useCallback } from "react";

// 1. INTERFACCIA PER IL PRODOTTO
interface ProductInventory {
  inventario?: number;
  disponibile?: number;
  in_produzione?: number;
  riservato_sito?: number;
}

interface ProductDetail {
  id: string;
  product_title?: string | null;
  variant_title?: string | null;
  sku?: string | null;
  ean?: string | null;
  image_url?: string | null;
  price?: number | null;
  cost?: number | null;
  inventory_policy?: string | null;
  status?: string | null;
  updated_at?: string | null;
  inventory?: ProductInventory | null;
  [key: string]: unknown;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const originOrder = typeof location.state?.originOrder?.id === "string"
    ? location.state.originOrder
    : null;

  const [modalState, setModalState] = useState<{
    label: string;
    value: string;
    field?: string;
    editable?: boolean;
    type?: "text" | "checkbox";
  } | null>(null);
  const [manualValue, setManualValue] = useState<string>("0");

  // 2. STATO TIPIZZATO!
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 3. fetchProduct PRIMA degli useEffect che lo usano
  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*, inventory(inventario, disponibile, in_produzione, riservato_sito)")
      .eq("id", id)
      .single();

    if (error) {
      setError(error.message);
      setData(null);
    } else {
      setData(data as ProductDetail);
      setError(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`product-${id}-realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${id}`
        },
        () => fetchProduct()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory',
          filter: `product_id=eq.${id}`
        },
        () => fetchProduct()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchProduct]);

  useEffect(() => {
    fetchProduct();
  }, [id, fetchProduct]);

  const mutation = useMutation({
    mutationFn: async ({ field, value, mode }: { field: string; value: unknown; mode?: "delta" | "replace" }) => {
      if (!id) throw new Error("ID mancante");

      if (["price", "inventory_policy", "status", "ean"].includes(field)) {
        return supabase.from("products").update({ [field]: value }).eq("id", id);
      }

      if (field === "inventario" && mode === "delta") {
        return supabase.rpc("adjust_inventory_quantity", {
          pid: id,
          delta: value,
        });
      }

      return supabase.from("inventory").update({ [field]: value }).eq("product_id", id);
    },
    onSuccess: () => {
      fetchProduct();
      setModalState(null);
      setManualValue("0");
    },
  });

  if (loading || !data) return <div className="p-6 text-center text-gray-500">Caricamento prodotto...</div>;
  if (error) return <div className="p-6 text-center text-red-500">Errore: {error}</div>;

  return (
    <div className="p-4 rounded-3xl border space-y-6 bg-gradient-to-b from-white to-gray-100 min-h-screen text-black">
      {originOrder && (
        <div className="flex justify-center">
          <div className="flex items-center gap-4 px-4 py-3 mb-4 bg-white/60 backdrop-blur border border-white/90 rounded-2xl shadow text-[clamp(0.8rem,2vw,1rem)] text-black">
            <span className="font-medium">
              Ordine di partenza: <strong>{originOrder.number}</strong>
            </span>
            <button
              onClick={() => navigate(`/ordini/${originOrder.id}`)}
              className="px-3 py-1 rounded-xl border border-black/20 bg-black/80 hover:bg-white/90 transition text-white/80 shadow-sm font-semibold"
            >
              Torna all’ordine
            </button>
          </div>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-[clamp(1.4rem,4vw,2.2rem)] font-bold text-black">
          {typeof data.product_title === "string" ? data.product_title : ""}
        </h1>
        <p className="text-[clamp(0.9rem,2vw,1.2rem)] text-black/60">
          {typeof data.variant_title === "string" ? data.variant_title : ""}
        </p>
      </div>

      {typeof data.image_url === "string" && data.image_url && (
        <div className="flex justify-center">
          <div className="rounded-3xl border border-gray-200 shadow-xl bg-white/30 backdrop-blur-md p-2">
            <img
              src={data.image_url}
              alt={typeof data.sku === "string" ? data.sku : undefined}
              className="max-h-[300px] rounded-2xl object-contain"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <GlassField label="SKU" value={data.sku} />
        <GlassField label="EAN" value={data.ean} />
        <GlassField label="ASIN" value={"—"} />
      </div>

      <Section label="Quantità & Magazzino" cols={2}>
        <GlassField
          label="Inventario"
          value={data.inventory?.inventario}
          editable
          field="inventario"
          extra={
            data.inventory?.in_produzione && data.inventory.in_produzione > 0
              ? ` (${data.inventory.in_produzione} in arrivo)`
              : ""
          }
        />
        <GlassField label="Costo" value={`€ ${Number(data.cost ?? 0).toFixed(2)}`} />
        <GlassField label="Disponibile" value={data.inventory?.disponibile} />
        <GlassField label="In Produzione" value={data.inventory?.in_produzione} />
      </Section>

      <Section label="Riservato" cols={3}>
        <GlassField label="Sito" value={data.inventory?.riservato_sito} />
        <GlassField label="Seller" value={"—"} />
        <GlassField label="Vendor" value={"—"} />
      </Section>

      <Section label="Prezzi" cols={3}>
        <GlassField label="Sito" value={`€ ${Number(data.price ?? 0).toFixed(2)}`} editable field="price" />
        <GlassField label="Seller" value={"—"} />
        <GlassField label="Vendor" value={"—"} />
      </Section>

      <Section label="Impostazioni" cols={2}>
        <GlassField label="Vendi Sempre" value={data.inventory_policy} editable field="inventory_policy" type="checkbox" />
        <GlassField label="Status" value={data.status} />
        <GlassField
          label="Ultima Modifica"
          value={data.updated_at ? formatDate(data.updated_at) : "—"}
        />
      </Section>

      {modalState && (
        <div
          onClick={() => setModalState(null)}
          className="fixed inset-0 z-10 bg-black/40 flex items-center justify-center backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white/80 backdrop-blur-md text-black border rounded-3xl p-6 shadow-xl w-[90%] max-w-xl relative"
          >
            <button
              onClick={() => setModalState(null)}
              className="absolute top-2 right-3 text-xl"
            >×</button>

            <h2 className="text-xl font-bold mb-4">{modalState.label}</h2>

            {modalState.editable && modalState.field === "inventario" ? (
              <>
                <div className="text-sm mb-2">
                  Valore attuale: <strong>{modalState.value}</strong>
                </div>
                <div className="text-sm mb-2">
                  Dopo modifica: <strong>{parseInt(modalState.value) + parseInt(manualValue || "0")}</strong>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setManualValue((parseInt(manualValue) - 1).toString())}
                    className="px-2 py-1 bg-gray-200 rounded"
                  >−</button>
                  <input
                    type="text"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    className="w-16 text-center border rounded"
                  />
                  <button
                    onClick={() => setManualValue((parseInt(manualValue) + 1).toString())}
                    className="px-2 py-1 bg-gray-200 rounded"
                  >+</button>
                  <button
                    onClick={() => mutation.mutate({ field: modalState.field!, value: parseInt(manualValue), mode: "delta" })}
                    className="ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded shadow"
                  >Salva</button>
                </div>
              </>
            ) : modalState.editable && modalState.field ? (
              modalState.type === "checkbox" ? (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={modalState.value.toLowerCase() === "continue"}
                    onChange={(e) =>
                      mutation.mutate({
                        field: modalState.field!,
                        value: e.target.checked ? "continue" : "deny",
                      })
                    }
                    className="w-6 h-6 accent-green-600 cursor-pointer"
                  />
                  <span className="text-lg">
                    {modalState.value.toLowerCase() === "continue" ? "Attivo" : "Disattivo"}
                  </span>
                </div>
              ) : (
                <>
                  <input
                    value={manualValue ?? modalState.value}
                    onChange={(e) => setManualValue(e.target.value)}
                    className="w-full p-3 rounded text-black bg-white/70"
                  />
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => mutation.mutate({ field: modalState.field!, value: manualValue })}
                      className="bg-black text-white font-semibold px-4 py-2 rounded-xl hover:bg-gray-800"
                    >Salva</button>
                  </div>
                </>
              )
            ) : (
              <div className="text-lg whitespace-pre-wrap">{modalState.value}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // --- COMPONENTI INTERNI ---

  function GlassField({ label, value, editable, field, type = "text", extra = "" }: {
    label: string;
    value: string | number | boolean | null | undefined;
    editable?: boolean;
    field?: string;
    type?: "text" | "checkbox";
    extra?: string;
  }) {
    const openModal = () => {
      setManualValue("0");
      setModalState({ label, value: String(value ?? ""), field, editable, type });
    };

    const isCheckbox = type === "checkbox";
    const displayValue =
      isCheckbox && typeof value === "string"
        ? value.toLowerCase() === "continue" ? "Sì" : "No"
        : value;

    return (
      <div
        className="p-4 rounded-xl border bg-white/60 shadow-sm backdrop-blur-md transition hover:shadow-md cursor-pointer text-center"
        onClick={openModal}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && openModal()}
        title={String(displayValue)}
      >
        <div className="text-xs font-semibold text-black/60 mb-1 text-center">{label}</div>
        <div className="text-sm font-bold text-black text-center truncate">
          {displayValue ?? "—"}{extra}
        </div>
      </div>
    );
  }

  function Section({ label, children, cols = 2 }: { label: string; children: React.ReactNode; cols?: number }) {
    const gridCols = {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
    }[cols] ?? "grid-cols-2";

    return (
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-black/50">{label}</h3>
        <div className={`grid ${gridCols} gap-2`}>{children}</div>
      </div>
    );
  }

  function formatDate(dateString: string = "") {
    return new Date(dateString).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
