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

  // (consigliato) metti SHA256 se anche il backend firma SHA256
  // qz.security.setSignatureAlgorithm("SHA256");

  securityReady = true;
}

export async function qzEnsureConnected(): Promise<void> {
  await qzSetupSecurity();
  if (qz.websocket.isActive()) return;

  const secure = window.location.protocol === "https:";
  await qz.websocket.connect({ usingSecure: secure });
}


/**
 * In qz-tray 2.2.5 non esiste printers.findAll().
 * Per listare le stampanti si usa printers.find() senza query (o con query vuota).
 */
export async function qzListPrinters(): Promise<string[]> {
  await qzEnsureConnected();

  const res = await qz.printers.find("");
  if (Array.isArray(res)) return res;
  // se per qualche motivo torna stringa, la incapsulo
  return res ? [res] : [];
}

export async function qzGetDefaultPrinter(): Promise<string> {
  await qzEnsureConnected();

  // API reale esistente in qz-tray 2.2.5
  const name = await qz.printers.getDefault();
  if (!name) throw new Error("Stampante predefinita non trovata");
  return name;
}

type PrintZplParams = {
  printer?: string; // se omesso: usa default
  zpl: string[] | string;
};

export async function qzPrintZpl(params: PrintZplParams): Promise<void> {
  await qzEnsureConnected();

  const printerName = params.printer ? params.printer : await qzGetDefaultPrinter();

  const cfg: QZConfig = qz.configs.create(printerName);

  const arr = Array.isArray(params.zpl) ? params.zpl : [params.zpl];

  const data: QZRawData[] = arr.map((z): QZRawData => ({
    type: "raw",
    format: "command",
    data: z,
  }));

  await qz.print(cfg, data);
}
