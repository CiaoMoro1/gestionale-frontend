import { useEffect, useState } from "react";
import { Package, CheckCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import VisualizzaParzialeModal from "../../components/VisualizzaParzialeModal";

type Riepilogo = {
  id: number;
  fulfillment_center: string;
  start_delivery: string;
  po_list: string[];
  stato_ordine: string;
};

type Parziale = {
  numero_parziale: number;
  confermato: boolean;
  created_at: string;
  gestito?: boolean;
  dati: {
    model_number: string;
    quantita: number;
    collo: number;
    po_number: string;
  }[];
};

type Articolo = {
  po_number: string;
  model_number: string;
  qty_ordered: number;
  qty_confirmed: number;
  cost?: number | string;  // <-- aggiungi questa riga!
};

export default function ParzialiOrdini() {
  const [riepiloghi, setRiepiloghi] = useState<Riepilogo[]>([]);
  const [articoli, setArticoli] = useState<{ [id: number]: Articolo[] }>({});
  const [parziali, setParziali] = useState<{ [id: number]: Parziale[] }>({});
  const [loading, setLoading] = useState(true);
  const [closingOrderId, setClosingOrderId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rieps = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/parziali`
      ).then((r) => r.json());
      setRiepiloghi(rieps);

      await Promise.all(
        rieps.map(async (r: Riepilogo) => {
          const articoliArr = await fetchAllItemsByPO(r.po_list);
          setArticoli((old) => ({ ...old, [r.id]: articoliArr }));

          const parzArr = await fetch(
            `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali?riepilogo_id=${r.id}`
          ).then((r) => r.json());
          setParziali((old) => ({
            ...old,
            [r.id]: parzArr.filter((p: Parziale) => p.confermato),
          }));
        })
      );

      setLoading(false);
    }
    load();
  }, []);


function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function fetchAllItemsByPO(po_list: string[]) {
  let all: Articolo[] = [];
  const BATCH_SIZE = 10; // stesso valore del backend!
  const MAX_BATCHES = 100; // sicurezza: max 20.000 righe (10x200x100)
  const poGroups = chunkArray(po_list, BATCH_SIZE);

  for (const group of poGroups) {
    let offset = 0;
    const limit = 200;
    let batchCount = 0;
    while (batchCount < MAX_BATCHES) {
      const url = `${import.meta.env.VITE_API_URL}/api/amazon/vendor/items?po_list=${group.join(",")}&offset=${offset}&limit=${limit}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < limit) break;
      offset += limit;
      batchCount += 1;
    }
  }
  // Deduplica finale
  const seen = new Set();
  all = all.filter(item => {
    const key = `${item.po_number}|${item.model_number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return all;
}



  function getQtyConfirmedPerPo(po_number: string, parz: Parziale[]) {
    let tot = 0;
    for (const p of parz) {
      for (const r of p.dati) {
        if (r.po_number === po_number) tot += r.quantita;
      }
    }
    return tot;
  }

  function formatDate(dt: string) {
    if (!dt) return "";
    const d = new Date(dt);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`;
  }

  async function handleToggleGestito(
    riepilogoId: number,
    numeroParziale: number,
    statoAttuale?: boolean
  ) {
    const nuovoStato = !statoAttuale;

    await fetch(
      `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali/gestito`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riepilogo_id: riepilogoId,
          numero_parziale: numeroParziale,
          gestito: nuovoStato,
        }),
      }
    );

    setParziali((prev) => {
      const aggiornati = { ...prev };
      aggiornati[riepilogoId] = aggiornati[riepilogoId].map((p) =>
        p.numero_parziale === numeroParziale ? { ...p, gestito: nuovoStato } : p
      );
      return aggiornati;
    });
  }

  // --- NUOVO: chiusura ordine senza reload ---
  async function chiudiOrdine(riep: Riepilogo) {
    setClosingOrderId(riep.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip/chiudi`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            center: riep.fulfillment_center,
            data: riep.start_delivery,
          }),
        }
      );
      if (!res.ok) throw new Error("Errore chiusura ordine");

      // Aggiorna stato locale: rimuovi l’ordine dalla lista, togli i suoi parziali/articoli
      setRiepiloghi((old) => old.filter((x) => x.id !== riep.id));
      setParziali((old) => {
        const copy = { ...old };
        delete copy[riep.id];
        return copy;
      });
      setArticoli((old) => {
        const copy = { ...old };
        delete copy[riep.id];
        return copy;
      });
      setSuccessMsg("Ordine chiuso con successo!");
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err: any) {
      alert("Errore durante la chiusura ordine: " + (err.message || err));
    } finally {
      setClosingOrderId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-2 md:px-6">
      {/* Toast di successo */}
      {successMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-100 text-green-800 font-bold rounded shadow z-50">
          {successMsg}
        </div>
      )}

      <h1 className="text-xl md:text-2xl font-bold mb-6 tracking-tight text-gray-800">
        Ordini Parziali
      </h1>

      {loading && (
        <div className="text-center py-10 text-blue-700 text-lg font-semibold">
          Caricamento...
        </div>
      )}

      {!loading && riepiloghi.length === 0 && (
        <div className="text-neutral-400 text-lg text-center">
          Nessun ordine parziale.
        </div>
      )}

      {riepiloghi.map((riep) => (
        <div
          key={riep.id}
          className="bg-white rounded-2xl shadow p-4 md:p-7 mb-10 flex flex-col"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-2">
            <div>
              <div className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Package className="text-blue-600" size={24} />
                <span className="break-all">{riep.fulfillment_center}</span>
              </div>
              <div className="text-xs text-gray-500">{riep.start_delivery}</div>
            </div>
            <span
              className={`px-3 py-1 rounded-xl text-xs md:text-sm font-semibold shadow-sm mt-2 md:mt-0 ${
                riep.stato_ordine === "parziale"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {riep.stato_ordine}
            </span>
          </div>

          {/* Tabella PO */}
          <div className="w-full overflow-x-auto">
            <table className="w-full mb-4 min-w-[320px]">
              <thead>
                <tr className="text-xs md:text-sm text-gray-700">
                  <th className="text-left p-1">PO</th>
                  <th className="text-center p-1">Confermati</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(riep.po_list || []).map((po) => {
                  const listaArticoli = articoli[riep.id] || [];
                  const articoliPO = listaArticoli.filter(
                    (a) => a.po_number === po
                  );
                  const qtyConf = getQtyConfirmedPerPo(
                    po,
                    parziali[riep.id] || []
                  );
                  const qtyOrd = articoliPO.reduce(
                    (sum, x) => sum + (x.qty_ordered || 0),
                    0
                  );
                  const full = qtyConf === qtyOrd && qtyOrd > 0;

                  return (
                    <tr key={po} className="border-t text-xs md:text-base">
                      <td className="p-1 font-mono break-all">{po}</td>
                      <td
                        className={`p-1 text-center font-bold ${
                          full ? "text-green-600" : "text-blue-700"
                        }`}
                      >
                        {qtyConf}/{qtyOrd}
                        {full && (
                          <span className="ml-2 text-green-600">
                            <CheckCircle size={15} />
                          </span>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>


{(() => {
  // Prendi solo gli articoli validi per i PO dell’ordine
  const listaArticoli = articoli[riep.id] || [];
  const articoliFiltrati = listaArticoli.filter(a => riep.po_list.includes(a.po_number) && (a.qty_ordered || 0) > 0);

  // Calcola valore ordinato solo su questi
  const valoreOrdinato = articoliFiltrati.reduce(
    (sum, x) => sum + ((x.qty_ordered || 0) * (Number(x.cost) || 0)), 0
  );

  // Map per costo lookup
  const costoArticoloMap = new Map<string, number>();
  articoliFiltrati.forEach(x => {
    costoArticoloMap.set(`${x.po_number}|${x.model_number}`, Number(x.cost) || 0);
  });

  // Calcola valore confermato su tutti i parziali
  const listaParziali = parziali[riep.id] || [];
  let valoreConfermato = 0;
  for (const parz of listaParziali) {
    const dati = typeof parz.dati === "string" ? JSON.parse(parz.dati) : parz.dati;
    for (const r of dati) {
      const key = `${r.po_number}|${r.model_number}`;
      valoreConfermato += (r.quantita || 0) * (costoArticoloMap.get(key) || 0);
    }
  }

  const percCosto = valoreOrdinato > 0 ? Math.min(Math.round((valoreConfermato / valoreOrdinato) * 100), 100) : 0;

  // Debug se vuoi
  // console.log('PO:', riep.po_list, 'Articoli filtrati:', articoliFiltrati, 'Ordinato:', valoreOrdinato, 'Confermato:', valoreConfermato);

  return articoliFiltrati.length > 0 && valoreOrdinato > 0 && (
    <div className="my-3">
      <div className="flex items-center justify-between mb-1 text-xs text-gray-600">
        <span>
          Valore ordinato: <span className="text-blue-700 font-bold">€ {valoreOrdinato.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
        </span>
        <span>
          Valore confermato: <span className="text-green-700 font-bold">€ {valoreConfermato.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
        </span>
      </div>
      <div className="relative w-full h-5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-5 rounded-full bg-green-500 transition-all"
          style={{ width: `${percCosto}%` }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
          {percCosto}%
        </div>
      </div>
      {valoreOrdinato === 0 && (
        <div className="text-xs text-red-500 mt-2">
          Attenzione: alcuni PO potrebbero non avere articoli validi con costo o quantità ordinata.
        </div>
      )}
    </div>
  );
})()}

          {/* Lista Parziali */}
          <div className="border-t pt-3 mt-3">
            <div className="font-bold mb-1 text-base md:text-lg">
              Parziali già creati
            </div>
            {parziali[riep.id]?.length === 0 && (
              <div className="text-gray-400 text-sm">
                Nessun parziale ancora confermato
              </div>
            )}
            {(parziali[riep.id] || []).map((p, idx) => (
              <div
                key={p.numero_parziale}
                className="py-3 border-b border-gray-100 text-[15px]"
              >
                {/* Riga 1: numero parziale + data */}
                <div className="grid grid-cols-2">
                  <span className="text-blue-700 font-bold">
                    {idx + 1}° Parziale
                  </span>
                  <span className="text-xs text-gray-400 text-right">
                    {formatDate(p.created_at)}
                  </span>
                </div>

                {/* Riga 2: Gestito + Visualizza */}
                <div className="grid grid-cols-2 mt-2">
                  <button
                    onClick={() =>
                      handleToggleGestito(
                        riep.id,
                        p.numero_parziale,
                        p.gestito
                      )
                    }
                    className={`px-2 py-1 rounded-full text-xs font-bold w-fit transition ${
                      p.gestito
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    }`}
                    title="Segna come gestito/non gestito"
                  >
                    {p.gestito ? "Gestito: SÌ" : "Gestito: NO"}
                  </button>

                  <div className="text-right">
                    <VisualizzaParzialeModal
                      dati={
                        typeof p.dati === "string" ? JSON.parse(p.dati) : p.dati
                      }
                      center={riep.fulfillment_center}
                      numeroParziale={p.numero_parziale}
                      data={riep.start_delivery}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Azioni finali */}
            <div className="flex justify-center gap-4 mt-4">
              <button
                className="bg-blue-600 text-white rounded-full px-4 py-2 font-semibold shadow hover:bg-blue-800 transition flex items-center gap-2 text-base md:text-lg"
                onClick={() =>
                  navigate(
                    `/ordini-amazon/dettaglio/${riep.fulfillment_center}/${riep.start_delivery}?numero_parziale=next`,
                    { state: { from: "parziali" } }
                  )
                }
              >
                <Plus size={20} />
                <span>Aggiungi Parziale</span>
              </button>

              <button
                className={`bg-green-600 text-white font-bold rounded-full px-4 py-2 text-base md:text-lg shadow-lg transition flex items-center gap-2 ${
                  !parziali[riep.id] || parziali[riep.id].length === 0
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-green-700"
                }`}
                disabled={
                  !parziali[riep.id] ||
                  parziali[riep.id].length === 0 ||
                  closingOrderId === riep.id
                }
                onClick={() => {
                  if (
                    window.confirm("Sei sicuro di voler chiudere l’ordine?")
                  ) {
                    chiudiOrdine(riep);
                  }
                }}
                title="Chiudi Ordine (tutte le quantità devono essere confermate)"
              >
                {closingOrderId === riep.id ? (
                  <span className="animate-pulse">Chiusura...</span>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    <span>Chiudi Ordine</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}