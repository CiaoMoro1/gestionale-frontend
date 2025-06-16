import { X, Download, Printer } from "lucide-react";
import { supabase } from "../lib/supabase";

interface ModalPDFLabelProps {
  open: boolean;
  onClose: () => void;
  pdfBase64: string;
  orderNumber?: string;
  orderId?: string; // <--- Serve per cambiare stato ordine
}

export default function ModalPDFLabel({
  open,
  onClose,
  pdfBase64,
  orderNumber,
  orderId,
}: ModalPDFLabelProps) {
  if (!open) return null;

  const blob = new Blob(
    [Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))],
    { type: "application/pdf" }
  );
  const url = URL.createObjectURL(blob);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `Etichetta_${orderNumber || "spedizione"}.pdf`;
    a.click();
    // Non revocare qui: serve anche per iframe/print
    // URL.revokeObjectURL(url); 
  };

  const handlePrint = async () => {
    // Aggiorna stato ordine a "etichette" su Supabase (se presente orderId)
    if (orderId) {
      try {
        await supabase
          .from("orders")
          .update({ stato_ordine: "etichette" })
          .eq("id", orderId);
      } catch (e) {
        // (opzionale) puoi mostrare una notifica o loggare l’errore
        // alert("Errore aggiornamento stato ordine!");
      }
    }
    // Apre il PDF in una nuova finestra e lancia la stampa
    const win = window.open(url, "_blank");
    if (win) {
      win.focus();
      setTimeout(() => {
        win.print();
      }, 400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="relative bg-white rounded-xl shadow-lg max-w-3xl w-full flex flex-col items-center">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-gray-200 hover:bg-gray-300 rounded-full p-1"
        >
          <X size={24} />
        </button>
        <div className="p-4 w-full h-[80vh] flex flex-col">
          <iframe
            src={url}
            title="Etichetta PDF"
            className="flex-1 w-full rounded mb-4 border"
            style={{ minHeight: 400 }}
          />
          <div className="flex gap-4 justify-center">
            <button
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl px-4 py-2 font-semibold"
              onClick={handlePrint}
            >
              <Printer size={18} /> Stampa
            </button>
            <button
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 font-semibold"
              onClick={handleDownload}
            >
              <Download size={18} /> Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
