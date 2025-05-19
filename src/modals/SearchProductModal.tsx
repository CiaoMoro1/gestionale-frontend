import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";

export default function SearchProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent); // ✅ rilevamento dispositivo mobile

  useEffect(() => {
    if (!open || !isMobile) return;

    const scanner = new Html5Qrcode("barcode-reader");
    scannerRef.current = scanner;
    scanningRef.current = false;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        if (scanningRef.current) return;
        scanningRef.current = true;


        const { data, error } = await supabase
          .from("products")
          .select("id")
          .eq("ean", decodedText)
          .single();

        if (error || !data?.id) {
          console.warn("❌ Prodotto non trovato o errore Supabase:", error?.message);
          alert(`Nessun prodotto trovato per EAN: ${decodedText}`);
          scanningRef.current = false;
          return;
        }

        await scanner.stop();
        window.location.href = `/prodotti/${data.id}`;
      },
      (error) => {
        console.warn("Errore durante scan:", error);
      }
    );

    return () => {
      scanner.stop().catch(console.error);
    };
  }, [open, navigate, onClose, isMobile]);

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
          className={`w-full h-64 rounded border flex justify-center items-center ${
            isMobile ? "" : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          {!isMobile && (
            <p className="text-center px-4">
              La fotocamera è disponibile solo da dispositivi mobili.
            </p>
          )}
        </div>

        <p className="text-center text-sm text-gray-600">
          Inquadra il codice a barre del prodotto.
        </p>
      </div>
    </div>
  );
}
