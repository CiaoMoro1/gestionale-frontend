// src/lib/qzPrint.ts
import qz, { type QZRawData, type QZConfig } from "qz-tray";

const API = import.meta.env.VITE_API_URL as string;

let securityReady = false;

export async function qzSetupSecurity(): Promise<void> {
  if (securityReady) return;

  // Certificato (PEM)
  qz.security.setCertificatePromise(async () => {
    const resp = await fetch(`${API}/api/qz/certificate`);
    if (!resp.ok) throw new Error("Impossibile caricare certificato QZ");
    return await resp.text();
  });

  // Firma lato backend
  qz.security.setSignaturePromise(async (toSign: string) => {
    const resp = await fetch(`${API}/api/qz/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: toSign }),
    });

    const data = (await resp.json().catch(() => ({}))) as {
      signature?: string;
      error?: string;
    };

    if (!resp.ok || !data.signature) {
      throw new Error(data.error || "Firma QZ fallita");
    }
    return data.signature;
  });

  // Se firmi SHA256 lato backend (openssl dgst -sha256), mettilo esplicito
  // Nota: su alcune versioni è già default, ma qui è più chiaro.
  qz.security.setSignatureAlgorithm?.("SHA256");

  securityReady = true;
}

export async function qzEnsureConnected(): Promise<void> {
  await qzSetupSecurity();
  if (qz.websocket.isActive()) return;

  // Se la pagina è https, il browser blocca ws:// => serve wss
  const secure = window.location.protocol === "https:";
  await qz.websocket.connect({ usingSecure: secure });
}

/**
 * Lista stampanti
 */
export async function qzListPrinters(): Promise<string[]> {
  await qzEnsureConnected();

  const res = await qz.printers.find("");
  if (Array.isArray(res)) return res;
  return res ? [res] : [];
}

/**
 * Trova una Zebra (match per nomi comuni su Windows)
 * Ritorna il nome stampante QZ/Windows oppure lancia errore se non trovata.
 */
export async function qzGetZebraPrinter(): Promise<string> {
  await qzEnsureConnected();

  const hints = ["ZDesigner", "Zebra", "GK", "ZD", "ZT"];

  for (const h of hints) {
    try {
      const name = await qz.printers.find(h);
      if (name && typeof name === "string") return name;
    } catch {
      // continua
    }
  }

  // Se non la trova, mostriamo cosa vede QZ (super utile per debug)
  const all = await qzListPrinters();
  throw new Error(
    `Zebra non trovata. Stampanti viste: ${all.length ? all.join(" | ") : "(nessuna)"}`
  );
}

type PrintZplParams = {
  /**
   * Se lo passi, stampa su QUELLA stampante (ma tu vuoi "solo Zebra",
   * quindi di default NON lo passare).
   */
  printer?: string;
  zpl: string[] | string;
};

/**
 * Stampa ZPL SOLO su Zebra.
 * - Se printer non è passato => usa automaticamente Zebra
 * - Se Zebra non esiste => ERRORE (non stampa sulla default)
 */
export async function qzPrintZpl(params: PrintZplParams): Promise<void> {
  await qzEnsureConnected();

  const printerName = params.printer ? params.printer : await qzGetZebraPrinter();
  const cfg: QZConfig = qz.configs.create(printerName);

  const arr = Array.isArray(params.zpl) ? params.zpl : [params.zpl];

  const data: QZRawData[] = arr.map((z): QZRawData => ({
    type: "raw",
    format: "command",
    data: z,
  }));

  await qz.print(cfg, data);
}
