import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;

    const scanner = new Html5Qrcode("barcode-reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        console.log("✅ Codice letto:", decodedText);

        const { data, error } = await supabase
          .from("products")
          .select("id")
          .eq("ean", decodedText)
          .single();

        if (error) {
          console.warn("❌ Errore Supabase:", error.message);
        }

        if (data?.id) {
          await scanner.stop();
          onClose();
          navigate(`/prodotti/${data.id}`);
        } else {
          alert(`Nessun prodotto trovato per EAN: ${decodedText}`);
        }
      },
      (error) => {
        console.warn("Errore durante scan:", error);
      }
    );

    return () => {
      scanner.stop().catch(console.error);
    };
  }, [open, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-2xl shadow-lg w-full max-w-md space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl"
        >×</button>
        <h2 className="text-lg font-bold">Scannerizza codice a barre</h2>
        <div
          id="barcode-reader"
          className="w-full h-64 rounded border overflow-hidden flex justify-center items-center"
        />
        <p className="text-center text-sm text-gray-600">
          Inquadra il codice a barre del prodotto.
        </p>
      </div>
    </div>
  );
}
