import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";

type Order = {
  id: string;
  number: string;
};

export default function SearchOrderModal({
  open,
  onClose,
  orders,
}: {
  open: boolean;
  onClose: () => void;
  orders: Order[];
}) {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!open || !isMobile) return;

    const scanner = new Html5Qrcode("barcode-order-reader");
    scannerRef.current = scanner;
    scanningRef.current = false;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;

        // CERCA TRA GLI ORDINI IN PRELIEVO GIA' CARICATI!
        const order = orders.find((o) => o.number === decodedText);

        if (!order) {
          alert(`Nessun ordine in prelievo trovato per codice: ${decodedText}`);
          scanningRef.current = false;
          return;
        }

        await scanner.stop();
        onClose(); // chiudi la modale
        window.location.href = `/prelievo/${order.id}`;
      },
      (error) => {
        console.warn("Errore durante scan:", error);
      }
    );

    return () => {
      scanner.stop().catch(console.error);
    };
  }, [open, navigate, onClose, isMobile, orders]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-2xl shadow-lg w-full max-w-md space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl"
        >
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold">Scannerizza barcode ordine</h2>

        <div
          id="barcode-order-reader"
          className={`w-full h-64 rounded border flex justify-center items-center ${
            isMobile ? "" : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          {!isMobile && (
            <p className="text-center px-4">
              La fotocamera è disponibile solo da dispositivi mobili.
            </p>
          )}
        </div>

        <p className="text-center text-sm text-gray-600">
          Inquadra il barcode dell’ordine dalla stampa o PDF.<br />
          Solo gli ordini già in prelievo sono ricercabili!
        </p>
      </div>
    </div>
  );
}
