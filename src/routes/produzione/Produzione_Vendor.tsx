import { useEffect, useState, useRef } from "react";
import { Info, Check, X, ChevronDown, Edit, Trash, Loader2, Lock } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateEAN13Barcode } from "../../utils/barcode-bwip";

// Toast component
function Toast({ message, type, onClose }: { message: string, type: "success" | "error", onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2300);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-6 left-1/2 z-[100] -translate-x-1/2 px-5 py-3 rounded-xl font-bold shadow-xl border text-center
      ${type === "success" ? "bg-green-100 border-green-300 text-green-800" : "bg-red-100 border-red-300 text-red-700"}
      animate-toast-pop`}>
      {message}
      <style>{`
        .animate-toast-pop {
          animation: toast-pop .5s cubic-bezier(.4,2,.3,1) both;
        }
        @keyframes toast-pop {
          0% { transform: translateX(-50%) scale(0.8); opacity:0; }
          100% { transform: translateX(-50%) scale(1); opacity:1;}
        }
      `}</style>
    </div>
  );
}

const TITOLO_DA_PRODURRE: Record<string, string> = {
  "": "Inseriti",
  "Da Stampare": "Da Stampare",
  "Stampato": "Stampati",
  "Calandrato": "Calandrati",
  "Cucito": "Cuciti",
  "Confezionato": "Confezionati",
  "Trasferito": "Trasferiti",
  "Rimossi": "Rimossi"
};

type ProduzioneRow = {
  id: number;
  sku: string;
  ean: string;
  qty: number;
  plus?: number | null;
  riscontro?: number | null;
  radice: string;
  start_delivery: string;
  stato: string;
  stato_produzione: string;
  da_produrre: number;
  cavallotti: boolean;
  note?: string;
  modificata_manualmente?: boolean; // <--- AGGIUNGI QUI
};

const STATI_PRODUZIONE = [
  "Da Stampare", "Stampato", "Calandrato", "Cucito", "Confezionato", "Trasferito", "Rimossi"
];


export default function ProduzioneVendor() {
  const [allRows, setAllRows] = useState<ProduzioneRow[]>([]);
  const [rows, setRows] = useState<ProduzioneRow[]>([]);
  const [statoProduzione, setStatoProduzione] = useState<string>("");
  const [radice, setRadice] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [radiciOpen, setRadiciOpen] = useState(false);
  const radiciBoxRef = useRef<HTMLDivElement>(null);
  const [statiOpen, setStatiOpen] = useState(false);
  const statiBoxRef = useRef<HTMLDivElement>(null);
  const [selezionati, setSelezionati] = useState<number[]>([]);
  const [modaleNota, setModaleNota] = useState<{ id: number, nota: string } | null>(null);
 const [statoProduzioneOpenId, setStatoProduzioneOpenId] = useState<number | null>(null);
 const [logMovimentiOpen, setLogMovimentiOpen] = useState<{ id: number, data: any[] } | null>(null);
 const [cavallottoModal, setCavallottoModal] = useState<string | null>(null);
const [cavallottoLoading,] = useState(false);
const [exportMassivoOpen, setExportMassivoOpen] = useState(false);


function estraiMisura(sku: string): string {
  const parts = sku.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

// Funzione che torna una coppia di numeri dalla misura
function parseMisura(misura: string): [number, number] {
  // Es: "40X145" => [40, 145]
  const match = misura.match(/^(\d+)[xX](\d+)$/);
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10)];
  }
  return [Number.NaN, Number.NaN]; // Non riconosciuto
}

async function exportPDF(orderBy: "az" | "misura") {
  const dataExport = rows.filter((r: ProduzioneRow) => selezionati.includes(r.id));
  const byRadice: Record<string, ProduzioneRow[]> = {};
  dataExport.forEach((r: ProduzioneRow) => {
    if (!byRadice[r.radice]) byRadice[r.radice] = [];
    byRadice[r.radice].push(r);
  });

  Object.keys(byRadice).forEach(radice => {
  if (Array.isArray(byRadice[radice])) {
    byRadice[radice].sort((a: ProduzioneRow, b: ProduzioneRow) => {
      if (orderBy === "misura") {
        const misuraA = estraiMisura(a.sku);
        const misuraB = estraiMisura(b.sku);

        // Tenta di parsare "AxB"
        const [numA1, numA2] = parseMisura(misuraA);
        const [numB1, numB2] = parseMisura(misuraB);

        if (!isNaN(numA1) && !isNaN(numB1)) {
          if (numA1 !== numB1) return numA1 - numB1;
          if (!isNaN(numA2) && !isNaN(numB2)) return numA2 - numB2;
        }
        return misuraA.localeCompare(misuraB, "it");
      }
      return a.sku.localeCompare(b.sku, "it");
    });
  }
});


  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  let firstTable = true;
  for (const radice of Object.keys(byRadice)) {
    // OGNI RADICE su una nuova pagina (tranne la prima)
    if (!firstTable) {
      doc.addPage();
    }
    const startY = 15; // fissa su ogni pagina

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Radice: ${radice}`, 12, startY);

    firstTable = false;

    // Barcode EAN -> base64 per ogni riga
    const barcodeMap: Record<string, string> = {};
    const bodyRows: any[] = [];
    for (const r of byRadice[radice]) {
      let barcodeImg: string = "";
      try {
        barcodeImg = await generateEAN13Barcode(r.ean, 70, 70);
      } catch {
        barcodeImg = "";
      }
      barcodeMap[r.ean] = barcodeImg;
      bodyRows.push([
        " ", // cella vuota, verrà disegnata con addImage
        r.sku,
        r.ean,
        r.stato_produzione,
        r.da_produrre,
      ]);
    }

autoTable(doc, {
  startY: startY + 3,
  head: [["Barcode", "SKU", "EAN", "Stato", "Quantità"]],
  body: bodyRows,
  theme: 'grid',
  headStyles: {
    fillColor: [37, 99, 235],
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    fontSize: 12,
    halign: 'center'
  },
  bodyStyles: {
    fontSize: 11,
    valign: 'middle',
    minCellHeight: 15,
    cellPadding: 2,
    overflow: 'ellipsize', // oppure 'visible'
  },
  alternateRowStyles: { fillColor: [245, 249, 255] },
  columnStyles: {
    0: { cellWidth: 40, halign: 'center', overflow: 'visible' }, // barcode
    1: { cellWidth: 80, overflow: 'linebreak' }, // SKU
    2: { cellWidth: 50, overflow: 'ellipsize' }, // EAN
    3: { cellWidth: 40, overflow: 'ellipsize' }, // Stato
    4: { cellWidth: 30, halign: 'center', overflow: 'visible' }, // Quantità
  },
  didDrawCell: function (data: any) {
    // Barcode sulla colonna 0, solo se presente l'immagine
    if (
      data.column.index === 0 &&
      data.row.raw &&
      data.row.raw[2] &&
      barcodeMap[data.row.raw[2]]
    ) {
      doc.addImage(
        barcodeMap[data.row.raw[2]],
        "PNG",
        data.cell.x + 2,
        data.cell.y + 2,
        30, // larghezza barcode in cella
        10
      );
    }
  }
});

  }

  window.open(doc.output("bloburl"), "_blank");

}



 async function openMovimentiLog(produzioneId: number) {
  setLogMovimentiOpen({ id: produzioneId, data: [] }); // apri subito il modale vuoto
  // fetch log
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/${produzioneId}/log`);
  const data = await res.json();
  setLogMovimentiOpen({ id: produzioneId, data });
}
  // Modale modifica da_produrre
  const [modaleDaProdurre, setModaleDaProdurre] = useState<{
    id: number;
    value: number;
    stato: string;
    qty: number;
    plus: number;
    riscontro: number;
  } | null>(null);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [loadingPatch, setLoadingPatch] = useState<boolean>(false);

  // Toast feedback
  const [toast, setToast] = useState<{ msg: string, type: "success" | "error" } | null>(null);

  // Badge animati
  const [badgeAnim, setBadgeAnim] = useState<number>(0);

  // Scrollbar sync refs
  const scrollTopRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (radiciOpen && radiciBoxRef.current && !radiciBoxRef.current.contains(e.target as Node)) setRadiciOpen(false);
      if (statiOpen && statiBoxRef.current && !statiBoxRef.current.contains(e.target as Node)) setStatiOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [radiciOpen, statiOpen]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/produzione`)
      .then(r => r.json())
      .then((data: any) => setAllRows(data.data || data));
  }, [badgeAnim]);

  useEffect(() => {
    let filtrate = allRows;
    if (statoProduzione) filtrate = filtrate.filter(r => r.stato_produzione === statoProduzione);
    if (radice) filtrate = filtrate.filter(r => r.radice === radice);
    if (search) filtrate = filtrate.filter(r =>
      r.sku.toLowerCase().includes(search.toLowerCase()) ||
      r.ean.toLowerCase().includes(search.toLowerCase())
    );
    setRows(filtrate);
    setSelezionati([]);
  }, [allRows, statoProduzione, radice, search]);

  // Sync scroll top/bottom
  useEffect(() => {
    const topDiv = scrollTopRef.current;
    const tableDiv = scrollTableRef.current;
    if (!topDiv || !tableDiv) return;
    const handleTop = () => { tableDiv.scrollLeft = topDiv.scrollLeft; };
    const handleTable = () => { topDiv.scrollLeft = tableDiv.scrollLeft; };
    topDiv.addEventListener("scroll", handleTop);
    tableDiv.addEventListener("scroll", handleTable);
    return () => {
      topDiv.removeEventListener("scroll", handleTop);
      tableDiv.removeEventListener("scroll", handleTable);
    };
  }, [rows.length]);




  
  async function patchProduzione(id: number, body: Partial<ProduzioneRow & { password?: string }>) {
    setLoadingPatch(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.status === 403) {
        const data = await res.json();
        setToast({ msg: data.error || "Password errata.", type: "error" });
        throw new Error(data.error || "Password errata.");
      }
      setBadgeAnim(b => b + 1);
      setToast({ msg: "Quantità aggiornata!", type: "success" });
    } catch (err: any) {
      setToast({ msg: err.message || "Errore generico", type: "error" });
    } finally {
      setLoadingPatch(false);
    }
  }

async function openCavallottoPdf(sku: string, formato: string) {
  // Non serve async, apri semplicemente la pagina HTML:
  window.open(`${import.meta.env.VITE_API_URL}/api/cavallotto/html?sku=${encodeURIComponent(sku)}&formato=${encodeURIComponent(formato)}`, "_blank");
  setCavallottoModal(null);
}

  async function handleModaleDaProdurreSave() {
    if (!modaleDaProdurre) return;
    setLoadingPatch(true);
    setPasswordError("");
    try {
      await patchProduzione(modaleDaProdurre.id, {
        da_produrre: modaleDaProdurre.value,
        password: modaleDaProdurre.stato === "Da Stampare" ? undefined : passwordInput,
      });
      setModaleDaProdurre(null);
      setPasswordInput("");
    } catch (err: any) {
      setPasswordError(err.message || "Password errata.");
    } finally {
      setLoadingPatch(false);
    }
  }

  function handleDaProdurreEdit(r: ProduzioneRow) {
    setModaleDaProdurre({
      id: r.id,
      value: r.da_produrre,
      stato: r.stato_produzione,
      qty: r.qty,
      plus: r.plus ?? 0,
      riscontro: r.riscontro ?? 0
    });
    setPasswordInput("");
    setPasswordError("");
  }

  async function azioneMassiva(stato: string) {
    setLoadingPatch(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selezionati,
        fields: { stato_produzione: stato }
      })
    });
    setSelezionati([]);
    setBadgeAnim(b => b + 1);
    setToast({ msg: `Segnato ${selezionati.length} come ${TITOLO_DA_PRODURRE[stato]}`, type: "success" });
    setLoadingPatch(false);
  }

  async function rimuoviDaProduzione() {
    if (selezionati.length === 0) return;
    setLoadingPatch(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/bulk`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selezionati
      })
    });
    setSelezionati([]);
    setBadgeAnim(b => b + 1);
    setToast({ msg: "Rimosse dalla produzione!", type: "success" });
    setLoadingPatch(false);
  }

  // BADGE STATI GLOBALE SU TUTTO
  const badgeStatoCounts = STATI_PRODUZIONE.map(st => ({
    stato: st,
    count: allRows.filter(r =>
      (!radice || r.radice === radice) &&
      (!search || r.sku.toLowerCase().includes(search.toLowerCase()) || r.ean.toLowerCase().includes(search.toLowerCase())) &&
      r.stato_produzione === st
    ).length
  }));
  const badgeTuttiStati = allRows.filter(r =>
    (!radice || r.radice === radice) &&
    (!search || r.sku.toLowerCase().includes(search.toLowerCase()) || r.ean.toLowerCase().includes(search.toLowerCase()))
  ).length;

  const radiciDisponibili = Array.from(new Set(
    allRows
      .filter(r => !statoProduzione || r.stato_produzione === statoProduzione)
      .map(r => r.radice)
  )).filter(Boolean);

  const badgeRadiceCounts = radiciDisponibili.map(r => ({
    radice: r,
    count: allRows.filter(row =>
      (!statoProduzione || row.stato_produzione === statoProduzione) &&
      row.radice === r
    ).length
  }));
  const badgeTutteRadici = allRows.filter(row =>
    (!statoProduzione || row.stato_produzione === statoProduzione) &&
    (!search || row.sku.toLowerCase().includes(search.toLowerCase()) || row.ean.toLowerCase().includes(search.toLowerCase()))
  ).length;

  function badgeNota(r: ProduzioneRow) {
    const hasNote = r.note && r.note.trim() !== "";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer select-none
          ${hasNote ? "bg-red-100 text-red-600 border border-red-300 hover:bg-red-200 animate-bounce-badge"
            : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200"}`}
        onClick={() => setModaleNota({ id: r.id, nota: r.note || "" })}
        title={hasNote ? "Visualizza/modifica nota" : "Aggiungi nota"}
      >
        <Info size={15} /> Nota
      </span>
    );
  }

  function badgeStato(stato: string) {
    const color =
      stato === "Da Stampare" ? "from-blue-300 to-cyan-400 border-blue-400 text-blue-800"
        : stato === "Stampato" ? "from-green-300 to-green-200 border-green-400 text-green-800"
        : stato === "Calandrato" ? "from-purple-300 to-purple-400 border-purple-400 text-purple-900"
        : stato === "Cucito" ? "from-orange-200 to-orange-400 border-orange-300 text-orange-800"
        : stato === "Confezionato" ? "from-pink-100 to-pink-300 border-pink-400 text-pink-700"
        : stato === "Trasferito" ? "from-gray-200 to-gray-300 border-gray-400 text-gray-700"
        : stato === "Rimossi" ? "from-red-100 to-red-200 border-red-400 text-red-800"
          : "from-gray-100 to-gray-200 border-gray-200 text-gray-600";
    return (
      <span className={`inline-block rounded-full border px-3 py-1 font-semibold text-xs bg-gradient-to-tr ${color} shadow glass transition-all animate-badge-state`} style={{ letterSpacing: 1 }}>
        {stato}
      </span>
    );
  }

  function badgeCavallotti(val: boolean, onClick: () => void) {
    return val
      ? <span onClick={onClick} className="inline-flex items-center cursor-pointer select-none rounded-xl px-2 py-1 bg-green-200 text-green-700 border border-green-300 shadow glass hover:scale-105 duration-100"><Check className="w-4 h-4 mr-1" /><b>Cavallotti</b></span>
      : <span onClick={onClick} className="inline-flex items-center cursor-pointer select-none rounded-xl px-2 py-1 bg-gray-200 text-gray-500 border border-gray-300 shadow glass hover:scale-105 duration-100"><X className="w-4 h-4 mr-1" /><b>No</b></span>;
  }

  const allVisibleIds = rows.map(r => r.id);
  const selezioneTotale = selezionati.length === allVisibleIds.length && allVisibleIds.length > 0;

  return (
    <div className="w-full max-w-[1200px] mx-auto px-2 pt-6 pb-12 font-sans">
      {/* TOAST */}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Azioni massive */}
      {selezionati.length > 0 && (
        <div className="sticky top-2 z-40 flex flex-wrap items-center gap-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-6 py-3 mb-4 border morph-glass animate-fade-in">
          <span className="text-lg font-bold text-cyan-800 flex items-center gap-2">
            <Check className="w-5 h-5 text-cyan-600" />
            <span className="animate-badge-pop">{selezionati.length}</span> selezionat{selezionati.length === 1 ? "o" : "i"}
          </span>
          <div className="flex gap-2 flex-wrap">
            <span className="font-semibold text-gray-600 mr-2">Azioni massive:</span>
            {/* Da Stampare */}
            <button
              className="px-4 py-2 rounded-xl font-bold shadow text-sm bg-gradient-to-tr from-blue-300 to-cyan-400 border border-blue-400 text-blue-800 hover:from-blue-400 hover:to-cyan-500 transition"
              onClick={() => azioneMassiva("Da Stampare")}
              disabled={loadingPatch}
            >
              <ChevronDown className="w-4 h-4 inline-block mr-1" />
              Segna come Da Stampare
            </button>
            {/* Stampato */}
            <button
              className="px-4 py-2 rounded-xl font-bold shadow text-sm bg-gradient-to-tr from-green-300 to-green-200 border border-green-400 text-green-800 hover:from-green-400 hover:to-green-300 transition"
              onClick={() => azioneMassiva("Stampato")}
              disabled={loadingPatch}
            >
              <ChevronDown className="w-4 h-4 inline-block mr-1" />
              Segna come Stampati
            </button>
            {/* Calandrato */}
            <button
              className="px-4 py-2 rounded-xl font-bold shadow text-sm bg-gradient-to-tr from-purple-300 to-purple-400 border border-purple-400 text-purple-900 hover:from-purple-400 hover:to-purple-500 transition"
              onClick={() => azioneMassiva("Calandrato")}
              disabled={loadingPatch}
            >
              <ChevronDown className="w-4 h-4 inline-block mr-1" />
              Segna come Calandrati
            </button>
            {/* Cucito */}
            <button
              className="px-4 py-2 rounded-xl font-bold shadow text-sm bg-gradient-to-tr from-orange-200 to-orange-400 border border-orange-300 text-orange-800 hover:from-orange-300 hover:to-orange-500 transition"
              onClick={() => azioneMassiva("Cucito")}
              disabled={loadingPatch}
            >
              <ChevronDown className="w-4 h-4 inline-block mr-1" />
              Segna come Cuciti
            </button>
            {/* Confezionato */}
            <button
              className="px-4 py-2 rounded-xl font-bold shadow text-sm bg-gradient-to-tr from-pink-100 to-pink-300 border border-pink-400 text-pink-700 hover:from-pink-200 hover:to-pink-400 transition"
              onClick={() => azioneMassiva("Confezionato")}
              disabled={loadingPatch}
            >
              <ChevronDown className="w-4 h-4 inline-block mr-1" />
              Segna come Confezionati
            </button>
            {/* Trasferito */}
            <button
              className="px-4 py-2 rounded-xl font-bold shadow text-sm bg-gradient-to-tr from-gray-200 to-gray-300 border border-gray-400 text-gray-700 hover:from-gray-300 hover:to-gray-400 transition"
              onClick={() => azioneMassiva("Trasferito")}
              disabled={loadingPatch}
            >
              <ChevronDown className="w-4 h-4 inline-block mr-1" />
              Segna come Trasferiti
            </button>
            {/* Rimossi */}
            <button
              className="px-4 py-2 rounded-xl font-bold shadow text-sm bg-gradient-to-tr from-red-100 to-red-200 border border-red-400 text-red-800 hover:from-red-200 hover:to-red-300 transition"
              onClick={() => azioneMassiva("Rimossi")}
              disabled={loadingPatch}
            >
              <Trash className="w-4 h-4 inline-block mr-1" />
              Segna come Rimossi
            </button>
            <button
              className="px-4 py-2 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-400 shadow text-sm ml-4"
              onClick={() => setSelezionati([])}
              disabled={loadingPatch}
            ><Trash className="w-4 h-4 inline-block mr-1" />Deseleziona tutto</button>
            <button
              className="px-4 py-2 rounded-xl font-bold bg-orange-100 text-orange-800 hover:bg-orange-200 shadow text-sm"
              onClick={() => setExportMassivoOpen(true)}
              disabled={loadingPatch}
            >
              📄 Esporta PDF
            </button>
          </div>
          {statoProduzione === "Rimossi" && (
            <button
              className="px-4 py-2 rounded-xl font-bold bg-gradient-to-tr from-red-400 to-red-600 border border-red-700 text-white hover:from-red-500 hover:to-red-700 shadow text-sm ml-4"
              onClick={rimuoviDaProduzione}
              disabled={loadingPatch}
            >
              <Trash className="w-4 h-4 inline-block mr-1" />Rimuovi da produzione
            </button>
          )}
          {loadingPatch && <Loader2 className="w-5 h-5 ml-4 animate-spin text-cyan-600" />}
        </div>
      )}

      {/* Filtri */}
      <div className="sticky top-0 z-30 bg-white/70 backdrop-blur-md rounded-2xl shadow px-5 py-4 mb-5 flex flex-wrap gap-3 items-end glass morph">
        {/* Filtro stato */}
        <div className="relative" ref={statiBoxRef}>
          <label className="block text-xs font-semibold mb-1">Stato Produzione</label>
          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition focus:outline-none ${statiOpen ? "border-cyan-500 ring-2 ring-cyan-100" : "border-gray-300"}`}
            onClick={() => setStatiOpen(!statiOpen)}
            style={{ minWidth: 160 }}
          >
            {TITOLO_DA_PRODURRE[statoProduzione || ""] || "Inseriti"}
            <ChevronDown size={16} />
          </button>
          {statiOpen && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto animate-fade-in"
              style={{ minWidth: 180 }}>
              <div className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${!statoProduzione ? "bg-cyan-100 text-cyan-900" : "text-cyan-700"}`}
                onClick={() => { setStatoProduzione(""); setStatiOpen(false); }}>
                Inseriti <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs">{badgeTuttiStati}</span>
              </div>
              {STATI_PRODUZIONE.map(st => (
                <div key={st}
                  className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${statoProduzione === st ? "bg-cyan-200 text-cyan-900" : "text-cyan-700"}`}
                  onClick={() => { setStatoProduzione(st); setStatiOpen(false); }}>
                  {TITOLO_DA_PRODURRE[st]} <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs animate-badge-pop">{badgeStatoCounts.find(x => x.stato === st)?.count || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Filtro radice */}
        <div className="relative" ref={radiciBoxRef}>
          <label className="block text-xs font-semibold mb-1">Radice</label>
          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition focus:outline-none ${radiciOpen ? "border-cyan-500 ring-2 ring-cyan-100" : "border-gray-300"}`}
            onClick={() => setRadiciOpen(!radiciOpen)}
            style={{ minWidth: 120 }}
          >
            {radice || "Tutte"}
            <ChevronDown size={16} />
          </button>
          {radiciOpen && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto animate-fade-in"
              style={{ minWidth: 140 }}>
              <div className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${radice === "" ? "bg-cyan-100 text-cyan-900" : "text-cyan-700"}`}
                onClick={() => { setRadice(""); setRadiciOpen(false); }}>
                Tutte <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs">{badgeTutteRadici}</span>
              </div>
              {badgeRadiceCounts.map(({ radice: r, count }) => (
                <div key={r}
                  className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${radice === r ? "bg-cyan-200 text-cyan-900" : "text-cyan-700"}`}
                  onClick={() => { setRadice(r); setRadiciOpen(false); }}>
                  {r} <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs animate-badge-pop">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Ricerca */}
        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1">Cerca SKU/EAN</label>
          <input
            type="text"
            className="input input-bordered rounded-xl font-medium w-full px-4 py-2 glass"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>


      {/* Tabella produzione */}
      <div
        ref={scrollTableRef}
        id="tableScroll"
        className="rounded-2xl shadow-xl border bg-white/80 glass morph px-2 sm:px-4 py-2 mb-10 overflow-x-auto"
        style={{
          background: "linear-gradient(135deg, rgba(244,245,250,0.87) 60%,rgba(224,241,250,0.85) 100%)",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.16), 0 1.5px 4px #d2e3f8"
        }}>
        <table className="w-full min-w-[1200px] text-[16px] sm:text-[18px] glass morph">
          <thead>
            <tr className="border-b border-gray-200">
              <th>
                <input type="checkbox"
                  checked={selezioneTotale}
                  onChange={e => setSelezionati(e.target.checked ? allVisibleIds : [])}
                />
              </th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-center">{TITOLO_DA_PRODURRE[statoProduzione || ""] || "Inseriti"}</th>
              <th className="px-3 py-2 text-center">Stato</th>
              <th className="px-3 py-2 text-center">Nota</th>
              <th className="px-3 py-2 text-center">Cavallotti</th>
              <th className="px-3 py-2 text-left">EAN</th>
              <th className="px-3 py-2 text-left">Radice</th>
              <th className="px-3 py-2 text-center">Azioni</th>

            </tr>
          </thead>
          <tbody>
            {rows.map(r =>
              <tr key={r.id} className="border-b border-gray-100 hover:bg-cyan-50/40 transition-all">
                <td>
                  <input type="checkbox"
                    checked={selezionati.includes(r.id)}
                    onChange={e =>
                      setSelezionati(s => e.target.checked ? [...s, r.id] : s.filter(id => id !== r.id))
                    }
                  />
                </td>
                <td className="px-3 py-2 font-mono font-bold">{r.sku}</td>
                  <td className="px-3 py-2 text-center font-bold text-base text-blue-800 relative">
                    <div className="flex flex-col items-center">
                      <span style={{ fontSize: "1.7em", lineHeight: 1 }}>
                        {(() => {
                          if (r.stato_produzione === "Da Stampare") {
                            const qty = r.qty ?? 0;
                            const riscontro = r.riscontro ?? 0;
                            const plus = r.plus ?? 0;
                            const lavorati = allRows
                              .filter(
                                x =>
                                  x.sku === r.sku &&
                                  x.ean === r.ean &&
                                  x.start_delivery === r.start_delivery &&
                                  x.stato_produzione !== "Da Stampare" &&
                                  x.stato_produzione !== "Rimossi"
                              )
                              .reduce((sum, x) => sum + (x.da_produrre || 0), 0);
                            return Math.max(qty - riscontro - lavorati, 0) + plus;
                          } else {
                            return r.da_produrre;
                          }
                        })()}
                      </span>
                      {/* Badge Modifica manuale */}
                      {r.modificata_manualmente && (
                        <span
                          className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-900 rounded-full text-xs font-bold border border-yellow-300 animate-badge-pop whitespace-nowrap"
                          title="Questa quantità è stata modificata manualmente"
                          style={{ fontSize: "0.93em" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M5 17h12M12 3l5 5m0 0l-8.5 8.5a2.828 2.828 0 01-4 0v0a2.828 2.828 0 010-4L17 8z" stroke="#b68900" strokeWidth="1.7" /></svg>
                          Modifica manuale
                        </span>
                      )}
                    </div>
                  </td>



                <td className="px-3 py-2 text-center align-middle font-bold text-base text-blue-800">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium italic">
                      {(() => {
                        const allOfThis = allRows.filter(
                          rr =>
                            rr.sku === r.sku &&
                            rr.ean === r.ean &&
                            rr.start_delivery === r.start_delivery
                        );
                        // Calcola lavorati
                        const statoOrder = [
                          "Stampato", "Calandrato", "Cucito", "Confezionato", "Trasferito"
                        ];
                        const statoLabel: Record<string, string> = {
                          "Stampato": "Stampati",
                          "Calandrato": "Calandrati",
                          "Cucito": "Cuciti",
                          "Confezionato": "Confezionati",
                          "Trasferito": "Trasferiti"
                        };

                        const parti = [];

                        // Per ogni stato lavorato, aggiungi la quantità se > 0
                        statoOrder.forEach(st => {
                          const sum = allOfThis
                            .filter(x => x.stato_produzione === st)
                            .reduce((tot, x) => tot + (x.da_produrre || 0), 0);
                          if (sum > 0) {
                            if (parti.length > 0) parti.push(" + ");
                            parti.push(
                              <span key={st}>{sum} {statoLabel[st]}</span>
                            );
                          }
                        });

                        // Da Stampare
                        const daStampareRow = allOfThis.find(x => x.stato_produzione === "Da Stampare");
                        const daStampare = daStampareRow?.da_produrre ?? 0;
                        const plus = daStampareRow?.plus ?? 0;
                        const daStampareEffettivo = plus > 0 ? daStampare - plus : daStampare;
                        if (daStampareEffettivo > 0) {
                          if (parti.length > 0) parti.push(" + ");
                          parti.push(
                            <span key="ds" className="text-blue-900 font-bold">{daStampareEffettivo} Da Stampare</span>
                          );
                        }
                        if (plus > 0) {
                          if (parti.length > 0) parti.push(" + ");
                          parti.push(
                            <span key="plusval" className="text-cyan-700 font-bold">{plus} da plus</span>
                          );
                        }

                        return parti.length > 0 ? parti : <span>0</span>;
                      })()}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.stato_produzione === "Da Stampare" ? (
                        <input
                          type="number"
                          min={0}
                          defaultValue={r.da_produrre}
                          style={{ width: 70, textAlign: "center", fontWeight: 700 }}
                          className="input input-bordered px-2 py-1 rounded-xl text-blue-800 font-bold"
                          onBlur={e => {
                            const nuovoVal = parseInt(e.target.value, 10) || 0;
                            if (nuovoVal !== r.da_produrre) patchProduzione(r.id, { da_produrre: nuovoVal });
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                        />
                      ) : (
                        <>
                          <button
                            title="Modifica quantità (richiede password)"
                            className="relative p-1 rounded-full glass hover:bg-blue-100 transition"
                            onClick={() => handleDaProdurreEdit(r)}
                          >
                            <Edit className="w-5 h-5 text-cyan-600" />
                            <span className="absolute -top-1.5 -right-1.5 text-[12px]">
                              <Lock className="w-4 h-4 text-cyan-600" />
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </td>





                <td className="px-3 py-2 text-center" style={{ minWidth: 160 }}>
                  <span
                    className="inline-block cursor-pointer"
                    tabIndex={0}
                    onClick={() => setStatoProduzioneOpenId(r.id)}
                    style={{ outline: "none" }}
                  >
                    {badgeStato(r.stato_produzione)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {badgeNota(r)}
                </td>

                <td className="px-3 py-2 text-center">
                  {badgeCavallotti(!!r.cavallotti, () => patchProduzione(r.id, { cavallotti: !r.cavallotti }))}
                  {r.cavallotti && (
                    <button
                      className="ml-2 px-2 py-1 bg-cyan-100 border border-cyan-300 rounded-xl text-cyan-800 text-xs font-semibold hover:bg-cyan-200"
                      title="Stampa Cavallotto"
                      onClick={() => setCavallottoModal(r.sku)}
                    >
                      🏷️ PDF
                    </button>
                  )}
                </td>
                
                <td className="px-3 py-2 font-mono">{r.ean}</td>
                <td className="px-3 py-2">{r.radice}</td>

                  <td className="px-3 py-2 text-center">
                    <button
                      className="rounded-full p-2 bg-gray-100 hover:bg-blue-100 transition shadow"
                      title="Storico movimenti"
                      onClick={() => openMovimentiLog(r.id)}
                    >
                      <Info size={19} className="text-blue-700" />
                    </button>
                  </td>

              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-gray-400 py-6 text-lg">Nessun articolo in produzione trovato.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* MODALE DA PRODURRE */}
      {modaleDaProdurre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
          <div className="bg-white/90 rounded-2xl p-6 shadow-xl border max-w-xs w-full morph-glass relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setModaleDaProdurre(null)}
              aria-label="Chiudi"
            >×</button>
            <div className="mb-2 text-xl font-bold text-blue-900">Modifica quantità</div>
            <div className="text-xs text-gray-500 mb-4">
              Quantità richiesta dal prelievo: <b>{modaleDaProdurre.qty}</b>
              {modaleDaProdurre.plus && modaleDaProdurre.plus > 0 &&
                <span className="ml-2 text-cyan-800 font-semibold">+ {modaleDaProdurre.plus} da plus</span>}
            </div>
            <div className="mb-3">
              <label className="block text-xs mb-1 font-semibold">Nuovo valore</label>
              <input
                type="number"
                min={0}
                value={modaleDaProdurre.value}
                onChange={e => setModaleDaProdurre({ ...modaleDaProdurre, value: parseInt(e.target.value, 10) || 0 })}
                className="input input-bordered w-full px-3 py-2 rounded-xl text-lg font-bold text-blue-800 glass shadow"
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs mb-1 font-semibold">Password autorizzazione</label>
              <input
                type="password"
                className="input input-bordered w-full px-3 py-2 rounded-xl"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
            </div>
            {passwordError && <div className="text-red-600 mb-2">{passwordError}</div>}
            <div className="flex gap-2 mt-4 justify-between">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                onClick={() => setModaleDaProdurre(null)}
              >Annulla</button>
              <button
                className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-800 shadow flex items-center gap-2"
                onClick={handleModaleDaProdurreSave}
                disabled={!passwordInput || loadingPatch}
              >Salva</button>
            </div>
          </div>
        </div>
      )}

      {statoProduzioneOpenId !== null && (() => {
        const row = rows.find(r => r.id === statoProduzioneOpenId);
        if (!row) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border flex flex-col w-full max-w-xs animate-fade-in relative">
              <button
                className="absolute top-2 right-3 text-neutral-400 hover:text-black text-2xl"
                onClick={() => setStatoProduzioneOpenId(null)}
              >×</button>
              <div className="font-bold text-lg mb-3 text-gray-900 text-center">Cambia stato produzione</div>
              <div className="flex flex-col gap-2 my-1">
                {STATI_PRODUZIONE.map(stato => (
                  <button
                    key={stato}
                    className={`
                      w-full flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition
                      ${row.stato_produzione === stato
                        ? "bg-cyan-200 text-blue-900 border border-cyan-400 shadow"
                        : "bg-white hover:bg-cyan-50 text-cyan-700 border border-gray-200"}
                    `}
                    onClick={() => {
                      patchProduzione(row.id, { stato_produzione: stato });
                      setStatoProduzioneOpenId(null);
                    }}
                  >
                    {badgeStato(stato)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODALE NOTA */}
      {modaleNota && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xs relative">
            <button className="absolute top-2 right-2 text-2xl text-gray-400 hover:text-black"
              onClick={() => setModaleNota(null)}>×</button>
            <div className="font-bold text-lg mb-3">Nota produzione</div>
            <textarea
              className="w-full border rounded-xl p-2 mb-3"
              rows={4}
              placeholder="Scrivi una nota..."
              value={modaleNota.nota}
              onChange={e => setModaleNota({ ...modaleNota, nota: e.target.value })}
            />
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-blue-800"
              onClick={async () => {
                await patchProduzione(modaleNota.id, { note: modaleNota.nota });
                setModaleNota(null);
              }}
            >Salva</button>
          </div>
        </div>
      )}
                {logMovimentiOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
  <div className="bg-white/90 rounded-2xl p-6 shadow-2xl border w-full max-w-3xl morph-glass animate-fade-in relative">
    <button
      className="absolute top-2 right-4 text-neutral-400 hover:text-black text-2xl"
      onClick={() => setLogMovimentiOpen(null)}
    >×</button>
    <div className="font-extrabold text-xl mb-4 text-blue-900">🕑 Storico movimenti produzione</div>
    <div className="max-h-[380px] overflow-y-auto">
      <table className="w-full text-[15px]">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-left">Data</th>
            <th className="py-2 text-left">Motivo</th>
            <th className="py-2 text-left">Stato</th>
            <th className="py-2 text-center">Qta</th>
            <th className="py-2 text-center">Plus</th>
            <th className="py-2 text-left">Utente</th>
          </tr>
        </thead>
        <tbody>
          {logMovimentiOpen.data.length === 0 && (
            <tr>
              <td colSpan={6} className="text-gray-400 text-center py-10">Nessun movimento registrato.</td>
            </tr>
          )}
          {logMovimentiOpen.data.map((log, i) => (
            <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
              <td className="py-1 text-xs">{log.created_at ? new Date(log.created_at).toLocaleString() : ""}</td>
              <td className="py-1">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold
                  ${log.motivo?.toLowerCase().includes('stato') ? 'bg-cyan-100 text-blue-800' :
                    log.motivo?.toLowerCase().includes('quantità') ? 'bg-amber-100 text-yellow-900' :
                    'bg-gray-100 text-gray-700'}
                `}>
                  {log.motivo}
                </span>
              </td>
              <td className="py-1">
                <span>{log.stato_vecchio || "-"}</span>
                <span className="mx-1 text-gray-400">→</span>
                <span className="font-bold text-blue-900">{log.stato_nuovo || "-"}</span>
              </td>
              <td className="py-1 text-center">
                <span className={log.qty_vecchia !== log.qty_nuova ? "font-bold text-cyan-700" : ""}>
                  {log.qty_vecchia ?? "-"} <span className="mx-1">→</span> {log.qty_nuova ?? "-"}
                </span>
              </td>
              <td className="py-1 text-center">
                <span className={log.plus_vecchio !== log.plus_nuovo ? "font-bold text-cyan-700" : ""}>
                  {log.plus_vecchio ?? "-"} <span className="mx-1">→</span> {log.plus_nuovo ?? "-"}
                </span>
              </td>
              <td className="py-1">{log.utente || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
</div>
)}

{cavallottoModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center relative">
      <button
        className="absolute top-2 right-3 text-2xl text-gray-300 hover:text-black"
        onClick={() => setCavallottoModal(null)}
      >×</button>
      <div className="mb-4 font-bold text-lg text-blue-800">Stampa Cavallotto</div>
      <div className="mb-4">Scegli il formato</div>
      <div className="flex flex-col gap-2 mb-3">
        {["A5", "A4", "A3"].map(formato => (
          <button
            key={formato}
            className="bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-800 font-semibold py-2 rounded-xl"
            onClick={() => openCavallottoPdf(cavallottoModal, formato)}
            disabled={cavallottoLoading}
          >
            {formato}
          </button>
        ))}
      </div>
      {cavallottoLoading && <Loader2 className="mx-auto animate-spin text-cyan-600" />}
    </div>
  </div>
)}
{exportMassivoOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center relative">
      <button
        className="absolute top-2 right-3 text-2xl text-gray-300 hover:text-black"
        onClick={() => setExportMassivoOpen(false)}
      >×</button>
      <div className="mb-4 font-bold text-lg text-blue-800">Esporta selezione PDF</div>
      <div className="mb-4">Scegli ordinamento</div>
      <div className="flex flex-col gap-2 mb-3">
        <button
          className="bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-800 font-semibold py-2 rounded-xl"
          onClick={async () => {
            await exportPDF("az");
            setExportMassivoOpen(false);
          }}
        >
          Ordina per SKU (A-Z)
        </button>
        <button
          className="bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-800 font-semibold py-2 rounded-xl"
          onClick={async () => {
            await exportPDF("misura");
            setExportMassivoOpen(false);
          }}
        >
          Ordina per misura finale (es. 2P, 3P, ecc)
        </button>
      </div>
    </div>
  </div>
)}


      <style>
        {`
        .morph-glass {backdrop-filter: blur(12px) saturate(120%); background: linear-gradient(120deg, rgba(240,248,255,0.92) 60%,rgba(216,241,250,0.95) 100%); box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.14), 0 1.5px 4px #d2e3f8;}
        .glass {backdrop-filter: blur(8px) saturate(130%);}
        .morph {box-shadow:0 8px 24px 0 rgba(180,210,255,0.12);}
        @keyframes fade-in {0% { opacity: 0; transform: translateY(-8px);} 100% { opacity: 1; transform: translateY(0);}}
        .animate-fade-in { animation: fade-in 0.2s;}
        @keyframes badge-pop {0%{transform:scale(0.6);opacity:0.7;}70%{transform:scale(1.15);}100%{transform:scale(1);opacity:1;}}
        .animate-badge-pop{animation:badge-pop .4s;}
        @keyframes bounce-badge{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
        .animate-bounce-badge{animation:bounce-badge 1.3s infinite;}
        @keyframes badge-state{0%{opacity:0;transform:scale(0.8);}100%{opacity:1;transform:scale(1);}}
        .animate-badge-state{animation:badge-state .3s;}
        @keyframes fade-in {0% { opacity: 0; transform: translateY(-8px);} 100% { opacity: 1; transform: translateY(0);}}
        .animate-fade-in { animation: fade-in 0.2s;}
        `}
      </style>
    </div>
  );
}
