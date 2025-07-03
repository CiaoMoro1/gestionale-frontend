import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
  onBarcodeFound?: (barcode: string) => void;
};

type DetectedBarcode = {
  code: string;
  box: number[][];
  center: { x: number; y: number };
  dist: number; // distanza dal centro box!
};

export default function SearchProductModal({
  open,
  onClose,
  onBarcodeFound,
}: Props) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [barcode, setBarcode] = useState<DetectedBarcode | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoDims, setVideoDims] = useState({ width: 640, height: 480 });

  // Configura box centrale
  const boxRect = { left: 30, top: 120, width: 260, height: 80 };

  // Quagga setup
  useEffect(() => {
    if (!open) return;

    setBarcode(null);
    setErrorMsg(null);
    setProcessing(false);

    function startQuagga() {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: scannerRef.current!,
            constraints: {
              facingMode: "environment",
              width: { min: 640 },
              height: { min: 480 },
            },
          },
          locator: { patchSize: "medium", halfSample: true },
          decoder: { readers: ["ean_reader", "code_128_reader"] },
          locate: true,
          frequency: 20,
        },
        (err?: any) => {
          if (err) {
            setErrorMsg("Errore avvio scanner: " + err.message);
            return;
          }
          Quagga.start();
          setTimeout(() => {
            const video = scannerRef.current?.querySelector("video");
            if (video) {
              setVideoDims({
                width: video.videoWidth || 640,
                height: video.videoHeight || 480,
              });
            }
          }, 600);
        }
      );
    }
    startQuagga();

    const handler = (result: any) => {
      if (!result.codeResult?.code || !result.box || result.box.length < 4) return;
      const code = result.codeResult.code;
      const box: number[][] = result.box;

      // Centra e scala
      const xs = box.map((b: number[]) => b[0]);
      const ys = box.map((b: number[]) => b[1]);
      const scaleX = 320 / videoDims.width;
      const scaleY = 320 / videoDims.height;
      const centerX = xs.reduce((sum, x) => sum + x, 0) / xs.length * scaleX;
      const centerY = ys.reduce((sum, y) => sum + y, 0) / ys.length * scaleY;

      // Centro del box target
      const boxCenter = {
        x: boxRect.left + boxRect.width / 2,
        y: boxRect.top + boxRect.height / 2,
      };
      const dist = Math.sqrt(
        Math.pow(centerX - boxCenter.x, 2) +
        Math.pow(centerY - boxCenter.y, 2)
      );

      // Se centro barcode DENTRO box rettangolare, prendi lui
      if (
        centerX >= boxRect.left &&
        centerX <= boxRect.left + boxRect.width &&
        centerY >= boxRect.top &&
        centerY <= boxRect.top + boxRect.height
      ) {
        setBarcode({ code, box, center: { x: centerX, y: centerY }, dist });
      } else {
        // Se nessuno dentro, scegli solo il più vicino MA SOLO SE VICINO (<50px)
        setBarcode((curr) => {
          if (!curr || dist < curr.dist) {
            if (dist < 50)
              return { code, box, center: { x: centerX, y: centerY }, dist };
          }
          return curr;
        });
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
    // eslint-disable-next-line
  }, [open, videoDims.width, videoDims.height]);

  // Cerca
  const handleSearch = async () => {
    if (!barcode) return;
    setProcessing(true);
    setErrorMsg(null);
    try { Quagga.stop(); } catch {}

    if (onBarcodeFound) {
      onBarcodeFound(barcode.code);
      setProcessing(false);
      return;
    }
    // Default: cerca in products
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("ean", barcode.code.trim())
      .single();

    setProcessing(false);

    if (error || !data?.id) {
      setErrorMsg(`Nessun prodotto trovato per EAN: ${barcode.code}`);
      return;
    }
    window.location.href = `/prodotti/${data.id}`;
  };

  // Resetta
  const startScanner = () => {
    setBarcode(null);
    setErrorMsg(null);
    setProcessing(false);
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
        >
          ×
        </button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codice a barre
        </h2>
        {/* Video e overlay */}
        <div
          className="relative w-full aspect-square max-w-[320px] flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
          style={{ minHeight: 320, minWidth: 320 }}
          ref={scannerRef}
        >
          {/* Overlay box centrale */}
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
          {/* Overlay card barcode */}
          {barcode && (
            <div
              style={{
                position: "absolute",
                left: barcode.center.x - 80,
                top: barcode.center.y - 32,
                zIndex: 10,
                width: 160,
                minHeight: 40,
                background: "#fff",
                border: "3px solid #16a34a",
                borderRadius: 14,
                boxShadow: "0 6px 18px 0 #05966933",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              {barcode.code}
              <button
                onClick={handleSearch}
                disabled={processing}
                className="ml-4 px-3 py-1 rounded-xl font-semibold shadow text-white bg-green-600 hover:bg-green-700 transition"
              >
                {processing ? "Apro..." : onBarcodeFound ? "Cerca" : "Apri"}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={startScanner}
            disabled={processing}
            className="px-4 py-2 rounded-xl font-semibold shadow text-white bg-cyan-600 hover:bg-cyan-700 transition"
          >
            Reset
          </button>
        </div>
        {errorMsg && (
          <div className="text-center text-xs text-red-600">{errorMsg}</div>
        )}
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra <b>un solo barcode</b> nel riquadro.<br />
          Il box si illumina quando è valido!
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
