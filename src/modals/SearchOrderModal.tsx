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
    const scanner = new Html5Qrcode("barcode-order-video-box");
    scannerRef.current = scanner;
    scanningRef.current = false;
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 80 } }, // rettangolo azzurro, area centrale
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
      <div className="relative w-full max-w-sm mx-auto px-3 py-5 rounded-3xl bg-white/80 shadow-2xl border border-gray-200 flex flex-col items-center gap-4">
        {/* Chiudi */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded transition"
          aria-label="Chiudi"
        >
          <X size={26} />
        </button>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-1 tracking-tight">
          Scannerizza ordine
        </h2>
        <p className="text-gray-500 text-sm text-center mb-2">
          Allinea il barcode dell’ordine dentro il riquadro azzurro e attendi la lettura.
        </p>
        <div
          className={`
            relative flex items-center justify-center
            w-full h-28 sm:h-32
            rounded-2xl bg-gray-100/70 border border-gray-300
            shadow-inner overflow-hidden
          `}
          style={{ minHeight: 112, maxWidth: 320 }}
        >
          <div
            id="barcode-order-video-box"
            className="w-full h-full object-cover"
          />
          {/* Overlay riquadro animato */}
          <div
            className="absolute inset-0 pointer-events-none border-2 border-cyan-500/90 rounded-2xl animate-pulse"
            style={{ boxShadow: "0 0 24px 0 #06b6d422" }}
          ></div>
          {/* Corners luminosi */}
          <div className="absolute left-0 top-0 w-5 h-5 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg pointer-events-none" />
          <div className="absolute right-0 top-0 w-5 h-5 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg pointer-events-none" />
          <div className="absolute left-0 bottom-0 w-5 h-5 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg pointer-events-none" />
          <div className="absolute right-0 bottom-0 w-5 h-5 border-b-4 border-r-4 border-cyan-400 rounded-br-lg pointer-events-none" />
          {/* Desktop info */}
          {!isMobile && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 text-gray-400 text-base font-medium z-10 rounded-2xl">
              <span>Usa uno smartphone per attivare la fotocamera</span>
            </div>
          )}
        </div>
        <div className="text-center text-xs text-gray-500 mt-1">
          Solo gli ordini già in prelievo sono ricercabili.
        </div>
        <button
          onClick={onClose}
          className="mt-2 text-cyan-700 font-semibold hover:underline text-sm transition"
        >
          Chiudi senza leggere
        </button>
      </div>
    </div>
  );
}
