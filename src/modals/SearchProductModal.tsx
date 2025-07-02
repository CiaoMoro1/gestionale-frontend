import { useEffect, useState } from "react";
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
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const videoDivId = "barcode-reader";

  // Avvia Quagga SOLO quando la modale e il div video sono montati
  useEffect(() => {
    if (!open) return;

    setTimeout(() => setCameraReady(true), 200); // Permette al DOM di renderizzare il div

    return () => {
      setCameraReady(false);
      setFound(false);
      setScanning(false);
      setLoading(false);
      setProduct(null);
      if (Quagga.running) Quagga.stop();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !cameraReady) return;

    // Inizializza Quagga appena il div è presente
    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: document.getElementById(videoDivId)!,
          constraints: { facingMode: "environment" },
          // area: { top: "30%", right: "30%", left: "30%", bottom: "30%" }, // disabilita per test
        },
        decoder: {
          readers: ["ean_reader", "code_128_reader", "code_39_reader"],
        },
        locate: true,
        locator: { patchSize: "medium", halfSample: true },
        numOfWorkers: 2,
        frequency: 10,
      },
      (err?: any) => {
        if (err) {
          alert("Errore apertura camera: " + err);
          return;
        }
        Quagga.start();
      }
    );

    return () => {
      if (Quagga.running) Quagga.stop();
    };
  }, [open, cameraReady]);

  useEffect(() => {
    if (!open || !cameraReady) return;

    const handler = async (data: any) => {
      if (!scanning || loading || product) return;
      setLoading(true);

      const code = data.codeResult.code;
      setFound(true);

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
      setLoading(false);
      setScanning(false);
      setFound(true);
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
    };
    // eslint-disable-next-line
  }, [open, scanning, loading, product, cameraReady]);

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
              id={videoDivId}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ minWidth: 200, minHeight: 200 }}
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
