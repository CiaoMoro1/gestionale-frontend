import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [, setCameraReady] = useState(false);
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const [product, setProduct] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Avvia la camera appena si apre la modale
  useEffect(() => {
    if (!open) return;

    const scanner = new Html5Qrcode("barcode-reader");
    scannerRef.current = scanner;
    setCameraReady(true);
    setLastDetected(null);
    setProduct(null);
    setErrorMsg(null);

    scanner.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: 250 },
      (decodedText) => {
        setLastDetected(decodedText); // solo memorizza, non scansiona!
      },
      () => {}
    );

    return () => {
      try { scanner.stop(); } catch {}
      try { scanner.clear(); } catch {}
      scannerRef.current = null;
      setCameraReady(false);
      setLastDetected(null);
      setProduct(null);
      setScanning(false);
      setErrorMsg(null);
    };
  }, [open]);

  // Quando clicchi "Scansiona"
  const handleScan = async () => {
    if (!lastDetected) {
      setErrorMsg("Nessun barcode rilevato da scansionare.");
      return;
    }
    setScanning(true);
    setErrorMsg(null);
    setProduct(null);
    // CERCA su supabase
    const { data, error } = await supabase
      .from("products")
      .select("id, nome, ean, image_url")
      .eq("ean", lastDetected)
      .single();
    if (error || !data?.id) {
      setErrorMsg(`Nessun prodotto trovato per EAN: ${lastDetected}`);
      setScanning(false);
      setProduct(null);
      return;
    }
    setProduct(data);
    setScanning(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            setProduct(null);
            setScanning(false);
            setLastDetected(null);
            setCameraReady(false);
            setErrorMsg(null);
            onClose();
          }}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codice a barre
        </h2>
        {/* CARD PRODOTTO */}
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
        {/* VIDEO + OVERLAY */}
        {!product && (
          <div
            className="
              relative w-full aspect-square max-w-[320px]
              flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
          >
            <div
              id="barcode-reader"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Overlay bordo, verde se c'è un barcode */}
            <div
              className={
                "absolute inset-0 pointer-events-none border-2 rounded-xl transition-all " +
                (lastDetected
                  ? "border-green-500 shadow-green-400/70"
                  : "border-cyan-400/80 animate-pulse")
              }
              style={{
                boxShadow: lastDetected
                  ? "0 0 24px 0 #22c55e99"
                  : "0 0 24px 0 #06b6d433"
              }}
            ></div>
            {/* Mostra il codice rilevato */}
            {lastDetected && (
              <div className="absolute bottom-2 left-0 w-full flex justify-center">
                <span className="px-4 py-1 bg-white/90 rounded-lg border border-cyan-400 text-cyan-800 font-bold shadow">
                  {lastDetected}
                </span>
              </div>
            )}
          </div>
        )}
        {/* BOTTONI */}
        {!product && (
          <button
            disabled={!lastDetected || scanning}
            onClick={handleScan}
            className={
              "mt-3 px-4 py-2 rounded-xl font-semibold shadow text-white " +
              (!lastDetected || scanning
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 transition")
            }
          >
            {scanning ? "Scansione..." : "Scansiona"}
          </button>
        )}
        {product && (
          <button
            onClick={() => {
              setProduct(null);
              setScanning(false);
              setLastDetected(null);
              setErrorMsg(null);
            }}
            className="mt-3 px-4 py-2 rounded-xl font-semibold shadow bg-cyan-200 text-cyan-900 hover:bg-cyan-300 transition"
          >
            Scansiona un altro prodotto
          </button>
        )}

        {errorMsg && (
          <div className="text-center text-xs text-red-600">{errorMsg}</div>
        )}

        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra il codice a barre <br />
          <span className="text-cyan-700 font-semibold">restando dentro il riquadro</span>
        </p>
        <button
          onClick={() => {
            setProduct(null);
            setScanning(false);
            setLastDetected(null);
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
