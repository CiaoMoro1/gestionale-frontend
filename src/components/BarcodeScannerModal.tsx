import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  open: boolean;
  onClose: () => void;
  onFound: (ean: string, setError: (msg: string) => void) => void | Promise<void>;
};

export default function BarcodeScannerModal({ open, onClose, onFound }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
  const [scannerKey, setScannerKey] = useState(0);

  useEffect(() => {
    if (!open || !isMobile) return;

    let cancelled = false;
    const scanner = new Html5Qrcode("barcode-reader-" + scannerKey);
    scannerRef.current = scanner;
    scanningRef.current = false;

    scanner.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: 250 },
      async (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;
        // La funzione parent decide cosa fare: se non trova l’articolo,
        // può settare l’errore con setScanError
        await onFound(decodedText, setScanError);
        // Se vuoi riattivare lo scanner dopo errore, NON chiudere qui!
      },
      () => {}
    ).catch((err) => {
      if (cancelled) return;
      setScanError(
        "Errore fotocamera: " +
          (err?.message || err?.toString() || "Nessuna webcam trovata o permessi negati.")
      );
    });

    return () => {
      cancelled = true;
      scanner.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [open, isMobile, scannerKey, onFound]);

  useEffect(() => {
    if (open) setScanError(null);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">Scannerizza codice a barre</h2>

        <div
          className="
            relative w-full aspect-square max-w-[320px]
            flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
        >
          {/* Video canvas */}
          <div
            id={`barcode-reader-${scannerKey}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay bordo */}
          <div
            className="absolute inset-0 pointer-events-none border-2 border-cyan-400/80 rounded-xl animate-pulse"
            style={{ boxShadow: "0 0 24px 0 #06b6d433" }}
          ></div>
        </div>

        {/* Messaggio errore */}
        {scanError && (
          <div className="text-red-600 text-sm font-semibold text-center mb-2">
            {scanError}
          </div>
        )}

        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra il codice a barre <br />
          <span className="text-cyan-700 font-semibold">restando dentro il riquadro</span>
        </p>
        {/* Bottone Riprova se errore */}
        {scanError && (
          <button
            className="mt-2 px-4 py-2 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
            onClick={() => {
              setScannerKey((k) => k + 1);
              setScanError(null);
            }}
          >
            Riprova
          </button>
        )}
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
