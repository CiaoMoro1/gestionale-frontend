import { useEffect, useState } from "react";
import { Package } from "lucide-react";

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

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/riepilogo/nuovi`)
      .then((res) => res.json())
      .then(setDati)
      .catch(console.error);
  }, []);

  return (
    <div>
      {dati.length === 0 ? (
        <div className="text-center text-neutral-400 py-12 animate-pulse">Caricamento...</div>
      ) : (
        dati.map((group, idx) => (
          <div
            key={idx}
            className="mb-10 rounded-[2rem] shadow-xl border border-white/40 bg-white/60 backdrop-blur-lg
              transition-all overflow-hidden px-4 py-4"
            style={{
              boxShadow: "0 8px 36px 0 rgba(40,55,90,0.08)",
              maxWidth: "100%",
              minWidth: 0
            }}
          >
            <div className="flex items-center gap-4 pb-2">
              <div className="shrink-0 flex items-center justify-center rounded-xl bg-gray-100 w-14 h-14 shadow">
                <Package className="text-gray-700" size={32} />
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-bold text-2xl tracking-wide text-neutral-900 uppercase">
                  {group.fulfillment_center}
                </span>
                <span className="text-sm text-neutral-500 font-medium pt-0.5">
                  {group.start_delivery}
                </span>
              </div>
              <span className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 font-semibold text-xs shadow border border-white/20">
                {group.stato_ordine}
              </span>
            </div>
            <div className="w-full overflow-x-hidden">
              <table className="w-full text-lg min-w-[300px]">
                <thead>
                  <tr>
                    <th className="py-3 pl-2 text-left font-medium text-neutral-500">PO</th>
                    <th className="py-3 text-left font-medium text-neutral-500">Articoli</th>
                  </tr>
                </thead>
                <tbody>
                {group.po_list.map((po, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-all">
                    <td className="pl-2 py-2 font-mono text-neutral-800">{po.po_number}</td>
                    <td className="py-2">
                        <span className="inline-block px-3 py-1 rounded-full bg-white/90 text-gray-800 font-semibold shadow-sm text-lg">
                        {po.numero_articoli}
                        </span>
                    </td>
                    </tr>
                ))}
                {/* Riga totale perfettamente sotto */}
                <tr>
                    <td className="pl-2 pt-6 font-bold text-left text-neutral-500 uppercase tracking-wide align-top">
                    Totale
                    </td>
                    <td className="pt-6 text-center align-top">
                    <span className="inline-block px-3 py-1 rounded-full bg-white/90 text-gray-800 font-extrabold shadow-sm text-xl">
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
