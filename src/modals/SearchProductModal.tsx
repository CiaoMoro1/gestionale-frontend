import { useEffect, useRef } from "react";
import Quagga from "quagga";

export default function QuaggaTest({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

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

    Quagga.onDetected((result: any) => {
      if (!result.codeResult?.code) return;
      alert("Letto: " + result.codeResult.code);
      console.log("TROVATO:", result.codeResult.code, result);
    });

    return () => {
      Quagga.offDetected();
      try { Quagga.stop(); } catch {}
    };
  }, [open]);

  if (!open) return null;

  return (
    <div>
      <div ref={scannerRef} style={{ width: 320, height: 320, border: "1px solid cyan" }} />
      <button onClick={onClose}>Chiudi</button>
    </div>
  );
}
