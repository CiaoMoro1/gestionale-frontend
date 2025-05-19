import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";

// Facoltativo: beep audio
const beepSrc = "https://assets.mixkit.co/sfx/preview/mixkit-confirmation-tone-2867.mp3";

type UniversalBarcodeScannerModalProps<T> = {
  open: boolean;
  onClose: () => void;
  mode: "product" | "order";
  data: T[];
  getCode: (item: T) => string;
  goTo: (item: T) => void;
};

export default function UniversalBarcodeScannerModal<T>({
  open,
  onClose,
  mode,
  data,
  getCode,
  goTo,
}: UniversalBarcodeScannerModalProps<T>) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || !isMobile) return;

    const scanner = new Html5Qrcode("universal-barcode-reader");
    scannerRef.current = scanner;
    scanningRef.current = false;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 90 } },
      async (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;

        // Trova elemento corrispondente (prodotto o ordine)
        const item = data.find((d) => getCode(d) === decodedText);

        if (!item) {
          alert(
            mode === "product"
              ? `Nessun prodotto trovato per barcode: ${decodedText}`
              : `Nessun ordine trovato per codice: ${decodedText}`
          );
          scanningRef.current = false;
          return;
        }

        // Suono beep
        try {
          new Audio(beepSrc).play();
        } catch (err) {
          console.error(err);
        }

        await scanner.stop();
        onClose();

        // Vai alla destinazione specifica (rotta)
        goTo(item);
      },
      () => {}
    );

    return () => {
      scanner.stop().catch((err) => console.error(err));
    };
  }, [open, onClose, isMobile, data, getCode, goTo, navigate, mode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-2xl shadow-xl w-full max-w-md space-y-4 relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl"
        >
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold text-center mb-2">
          {mode === "order" ? "Scannerizza barcode ordine" : "Scannerizza barcode prodotto"}
        </h2>
        <div className="relative w-full h-64 rounded border overflow-hidden flex justify-center items-center bg-black">
          <div
            id="universal-barcode-reader"
            className="absolute inset-0 w-full h-full flex items-center justify-center"
          ></div>
          {/* Overlay guida */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div
                className="border-4 border-cyan-400 rounded-xl animate-pulse shadow-2xl"
                style={{
                  width: 220,
                  height: 90,
                  boxShadow: "0 0 0 12000px rgba(0,0,0,0.7) inset",
                }}
              >
                <div className="absolute left-[-4px] top-[-4px] w-5 h-5 border-t-4 border-l-4 border-cyan-300 rounded-tl-lg shadow-cyan-300" />
                <div className="absolute right-[-4px] top-[-4px] w-5 h-5 border-t-4 border-r-4 border-cyan-300 rounded-tr-lg" />
                <div className="absolute left-[-4px] bottom-[-4px] w-5 h-5 border-b-4 border-l-4 border-cyan-300 rounded-bl-lg" />
                <div className="absolute right-[-4px] bottom-[-4px] w-5 h-5 border-b-4 border-r-4 border-cyan-300 rounded-br-lg" />
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-sm text-gray-600">
          Allinea il{" "}
          <span className="font-semibold text-black">
            barcode {mode === "order" ? "ordine" : "prodotto"}
          </span>{" "}
          <span className="text-cyan-600">dentro il riquadro luminoso</span> e attendi.
          <br />
          <span className="text-gray-400">
            {mode === "order"
              ? "(Solo ordini in prelievo sono ricercabili)"
              : "(Solo prodotti registrati sono ricercabili)"}
          </span>
        </div>
      </div>
    </div>
  );
}
