import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [product, setProduct] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Area centrale (rettangolo 60% del video, puoi regolare)
  const area = { top: "20%", right: "20%", left: "20%", bottom: "20%" };

  useEffect(() => {
    if (!open) return;
    setProduct(null);
    setLastCode(null);
    setErrorMsg(null);
    setScanning(false);

    // Cleanup Quagga on unmount
    return () => {
      Quagga.offDetected();
      try { Quagga.stop(); } catch {}
    };
  }, [open]);

  // Avvia la camera quando si apre il modale, ma NON la scansione
  const handleStartScanner = () => {
    if (scanning) return;
    setLastCode(null);
    setProduct(null);
    setErrorMsg(null);

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current!,
          constraints: { facingMode: "environment" },
          area,
        },
        locator: { patchSize: "medium", halfSample: true },
        decoder: { readers: ["ean_reader", "code_128_reader", "code_39_reader"] },
        locate: true,
        frequency: 12,
      },
      (err?: any) => {
        if (err) {
          setErrorMsg("Errore apertura camera: " + err);
        } else {
          Quagga.start();
          setScanning(true);
        }
      }
    );
  };

  // Scansiona solo quando clicchi "Scansiona"
  const handleScan = () => {
    if (!scanning) return;
    setLastCode(null);
    setProduct(null);
    setErrorMsg(null);

    Quagga.onDetected(async (result: any) => {
      if (!result.codeResult?.code) return;
      // Area centrale del box (60%)
      const box = result.box;
      if (!box || box.length < 4) return;
      const centerX = (box[0][0] + box[2][0]) / 2;
      const centerY = (box[0][1] + box[2][1]) / 2;
      // Video 320x320, area centrale 20%-80% => (64,64)-(256,256)
      if (centerX < 64 || centerX > 256 || centerY < 64 || centerY > 256) return;

      Quagga.offDetected();
      Quagga.stop();

      setLastCode(result.codeResult.code);

      // Query Supabase
      const code = result.codeResult.code.trim();
      let { data, error } = await supabase
        .from("products")
        .select("id, nome, ean, image_url")
        .eq("ean", code)
        .single();

      if (error || !data?.id) {
        setErrorMsg(`Nessun prodotto trovato per EAN: ${code}`);
        setProduct(null);
      } else {
        setProduct(data);
      }
      setScanning(false);
    });
  };

  // Avvia scanner quando il modale si apre
  useEffect(() => {
    if (open) handleStartScanner();
    // eslint-disable-next-line
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            Quagga.offDetected();
            try { Quagga.stop(); } catch {}
            setScanning(false);
            setProduct(null);
            setLastCode(null);
            setErrorMsg(null);
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
          {/* Box centrale */}
          <div
            style={{
              position: "absolute",
              left: "64px",
              top: "64px",
              width: "192px",
              height: "192px",
              border: "2px solid #06b6d4",
              borderRadius: "16px",
              boxShadow: "0 0 24px 0 #06b6d433",
              pointerEvents: "none" as const,
              zIndex: 2
            }}
          />
          {lastCode && (
            <div className="absolute bottom-2 left-0 w-full flex justify-center z-10">
              <span className="px-4 py-1 bg-white/90 rounded-lg border border-cyan-400 text-cyan-800 font-bold shadow">
                {lastCode}
              </span>
            </div>
          )}
        </div>

        {!product && (
          <button
            onClick={handleScan}
            disabled={!scanning}
            className={
              "mt-3 px-4 py-2 rounded-xl font-semibold shadow text-white " +
              (!scanning
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 transition")
            }
          >
            {scanning ? "Scansiona..." : "Scansiona"}
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
          Solo il codice <b>totalmente dentro il box centrale</b> verrà letto!
        </p>
        <button
          onClick={() => {
            Quagga.offDetected();
            try { Quagga.stop(); } catch {}
            setScanning(false);
            setProduct(null);
            setLastCode(null);
            setErrorMsg(null);
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
