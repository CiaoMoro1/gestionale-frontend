import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  nome?: string;
  ean: string;
  image_url?: string;
  sku?: string;
};

type BarcodeOverlay = {
  code: string;
  box: [number, number][];
  ts: number;
  product?: Product;
};

export default function SearchProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState<BarcodeOverlay | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Box centrale rettangolare
  const boxRect = { left: 30, top: 120, width: 260, height: 80 };

  useEffect(() => {
    if (!open) return;
    setOverlay(null);
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

      // Mapping Quagga 640x480 -> nostro 320x320
      const scaleX = 320 / 640;
      const scaleY = 320 / 480;
      const xs = box.map((b: number[]) => b[0] * scaleX);
      const ys = box.map((b: number[]) => b[1] * scaleY);
      const centerX = (xs[0] + xs[2]) / 2;
      const centerY = (ys[0] + ys[2]) / 2;

      if (
        centerX >= boxRect.left &&
        centerX <= boxRect.left + boxRect.width &&
        centerY >= boxRect.top &&
        centerY <= boxRect.top + boxRect.height
      ) {
        // Non rifare la stessa card se non cambia barcode
        setOverlay(prev =>
          prev && prev.code === code && now - prev.ts < 1500
            ? prev
            : { code, box, ts: now, product: prev?.product }
        );
      }
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
      try { Quagga.stop(); } catch {}
      setOverlay(null);
      setErrorMsg(null);
      setProcessing(false);
    };
  }, [open]);

  // Quando clicchi la card: cerca su supabase e aggiorna la card con immagine/EAN/SKU
  const handleSearch = async (code: string) => {
    setProcessing(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("products")
      .select("id, nome, ean, image_url, sku")
      .eq("ean", code.trim())
      .single();

    setProcessing(false);

    if (error || !data?.id) {
      setErrorMsg(`Nessun prodotto trovato per EAN: ${code}`);
      setOverlay(o => o ? { ...o, product: undefined } : null);
      return;
    }
    // Aggiorna la card con i dettagli prodotto
    setOverlay(o => o ? { ...o, product: data } : null);
    // Dopo 1s redirect automatico (o solo su secondo click, come preferisci)
    setTimeout(() => {
      window.location.href = `/prodotti/${data.id}`;
    }, 900);
  };

  if (!open) return null;

  // Stile per overlay card (mobile/tablet friendly)
  const cardStyle = (box: [number, number][]) => {
    const scaleX = 320 / 640;
    const scaleY = 320 / 480;
    const xs = box.map(b => b[0] * scaleX);
    const ys = box.map(b => b[1] * scaleY);
    const left = Math.min(...xs);
    const top = Math.min(...ys) - 32; // solleva un po' la card sopra al barcode
    const width = Math.max(...xs) - left;
    return {
      position: "absolute" as const,
      left, top: Math.max(top, 0), width: Math.max(width, 110), height: 110,
      zIndex: 10,
      borderRadius: 18,
      boxShadow: "0 2px 14px #1114",
      background: "#fff",
      border: "2px solid #16a34a",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      padding: "8px 6px",
      pointerEvents: "auto" as const,
      transition: "all .2s"
    };
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            try { Quagga.stop(); } catch {}
            setOverlay(null);
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
          {/* Overlay card sopra barcode */}
          {overlay && (
            <button
              style={cardStyle(overlay.box)}
              onClick={() => handleSearch(overlay.code)}
              disabled={processing}
            >
              <div className="text-sm text-cyan-700 font-semibold truncate w-full text-center">
                {overlay.product?.sku ?? "Codice"}
              </div>
              <div className="font-bold text-cyan-900 text-lg truncate w-full text-center">
                {overlay.product?.nome ?? overlay.code}
              </div>
              {overlay.product?.image_url && (
                <img
                  src={overlay.product.image_url}
                  alt="prodotto"
                  className="my-1 mx-auto rounded max-h-12 object-contain"
                  style={{ maxWidth: "90%" }}
                />
              )}
              <div className="text-xs text-gray-500 mt-1 w-full text-center">
                {overlay.product?.ean ?? overlay.code}
              </div>
            </button>
          )}
          {/* Box centrale */}
          <div
            style={{
              position: "absolute",
              left: boxRect.left + "px",
              top: boxRect.top + "px",
              width: boxRect.width + "px",
              height: boxRect.height + "px",
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
          Tocca la card sopra al barcode centrato per cercare.<br />
          SKU sopra, nome al centro, immagine e EAN sotto!
        </p>
        <button
          onClick={() => {
            try { Quagga.stop(); } catch {}
            setOverlay(null);
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
