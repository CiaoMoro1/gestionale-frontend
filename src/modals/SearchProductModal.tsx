import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Product = {
  id: string;
  nome?: string;
  ean?: string;
  image_url?: string;
  [key: string]: any;
};

export default function SearchProductModal({ open, onClose }: Props) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

  // Serve per evitare che processi barcode quando non vuoi!
  const allowScan = scanning && !loading && !product;

  // Avvia SEMPRE la camera quando la modale è aperta!
  useEffect(() => {
    if (!open || !isMobile) return;

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current!,
          constraints: { facingMode: "environment" },
          area: { top: "30%", right: "30%", left: "30%", bottom: "30%" },
        },
        decoder: {
          readers: ["ean_reader", "code_128_reader", "code_39_reader"],
        },
        locate: true,
        locator: { patchSize: "medium", halfSample: true },
        numOfWorkers: 2,
        frequency: 12,
      },
      (err?: any) => {
        if (!err) Quagga.start();
      }
    );

    const handler = async (data: any) => {
      if (!allowScan) return;
      setLoading(true);

      const code = data.codeResult.code;

      const { data: prodotto, error } = await supabase
        .from("products")
        .select("id, nome, ean, image_url")
        .eq("ean", code)
        .single();

      if (error || !prodotto?.id) {
        alert(`Nessun prodotto trovato per EAN: ${code}`);
        setLoading(false);
        setFound(false);
        return;
      }

      setProduct(prodotto);
      setFound(true);
      setLoading(false);
      setScanning(false);
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
      if (Quagga.running) Quagga.stop();
    };
    // eslint-disable-next-line
  }, [open, isMobile, allowScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            setScanning(false);
            setFound(false);
            setLoading(false);
            setProduct(null);
            onClose();
          }}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codice a barre
        </h2>

        {/* CARD PRODOTTO TROVATO */}
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
              ref={scannerRef}
              id="barcode-reader"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className={
                "absolute inset-0 pointer-events-none border-2 rounded-xl " +
                (found
                  ? "border-green-500 shadow-green-400/70 animate-none"
                  : "border-cyan-400/80 animate-pulse")
              }
              style={{
                boxShadow: found
                  ? "0 0 24px 0 #22c55e99"
                  : "0 0 24px 0 #06b6d433"
              }}
            ></div>
          </div>
        )}

        {/* BOTTONI */}
        {!product && (
          <button
            disabled={scanning}
            onClick={() => {
              setScanning(true);
              setFound(false);
              setLoading(false);
            }}
            className={
              "mt-3 px-4 py-2 rounded-xl font-semibold shadow text-white " +
              (scanning
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 transition")
            }
          >
            {scanning ? "Scansione attiva..." : "Scansiona"}
          </button>
        )}
        {product && (
          <button
            onClick={() => {
              setProduct(null);
              setFound(false);
              setScanning(false);
              setLoading(false);
            }}
            className="mt-3 px-4 py-2 rounded-xl font-semibold shadow bg-cyan-200 text-cyan-900 hover:bg-cyan-300 transition"
          >
            Scansiona un altro prodotto
          </button>
        )}

        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra il codice a barre <br />
          <span className="text-cyan-700 font-semibold">restando dentro il riquadro</span>
        </p>
        <button
          onClick={() => {
            setScanning(false);
            setFound(false);
            setLoading(false);
            setProduct(null);
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
