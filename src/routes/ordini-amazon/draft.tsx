import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SearchProductModal from "../../modals/SearchProductModal";

export default function DraftGestione() {
  const [barcode, setBarcode] = useState("");
  const [foundRows, setFoundRows] = useState<any[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Rilancia la ricerca quando cambia il parametro barcode nell'URL
  useEffect(() => {
    const q = searchParams.get("barcode") || "";
    setBarcode(q);
    if (q) {
      searchArticle(q);
    } else {
      setFoundRows([]);
    }
    // eslint-disable-next-line
  }, [searchParams]);

  async function searchArticle(code: string) {
    setFoundRows([]); // reset
    if (!code) return;
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/amazon/vendor/items/by-barcode?barcode=${encodeURIComponent(code)}`
    );
    const data = await res.json();
    setFoundRows(data);
  }

  function handleScannerFound(ean: string) {
    setBarcode(ean);
    setSearchParams({ barcode: ean });
    searchArticle(ean);
    setScannerOpen(false);
  }

  function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    setSearchParams({ barcode }); // aggiorna l'URL
    searchArticle(barcode.trim());
  }

  function clearSearch() {
    setBarcode("");
    setSearchParams({});
    setFoundRows([]);
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gestione DRAFT ordini (barcode/SKU)</h1>

      {/* Pill ricerca attiva */}
      {barcode && (
        <div className="mb-2 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
            Ricerca: {barcode}
          </span>
          <button
            onClick={clearSearch}
            className="text-xs bg-gray-200 rounded px-2 py-1 hover:bg-gray-300"
          >
            Cancella
          </button>
        </div>
      )}

      {/* Ricerca manuale e scanner */}
      <div className="flex gap-2 mb-4">
        <form onSubmit={handleManualSearch} className="flex-1 flex gap-2">
          <input
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            placeholder="Cerca SKU o EAN"
            className="border rounded px-3 py-2 w-full"
          />
          <button type="submit" className="bg-cyan-700 text-white px-4 py-2 rounded">
            Cerca
          </button>
        </form>
        <button
          className="bg-gray-700 text-white px-4 py-2 rounded"
          onClick={() => setScannerOpen(true)}
        >
          Scanner
        </button>
      </div>

      <SearchProductModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcodeFound={handleScannerFound}
      />

      {/* Tabella risultati, responsive */}
      <div className="w-full overflow-x-auto rounded-xl">
        {foundRows.length === 0 ? (
          <div className="text-neutral-400 py-10">Nessun articolo trovato</div>
        ) : (
          <table className="min-w-[700px] w-full border mb-10 text-sm bg-white">
            <thead>
              <tr>
                <th className="py-2 px-1">Centro</th>
                <th className="py-2 px-1">PO</th>
                <th className="py-2 px-1">SKU</th>
                <th className="py-2 px-1">EAN</th>
                <th className="py-2 px-1">Ord.</th>
                <th className="py-2 px-1">Inserito</th>
                <th className="py-2 px-1"></th>
              </tr>
            </thead>
            <tbody>
              {foundRows.map((art, idx) => (
                <tr key={idx} className="hover:bg-blue-50 transition">
                  <td className="border px-1">{art.fulfillment_center}</td>
                  <td className="border px-1 font-mono">{art.po_number}</td>
                  <td className="border px-1 font-mono">{art.model_number}</td>
                  <td className="border px-1">{art.vendor_product_id}</td>
                  <td className="border px-1 text-right">{art.qty_ordered}</td>
                  <td className={`border px-1 text-right font-bold ${art.qty_inserted > 0 ? "text-blue-700" : "text-neutral-400"}`}>
                    {art.qty_inserted ?? 0}
                  </td>
                  <td className="border px-1 text-center">
                    <button
                      className="underline text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-100"
                      onClick={() =>
                        navigate(
                          `/ordini-amazon/dettaglio/${art.fulfillment_center}/${art.start_delivery}`,
                          {
                            state: {
                              autoOpen: {
                                po_number: art.po_number,
                                model_number: art.model_number,
                              },
                              fromDraft: true,
                              barcode, // <-- Passa sempre il barcode per tornare con la ricerca attiva!
                            },
                          }
                        )
                      }
                    >
                      Gestisci Parziale
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
