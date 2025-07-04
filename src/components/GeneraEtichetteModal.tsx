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

const LABEL_W = 192; // px (HTML preview singola)
const LABEL_H = 92;  // px

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#fff",
    width: LABEL_W,
    height: LABEL_H,
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    width: LABEL_W,
    height: LABEL_H,
    padding: 0,
    margin: 0,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    backgroundColor: "#fafbfc",
  },
  sku: {
    fontWeight: 700,
    marginBottom: 2,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    maxWidth: LABEL_W - 10,
  },
  ean: { fontSize: 14, marginTop: 3, letterSpacing: 2 },
  barcodeWrap: { margin: 0, width: LABEL_W - 2, height: 48, alignItems: "center" },
});

function computeAutoFontSize(sku: string, containerWidth: number, baseFont: number = 15, minFont: number = 7) {
  const charWidth = baseFont * 0.62;
  const requiredWidth = sku.length * charWidth;
  if (requiredWidth < containerWidth) return baseFont;
  const shrinkFont = Math.max(minFont, Math.floor(containerWidth / (sku.length * 0.62)));
  return shrinkFont;
}

export default function GeneraEtichetteModal({ open, onClose, sku, ean }: Props) {
  const [qty, setQty] = useState(1);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [autoFont, setAutoFont] = useState(15);

  useEffect(() => {
    if (sku) setAutoFont(computeAutoFontSize(sku, LABEL_W - 12, 15, 7));
  }, [sku]);

  useEffect(() => {
    if (ean) {
      generateEAN13Barcode(ean, 264, 56) // canvas largo!
        .then(setBarcodeUrl)
        .catch(() => setBarcodeUrl(null));
    }
  }, [ean]);

  function handleQtyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setQty(Number.isFinite(val) && val > 0 ? val : 1);
  }

  // PDF etichetta singola
  async function handleDownloadPDF() {
    if (!barcodeUrl) return;
    setPdfLoading(true);

    const fontSizeForPdf = computeAutoFontSize(sku, LABEL_W - 10, 14, 7);
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
                width: LABEL_W - 40, // margine più grande (20px per lato)
                height: 34,
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

  // Stampa diretta
  function handleStampaDiretta() {
    if (!barcodeUrl) return;
    const fontPx = autoFont;
    const win = window.open("", "_blank", "width=320,height=200");
    if (win) {
      win.document.write(`
        <html>
        <head>
          <title>Stampa Etichetta</title>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>
            body { margin:0; background:#fff; display:flex; align-items:center; justify-content:center; height:100vh;}
            .etichetta {
              width:${LABEL_W}px; height:${LABEL_H}px; 
              border:1px solid #d4d4d4; border-radius:7px;
              box-shadow: 0 4px 16px 0 #0001;
              display:flex; flex-direction:column; align-items:center; justify-content:center;
              font-size:13px; margin:0 auto; background:#fafbfc;
              padding: 8px 0;
            }
            .sku {
              font-family: monospace;
              font-weight:bold; margin-bottom:2px;
              font-size:${fontPx}px; white-space:nowrap;
              overflow:hidden; text-overflow:clip; max-width:94%;
              line-height:1.1;
            }
            .ean { font-size:14px; margin-top:3px; letter-spacing:2px;}
            img { margin:0; width:180px; height:50px;}
          </style>
        </head>
        <body>
          <div class="etichetta">
            <div class="sku">${sku}</div>
            <img src="${barcodeUrl}" />
            <div class="ean">${ean}</div>
          </div>
          <script>
            setTimeout(()=>{window.print();}, 300);
          </script>
        </body>
        </html>
      `);
      win.document.close();
    }
  }

  // PDF A4, 24 etichette (3x8)
  function handleAnteprimaFoglio() {
    if (!barcodeUrl) return;
    const cols = 3;
    const rows = 8;
    const labelW = 70; // mm
    const labelH = 35; // mm
    const marginTop = 5; // mm
    const marginLeft = 0; // mm

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
          const x = marginLeft + c * labelW;
          const y = marginTop + r * labelH;

          // Bordo etichetta sottile grigio chiaro
          doc.setDrawColor(210);
          doc.rect(x, y, labelW, labelH);

          // SKU
          doc.setFontSize(13);
          doc.setFont("courier", "bold");
          doc.text(sku, x + labelW / 2, y + 11, { align: "center" });

          // Barcode bello largo!
          doc.addImage(barcodeUrl, "PNG", x + 10, y + 15, labelW - 20, 12); // 10mm margine per lato


          // EAN
          doc.setFontSize(13);
          doc.setFont("helvetica", "normal");
          doc.text(ean, x + labelW / 2, y + labelH - 5, { align: "center" });

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
      <div className="bg-white rounded-2xl shadow-xl px-5 py-6 w-full max-w-xs sm:max-w-[370px] relative flex flex-col items-center">
        <button className="absolute top-2 right-4 text-2xl text-neutral-400 hover:text-black" onClick={onClose}>×</button>
        <h3 className="font-bold text-xl text-blue-700 mb-3 text-center">Genera Etichetta <span className="hidden sm:inline">(PDF)</span></h3>
        
        {/* ANTEPRIMA */}
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
                    width: LABEL_W - 32, // lascia 16px per lato di bianco (prova a ridurre ancora per più "aria")
                    height: 36,          // un po’ meno alto se vuoi meno impattante
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
            type="number"
            min={1}
            max={99}
            inputMode="numeric"
            value={qty}
            onChange={handleQtyChange}
            className="border border-gray-300 rounded px-2 py-1 w-16 text-center font-bold text-lg bg-white shadow-sm focus:outline-cyan-500"
            style={{ fontSize: "17px" }}
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
            onClick={handleStampaDiretta}
            disabled={!barcodeUrl}
          >
            Stampa subito
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
