import { useEffect, useState } from "react";
import {
  PackageCheck,
  Truck,
  Loader,
  AlertTriangle,
  CheckCircle,
  Boxes,
  PackageSearch,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type BrtEvent = {
  data: string;
  ora: string;
  id: string;
  descrizione: string;
  filiale: string;
};

type BrtTrackingMultiStatusProps = {
  parcelIds: string[];
  orderNumber?: string | number;
};

const EVENT_ICON: Record<string, React.ReactElement> = {
  CONSEGNATA: <CheckCircle className="text-green-600" size={22} />,
  "IN CONSEGNA": <Truck className="text-blue-500" size={22} />,
  RITIRATA: <PackageCheck className="text-yellow-500" size={22} />,
  PARTITA: <Loader className="text-blue-400 animate-spin" size={20} />,
};

const STATUS_COLORS: Record<string, string> = {
  CONSEGNATA: "bg-green-200 text-green-800 border-green-300",
  "IN CONSEGNA": "bg-blue-100 text-blue-800 border-blue-200",
  RITIRATA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PARTITA: "bg-blue-50 text-blue-700 border-blue-100",
};

function getStatusColor(stato: string) {
  const key = stato.toUpperCase();
  return STATUS_COLORS[key] || "bg-gray-100 text-gray-700 border-gray-200";
}

export default function BrtTrackingMultiStatus({
  parcelIds,
  orderNumber,
}: BrtTrackingMultiStatusProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parcelIds || parcelIds.length === 0) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || "";
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/brt/tracking?parcelIds=${parcelIds.join(",")}`,
          { headers }
        );
        if (!res.ok) throw new Error("Errore tracking");
        const dataJson = await res.json();
        const normalized =
          Array.isArray(dataJson.results) && dataJson.results.length > 0
            ? dataJson.results
            : Array.isArray(dataJson)
            ? dataJson
            : [dataJson];
        setResults(normalized);
        setLoading(false);
      } catch (err) {
        setError("Errore caricamento tracking BRT.");
        setLoading(false);
      }
    })();
  }, [parcelIds]);

  if (!parcelIds || parcelIds.length === 0) return null;
  if (loading)
    return (
      <div className="my-4 flex items-center gap-2 justify-center text-blue-800">
        <Loader className="animate-spin" size={20} />
        <span>Caricamento tracking BRT…</span>
      </div>
    );
  if (error)
    return (
      <div className="my-4 flex items-center gap-2 justify-center text-red-600 font-semibold">
        <AlertTriangle size={18} />
        {error}
      </div>
    );

  // Mostra SOLO la prima spedizione, ignora i duplicati
  const tracking = results[0];
  const brtData =
    tracking.tracking?.ttParcelIdResponse ??
    tracking.tracking ??
    tracking.ttParcelIdResponse ??
    tracking;

  const stato =
    brtData?.bolla?.dati_spedizione?.descrizione_stato_sped_parte1 ||
    brtData?.bolla?.dati_spedizione?.stato_sped_parte1 ||
    "Stato non disponibile";
  const events = (brtData?.lista_eventi || []).map((e: any) => e.evento) as BrtEvent[];
  const spedizioneId = brtData?.bolla?.dati_spedizione?.spedizione_id || "-";
  const terminale = brtData?.bolla?.dati_spedizione?.filiale_arrivo || "";
  const statoBadge = getStatusColor(stato);
  const consegnata = stato.toUpperCase().includes("CONSEGNATA");

  return (
    <section className="w-full max-w-md mx-auto mt-3 mb-6 px-1">
      <div className="rounded-2xl shadow bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="font-bold text-blue-900 flex gap-2 items-center text-base sm:text-lg">
            <Boxes className="inline mb-1 text-blue-400" size={22} />
            Tracking BRT
            {orderNumber && (
              <span className="ml-2 text-xs text-blue-700 font-normal bg-white rounded-lg px-2 py-1">
                Ordine #{orderNumber}
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-blue-700 truncate flex items-center gap-1">
            <PackageSearch size={16} className="text-blue-500" />
            {parcelIds.length} colli
          </div>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <span className={`px-2 py-1 rounded-lg border font-bold text-sm sm:text-base ${statoBadge}`}>
            {stato}
          </span>
          {consegnata && (
            <span className="ml-2 px-2 py-1 text-xs rounded bg-green-100 text-green-700 font-bold border border-green-200">
              CONSEGNATA
            </span>
          )}
        </div>
        <div className="text-xs text-blue-700 mb-1">
          Spedizione ID: <span className="font-semibold">{spedizioneId}</span>
        </div>
        {terminale && (
          <div className="text-xs text-blue-700 mb-2">
            Filiale arrivo: <span className="font-semibold">{terminale}</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <ol className="flex flex-col gap-0.5 mt-1">
            {events.length === 0 ? (
              <li className="text-gray-400 text-xs py-2">Nessun evento disponibile.</li>
            ) : (
              events
                .filter(ev => ev.descrizione?.trim() !== "")
                .reverse()
                .map((ev, idx) => (
                  <li key={idx} className="flex items-center gap-2 px-1 py-1">
                    <span className="flex-shrink-0 w-5">
                      {EVENT_ICON[ev.descrizione.toUpperCase()] ||
                        <Loader className="text-gray-400" size={16} />}
                    </span>
                    <span className="text-xs text-gray-700 w-20 flex-shrink-0">
                      {ev.data} {ev.ora}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        ev.descrizione === stato ? "text-blue-700" : "text-gray-800"
                      }`}
                    >
                      {ev.descrizione}
                    </span>
                    {ev.filiale && (
                      <span className="text-[10px] text-gray-400 ml-2">{ev.filiale}</span>
                    )}
                  </li>
                ))
            )}
          </ol>
        </div>
      </div>
    </section>
  );
}
