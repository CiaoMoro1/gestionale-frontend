import { FileText, Trash2, Printer } from "lucide-react";

type LabelActionsProps = {
  etichetta: { labels: string[] };
  isMerging: boolean;
  setMergedPdf: (pdf: string) => void;
  setIsMerging: (v: boolean) => void;
  setModalPdfOpen: (v: boolean) => void;
  onPrint: () => void;
  onDelete: () => void;
  stato_ordine: string;
  apiLoading: boolean;
  mergePdfBase64Array: (arr: string[]) => Promise<string>;
};

export default function LabelActions({
  etichetta,
  isMerging,
  setMergedPdf,
  setIsMerging,
  setModalPdfOpen,
  onPrint,
  onDelete,
  stato_ordine,
  apiLoading,
  mergePdfBase64Array,
}: LabelActionsProps) {
  // Determina colore badge in base allo stato
  const statoBadge = stato_ordine === "etichette"
    ? { label: "Etichette stampate", className: "bg-green-100 text-green-700" }
    : { label: "Prelievo", className: "bg-yellow-100 text-yellow-800" };

  // Funzione per gestire visualizzazione e merge PDF
  const handleView = async () => {
    setIsMerging(true);
    if (etichetta.labels.length <= 1) {
      setMergedPdf(etichetta.labels[0] || "");
      setIsMerging(false);
      setModalPdfOpen(true);
    } else {
      try {
        const merged = await mergePdfBase64Array(etichetta.labels);
        setMergedPdf(merged);
        setIsMerging(false);
        setModalPdfOpen(true);
      } catch (e) {
        alert("Errore durante l'unione delle etichette PDF");
        setIsMerging(false);
      }
    }
  };

  // Non mostrare niente se non ci sono etichette
  if (!etichetta.labels.length) return null;

  return (
    <div className="flex flex-wrap gap-3 justify-center items-center mt-6">
      {/* Bottone stampa */}
      <button
        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-xl shadow text-fluid-base font-semibold"
        onClick={onPrint}
        disabled={apiLoading}
      >
        <Printer size={22} /> Stampa etichette
      </button>
      {/* Bottone visualizza */}
      <button
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl shadow text-fluid-base font-semibold"
        onClick={handleView}
        disabled={apiLoading || isMerging}
      >
        <FileText size={22} /> {isMerging ? "Unione PDF..." : "Visualizza etichette"}
      </button>
      {/* Bottone elimina */}
      <button
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl shadow text-fluid-base font-semibold"
        onClick={onDelete}
        disabled={apiLoading}
      >
        <Trash2 size={22} /> Elimina etichetta
      </button>
      {/* Stato ordine badge */}
      <div className={`ml-4 text-sm font-bold px-3 py-2 rounded-xl ${statoBadge.className}`}>
        Stato ordine: {statoBadge.label}
      </div>
    </div>
  );
}
