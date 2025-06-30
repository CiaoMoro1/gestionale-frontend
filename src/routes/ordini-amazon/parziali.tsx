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
};

export default function ParzialiOrdini() {
  const [riepiloghi, setRiepiloghi] = useState<Riepilogo[]>([]);
  const [articoli, setArticoli] = useState<{ [id: number]: Articolo[] }>({});
  const [parziali, setParziali] = useState<{ [id: number]: Parziale[] }>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // CARICA DATI ORDINI PARZIALI
  useEffect(() => {
    async function load() {
      setLoading(true);
      const rieps = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/parziali`
      ).then((r) => r.json());
      setRiepiloghi(rieps);

      for (const r of rieps) {
        // Articoli
        fetch(
          `${import.meta.env.VITE_API_URL}/api/amazon/vendor/items?po_list=${r.po_list.join(",")}`
        )
          .then((r) => r.json())
          .then((arr: Articolo[]) => {
            setArticoli((old) => ({ ...old, [r.id]: arr }));
          });
        // Parziali confermati
        fetch(
          `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali?riepilogo_id=${r.id}`
        )
          .then((r) => r.json())
          .then((arr: Parziale[]) => {
            setParziali((old) => ({
              ...old,
              [r.id]: arr.filter((p) => p.confermato),
            }));
          });
      }
      setLoading(false);
    }
    load();
  }, []);

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

  return (
    <div className="max-w-4xl mx-auto py-6 px-2 md:px-6">
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
          {/* Header Card */}
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
                  const qtyConf = getQtyConfirmedPerPo(po, parziali[riep.id] || []);
                  const qtyOrd = articoliPO.reduce((sum, x) => sum + (x.qty_ordered || 0), 0);
                  const full = qtyConf === qtyOrd && qtyOrd > 0;
                  return (
                    <tr
                      key={po}
                      className="border-t text-xs md:text-base"
                    >
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
          {/* PARZIALI */}
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
                    className="flex flex-row items-center justify-between py-1 gap-3 whitespace-nowrap text-[15px]"
                    style={{ minWidth: 0 }}
                    >
                    <span className="text-blue-700 font-bold min-w-[80px]">
                        {idx + 1}° Parziale
                    </span>
                    <span className="text-xs text-gray-400 min-w-[105px]">
                        {formatDate(p.created_at)}
                    </span>
                    <span className="flex-1 flex items-center justify-end">
                        <VisualizzaParzialeModal
                            dati={typeof p.dati === "string" ? JSON.parse(p.dati) : p.dati}
                         />

                    </span>
                    </div>
                ))}
                {/* Bottone Aggiungi Parziale */}
                <div className="flex mt-4">
                    <button
                    className="bg-blue-600 text-white rounded-full px-4 py-2 font-semibold shadow hover:bg-blue-800 transition mx-auto flex items-center gap-2 text-base md:text-lg"
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
                </div>
            </div>
        </div>
      ))}
    </div>
  );
}
