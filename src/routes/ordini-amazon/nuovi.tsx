import { useEffect, useState } from "react";
import { Package, ChevronRight } from "lucide-react";

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
    <div className="mx-auto max-w-2xl p-4 bg-gradient-to-br from-blue-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950 min-h-screen">
      {dati.length === 0 ? (
        <div className="text-center text-neutral-400 py-12 animate-pulse">Caricamento...</div>
      ) : (
        dati.map((group, idx) => (
          <div
            key={idx}
            className="mb-8 rounded-3xl shadow-xl border border-white/50 dark:border-neutral-800/60
              bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md transition-all overflow-hidden"
            style={{ boxShadow: "0 12px 40px 0 rgba(0,0,0,0.09)" }}
          >
            <div className="flex items-center gap-3 px-6 pt-6 pb-3">
              <div className="shrink-0 flex items-center justify-center rounded-2xl bg-blue-100/70 dark:bg-blue-900/30 w-12 h-12 shadow">
                <Package className="text-blue-600" size={28} />
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-[600] text-2xl sm:text-3xl tracking-wide text-neutral-900 dark:text-neutral-100 leading-tight uppercase">
                  {group.fulfillment_center}
                </span>
                <span className="text-sm text-neutral-500 font-medium pt-1">{group.start_delivery}</span>
              </div>
              <span className="px-4 py-1.5 rounded-full bg-blue-200/70 dark:bg-blue-800/60 text-blue-800 dark:text-blue-200 font-semibold text-xs shadow border border-white/30">
                {group.stato_ordine}
              </span>
            </div>
            <div className="overflow-x-auto pb-3">
              <table className="w-full text-base min-w-[320px]">
                <thead>
                  <tr>
                    <th className="py-3 pl-6 text-left font-medium text-neutral-600 dark:text-neutral-300 tracking-wide">PO</th>
                    <th className="py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">Articoli</th>
                  </tr>
                </thead>
                <tbody>
                  {group.po_list.map((po, i) => (
                    <tr
                      key={i}
                      className="hover:bg-white/30 dark:hover:bg-neutral-800/40 transition-all"
                    >
                      <td className="pl-6 py-2 font-mono text-lg text-neutral-800 dark:text-neutral-100">
                        {po.po_number}
                      </td>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-100/70 dark:bg-neutral-800/80 text-blue-900 dark:text-blue-200 font-semibold shadow text-lg">
                          {po.numero_articoli}
                          <ChevronRight size={16} className="text-neutral-300 dark:text-neutral-600" />
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-white/50 dark:bg-neutral-900/60 border-t border-white/30 dark:border-neutral-800/40">
                    <td className="pl-6 py-2 font-bold text-right text-neutral-500 text-lg uppercase tracking-wide">
                      Totale
                    </td>
                    <td className="py-2 font-extrabold text-blue-700 dark:text-blue-400 text-xl">
                      {group.totale_articoli}
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
