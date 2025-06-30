import { useRef, useEffect, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  open: boolean;
  onClose: () => void;
  onFound: (ean: string) => void;
};

export default function BarcodeScannerModal({ open, onClose, onFound }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let running = false;
    if (!open) return;
    setError(null);

    // Istanzia lo scanner solo se esiste l'elemento!
    const el = document.getElementById("barcode-reader");
    if (!el) return;

    scannerRef.current = new Html5Qrcode("barcode-reader");

    scannerRef.current
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          if (decodedText) {
            onFound(decodedText);
            scannerRef.current?.stop().then(onClose).catch(() => {});
          }
        },
        () => {
          // Puoi loggare errori di scansione qui
        }
      )
      .then(() => {
        running = true;
      })
      .catch((err) => {
        setError(
          "Errore fotocamera: " +
            (err?.message || err?.toString() || "Nessuna webcam trovata o permessi negati.")
        );
      });

    return () => {
      if (scannerRef.current && running) {
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [open, onFound, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-2xl shadow-2xl w-full max-w-xs flex flex-col items-center relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >
          ×
        </button>
        <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">Scannerizza codice a barre</h2>
        <div
          id="barcode-reader"
          className="w-full h-52 bg-gray-100 rounded-xl border mb-3 flex items-center justify-center"
        >
          {!error && <span className="text-gray-400">Caricamento webcam...</span>}
        </div>
        {error && (
          <div className="text-red-600 text-sm mb-2 font-semibold text-center">
            {error}
          </div>
        )}
        <p className="text-center text-sm text-gray-600 mb-2">
          Inquadra il codice a barre.<br />
          <span className="text-cyan-700 font-semibold">Se non vedi la webcam, controlla i permessi.</span>
        </p>
        <button
          onClick={onClose}
          className="text-cyan-700 font-semibold hover:underline text-sm transition"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
