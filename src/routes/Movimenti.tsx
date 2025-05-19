import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  full_name?: string;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string;
  undone?: boolean; // 👈 AGGIUNGI QUESTA RIGA
};

export default function Movimenti() {
  const [limit, setLimit] = useState(10);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [refresh, setRefresh] = useState(0);


  const { data, isLoading, error } = useQuery({
    queryKey: ["frontend_audit_logs", limit, entityType, entityId, userFilter, refresh],
    queryFn: async () => {
      let query = supabase
        .from("frontend_audit_logs")
        .select("id, action, entity_type, entity_id, full_name, details, created_at, user_id, undone")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (entityType) query = query.eq("entity_type", entityType);
      if (entityId) query = query.eq("entity_id", entityId);
      if (userFilter) query = query.ilike("full_name", `%${userFilter}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const loadMore = () => setLimit((prev) => prev + 10);

  // 👇 Funzione per annullare movimento di SET_PRELIEVO (rimettere lo stato "from")
  async function undoSetPrelievo(log: AuditLog) {
    if (!log.details?.from) return;

    // 1. Rimetti lo stato precedente sull’ordine
    await supabase.from("orders")
      .update({ stato_ordine: log.details.from })
      .eq("id", log.entity_id);

    // 2. Marca il log come annullato
    await supabase.from("frontend_audit_logs")
      .update({ undone: true })
      .eq("id", log.id);

    setRefresh((r) => r + 1);
  }

  // 👇 Messaggio umano-friendly per ogni log
  function renderAuditDescription(log: AuditLog) {
    if (log.action === "SET_PRELIEVO" && log.entity_type === "order") {
      return (
        <>
          <span className="font-bold">{log.full_name || log.user_id}</span>{" "}
          ha cambiato lo stato dell’ordine{" "}
          <span className="font-bold">{log.details?.number || log.entity_id}</span>{" "}
          da <span className="text-red-700 font-semibold">"{log.details?.from || 'nuovo'}"</span> a{" "}
          <span className="text-green-700 font-semibold">"{log.details?.to || 'prelevato'}"</span>
        </>
      );
    }
    // Altri casi di audit "umano":
    if (log.action === "CONFIRM_PRELIEVO" && log.entity_type === "order") {
      return (
        <>
          <span className="font-bold">{log.full_name || log.user_id}</span>{" "}
          ha confermato il prelievo dell’ordine{" "}
          <span className="font-bold">{log.details?.number || log.entity_id}</span>
        </>
      );
    }
    if (log.action === "EDIT_QUANTITY" && log.entity_type === "product") {
      return (
        <>
          <span className="font-bold">{log.full_name || log.user_id}</span>{" "}
          ha cambiato la quantità del prodotto{" "}
          <span className="font-bold">{log.details?.sku || log.entity_id}</span>{" "}
          da <span className="text-red-700 font-semibold">{log.details?.from}</span> a{" "}
          <span className="text-green-700 font-semibold">{log.details?.to}</span>
        </>
      );
    }
    // Fallback generico
    return (
      <>
        <span className="font-bold">{log.full_name || log.user_id}</span>{" "}
        ha eseguito <span className="font-bold">{log.action}</span> su <span className="font-bold">{log.entity_type}</span>{" "}
        {log.details?.number || log.details?.sku || log.entity_id}
      </>
    );
  }

  return (
    <div className="p-6 text-black bg-white/90 min-h-screen space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-2">Movimenti / Audit log</h1>

      {/* Filtri */}
      <div className="flex gap-3 flex-wrap items-center text-sm mb-4">
        <input
          type="text"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder="Filtra per tipo (es. order, product)"
          className="border px-3 py-2 rounded w-40"
        />
        <input
          type="text"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          placeholder="Filtra per ID entità"
          className="border px-3 py-2 rounded w-52"
        />
        <input
          type="text"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          placeholder="Filtra per nome utente"
          className="border px-3 py-2 rounded w-48"
        />
        <button
          onClick={() => setRefresh((r) => r + 1)}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-900"
        >
          Applica filtri
        </button>
      </div>

      {/* Lista movimenti */}
      {isLoading && <div>Caricamento...</div>}
      {error && <div className="text-red-500">Errore: {error.message}</div>}
      {data?.length === 0 && <div className="text-gray-500 text-center">Nessun movimento trovato.</div>}

      <div className="space-y-4">
        {data?.map((log) => (
          <div key={log.id} className="p-4 border rounded-xl bg-gray-50/80 shadow space-y-2">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div>{renderAuditDescription(log)}</div>
              <span>{new Date(log.created_at).toLocaleString("it-IT")}</span>
            </div>
            {log.details && (
              <details>
                <summary className="cursor-pointer text-gray-500 text-xs mt-2">Dettagli tecnici</summary>
                <pre className="bg-white p-2 mt-1 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </details>
            )}
            {/* Mostra "Annulla" solo se è SET_PRELIEVO e hai il vecchio stato */}
            {log.action === "SET_PRELIEVO" && log.details?.from && (
                <div className="text-right">
                  {log.undone ? (
                    <span className="px-3 py-1 text-sm bg-red-600 text-white rounded">
                      Annullato
                    </span>
                  ) : (
                    <button
                      onClick={() => undoSetPrelievo(log)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={log.undone}
                    >
                      Annulla movimento
                    </button>
                  )}
                </div>
              )}


          </div>
        ))}
      </div>

      {/* Bottone "Carica altri" */}
      {data && data.length >= limit && (
        <div className="text-center mt-6">
          <button
            onClick={loadMore}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-900 transition"
          >
            Carica altri movimenti
          </button>
        </div>
      )}
    </div>
  );
}
