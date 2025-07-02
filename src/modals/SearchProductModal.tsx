import { useEffect, useRef, useState } from "react";
import Quagga from "quagga";

export default function DebugQuagga({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [detected, setDetected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDetected([]);

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current!,
          constraints: {
            facingMode: "environment",
            width: { min: 640 },
            height: { min: 480 }
          },
        },
        locator: { patchSize: "large", halfSample: true },
        decoder: { readers: ["ean_reader"] },
        locate: true,
        frequency: 10,
      },
      (err?: any) => {
        if (!err) Quagga.start();
      }
    );

    Quagga.onDetected((result: any) => {
      if (!result.codeResult?.code) return;
      console.log("TROVATO:", result.codeResult.code, result.box);
      setDetected((prev) =>
        prev.includes(result.codeResult.code)
          ? prev
          : [...prev, result.codeResult.code]
      );
    });

    return () => {
      Quagga.offDetected();
      try { Quagga.stop(); } catch {}
      setDetected([]);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div>
      <div ref={scannerRef} style={{ width: 320, height: 320, border: "1px solid cyan" }} />
      <div>Barcodes trovati:</div>
      <ul>
        {detected.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <button onClick={onClose}>Chiudi</button>
    </div>
  );
}
