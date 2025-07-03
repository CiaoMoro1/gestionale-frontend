import { useState } from "react";
import SearchProductModal from "../../modals/SearchProductModal"; // Usalo come scanner!
import ModaleParziale from "../../components/ModaleParziale";

export default function DraftOrdini() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [modaleArticolo, setModaleArticolo] = useState<any>(null);

  // MOCK implementazioni minime (sostituisci con le vere se vuoi)
  const getParzialiStorici = () => [];
  const getResiduoInput = () => 9999;
  const aggiungiParziali = async () => {};

  // Solo UN argomento: barcode letto
  async function handleBarcodeTrovato(val: string) {
    // TODO: Sostituisci con fetch reale per la tua logica gestionale!
    setModaleArticolo({
      model_number: "SKU1234",
      vendor_product_id: val,
      qty_ordered: 10,
      po_number: "PO-TEST",
      fulfillment_center: "BGY1"
    });
    setScannerOpen(false);
  }

  return (
    <div className="max-w-xl mx-auto px-2 py-5">
      <h1 className="text-2xl font-bold mb-6 text-center">DRAFT — Prelievo Ordini</h1>

      <div className="flex justify-center mt-10 mb-10">
        <button
          className="bg-cyan-700 text-white font-bold px-8 py-4 rounded-2xl text-xl shadow hover:bg-cyan-900 transition"
          onClick={() => setScannerOpen(true)}
        >
          Scannerizza barcode
        </button>
      </div>

      {/* Qui usi SearchProductModal come scanner */}
      <SearchProductModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcodeFound={handleBarcodeTrovato}
      />

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
