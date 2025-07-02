import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Avvia la camera (ma non la scansione) quando la modale si apre
  useEffect(() => {
    if (!open) return;
    const scanner = new Html5Qrcode("barcode-reader");
    scannerRef.current = scanner;
    setCameraReady(true);

    return () => {
      scanner.stop();
      scanner.clear();
      scanningRef.current = false;
      setScanning(false);
      setCameraReady(false);
    };
  }, [open]);

  // Attiva la scansione SOLO quando clicchi "Scansiona"
  useEffect(() => {
    if (!open || !scanning || !scannerRef.current) return;

    scanningRef.current = false; // reset
    scannerRef.current.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: 250 },
      async (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;

        const { data, error } = await supabase
          .from("products")
          .select("id, nome, ean, image_url")
          .eq("ean", decodedText)
          .single();

        if (error || !data?.id) {
          alert(`Nessun prodotto trovato per EAN: ${decodedText}`);
          scanningRef.current = false;
          return;
        }

        await scannerRef.current?.stop();
        window.location.href = `/prodotti/${data.id}`;
      },
      () => {}
    );

    return () => {
      scannerRef.current?.stop().catch(() => {});
      scanningRef.current = false;
    };
  }, [scanning, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            setScanning(false);
            onClose();
          }}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codice a barre
        </h2>

        <div
          className="
            relative w-full aspect-square max-w-[320px]
            flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
        >
          {/* Video canvas */}
          <div
            id="barcode-reader"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay bordo */}
          <div
            className="absolute inset-0 pointer-events-none border-2 border-cyan-400/80 rounded-xl animate-pulse"
            style={{ boxShadow: "0 0 24px 0 #06b6d433" }}
          ></div>
        </div>

        <button
          disabled={!cameraReady || scanning}
          onClick={() => setScanning(true)}
          className={
            "mt-3 px-4 py-2 rounded-xl font-semibold shadow text-white " +
            (!cameraReady || scanning
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-cyan-600 hover:bg-cyan-700 transition")
          }
        >
          {scanning ? "Scansione attiva..." : "Scansiona"}
        </button>

        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra il codice a barre <br />
          <span className="text-cyan-700 font-semibold">
            restando dentro il riquadro
          </span>
        </p>
        <button
          onClick={() => {
            setScanning(false);
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
