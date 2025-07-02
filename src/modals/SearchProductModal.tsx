import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Box rettangolare centrato (260x80)
  const boxRect = { left: 30, top: 120, width: 260, height: 80 };

  useEffect(() => {
    if (!open) return;
    setBarcode(null);
    setErrorMsg(null);
    setProcessing(false);

    Quagga.init({
      inputStream: {
        type: "LiveStream",
        target: scannerRef.current!,
        constraints: {
          facingMode: "environment",
          width: { min: 640 },
          height: { min: 480 }
        }
      },
      locator: { patchSize: "x-large", halfSample: false },
      decoder: { readers: ["ean_reader"] },
      locate: true,
      frequency: 10,
    }, (err?: any) => {
      if (!err) Quagga.start();
    });

    const handler = (result: any) => {
      if (!result.codeResult?.code) {
        setBarcode(null);
        return;
      }
      const code = result.codeResult.code;
      const box = result.box;
      if (!box || box.length < 4) {
        setBarcode(null);
        return;
      }
      // Mappa coordinate su 320x320
      const scaleX = 320 / 640;
      const scaleY = 320 / 480;
      const xs = box.map((b: number[]) => b[0] * scaleX);
      const ys = box.map((b: number[]) => b[1] * scaleY);
      const centerX = (xs[0] + xs[2]) / 2;
      const centerY = (ys[0] + ys[2]) / 2;
      // Solo se il centro è nel box rettangolare
      if (
        centerX >= boxRect.left &&
        centerX <= boxRect.left + boxRect.width &&
        centerY >= boxRect.top &&
        centerY <= boxRect.top + boxRect.height
      ) {
        setBarcode(code);
      } else {
        setBarcode(null);
      }
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
      try { Quagga.stop(); } catch {}
      setBarcode(null);
      setErrorMsg(null);
      setProcessing(false);
    };
  }, [open]);

  // Click su "Apri"
  const handleSearch = async () => {
    if (!barcode) return;
    setProcessing(true);
    setErrorMsg(null);

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
          {/* Box centrale che diventa verde */}
          <div
            style={{
              position: "absolute",
              left: boxRect.left + "px",
              top: boxRect.top + "px",
              width: boxRect.width + "px",
              height: boxRect.height + "px",
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
          <button
            onClick={handleSearch}
            disabled={processing}
            className="mt-3 px-4 py-2 rounded-xl font-semibold shadow text-white bg-green-600 hover:bg-green-700 transition"
          >
            {processing ? "Apro..." : "Apri"}
          </button>
        )}
        {errorMsg && (
          <div className="text-center text-xs text-red-600">{errorMsg}</div>
        )}
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Posiziona il barcode dentro il riquadro.<br />
          Il box diventa verde quando è pronto!
        </p>
        <button
          onClick={() => {
            try { Quagga.stop(); } catch {}
            setBarcode(null);
            setErrorMsg(null);
            setProcessing(false);
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
