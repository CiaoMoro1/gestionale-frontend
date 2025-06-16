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
      { fps: 10, qrbox: { width: 220, height: 80 } },
      (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;
        onDetected(decodedText);
      },
      () => {} // error callback (puoi loggare o ignorare)
    );
    return () => {
      scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line
  }, [onDetected, isMobile]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all">
      <div className="relative w-full max-w-sm mx-auto px-3 py-5 rounded-3xl bg-white/70 shadow-2xl border border-gray-200 flex flex-col items-center gap-4">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded transition"
          aria-label="Chiudi"
        >
          <X size={26} />
        </button>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-1 tracking-tight">
          Scannerizza articolo
        </h2>
        <p className="text-gray-500 text-sm text-center mb-2">
          Inquadra il codice a barre <span className="hidden sm:inline">dell’articolo</span> dentro il riquadro.
        </p>
        <div
          className={`
            relative
            flex items-center justify-center
            w-full
            h-28
            sm:h-32
            rounded-2xl
            bg-gray-100/70
            border border-gray-300
            shadow-inner
            overflow-hidden
          `}
          style={{ minHeight: 112, maxWidth: 320 }}
        >
          <div
            id="barcode-scanner-video-box"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 pointer-events-none border-2 border-blue-600/80 rounded-2xl animate-pulse"
            style={{ boxShadow: "0 0 18px 0 #2563eb22" }}
          ></div>
          {!isMobile && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 text-gray-400 text-base font-medium z-10 rounded-2xl">
              <span>Usa uno smartphone per attivare la fotocamera</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full items-center">
          <p className="text-xs text-gray-400 text-center">
            Solo i codici visibili nel riquadro vengono letti.<br />
            Supporta barcode EAN, CODE-128, QR, ecc.
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-2 text-blue-700 font-semibold hover:underline text-sm transition"
        >
          Chiudi senza leggere
        </button>
      </div>
    </div>
  );
}
