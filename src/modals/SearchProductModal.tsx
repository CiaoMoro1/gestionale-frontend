import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLDivElement>(null);
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Box centrale 250x250 px al centro del container 320x320
  const box = { left: 35, top: 35, size: 250 };

  useEffect(() => {
    if (!open) return;

    setLastDetected(null);
    setProduct(null);
    setErrorMsg(null);

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: videoRef.current!,
          constraints: { facingMode: "environment" }
        },
        locator: { patchSize: "medium", halfSample: true },
        decoder: { readers: ["ean_reader", "code_128_reader", "code_39_reader"] },
        locate: true,
        frequency: 12
      },
      (err?: any) => {
        if (!err) Quagga.start();
      }
    );

    const handler = (result: any) => {
      if (processing || product) return;
      if (!result.codeResult?.code) return;

      // Calcola centro barcode
      const boxPoints = result.box;
      if (!boxPoints || boxPoints.length < 4) return;
      const centerX = (boxPoints[0][0] + boxPoints[2][0]) / 2;
      const centerY = (boxPoints[0][1] + boxPoints[2][1]) / 2;

      const inBox =
        centerX >= box.left &&
        centerX <= box.left + box.size &&
        centerY >= box.top &&
        centerY <= box.top + box.size;

      if (!inBox) return;

      setLastDetected(result.codeResult.code);
      setErrorMsg(null);
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
      if (Quagga.running) Quagga.stop();
    };
    // eslint-disable-next-line
  }, [open, processing, product]);

  // Cerca su supabase SOLO su click
  const handleSearch = async () => {
    if (!lastDetected) return;
    setProcessing(true);
    setProduct(null);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("products")
      .select("id, nome, ean, image_url")
      .eq("ean", lastDetected)
      .single();

    if (error || !data?.id) {
      setErrorMsg(`Nessun prodotto trovato per EAN: ${lastDetected}`);
      setProcessing(false);
      setProduct(null);
      return;
    }
    setProduct(data);
    setProcessing(false);
  };

  if (!open) return null;

  // Overlay box centrale
  const overlayStyle = {
    position: "absolute" as const,
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.size}px`,
    height: `${box.size}px`,
    border: "2px solid #06b6d4",
    borderRadius: "16px",
    boxShadow: "0 0 24px 0 #06b6d433",
    pointerEvents: "none" as const,
    zIndex: 2
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codice a barre
        </h2>

        <div
          className="relative w-full aspect-square max-w-[320px] flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
          style={{ minHeight: 320, minWidth: 320 }}
        >
          <div
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ zIndex: 1 }}
          />
          <div style={overlayStyle}></div>
          {lastDetected && (
            <div className="absolute bottom-2 left-0 w-full flex justify-center z-10">
              <span className="px-4 py-1 bg-white/90 rounded-lg border border-cyan-400 text-cyan-800 font-bold shadow">
                {lastDetected}
              </span>
            </div>
          )}
        </div>

        {lastDetected && !product && (
          <button
            disabled={processing}
            onClick={handleSearch}
            className={
              "mt-3 px-4 py-2 rounded-xl font-semibold shadow text-white " +
              (processing
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 transition")
            }
          >
            {processing ? "Cerca..." : "Cerca"}
          </button>
        )}

        {product && (
          <div
            className="mt-2 bg-cyan-50 rounded-xl border border-cyan-300 px-4 py-3 text-center shadow cursor-pointer transition hover:bg-cyan-100"
            onClick={() => window.location.href = `/prodotti/${product.id}`}
          >
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.nome}
                className="mx-auto rounded mb-2 max-h-28 object-contain"
              />
            )}
            <div className="font-bold text-cyan-900 text-lg">{product.nome || "Prodotto"}</div>
            <div className="text-sm text-cyan-700">EAN: {product.ean}</div>
            <div className="text-xs text-gray-500 mt-1">Clicca per dettagli</div>
          </div>
        )}

        {errorMsg && (
          <div className="text-center text-xs text-red-600">{errorMsg}</div>
        )}

        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Solo il codice <b>totalmente dentro il box centrale</b> verrà proposto per la ricerca!
        </p>
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
