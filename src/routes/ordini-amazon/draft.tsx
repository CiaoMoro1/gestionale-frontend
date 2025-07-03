import { useState } from "react";
import SearchProductModal from "../../modals/SearchProductModal";
import ModaleParziale from "../../components/ModaleParziale";

type CentroRiga = {
  fulfillment_center: string;
  po_number: string;
  qty_ordered: number;
};

type CentriInfo = {
  model_number: string;
  vendor_product_id: string;
  righe: CentroRiga[];
};

export default function DraftOrdini() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [centriInfo, setCentriInfo] = useState<CentriInfo | null>(null);
  const [modaleArticolo, setModaleArticolo] = useState<any>(null);

  // Funzioni "mock" da sostituire con quelle reali se vuoi
  const getParzialiStorici = () => [];
  const getResiduoInput = () => 9999;
  const aggiungiParziali = async () => {};

  // Callback dopo lettura barcode
  async function handleBarcodeTrovato(barcode: string) {
    setScannerOpen(false);
    setModaleArticolo(null);
    setCentriInfo(null);

    // Chiamata al backend (API Flask)
    const res = await fetch(
      `/api/amazon/vendor/draft-barcode?ean=${encodeURIComponent(barcode)}`
    );
    if (!res.ok) {
      alert("Articolo non trovato!");
      return;
    }
    const info = await res.json();
    setCentriInfo(info);
  }

  return (
    <div className="max-w-xl mx-auto px-2 py-5">
      <h1 className="text-2xl font-bold mb-6 text-center">DRAFT — Prelievo Ordini</h1>

      {/* Bottone scanner */}
      <div className="flex justify-center mt-10 mb-10">
        <button
          className="bg-cyan-700 text-white font-bold px-8 py-4 rounded-2xl text-xl shadow hover:bg-cyan-900 transition"
          onClick={() => {
            setCentriInfo(null);
            setScannerOpen(true);
            setModaleArticolo(null);
          }}
        >
          Scannerizza barcode
        </button>
      </div>

      {/* Modale scanner */}
      <SearchProductModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcodeFound={handleBarcodeTrovato}
      />

      {/* Tabella centri/PO trovati */}
      {centriInfo && (
        <div className="bg-white rounded-xl shadow p-4 my-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-bold text-lg">
                ARTICOLO: {centriInfo.model_number}
              </h2>
              <div className="text-sm text-gray-600">
                EAN: {centriInfo.vendor_product_id}
              </div>
            </div>
            <button
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs"
              onClick={() => setCentriInfo(null)}
            >
              Nuova scansione
            </button>
          </div>
          <table className="w-full border mt-2 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-3 py-2 text-left">Centro</th>
                <th className="px-3 py-2 text-center">Quantità</th>
                <th className="px-3 py-2 text-center">PO</th>
                <th className="px-3 py-2 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {centriInfo.righe.map((riga, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-3 py-2">{riga.fulfillment_center}</td>
                  <td className="px-3 py-2 text-center">{riga.qty_ordered}</td>
                  <td className="px-3 py-2 text-center">{riga.po_number}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      className="px-3 py-1 bg-cyan-700 text-white rounded-lg hover:bg-cyan-900 text-sm"
                      onClick={() =>
                        setModaleArticolo({
                          model_number: centriInfo.model_number,
                          vendor_product_id: centriInfo.vendor_product_id,
                          po_number: riga.po_number,
                          qty_ordered: riga.qty_ordered,
                          fulfillment_center: riga.fulfillment_center,
                        })
                      }
                    >
                      Gestisci parziali
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale gestione parziali */}
      {modaleArticolo && (
        <ModaleParziale
          articolo={modaleArticolo}
          onClose={() => setModaleArticolo(null)}
          getParzialiStorici={getParzialiStorici}
          getResiduoInput={getResiduoInput}
          aggiungiParziali={aggiungiParziali}
        />
      )}
    </div>
  );
}
