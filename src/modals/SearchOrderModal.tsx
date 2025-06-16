import { useEffect, useRef } from "react";
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

  useEffect(() => {
    if (!open || !isMobile) return;
    const scanner = new Html5Qrcode("barcode-order-reader");
    scannerRef.current = scanner;
    scanningRef.current = false;
    scanner.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: 250 }, // uguale ai prodotti!
      async (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;
        const order = orders.find((o) => o.number === decodedText);
        if (!order) {
          alert(`Nessun ordine in prelievo trovato per codice: ${decodedText}`);
          scanningRef.current = false;
          return;
        }
        await scanner.stop();
        onClose();
        window.location.href = `/prelievo/${order.id}`;
      },
      () => {}
    );
    return () => {
      scanner.stop().catch(() => {});
    };
  }, [open, onClose, orders, isMobile]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        {/* Chiudi */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        ><X size={22} /></button>
        <h2 className="text-lg font-bold text-gray-900 text-center">Scannerizza ordine</h2>

        <div
          className="
            relative w-full aspect-square max-w-[320px]
            flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
        >
          {/* Video camera */}
          <div
            id="barcode-order-reader"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay bordo */}
          <div
            className="absolute inset-0 pointer-events-none border-2 border-cyan-400/80 rounded-xl animate-pulse"
            style={{ boxShadow: "0 0 24px 0 #06b6d433" }}
          ></div>
        </div>

        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra il barcode <br />
          <span className="text-cyan-700 font-semibold">restando dentro il riquadro</span>
        </p>
        <div className="text-center text-xs text-gray-500 mt-1">
          Solo gli ordini già in prelievo sono ricercabili.
        </div>
        <button
          onClick={onClose}
          className="mt-2 text-cyan-700 font-semibold hover:underline text-sm transition"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
