import { useState, useEffect } from "react";
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import JsBarcode from "jsbarcode";

type Props = {
  open: boolean;
  onClose: () => void;
  sku: string;
  ean: string;
};

const LABEL_W = 192;
const LABEL_H = 92;

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
  sku: { fontWeight: 700, fontSize: 14, marginBottom: 2 },
  ean: { fontSize: 12, marginTop: 2, letterSpacing: 2 },
  barcodeWrap: { margin: 2, width: 160, height: 38, alignItems: "center" },
});

function generateBarcodePngDataURL(ean: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, ean, {
        format: "EAN13",
        width: 2,
        height: 40,
        displayValue: false,
        margin: 0,
      });
      resolve(canvas.toDataURL("image/png"));
    } catch (e) {
      reject(e);
    }
  });
}

export default function GeneraEtichetteModal({ open, onClose, sku, ean }: Props) {
  const [qty, setQty] = useState(1);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (ean) {
      generateBarcodePngDataURL(ean)
        .then(setBarcodeUrl)
        .catch(() => setBarcodeUrl(null));
    }
  }, [ean]);

  // Handle input qty
  function handleQtyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setQty(Number.isFinite(val) && val > 0 ? val : 1);
  }

  // Crea PDF solo su richiesta (no rendering in tempo reale)
  async function handleDownloadPDF() {
    if (!barcodeUrl) return;
    setPdfLoading(true);

    const doc = (
      <Document>
        {[...Array(qty)].map((_, i) => (
          <Page
            key={i}
            size={{ width: LABEL_W, height: LABEL_H }}
            style={styles.page}
          >
            <View style={styles.label}>
              <Text style={styles.sku}>{sku}</Text>
              <Image src={barcodeUrl} style={styles.barcodeWrap} />
              <Text style={styles.ean}>{ean}</Text>
            </View>
          </Page>
        ))}
      </Document>
    );

    // Genera blob e scarica
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

  // Stampa diretta (HTML preview)
  function handleStampaDiretta() {
    if (!barcodeUrl) return;
    const win = window.open("", "_blank", "width=320,height=200");
    if (win) {
      win.document.write(`
        <html>
        <head>
          <title>Stampa Etichetta</title>
          <style>
            body { margin:0; background:#fff; }
            .etichetta {
              width:${LABEL_W}px; height:${LABEL_H}px; border:1px solid #d4d4d4; border-radius:6px;
              display:flex; flex-direction:column; align-items:center; justify-content:center;
              font-size:14px; margin:0 auto; background:#fafbfc;
            }
            .sku { font-weight:bold; margin-bottom:2px; font-size:15px;}
            .ean { font-size:12px; margin-top:2px; letter-spacing:2px;}
            img { margin:2px; width:160px; height:38px;}
          </style>
        </head>
        <body>
          <div class="etichetta">
            <div class="sku">${sku}</div>
            <img src="${barcodeUrl}" />
            <div class="ean">${ean}</div>
          </div>
          <script>
            setTimeout(()=>{window.print();}, 400);
          </script>
        </body>
        </html>
      `);
      win.document.close();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl px-6 py-6 min-w-[340px] w-full max-w-xs relative flex flex-col items-center">
        <button className="absolute top-2 right-4 text-2xl text-neutral-400 hover:text-black" onClick={onClose}>×</button>
        <h3 className="font-bold text-lg text-blue-700 mb-2 text-center">Genera Etichetta (PDF)</h3>
        {/* ANTEPRIMA */}
        <div className="mb-2 w-full flex flex-col items-center">
          <div className="border border-gray-300 rounded-md bg-gray-50 mb-2 py-2 px-2 flex flex-col items-center" style={{ width: LABEL_W, height: LABEL_H }}>
            <div className="font-mono text-[15px] font-bold mb-1">{sku}</div>
            {barcodeUrl && <img src={barcodeUrl} alt="barcode" style={{ width: 160, height: 38, background: "#fff" }} />}
            <div className="text-xs tracking-widest">{ean}</div>
          </div>
        </div>
        <div className="mb-2 text-xs text-neutral-700 text-center">EAN: <b>{ean}</b></div>
        <div className="flex items-center mb-4 w-full justify-center">
          <label className="mr-2 text-xs font-bold">Q.tà etichette</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={handleQtyChange}
            className="border rounded px-2 py-1 w-16 text-center font-bold"
          />
        </div>
        <div className="flex gap-2 w-full">
          {barcodeUrl && (
            <button
              className="w-1/2 py-2 font-bold rounded-lg shadow bg-blue-600 text-white hover:bg-blue-800 transition text-xs"
              disabled={pdfLoading}
              onClick={handleDownloadPDF}
            >
              {pdfLoading ? "Creazione PDF..." : "Scarica PDF"}
            </button>
          )}
          {barcodeUrl && (
            <button
              className="w-1/2 py-2 font-bold rounded-lg shadow bg-green-600 text-white hover:bg-green-800 transition text-xs"
              onClick={handleStampaDiretta}
            >
              Stampa subito
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
