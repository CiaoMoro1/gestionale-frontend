import { useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<any>(null);
  const [scanActive, setScanActive] = useState(false);

  const onScanSuccess = async (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear(); // stop scanning
    }
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("ean", decodedText)
      .single();
    if (error || !data?.id) {
      alert(`Nessun prodotto trovato per EAN: ${decodedText}`);
      setScanActive(false);
      return;
    }
    window.location.href = `/prodotti/${data.id}`;
  };

  const startScan = () => {
    setScanActive(true);
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        "barcode-reader-ui",
        {
          fps: 12,
          qrbox: 250,
        },
        /* verbose= */ false
      );
      scannerRef.current.render(onScanSuccess);
    }, 200);
  };

  const stopScan = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanActive(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            stopScan();
            onClose();
          }}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codice a barre
        </h2>
        <div className="relative w-full aspect-square max-w-[320px] flex flex-col items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner">
          {!scanActive && (
            <button
              onClick={startScan}
              className="absolute inset-0 z-10 m-auto px-4 py-2 bg-cyan-600 text-white rounded-xl shadow font-semibold transition hover:bg-cyan-700"
              style={{ width: "auto", height: "auto" }}
            >
              Scansiona
            </button>
          )}
          <div id="barcode-reader-ui" className="w-full h-full" />
        </div>
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra il codice a barre <br />
          <span className="text-cyan-700 font-semibold">restando dentro il riquadro</span>
        </p>
        {scanActive && (
          <button
            onClick={stopScan}
            className="mt-2 text-cyan-700 font-semibold hover:underline text-sm transition"
          >
            Ferma scansione
          </button>
        )}
        <button
          onClick={() => {
            stopScan();
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
