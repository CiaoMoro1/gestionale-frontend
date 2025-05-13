import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  let scanner: Html5Qrcode | null = null;

  useEffect(() => {
    if (!open) return;

    scanner = new Html5Qrcode("barcode-reader");

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("ean", decodedText)
          .single();

        if (data?.id) {
          await scanner?.stop();
          onClose();
          navigate(`/prodotti/${data.id}`);
        }
      },
      (error) => {
        console.warn("Errore scan:", error);
      }
    );

    return () => {
      scanner?.stop().catch(console.error);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-2xl shadow-lg w-full max-w-md space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-xl"
        >×</button>
        <h2 className="text-lg font-bold">Scannerizza codice a barre</h2>
        <div id="barcode-reader" className="w-full h-64 rounded border" />
        <p className="text-center text-sm text-gray-600">
          Inquadra il codice a barre del prodotto.
        </p>
      </div>
    </div>
  );
}