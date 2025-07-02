import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // ID UNIVOCO ogni volta che la modale viene aperta
  const [readerId] = useState(() => "barcode-reader-" + Math.random().toString(36).slice(2, 8));
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    // Aspetta che il div sia effettivamente nel DOM!
    setTimeout(() => {
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      scanningRef.current = false;

      scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: 250 },
        async (decodedText) => {
          if (scanningRef.current) return;
          scanningRef.current = true;

          const barcode = decodedText.trim();
          let { data, error } = await supabase
            .from("products")
            .select("id")
            .eq("ean", barcode)
            .single();

          if (error || !data?.id) {
            alert(`Nessun prodotto trovato per EAN: ${barcode}`);
            scanningRef.current = false;
            return;
          }

          await scanner.stop();
          window.location.href = `/prodotti/${data.id}`;
        },
        () => {}
      );
    }, 100);

    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch {}
        try { scannerRef.current.clear(); } catch {}
        scannerRef.current = null;
      }
      scanningRef.current = false;
    };
  }, [open, readerId]);

  if (!open) return null;

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
        <div className="
            relative w-full aspect-square max-w-[320px]
            flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
        >
          {/* Video canvas */}
          <div
            id={readerId}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay bordo */}
          <div
            className="absolute inset-0 pointer-events-none border-2 border-cyan-400/80 rounded-xl animate-pulse"
            style={{ boxShadow: "0 0 24px 0 #06b6d433" }}
          ></div>
        </div>
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Inquadra il codice a barre <br />
          <span className="text-cyan-700 font-semibold">restando dentro il riquadro</span>
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
