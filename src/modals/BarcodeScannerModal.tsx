import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

export default function BarcodeScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isMobile) return;
    const scanner = new Html5Qrcode("barcode-scanner-modal");
    scannerRef.current = scanner;
    scanningRef.current = false;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;
        onDetected(decodedText);
      },
      () => {} // non serve gestire error qui, lo puoi omettere
    );
    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onDetected, isMobile]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-2xl shadow-lg w-full max-w-md space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl"
        >
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold">Scannerizza barcode articolo</h2>
        <div
          id="barcode-scanner-modal"
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
      </div>
    </div>
  );
}
