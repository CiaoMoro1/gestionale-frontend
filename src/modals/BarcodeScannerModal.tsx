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
  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isMobile) return;
    const scanner = new Html5Qrcode("barcode-scanner-video-box");
    scannerRef.current = scanner;
    scanningRef.current = false;
    scanner.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: 250 }, // stesso "full box" degli altri modali!
      (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;
        onDetected(decodedText);
      },
      () => {}
    );
    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onDetected, isMobile]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >
          <X size={22} />
        </button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza articolo
        </h2>
        <div
          className="
            relative w-full aspect-square max-w-[320px]
            flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
        >
          {/* Video camera */}
          <div
            id="barcode-scanner-video-box"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay bordo */}
          <div
            className="absolute inset-0 pointer-events-none border-2 border-cyan-400/80 rounded-xl animate-pulse"
            style={{ boxShadow: "0 0 24px 0 #06b6d433" }}
          ></div>
        </div>
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra il codice a barre <br />
          <span className="text-cyan-700 font-semibold">restando dentro il riquadro</span>
        </p>
        <div className="text-xs text-gray-500 text-center">
          Supporta EAN, CODE-128, QR, ecc.
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
