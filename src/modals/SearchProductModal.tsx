import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type Props = {
  open: boolean;
  onClose: () => void;
  onBarcodeFound?: (barcode: string) => void;
};

export default function SearchProductModal({
  open,
  onClose,
  onBarcodeFound,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [streamObj, setStreamObj] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setScanning(true);

    const codeReader = new BrowserMultiFormatReader();
    let active = true;
    let animationId: number;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        let backCamera = devices.find(device =>
          device.label.toLowerCase().includes("back") ||
          device.label.toLowerCase().includes("environment")
        );
        if (!backCamera && devices.length > 0) backCamera = devices[0];

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: backCamera?.deviceId,
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        setStreamObj(stream); // Salva in stato per chiusura affidabile

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        const scanLoop = async () => {
          if (!active || !videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          if (video.videoWidth === 0 || video.videoHeight === 0) {
            animationId = requestAnimationFrame(scanLoop);
            return;
          }

          const boxW = 300;
          const boxH = 150;
          const x = (video.videoWidth - boxW) / 2;
          const y = (video.videoHeight - boxH) / 2;
          canvas.width = boxW;
          canvas.height = boxH;

          ctx.drawImage(video, x, y, boxW, boxH, 0, 0, boxW, boxH);

          try {
            const result = await codeReader.decodeFromCanvas(canvas);
            if (result) {
              setScanning(false);
              active = false;
              // Ferma lo stream video
              if (stream) stream.getTracks().forEach(track => track.stop());
              setStreamObj(null);
              if (onBarcodeFound) onBarcodeFound(result.getText());
              onClose();
              return;
            }
          } catch (e) {}
          animationId = requestAnimationFrame(scanLoop);
        };

        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => scanLoop();
          if (videoRef.current.readyState >= 2) scanLoop();
        }
      } catch (e: any) {
        setError("Impossibile aprire fotocamera: " + (e?.message || e));
        setScanning(false);
      }
    })();

    return () => {
      active = false;
      setScanning(false);
      // Stop stream video (in ogni caso!)
      const toStop = stream || streamObj;
      if (toStop) {
        toStop.getTracks().forEach(track => track.stop());
      }
      setStreamObj(null);
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (animationId) cancelAnimationFrame(animationId);
    };
    // eslint-disable-next-line
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
      <div className="absolute top-3 right-3">
        <button
          onClick={onClose}
          className="bg-white/90 px-3 py-1 rounded-xl shadow font-semibold text-gray-700 hover:bg-gray-100 text-lg"
        >
          ×
        </button>
      </div>
      <div className="flex flex-col items-center w-full h-full justify-center">
        <h2 className="text-lg font-bold text-white mb-2">Scannerizza codice a barre</h2>
        <div
          className="relative w-full flex items-center justify-center"
          style={{ maxWidth: 480, height: 340 }}
        >
          <video
            ref={videoRef}
            style={{
              width: "100vw",
              maxWidth: 480,
              height: 340,
              borderRadius: 18,
              objectFit: "cover",
              background: "#000"
            }}
            muted
            autoPlay
            playsInline
          />
          {/* Box overlay */}
          <div
            style={{
              position: "absolute",
              border: "3px solid #0ea5e9",
              borderRadius: 18,
              top: "50%",
              left: "50%",
              width: 300,
              height: 150,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              boxShadow: "0 0 32px 0 #0ea5e955"
            }}
          />
        </div>
        {/* Canvas invisibile usato per cropping */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {error && (
          <div className="text-red-500 text-sm mt-3 bg-white/90 px-2 py-1 rounded">{error}</div>
        )}
        <p className="mt-3 text-white text-sm">
          Inquadra <b>un solo barcode</b> nel riquadro blu.<br />
          Si chiude appena riconosciuto.
        </p>
        {!scanning && (
          <button
            className="mt-5 bg-cyan-600 hover:bg-cyan-800 text-white px-5 py-2 rounded-xl font-semibold"
            onClick={onClose}
          >
            Chiudi
          </button>
        )}
      </div>
    </div>
  );
}
