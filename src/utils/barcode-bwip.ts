import bwipjs from "bwip-js";

/**
 * Genera un DataURL PNG del barcode EAN13.
 */
export function generateEAN13Barcode(ean: string, width = 264, height = 56): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      bwipjs.toCanvas(canvas, {
        bcid: "ean13",
        text: ean,
        scale: 2.2,           // <--- DIMINUISCI il valore: barre più strette
        height: height / 2,
        includetext: false,   // <--- NO testo dentro il barcode!
        paddingwidth: 0,
        paddingheight: 14,    // Più spazio sotto
        backgroundcolor: "FFFFFF",
        barcolor: "#000000",
      });
      resolve(canvas.toDataURL("image/png"));
    } catch (err) {
      reject(err);
    }
  });
}

