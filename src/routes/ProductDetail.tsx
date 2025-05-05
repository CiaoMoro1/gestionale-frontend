import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useState } from "react";

export default function ProductDetail() {
  const { id } = useParams();
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
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      const { error } = await supabase.from("products").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: ["product", id] });
      setModalState(null);
      setModalInput("");
    },
  });

  if (isLoading) return <div className="p-6 text-blue-500 text-center">Caricamento...</div>;
  if (error) return <div className="p-6 text-red-500">Errore: {error.message}</div>;

  return (
    <div className="p-4 space-y-6 rounded-3xl border text-white bg-gradient-to-b from-blue-900 to-blue-300 min-h-screen">
      {/* Titolo */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white/90">{data.product_title}</h1>
        <p className="text-sm text-white/50">{data.variant_title}</p>
      </div>

      {/* Immagine */}
      {data.image_url && (
        <div className="flex justify-center">
          <div className="inline-block rounded-3xl border border-white/20 shadow-xl backdrop-blur bg-white/5 p-2">
            <img
              src={data.image_url}
              alt={data.sku}
              className="max-h-[300px] rounded-3xl object-contain"
            />
          </div>
        </div>
      )}



      {/* Info principali */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <GlassField label="SKU" value={data.sku} />
        <GlassField label="EAN" value={data.ean} editable field="ean" />
      </div>

      {/* Info tecniche */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <GlassField label="Prezzo" value={`€ ${Number(data.price ?? 0).toFixed(2)}`} editable field="price" />
        <GlassField label="Quantità" value={data.quantity} editable field="quantity" />

        {/* Checkbox editabile */}
        <GlassField
  label="Vendi Sempre"
  value={data.inventory_policy}
  editable
  field="inventory_policy"
  type="checkbox"
/>

        <GlassField label="Ultima modifica" value={formatDate(data.updated_at)} />
      </div>

      {/* Modal dinamico fluttuante */}
      {modalState && (
  <div
    onClick={() => setModalState(null)}
    className="fixed inset-0 z-10 bg-black/40 flex items-center justify-center backdrop-blur-sm"
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-gradient-to-b from-blue-900 to-blue-300 text-white border rounded-3xl p-6 shadow-xl w-[90%] max-w-xl relative"
    >
      <button
        onClick={() => setModalState(null)}
        className="absolute top-2 right-3 text-white text-xl"
      >
        ×
      </button>

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
              className="w-6 h-6 accent-green-500 cursor-pointer"
            />
            <span className="text-lg">
              {modalState.value.toLowerCase() === "continue" ? "Attivo" : "Disattivo"}
            </span>
          </div>
        ) : (
          <>
            <input
              value={modalInput || modalState.value}
              onChange={(e) => setModalInput(e.target.value)}
              className="w-full p-3 rounded text-black bg-white/50"
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  mutation.mutate({
                    field: modalState.field!,
                    value: modalInput,
                  });
                }}
                className="bg-white/90 text-blue-700 font-semibold px-4 py-2 rounded hover:bg-blue-100"
              >
                Salva
              </button>
            </div>
          </>
        )
      ) : (
        <div className="text-lg text-white whitespace-pre-wrap">{modalState.value}</div>
      )}
    </div>
  </div>
)}

    </div>
  );

  function GlassField({
    label,
    value,
    editable,
    field,
    type = "text",
  }: {
    label: string;
    value: any;
    editable?: boolean;
    field?: string;
    type?: "text" | "checkbox";
  }) {
    const isCheckbox = type === "checkbox";
    const displayValue =
      isCheckbox && typeof value === "string"
        ? value.toLowerCase() === "continue"
          ? "Sì"
          : "No"
        : value;
  
    const openModal = () => {
      setModalState({
        label,
        value: String(value),
        field,
        editable,
        type,
      });
    };
  
    return (
      <div
        className="p-4 rounded-xl border border-white/90 backdrop-blur bg-white/50 shadow flex justify-between items-start cursor-pointer hover:ring-2 hover:ring-white/50 transition"
        onClick={openModal}
      >
        <div className="flex-1 min-w-0">
          <div className="text-black mb-1 truncate text-[clamp(1.3rem,2.5vw,1.5rem)]">
            {label}
          </div>
          <div className="truncate text-[clamp(1rem,2vw,1.2rem)] text-black">
            {displayValue !== undefined && displayValue !== null && displayValue !== "" ? displayValue : "—"}
          </div>
        </div>
        {editable && field && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModalState({ label, value: String(value), field, editable, type });
            }}
            className="text-sm text-blue-700 hover:text-blue-900 mt-1"
          >
            🛠
          </button>
        )}
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
