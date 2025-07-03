import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

// Tipizzazione chiara
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
  const scannerRef = useRef<HTMLDivElement>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, setScanningActive] = useState(true);
  const scanningActiveRef = useRef(true);

  // Configurazione box centrale (modifica qui per cambiare posizione/dimensioni)
  const boxRect = { left: 30, top: 120, width: 260, height: 80 };
  const tolerance = 40;

  // Resetta lo scanner
  const startScanner = () => {
    setBarcode(null);
    setProcessing(false);
    setErrorMsg(null);
    setScanningActive(true);
    scanningActiveRef.current = true;
  };

  // Setup Quagga ogni volta che "open" diventa true
  useEffect(() => {
    if (!open) return;

    setBarcode(null);
    setErrorMsg(null);
    setProcessing(false);
    setScanningActive(true);
    scanningActiveRef.current = true;

    // Funzione di avvio
    function startQuagga() {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: scannerRef.current!,
            constraints: {
              facingMode: "environment",
              width: { min: 640 },
              height: { min: 480 }
            }
          },
          locator: { patchSize: "medium", halfSample: true },
          decoder: { readers: ["ean_reader"] },
          locate: true,
          frequency: 30,
        },
        (err?: any) => {
          if (err) {
            setErrorMsg("Errore avvio scanner: " + err.message);
            return;
          }
          Quagga.start();
        }
      );
    }

    startQuagga();

    // Handler del barcode rilevato
    const handler = (result: any) => {
      if (!scanningActiveRef.current) return;
      if (!result.codeResult?.code) return;

      const code: string = result.codeResult.code;
      const box: number[][] = result.box;
      if (!box || box.length < 4) return;

      const scaleX = 320 / 640;
      const scaleY = 320 / 480;
      const xs = box.map((b: number[]) => b[0] * scaleX);
      const ys = box.map((b: number[]) => b[1] * scaleY);

      // CENTRO: media di tutti i vertici (meglio ancora che solo diagonale)
      const centerX = xs.reduce((sum: number, x: number) => sum + x, 0) / xs.length;
      const centerY = ys.reduce((sum: number, y: number) => sum + y, 0) / ys.length;

      // Overlay box di tolleranza
      if (
        centerX >= boxRect.left - tolerance &&
        centerX <= boxRect.left + boxRect.width + tolerance &&
        centerY >= boxRect.top - tolerance &&
        centerY <= boxRect.top + boxRect.height + tolerance
      ) {
        setBarcode(code);
        setScanningActive(false);
        scanningActiveRef.current = false;
        // Log per debug
        //console.log("Codice letto:", code);
      }
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
      try { Quagga.stop(); } catch {}
      setBarcode(null);
      setErrorMsg(null);
      setProcessing(false);
      setScanningActive(true);
      scanningActiveRef.current = true;
    };
    // eslint-disable-next-line
  }, [open]);

  // Clic su "Apri" o "Cerca"
  const handleSearch = async () => {
    if (!barcode) return;
    setProcessing(true);
    setErrorMsg(null);

    try { Quagga.stop(); } catch {}

    // Callback custom per draft (tabella centri/PO)
    if (onBarcodeFound) {
      onBarcodeFound(barcode);
      setProcessing(false);
      return;
    }

    // Default: ricerca prodotti (tabella products)
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("ean", barcode.trim())
      .single();

    setProcessing(false);

    if (error || !data?.id) {
      setErrorMsg(`Nessun prodotto trovato per EAN: ${barcode}`);
      return;
    }

    window.location.href = `/prodotti/${data.id}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            try { Quagga.stop(); } catch {}
            setBarcode(null);
            setErrorMsg(null);
            setProcessing(false);
            setScanningActive(true);
            scanningActiveRef.current = true;
            onClose();
          }}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codice a barre
        </h2>
        {/* VIDEO + OVERLAY */}
        <div
          className="relative w-full aspect-square max-w-[320px] flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
          style={{ minHeight: 320, minWidth: 320 }}
        >
          <div
            ref={scannerRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ zIndex: 1 }}
          />
          {/* Box centrale */}
          <div
            style={{
              position: "absolute",
              left: boxRect.left,
              top: boxRect.top,
              width: boxRect.width,
              height: boxRect.height,
              border: `3px solid ${barcode ? "#16a34a" : "#06b6d4"}`,
              borderRadius: "14px",
              boxShadow: barcode
                ? "0 0 24px 0 #16a34a77"
                : "0 0 24px 0 #06b6d433",
              pointerEvents: "none" as const,
              zIndex: 2,
              transition: "border-color .2s, box-shadow .2s"
            }}
          />
          {/* Mostra barcode trovato */}
          {barcode && (
            <div className="absolute left-0 w-full flex justify-center" style={{ top: boxRect.top + boxRect.height + 8 }}>
              <span className="px-4 py-1 bg-white/90 rounded-lg border border-cyan-400 text-cyan-800 font-bold shadow">
                {barcode}
              </span>
            </div>
          )}
        </div>
        {barcode && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSearch}
              disabled={processing}
              className="px-4 py-2 rounded-xl font-semibold shadow text-white bg-green-600 hover:bg-green-700 transition"
            >
              {processing ? "Apro..." : onBarcodeFound ? "Cerca" : "Apri"}
            </button>
            <button
              onClick={startScanner}
              disabled={processing}
              className="px-4 py-2 rounded-xl font-semibold shadow text-white bg-cyan-600 hover:bg-cyan-700 transition"
            >
              Reset
            </button>
          </div>
        )}
        {errorMsg && (
          <div className="text-center text-xs text-red-600">{errorMsg}</div>
        )}
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Posiziona il barcode dentro (o vicino) al riquadro.<br />
          Il box diventa verde quando è pronto!
        </p>
        <button
          onClick={() => {
            try { Quagga.stop(); } catch {}
            setBarcode(null);
            setErrorMsg(null);
            setProcessing(false);
            setScanningActive(true);
            scanningActiveRef.current = true;
            onClose();
          }}
          className="mt-2 text-cyan-700 font-semibold hover:underline text-sm transition"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
