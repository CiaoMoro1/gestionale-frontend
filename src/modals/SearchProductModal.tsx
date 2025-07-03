import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type Props = {
  open: boolean;
  onClose: () => void;
  onBarcodeFound?: (barcode: string) => void;
};

export default function SearchProductModal({
  open,
  onClose,
  onBarcodeFound,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setScanning(true);

    const codeReader = new BrowserMultiFormatReader();
    let active = true;

    (async () => {
      try {
        // Ottieni la lista delle camere disponibili
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        // Cerca la camera posteriore (label contiene 'back' o 'environment')
        let backCamera = devices.find(device =>
          device.label.toLowerCase().includes("back") ||
          device.label.toLowerCase().includes("environment")
        );
        if (!backCamera && devices.length > 0) backCamera = devices[0]; // fallback prima camera

        await codeReader.decodeFromVideoDevice(
          backCamera?.deviceId,
          videoRef.current!,
          (result, err) => {
            if (!active) return;
            if (result) {
              setScanning(false);
              active = false;
              (codeReader as any).reset && (codeReader as any).reset();
              if (onBarcodeFound) onBarcodeFound(result.getText());
              onClose();
            }
            if (err && err.message && err.message !== "No MultiFormat Readers were able to detect the code.") {
              setError("Errore scanner: " + err.message);
            }
          }
        );
      } catch (e: any) {
        setError("Impossibile aprire fotocamera: " + (e?.message || e));
        setScanning(false);
      }
    })();

    return () => {
      active = false;
      (codeReader as any).reset && (codeReader as any).reset();
      setScanning(false);
    };
    // eslint-disable-next-line
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
      <div className="absolute top-3 right-3">
        <button
          onClick={onClose}
          className="bg-white/90 px-3 py-1 rounded-xl shadow font-semibold text-gray-700 hover:bg-gray-100 text-lg"
        >
          ×
        </button>
      </div>
      <div className="flex flex-col items-center w-full h-full justify-center">
        <h2 className="text-lg font-bold text-white mb-2">Scannerizza codice a barre</h2>
        <div
          className="relative w-full flex items-center justify-center"
          style={{ maxWidth: 480, height: 340 }}
        >
          <video
            ref={videoRef}
            style={{
              width: "100vw",
              maxWidth: 480,
              height: 340,
              borderRadius: 18,
              objectFit: "cover",
              background: "#000"
            }}
            muted
            autoPlay
            playsInline
          />
          {/* Box overlay */}
          <div
            style={{
              position: "absolute",
              border: "3px solid #0ea5e9",
              borderRadius: 18,
              top: "50%",
              left: "50%",
              width: 220,
              height: 70,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              boxShadow: "0 0 32px 0 #0ea5e955"
            }}
          />
        </div>
        {error && (
          <div className="text-red-500 text-sm mt-3 bg-white/90 px-2 py-1 rounded">{error}</div>
        )}
        <p className="mt-3 text-white text-sm">
          Inquadra <b>un solo barcode</b> nel riquadro blu.<br />
          Si chiude appena riconosciuto.
        </p>
        {!scanning && (
          <button
            className="mt-5 bg-cyan-600 hover:bg-cyan-800 text-white px-5 py-2 rounded-xl font-semibold"
            onClick={onClose}
          >
            Chiudi
          </button>
        )}
      </div>
    </div>
  );
}
