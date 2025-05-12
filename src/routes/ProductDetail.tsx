import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useState } from "react";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const originOrder = typeof location.state?.originOrder?.id === "string"
    ? location.state.originOrder
    : null;

  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{
    label: string;
    value: string;
    field?: string;
    editable?: boolean;
    type?: "text" | "checkbox";
  } | null>(null);
  const [modalInput, setModalInput] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, inventory(inventario, disponibile, in_produzione, riservato_sito)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      if (!id) throw new Error("ID mancante");

      if (["price", "inventory_policy", "status", "ean"].includes(field)) {
        return supabase.from("products").update({ [field]: value }).eq("id", id);
      }

      return supabase.from("inventory").update({ [field]: value }).eq("product_id", id);
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: ["product", id] });
      setModalState(null);
      setModalInput("");
    },
  });

  if (isLoading) return <div className="p-6 text-center text-gray-500">Caricamento...</div>;
  if (error) return <div className="p-6 text-center text-red-500">Errore: {error.message}</div>;

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
          {data.product_title}
        </h1>
        <p className="text-[clamp(0.9rem,2vw,1.2rem)] text-black/60">
          {data.variant_title}
        </p>
      </div>

      {data.image_url && (
        <div className="flex justify-center">
          <div className="rounded-3xl border border-gray-200 shadow-xl bg-white/30 backdrop-blur-md p-2">
            <img
              src={data.image_url}
              alt={data.sku}
              className="max-h-[300px] rounded-2xl object-contain"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <GlassField label="SKU" value={data.sku} />
        <GlassField label="EAN" value={data.ean} editable field="ean" />
        <GlassField label="ASIN" value={"—"} />
      </div>

      <Section label="Quantità & Magazzino" cols={2}>
        <GlassField label="Inventario" value={data.inventory?.inventario} editable field="inventario" />
        <GlassField label="Costo" value={`€ ${Number(data.cost ?? 0).toFixed(2)}`} />
        <GlassField
          label="Disponibile"
          value={data.inventory?.disponibile}
          extra={data.inventory?.in_produzione > 0 ? ` (${data.inventory.in_produzione} in arrivo)` : ""}
        />
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
        <GlassField label="Ultima Modifica" value={formatDate(data.updated_at)} />
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

            {modalState.editable && modalState.field ? (
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
                    value={modalInput ?? modalState.value}
                    onChange={(e) => setModalInput(e.target.value)}
                    className="w-full p-3 rounded text-black bg-white/70"
                  />
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => mutation.mutate({ field: modalState.field!, value: modalInput })}
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

  function GlassField({ label, value, editable, field, type = "text", extra = "" }: {
    label: string;
    value: any;
    editable?: boolean;
    field?: string;
    type?: "text" | "checkbox";
    extra?: string;
  }) {
    const isCheckbox = type === "checkbox";
    const displayValue =
      isCheckbox && typeof value === "string"
        ? value.toLowerCase() === "continue" ? "Sì" : "No"
        : value;

        const openModal = () => {
          setModalInput(String(value ?? ""));
          setModalState({ label, value: String(value ?? ""), field, editable, type });
        };

    return (
      <div
        className="p-4 rounded-xl border bg-white/60 shadow-sm backdrop-blur-md transition hover:shadow-md cursor-pointer"
        onClick={openModal}
        title={String(displayValue)}
      >
        <div className="text-xs font-semibold text-black/60 mb-1 truncate">{label}</div>
        <div className="text-sm font-bold text-black truncate">
          {displayValue || "—"}{extra}
        </div>
      </div>
    );
  }

  function Section({ label, children, cols = 2 }: { label: string; children: React.ReactNode; cols?: number }) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-black/50">{label}</h3>
        <div className={`grid grid-cols-${cols} gap-2`}>{children}</div>
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
