import React, { useState, useEffect } from "react";
import { PDFDocument, type PDFPage } from "pdf-lib";
import { useDropzone } from "react-dropzone";

const A4_WIDTH = 595.28;   // pt
const A4_HEIGHT = 841.89;  // pt

const EtichetteVendor: React.FC = () => {
  const [asnFile, setAsnFile] = useState<File | null>(null);
  const [colliFile, setColliFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const asnDropzone = useDropzone({
    accept: { "application/pdf": [] },
    multiple: false,
    onDrop: (acceptedFiles) => {
      setAsnFile(acceptedFiles[0] || null);
      setErrorMsg(null);
    },
  });

  const colliDropzone = useDropzone({
    accept: { "application/pdf": [] },
    multiple: false,
    onDrop: (acceptedFiles) => {
      setColliFile(acceptedFiles[0] || null);
      setErrorMsg(null);
    },
  });

  const resetAll = () => {
    setAsnFile(null);
    setColliFile(null);
    setErrorMsg(null);
  };

  const handleGeneratePDF = async () => {
    setErrorMsg(null);
    if (!asnFile || !colliFile) {
      setErrorMsg("Carica entrambi i file PDF.");
      return;
    }
    setLoading(true);
    try {
      const [asnBytes, colliBytes] = await Promise.all([
        asnFile.arrayBuffer(),
        colliFile.arrayBuffer(),
      ]);

      const asnPdfDoc = await PDFDocument.load(asnBytes);
      const colliPdfDoc = await PDFDocument.load(colliBytes);

      if (asnPdfDoc.getPageCount() < 1) {
        throw new Error("Il file ASN è vuoto.");
      }
      const numColli = colliPdfDoc.getPageCount();
      if (numColli < 1) {
        throw new Error("Il file Colli non ha etichette.");
      }

      // output
      const outputPdf = await PDFDocument.create();

      // Pagina ASN (singola) + tutte le pagine colli
      const asnPage: PDFPage = asnPdfDoc.getPage(0);
      const colliPages: PDFPage[] = [];
      for (let i = 0; i < numColli; i++) {
        colliPages.push(colliPdfDoc.getPage(i));
      }

      // Array etichette: n volte ASN (quante i colli), poi tutte le etichette colli
      const etichette: PDFPage[] = [];
      for (let i = 0; i < numColli; i++) etichette.push(asnPage);
      etichette.push(...colliPages);

      // Impagina 4 per A4
      for (let i = 0; i < etichette.length; i += 4) {
        const page = outputPdf.addPage([A4_WIDTH, A4_HEIGHT]);
        for (let j = 0; j < 4 && i + j < etichette.length; j++) {
          const srcPage = etichette[i + j];
          const embedded = await outputPdf.embedPage(srcPage);

          const width = embedded.width;
          const height = embedded.height;

          const scaleX = (A4_WIDTH / 2) / width;
          const scaleY = (A4_HEIGHT / 2) / height;
          const scale = Math.min(scaleX, scaleY) * 0.98; // piccolo margine

          const x = (j % 2) * (A4_WIDTH / 2) + 6;
          const y = A4_HEIGHT - ((Math.floor(j / 2) + 1) * (A4_HEIGHT / 2)) + 6;

          page.drawPage(embedded, {
            x,
            y,
            xScale: scale,
            yScale: scale,
          });
        }
      }

      const pdfBytes = await outputPdf.save(); // Uint8Array

      // ✅ Fix TS2322: crea un vero ArrayBuffer ritagliato
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg("Errore nella generazione: " + msg);
    } finally {
      setLoading(false);
    }
  };

  // Simple preview of selected PDFs (solo nome e #pagine)
  const fileInfo = async (file: File | null) => {
    if (!file) return null;
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const n = pdfDoc.getPageCount();
      return `(${n} pagina${n > 1 ? "e" : ""})`;
    } catch {
      return null;
    }
  };

  const [asnInfo, setAsnInfo] = useState<string | null>(null);
  const [colliInfo, setColliInfo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setAsnInfo(asnFile ? await fileInfo(asnFile) : null);
      setColliInfo(colliFile ? await fileInfo(colliFile) : null);
    })();
  }, [asnFile, colliFile]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">Etichette Vendor Amazon</h1>
      <p className="text-gray-500 mb-4">
        Carica <b>1 PDF etichetta ASN</b> (singola pagina) e <b>1 PDF etichette Colli</b> (una pagina per collo).
        <br />
        Verrà creato un PDF unico: 4 etichette per foglio A4, pronto per la stampa.
      </p>

      <div className="grid grid-cols-2 gap-6">
        <div
          {...asnDropzone.getRootProps()}
          className={`border-2 p-4 rounded-xl cursor-pointer text-center transition hover:border-blue-500 ${
            asnDropzone.isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
        >
          <input {...asnDropzone.getInputProps()} />
          <span className="block font-semibold mb-2">ASN</span>
          <span className="block text-gray-600 text-sm">
            {asnFile ? asnFile.name : "Trascina o scegli etichetta ASN"}
          </span>
          {asnInfo && <span className="block text-xs text-blue-700 mt-1">{asnInfo}</span>}
        </div>

        <div
          {...colliDropzone.getRootProps()}
          className={`border-2 p-4 rounded-xl cursor-pointer text-center transition hover:border-blue-500 ${
            colliDropzone.isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
        >
          <input {...colliDropzone.getInputProps()} />
          <span className="block font-semibold mb-2">Colli</span>
          <span className="block text-gray-600 text-sm">
            {colliFile ? colliFile.name : "Trascina o scegli etichette Colli"}
          </span>
          {colliInfo && <span className="block text-xs text-blue-700 mt-1">{colliInfo}</span>}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow disabled:bg-gray-400"
          onClick={handleGeneratePDF}
          disabled={!asnFile || !colliFile || loading}
        >
          {loading ? "Generazione in corso..." : "Genera PDF Etichette"}
        </button>
        <button
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-3 rounded-xl shadow"
          onClick={resetAll}
          disabled={loading}
        >
          Reset
        </button>
      </div>

      {errorMsg && <div className="text-red-600 mt-2 font-semibold">{errorMsg}</div>}
    </div>
  );
};

export default EtichetteVendor;
