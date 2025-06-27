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
    <div className="mx-auto max-w-[750px] p-2 sm:p-4 md:p-8">
      {dati.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 animate-pulse">Caricamento...</div>
      ) : (
        dati.map((group, idx) => (
          <div
            key={idx}
            className="mb-8 rounded-2xl shadow-sm border bg-white dark:bg-neutral-950 flex flex-col gap-2"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-4 pt-4 pb-2">
              <div className="flex items-center gap-2 flex-1">
                <Package className="text-blue-600 shrink-0" size={30} />
                <span className="text-xl sm:text-2xl font-bold uppercase tracking-wide">{group.fulfillment_center}</span>
                <span className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold">
                  {group.stato_ordine}
                </span>
              </div>
              <span className="text-base sm:text-lg text-neutral-500 font-medium">
                {group.start_delivery}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm sm:text-base min-w-[320px] md:min-w-[500px]">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pl-4 text-left font-medium text-neutral-500">PO</th>
                    <th className="py-2 text-left font-medium text-neutral-500">Numero Articoli</th>
                    <th className="py-2 text-left font-medium text-neutral-500 min-w-[80px]">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {group.po_list.map((po, i) => (
                    <tr
                      key={i}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
                    >
                      <td className="pl-4 py-2 font-mono text-[15px] sm:text-base">
                        {po.po_number}
                      </td>
                      <td className="py-2 font-semibold text-base text-blue-800 dark:text-blue-300">
                        <span className="inline-block px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {po.numero_articoli}
                        </span>
                        <ChevronRight size={16} className="inline ml-1 text-neutral-300 dark:text-neutral-600" />
                      </td>
                      <td className="py-2">
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs uppercase">
                          {group.stato_ordine}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-neutral-50 dark:bg-neutral-900">
                    <td className="pl-4 py-2 font-bold text-right uppercase text-neutral-500">Totale</td>
                    <td className="py-2 font-extrabold text-black dark:text-blue-400 text-lg sm:text-xl">
                      {group.totale_articoli}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      {dati.length === 0 ? null : (
        <div className="text-xs text-center text-neutral-400 pb-8">
          Ultimo aggiornamento: {new Date().toLocaleString()}
        </div>
      )}
    </div>
  );
}
