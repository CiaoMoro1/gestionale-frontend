import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";
import { supabase } from "../lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
  onBarcodeFound?: (barcode: string) => void;
};

type DetectedBarcode = {
  code: string;
  box: number[][];
  center: { x: number; y: number };
};

export default function SearchProductModal({
  open,
  onClose,
  onBarcodeFound,
}: Props) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [barcodes, setBarcodes] = useState<DetectedBarcode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoDims, setVideoDims] = useState({ width: 640, height: 480 });

  // Per focus manuale
  const lastTapRef = useRef<number>(0);

  // Start o resetta lo scanner
  const startScanner = () => {
    setBarcodes([]);
    setSelected(null);
    setErrorMsg(null);
    setProcessing(false);
  };

  // Rileva i codici con posizione e box
  useEffect(() => {
    if (!open) return;

    startScanner();

    function startQuagga() {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: scannerRef.current!,
            constraints: {
              facingMode: "environment",
              width: { min: 640 },
              height: { min: 480 },
            },
          },
          locator: { patchSize: "medium", halfSample: true },
          decoder: { readers: ["ean_reader", "code_128_reader"] },
          locate: true,
          frequency: 30,
        },
        (err?: any) => {
          if (err) {
            setErrorMsg("Errore avvio scanner: " + err.message);
            return;
          }
          Quagga.start();
          // Ottieni la vera dimensione video dopo avvio
          setTimeout(() => {
            const video = scannerRef.current?.querySelector("video");
            if (video) {
              setVideoDims({
                width: video.videoWidth || 640,
                height: video.videoHeight || 480,
              });
            }
          }, 500);
        }
      );
    }

    startQuagga();

    const handler = (result: any) => {
      if (!result.codeResult?.code || !result.box || result.box.length < 4)
        return;

      const { code } = result.codeResult;
      const box: number[][] = result.box;

      // Calcola centro
      const xs = box.map((b: number[]) => b[0]);
      const ys = box.map((b: number[]) => b[1]);
      const center = {
        x: xs.reduce((sum, x) => sum + x, 0) / xs.length,
        y: ys.reduce((sum, y) => sum + y, 0) / ys.length,
      };

      setBarcodes((prev) => {
        // Se già presente aggiorna la posizione, se nuovo aggiungi
        if (prev.some((b) => b.code === code)) {
          return prev.map((b) =>
            b.code === code ? { ...b, box, center } : b
          );
        }
        return [...prev, { code, box, center }];
      });
    };

    Quagga.onDetected(handler);

    return () => {
      Quagga.offDetected(handler);
      try {
        Quagga.stop();
      } catch {}
      setBarcodes([]);
      setSelected(null);
      setErrorMsg(null);
      setProcessing(false);
    };
    // eslint-disable-next-line
  }, [open]);

  // Gestione ricerca/click barcode
  const handleSearch = async (code: string) => {
    setProcessing(true);
    setErrorMsg(null);
    try {
      Quagga.stop();
    } catch {}

    if (onBarcodeFound) {
      onBarcodeFound(code);
      setProcessing(false);
      return;
    }

    // Default: ricerca su products
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("ean", code.trim())
      .single();

    setProcessing(false);

    if (error || !data?.id) {
      setErrorMsg(`Nessun prodotto trovato per EAN: ${code}`);
      return;
    }
    window.location.href = `/prodotti/${data.id}`;
  };

  // Funzione focus camera su tap
  const handleVideoTap = () => {
    const now = Date.now();
    // Debounce per evitare doppio tap
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;

    const video = scannerRef.current?.querySelector("video");
    if (video && "focus" in video) {
      // Alcuni browser supportano MediaTrack focus, altri no
      // Qui richiami l'API autofocus se esiste
      // @ts-ignore
      if (typeof video.focus === "function") video.focus();
    }
    // In alternativa, puoi tentare il re-focus via constraints
    const stream = video && (video as any).srcObject;
    if (stream && stream.getTracks) {
      const track = stream.getTracks()[0];
      // Alcune webcam moderne supportano la focusMode
      // @ts-ignore
      if (track && track.applyConstraints) {
        // Prova autofocus
        // @ts-ignore
        track.applyConstraints({
          advanced: [{ focusMode: "continuous" }],
        });
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-3 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md space-y-3 relative flex flex-col items-center">
        <button
          onClick={() => {
            try {
              Quagga.stop();
            } catch {}
            setBarcodes([]);
            setSelected(null);
            setErrorMsg(null);
            setProcessing(false);
            onClose();
          }}
          className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700"
        >
          ×
        </button>
        <h2 className="text-lg font-bold text-gray-900 text-center">
          Scannerizza codici a barre
        </h2>
        {/* VIDEO + OVERLAY */}
        <div
          className="relative w-full aspect-square max-w-[320px] flex items-center justify-center rounded-xl overflow-hidden border border-cyan-400 bg-gray-100 shadow-inner"
          style={{ minHeight: 320, minWidth: 320 }}
          ref={scannerRef}
          onClick={handleVideoTap}
          title="Tocca per mettere a fuoco"
        >
          {/* Overlay su ogni barcode */}
          {barcodes.map((b) => {
            // Proietta posizione nel box video reale
            const scaleX = 320 / videoDims.width;
            const scaleY = 320 / videoDims.height;
            const left = b.center.x * scaleX - 50;
            const top = b.center.y * scaleY - 30;

            return (
              <div
                key={b.code}
                style={{
                  position: "absolute",
                  left: left,
                  top: top,
                  zIndex: 3,
                  width: 100,
                  minHeight: 40,
                  background: "#fff",
                  border: b.code === selected ? "3px solid #16a34a" : "2px solid #06b6d4",
                  borderRadius: 12,
                  boxShadow: "0 4px 12px 0 #0002",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "border .2s",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(b.code);
                }}
                className="barcode-card"
              >
                <span
                  className="font-semibold text-cyan-800"
                  style={{ fontSize: 16 }}
                >
                  {b.code}
                </span>
                {selected === b.code && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSearch(b.code);
                    }}
                    disabled={processing}
                    className="ml-2 px-3 py-1 rounded-xl font-semibold shadow text-white bg-green-600 hover:bg-green-700 transition"
                  >
                    {processing ? "Apro..." : onBarcodeFound ? "Cerca" : "Apri"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={startScanner}
            disabled={processing}
            className="px-4 py-2 rounded-xl font-semibold shadow text-white bg-cyan-600 hover:bg-cyan-700 transition"
          >
            Reset
          </button>
        </div>
        {errorMsg && (
          <div className="text-center text-xs text-red-600">{errorMsg}</div>
        )}
        <p className="text-center text-sm text-gray-600 px-2 mt-1">
          Tocca la zona video per mettere a fuoco.<br />
          Clicca su un codice per selezionarlo, poi su "Cerca/Apri"!
        </p>
        <button
          onClick={() => {
            try {
              Quagga.stop();
            } catch {}
            setBarcodes([]);
            setSelected(null);
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
