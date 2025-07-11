import { useState, useEffect } from "react";
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import jsPDF from "jspdf";
import { generateEAN13Barcode } from "../utils/barcode-bwip";

type Props = {
  open: boolean;
  onClose: () => void;
  sku: string;
  ean: string;
};

// Brother 62x29mm (a 96dpi ≈ 234x110px)
const LABEL_W = 234;
const LABEL_H = 110;

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#fff",
    width: LABEL_W,
    height: LABEL_H,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
  },
  label: {
    width: LABEL_W,
    height: LABEL_H,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafbfc",
    padding: 0,
    margin: 0,
  },
  sku: {
    fontWeight: 700,
    marginBottom: 2,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
    maxWidth: LABEL_W - 10,
    fontSize: 26,
  },
  ean: { fontSize: 15, marginTop: 1, letterSpacing: 2 },
  barcodeWrap: { width: LABEL_W - 8, height: 60, alignItems: "center", margin: 0 },
});

function computeAutoFontSize(sku: string, containerWidth: number, baseFont: number = 26, minFont: number = 10) {
  const charWidth = baseFont * 0.62;
  const requiredWidth = sku.length * charWidth;
  if (requiredWidth < containerWidth) return baseFont;
  const shrinkFont = Math.max(minFont, Math.floor(containerWidth / (sku.length * 0.62)));
  return shrinkFont;
}

export default function GeneraEtichetteModal({ open, onClose, sku, ean }: Props) {
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState("1");
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [autoFont, setAutoFont] = useState(26);

  // Auto-adatta font SKU
  useEffect(() => {
    setAutoFont(computeAutoFontSize(sku, LABEL_W - 12, 26, 10));
  }, [sku]);

  // Quantità: permette di cancellare tutto per scrivere nuovo valore
  useEffect(() => {
    setQtyInput(String(qty));
  }, [qty]);

  // Genera il barcode PNG ogni volta che cambia l'EAN
  useEffect(() => {
    if (ean) {
      generateEAN13Barcode(ean, LABEL_W - 8, 60)
        .then(setBarcodeUrl)
        .catch(() => setBarcodeUrl(null));
    }
  }, [ean]);

  // Quantità: solo numeri > 0, max 99
  function handleQtyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "");
    setQtyInput(val);
    if (val === "") return;
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0 && n <= 99) setQty(n);
  }

  // Scarica PDF etichette 62x29mm
  async function handleDownloadPDF() {
    if (!barcodeUrl) return;
    setPdfLoading(true);
    const fontSizeForPdf = computeAutoFontSize(sku, LABEL_W - 14, 24, 10);
    const doc = (
      <Document>
        {[...Array(qty)].map((_, i) => (
          <Page
            key={i}
            size={{ width: LABEL_W, height: LABEL_H }}
            style={styles.page}
          >
            <View style={styles.label}>
              <Text
                style={{
                  ...styles.sku,
                  fontSize: fontSizeForPdf,
                }}
                render={() => sku}
              />
              <Image src={barcodeUrl} style={{
                width: LABEL_W - 8,
                height: 60,
                margin: "0 auto",
                alignSelf: "center"
              }} />
              <Text style={styles.ean}>{ean}</Text>
            </View>
          </Page>
        ))}
      </Document>
    );
    const asPdf = pdf();
    asPdf.updateContainer(doc);
    const blob = await asPdf.toBlob();
    setPdfLoading(false);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etichette_${sku}_${ean}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // APRE PDF e stampa automatico (stampa perfetta su Brother, senza download)
async function handleStampaPDFDiretta() {
  if (!barcodeUrl) return;
  setPdfLoading(true);
  const fontSizeForPdf = computeAutoFontSize(sku, LABEL_W - 14, 24, 10);
  const doc = (
    <Document>
      {[...Array(qty)].map((_, i) => (
        <Page
          key={i}
          size={{ width: LABEL_W, height: LABEL_H }}
          style={styles.page}
        >
          <View style={styles.label}>
            <Text
              style={{
                ...styles.sku,
                fontSize: fontSizeForPdf,
              }}
              render={() => sku}
            />
            <Image src={barcodeUrl} style={{
              width: LABEL_W - 8,
              height: 60,
              margin: "0 auto",
              alignSelf: "center"
            }} />
            <Text style={styles.ean}>{ean}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
  const asPdf = pdf();
  asPdf.updateContainer(doc);
  const blob = await asPdf.toBlob();
  setPdfLoading(false);

  const pdfUrl = URL.createObjectURL(blob);

  // **APRE SOLO IL PDF, lascia che l’utente prema il tasto “stampa”**
  window.open(pdfUrl, "_blank");


    // HTML intermedio per print automatico
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(`
        <html>
        <head>
          <title>Stampa PDF Etichetta</title>
          <style>
            html, body { margin:0; padding:0; height:100%; }
            iframe { border:none; width:100vw; height:100vh; }
          </style>
        </head>
        <body>
          <iframe id="etiframe" src="${pdfUrl}"></iframe>
          <script>
            const frame = document.getElementById('etiframe');
            frame.onload = function() {
              setTimeout(function() {
                frame.contentWindow.focus();
                frame.contentWindow.print();
              }, 400);
            }
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  }

  // PDF A4, 24 etichette (3x8, 70x35mm)
  function handleAnteprimaFoglio() {
    if (!barcodeUrl) return;
    const cols = 3;
    const rows = 8;
    const labelW = 70; // mm
    const labelH = 35; // mm
    const marginTop = 5; // mm

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    let q = qty;
    let idx = 0;
    for (let page = 0; q > 0; page++) {
      if (page > 0) doc.addPage();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (idx >= qty) break;
          const x = c * labelW;
          const y = marginTop + r * labelH;

          doc.setDrawColor(210);
          doc.rect(x, y, labelW, labelH);

          // SKU
          doc.setFontSize(13);
          doc.setFont("courier", "bold");
          doc.text(sku, x + labelW / 2, y + 11, { align: "center" });

          // Barcode
          doc.addImage(barcodeUrl, "PNG", x + 6, y + 14, labelW - 12, 13);

          // EAN
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text(ean, x + labelW / 2, y + labelH - 4, { align: "center" });

          idx++;
          q--;
          if (q <= 0) break;
        }
        if (q <= 0) break;
      }
    }
    window.open(doc.output("bloburl"), "_blank");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl px-5 py-6 w-full max-w-xs sm:max-w-[390px] relative flex flex-col items-center">
        <button className="absolute top-2 right-4 text-2xl text-neutral-400 hover:text-black" onClick={onClose}>×</button>
        <h3 className="font-bold text-xl text-blue-700 mb-3 text-center">Genera Etichetta</h3>
        <div className="mb-4 w-full flex flex-col items-center">
          <div
            className="border border-gray-200 shadow-sm rounded-lg bg-gray-50 py-2 px-3 flex flex-col items-center"
            style={{
              width: LABEL_W,
              height: LABEL_H,
              boxShadow: "0 1px 8px #0001",
              margin: "0 auto",
            }}
          >
            <div
              className="font-mono font-bold mb-1 text-center"
              style={{
                fontSize: `${autoFont}px`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                minWidth: 0,
                maxWidth: "100%",
                lineHeight: 1.1,
                letterSpacing: "0.5px",
              }}
            >
              {sku}
            </div>
              {barcodeUrl && (
                <img
                  src={barcodeUrl}
                  alt="barcode"
                  style={{
                    width: LABEL_W - 8,
                    height: 60,
                    background: "#fff",
                    display: "block",
                    margin: "0 auto",
                    objectFit: "contain",
                  }}
                />
              )}
            <div className="text-base tracking-widest text-center mt-1">{ean}</div>
          </div>
        </div>
        <div className="flex items-center mb-4 w-full justify-center">
          <label className="mr-2 text-xs font-semibold">Q.tà etichette</label>
          <input
            type="text"
            min={1}
            max={99}
            inputMode="numeric"
            value={qtyInput}
            onChange={handleQtyChange}
            className="border border-gray-300 rounded px-2 py-1 w-16 text-center font-bold text-lg bg-white shadow-sm focus:outline-cyan-500"
            style={{ fontSize: "17px" }}
            pattern="\d*"
            onBlur={() => {
              if (!qtyInput || qtyInput === "0") setQtyInput(String(qty > 0 ? qty : 1));
            }}
          />
        </div>
        <div className="flex gap-2 w-full">
          <button
            className="w-1/2 py-2 font-bold rounded-lg shadow bg-blue-600 text-white hover:bg-blue-800 transition text-sm"
            disabled={pdfLoading}
            onClick={handleDownloadPDF}
          >
            {pdfLoading ? "Creazione PDF..." : "Scarica PDF"}
          </button>
          <button
            className="w-1/2 py-2 font-bold rounded-lg shadow bg-green-600 text-white hover:bg-green-800 transition text-sm"
            onClick={handleStampaPDFDiretta}
            disabled={!barcodeUrl}
          >
            Stampa subito (PDF)
          </button>
        </div>
        <button
          className="w-full mt-3 py-2 font-bold rounded-lg shadow bg-cyan-600 text-white hover:bg-cyan-800 transition text-sm"
          onClick={handleAnteprimaFoglio}
          disabled={!barcodeUrl}
        >
          Genera PDF (foglio 24 etichette)
        </button>
      </div>
    </div>
  );
}
