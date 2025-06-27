// src/routes/ordini-amazon/dashboard.tsx

import React, { useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { UploadCloud, Loader2 } from "lucide-react";

const DashboardAmazonVendor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setLog([]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setLog(["Seleziona prima un file Excel."]);
      return;
    }
    setLoading(true);
    setLog(["Caricamento in corso..."]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // ATTENZIONE: Modifica l'URL in base al tuo endpoint
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/upload`, {
    method: "POST",
    body: formData,
    });

      if (!res.ok) {
        setLog([`Errore HTTP: ${res.status}`]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.status === "ok") {
        setLog([
        `✅ Importazione completata!`,
        `${data.importati} articoli importati correttamente.`,
        `(${data.po_unici} PO/ordini unici importati)`,
        ...(data.doppioni?.length ? ["⚠️ Doppioni saltati:", ...data.doppioni] : []),
        ...(data.errors?.length ? ["❌ Errori:", ...data.errors] : []),
        ]);
      } else {
        setLog([`❌ Errore: ${data.errors?.join(", ") || "Errore sconosciuto"}`]);
      }
    } catch (err: any) {
      setLog([`❌ Errore durante l’upload: ${err.message}`]);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto mt-8">
      <Card>
        <CardContent className="p-6 flex flex-col gap-4">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <UploadCloud size={28} className="text-blue-600" />
            Carica Ordini Amazon Vendor
          </h1>
          <p className="text-sm text-muted-foreground">
            Seleziona un file Excel (.xls/.xlsx) scaricato dal portale Amazon Vendor. 
            <br />
            <b>NB:</b> Solo le colonne principali verranno importate.
          </p>

          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
            className="mb-2"
            disabled={loading}
          />

          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-fit"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} /> Caricamento...
              </>
            ) : (
              "Carica ordini"
            )}
          </Button>

          {log.length > 0 && (
            <div className="bg-muted rounded p-3 mt-4 text-sm space-y-1 max-h-52 overflow-auto">
              {log.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardAmazonVendor;
