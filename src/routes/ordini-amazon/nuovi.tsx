// src\routes\ordini-amazon\nuovi.tsx



import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";

// Tipi
type PO = {
  po_number: string;
  numero_articoli: number;
};

type Riepilogo = {
  fulfillment_center: string;
  start_delivery: string;
  po_list: PO[];
  totale_articoli: number;
  stato_ordine: string;
};

export default function RiepilogoNuovi() {
  const [dati, setDati] = useState<Riepilogo[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/nuovi`)
      .then((res) => res.json())
      .then(setDati)
      .catch(console.error);
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-2 sm:p-4">
      {dati.length === 0 ? (
        <div className="text-center text-neutral-400 py-12 animate-pulse">
          Caricamento...
        </div>
      ) : (
        dati.map((group, idx) => (
          <div
            key={idx}
            className="mb-6 rounded-2xl shadow border bg-white/70 backdrop-blur-xl transition-all overflow-hidden px-2 py-3 cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-blue-200"
            onClick={() =>
              navigate(
                `/ordini-amazon/dettaglio/${group.fulfillment_center}/${group.start_delivery}`,
                { state: { from: "nuovi" } }
              )
            }
          >
            <div className="flex items-center gap-3 pb-1 px-2">
              <div className="shrink-0 flex items-center justify-center rounded-xl bg-gray-100 w-12 h-12 shadow">
                <Package className="text-blue-700" size={26} />
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-bold text-lg tracking-wide text-neutral-900 uppercase">
                  {group.fulfillment_center}
                </span>
                <span className="text-xs text-neutral-500 font-medium">
                  {group.start_delivery}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs shadow border border-white/20">
                {group.stato_ordine}
              </span>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm min-w-[270px]">
                <thead>
                  <tr>
                    <th className="py-2 pl-2 text-left font-medium text-neutral-500">PO</th>
                    <th className="py-2 text-center font-medium text-neutral-500">Articoli</th>
                  </tr>
                </thead>
                <tbody>
                  {group.po_list.map((po, i) => (
                    <tr key={i}>
                      <td className="pl-2 py-2 font-mono text-neutral-700">{po.po_number}</td>
                      <td className="py-2 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold shadow-sm">
                          {po.numero_articoli}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pl-2 pt-4 font-bold text-left text-neutral-500 uppercase tracking-wide">
                      Totale
                    </td>
                    <td className="pt-4 text-center">
                      <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-extrabold shadow-sm text-base">
                        {group.totale_articoli}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      {dati.length === 0 ? null : (
        <div className="text-xs text-center text-neutral-400 pb-8 mt-6">
          Ultimo aggiornamento: {new Date().toLocaleString()}
        </div>
      )}
    </div>
  );
}
