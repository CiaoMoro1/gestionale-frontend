import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

type BarcodeOverlay = {
  code: string;
  box: [number, number][];
  ts: number;
};

export default function SearchProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [overlays, setOverlays] = useState<BarcodeOverlay[]>([]);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOverlays([]);
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
      if (!result.codeResult?.code) return;
      const code = result.codeResult.code;
      const box = result.box;
      const now = Date.now();
      if (!box || box.length < 4) return;
      // Solo codici nuovi
      setOverlays((prev) => {
        if (prev.some(o => o.code === code && now - o.ts < 1500)) return prev;
        // Sovrascrivi se vecchio, oppure aggiungi
        return [
          ...prev.filter(o => now - o.ts < 1500 && o.code !== code),
          { code, box, ts: now }
        ];
      });
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
      try { Quagga.stop(); } catch {}
      setOverlays([]);
      setErrorMsg(null);
      setProcessing(false);
    };
  }, [open]);

  // Calcola la posizione e la dimensione della card dal bounding box
  const getOverlayStyle = (box: [number, number][]) => {
    // Trasformo Quagga box (tipicamente da 640x480) su 320x320 (nostro video)
    // Serve la proporzione!
    const scaleX = 320 / 640;
    const scaleY = 320 / 480;
    const xs = box.map(b => b[0] * scaleX);
    const ys = box.map(b => b[1] * scaleY);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    return {
      position: "absolute" as const,
      left, top, width, height,
      zIndex: 5,
      pointerEvents: "auto" as const
    };
  };

  // Click card → cerca su Supabase
  const handleSearch = async (code: string) => {
    setProcessing(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("ean", code.trim())
      .single();

    setProcessing(false);

    if (error || !data?.id) {
      setErrorMsg(`Nessun prodotto trovato per EAN: ${code}`);
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
            setOverlays([]);
            setErrorMsg(null);
            setProcessing(false);
            onClose();
          }}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">Scannerizza codice a barre</h2>
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
          {/* Overlay cards sui barcode */}
          {overlays.map(o => (
            <button
              key={o.code}
              style={{
                ...getOverlayStyle(o.box),
                border: "2px solid #16a34a",
                background: "rgba(34,197,94,0.09)",
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#16a34a",
                fontWeight: 700,
                fontSize: 18,
                boxShadow: "0 2px 8px #16a34a33",
                transition: "box-shadow .2s",
              }}
              onClick={() => handleSearch(o.code)}
              disabled={processing}
            >
              {o.code}
            </button>
          ))}
          {/* Box centrale */}
          <div
            style={{
              position: "absolute",
              left: "30px",     // (320 - 260) / 2
              top: "120px",     // (320 - 80) / 2
              width: "260px",
              height: "80px",
              border: "2px solid #06b6d4",
              borderRadius: "14px",
              boxShadow: "0 0 24px 0 #06b6d433",
              pointerEvents: "none" as const,
              zIndex: 2,
            }}
          />
        </div>
        {errorMsg && (
          <div className="text-center text-xs text-red-600">{errorMsg}</div>
        )}
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Tocca il codice sopra al barcode da cercare!<br />
          (Overlay = posizione reale del barcode inquadrato)
        </p>
        <button
          onClick={() => {
            try { Quagga.stop(); } catch {}
            setOverlays([]);
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
