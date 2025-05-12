import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

type AuditLog = {
  id: string;
  table_name: string;
  row_id: string;
  action: string;
  created_at: string;
  record_data: any;
  user_id: string;
  user?: { email: string } | null;
};

export default function Movimenti() {
  const [limit, setLimit] = useState(10);
  const [tableFilter, setTableFilter] = useState("");
  const [rowIdFilter, setRowIdFilter] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit_log", limit, tableFilter, rowIdFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("id, table_name, row_id, action, created_at, record_data, source, user:user_id(email, role)")
        .eq("source", "manual")
        .order("created_at", { ascending: false })
        .limit(limit);
        query = query.eq("source", "manual");

      if (tableFilter) query = query.eq("table_name", tableFilter);
      if (rowIdFilter) query = query.eq("row_id", rowIdFilter);

      const { data, error } = await query;
      if (error) throw error;

      // forza user come oggetto, non array
      return (data ?? []).map((row: any) => ({
        ...row,
        user: Array.isArray(row.user) ? row.user[0] : row.user,
      })) as AuditLog[];
    },
  });

  const undoMutation = useMutation({
    mutationFn: async (log: AuditLog) => {
      const table = log.table_name;
      const id = log.row_id;

      if (log.action === "UPDATE") {
        return supabase.from(table).update(log.record_data).eq("id", id);
      }
      if (log.action === "DELETE") {
        return supabase.from(table).insert(log.record_data);
      }
      if (log.action === "INSERT") {
        return supabase.from(table).delete().eq("id", id);
      }
    },
    onSuccess: () => refetch(),
  });

  const loadMore = () => setLimit((prev) => prev + 10);

  return (
    <div className="p-6 text-black bg-white min-h-screen space-y-6">
      <h1 className="text-2xl font-bold text-center">Movimenti recenti</h1>

      {/* Filtri */}
      <div className="flex gap-4 flex-wrap items-center text-sm">
        <input
          type="text"
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          placeholder="Filtra per tabella (es. products)"
          className="border px-3 py-2 rounded w-full md:w-64"
        />
        <input
          type="text"
          value={rowIdFilter}
          onChange={(e) => setRowIdFilter(e.target.value)}
          placeholder="Filtra per ID riga"
          className="border px-3 py-2 rounded w-full md:w-64"
        />
        <button
          onClick={() => refetch()}
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
          <div key={log.id} className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div>
                <strong>{log.action}</strong> su <code>{log.table_name}</code> — ID: <code>{log.row_id}</code>
              </div>
              <span>{new Date(log.created_at).toLocaleString("it-IT")}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Utente:</span>{" "}
              <span className="font-medium">{log.user?.email || log.user_id}</span>
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Dati:</span>
              <pre className="bg-white p-2 mt-1 rounded text-xs overflow-auto max-h-60">
                {JSON.stringify(log.record_data, null, 2)}
              </pre>
            </div>
            {(log.action === "UPDATE" || log.action === "DELETE" || log.action === "INSERT") && (
              <div className="text-right">
                <button
                  onClick={() => undoMutation.mutate(log)}
                  disabled={undoMutation.status === "pending"}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Annulla modifica
                </button>
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
