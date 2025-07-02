import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

type Detected = { code: string; ts: number };

export default function SearchProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [detected, setDetected] = useState<Detected[]>([]);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDetected([]);
    setErrorMsg(null);
    setProcessing(false);

    Quagga.init({
      inputStream: {
        type: "LiveStream",
        target: scannerRef.current!,
        constraints: {
          facingMode: "environment",
          width: { min: 640 },
          height: { min: 480 }
        }
      },
      locator: { patchSize: "x-large", halfSample: false },
      decoder: { readers: ["ean_reader"] },
      locate: true,
      frequency: 10,
    }, (err?: any) => {
      if (!err) Quagga.start();
    });

    const handler = (result: any) => {
      if (!result.codeResult?.code) return;
      const code = result.codeResult.code;
      const now = Date.now();
      // solo codici nuovi negli ultimi 4 sec
      setDetected((prev) => {
        if (prev.some(d => d.code === code && now - d.ts < 4000)) return prev;
        return [...prev.filter(d => now - d.ts < 4000), { code, ts: now }];
      });
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
      try { Quagga.stop(); } catch {}
      setDetected([]);
      setErrorMsg(null);
      setProcessing(false);
    };
  }, [open]);

  // Clicca la card → cerca su Supabase
  const handleSearch = async (barcode: string) => {
    setProcessing(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("ean", barcode.trim())
      .single();

    setProcessing(false);

    if (error || !data?.id) {
      setErrorMsg(`Nessun prodotto trovato per EAN: ${barcode}`);
      return;
    }

    window.location.href = `/prodotti/${data.id}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            try { Quagga.stop(); } catch {}
            setDetected([]);
            setErrorMsg(null);
            setProcessing(false);
            onClose();
          }}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >×</button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codice a barre
        </h2>
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
        </div>
        {/* CARD BARCODE */}
        <div className="flex flex-col gap-2 w-full items-center mt-2">
          {detected.length === 0 && (
            <div className="text-xs text-gray-400 text-center">
              Nessun codice rilevato…
            </div>
          )}
          {detected.map(d => (
            <button
              key={d.code}
              disabled={processing}
              onClick={() => handleSearch(d.code)}
              className="px-4 py-3 rounded-xl border border-cyan-400 bg-white shadow font-mono text-cyan-900 text-lg w-full hover:bg-cyan-100 transition text-center"
            >
              {d.code}
              {processing && <span className="ml-2 animate-spin">⏳</span>}
            </button>
          ))}
        </div>
        {errorMsg && (
          <div className="text-center text-xs text-red-600">{errorMsg}</div>
        )}
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Tocca il codice che vuoi cercare.<br />
          Solo il barcode <b>totalmente dentro il box centrale</b> viene mostrato!
        </p>
        <button
          onClick={() => {
            try { Quagga.stop(); } catch {}
            setDetected([]);
            setErrorMsg(null);
            setProcessing(false);
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
