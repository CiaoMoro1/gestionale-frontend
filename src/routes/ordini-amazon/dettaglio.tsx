import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { Package, CheckCircle, ChevronRight, CircleChevronLeft, Plus, Minus, Search } from "lucide-react";
import GeneraEtichetteModal from "../../components/GeneraEtichetteModal";
import BarcodeScannerModal from "../../components/BarcodeScannerModal";
import SlideToConfirm from "../../components/SlideToConfirm";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Articolo = {
  model_number: string;
  vendor_product_id: string;
  qty_ordered: number;
  po_number: string;
};
type RigaParziale = {
  model_number: string;
  quantita: number;
  collo: number;
  po_number: string;
  confermato: boolean;
  numero_parziale?: number; // per getParzialiStorici
};
type RigaInput = { id: string; quantita: number | ""; collo: number };
type ColloRiepilogo = {
  collo: number;
  righe: { model_number: string; quantita: number }[];
  confermato: boolean;
};

const PAGE_LIMIT = 200;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllBatched(
  urlBase: string,
  key: string | null = null
): Promise<any[]> {
  let all: any[] = [];
  let offset = 0;
  const limit = PAGE_LIMIT;
  while (true) {
    const url = urlBase.includes("?")
      ? `${urlBase}&offset=${offset}&limit=${limit}`
      : `${urlBase}?offset=${offset}&limit=${limit}`;
    const res = await fetch(url);
    const json = await res.json();
    let lista: any[] = [];
    if (Array.isArray(json)) lista = json;
    else if (key && Array.isArray(json[key])) lista = json[key];
    else if (json && key && json[key]) lista = json[key];
    all = [...all, ...lista];
    if (lista.length < limit) break;
    offset += limit;
    await sleep(150); // <--- AGGIUNGI QUESTO ritardo tra i batch!
  }
  return all;
}


export default function DettaglioDestinazione() {
  const { center, data } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const barcode = location.state?.barcode;
  const from = location.state?.from === "nuovi" ? "nuovi" : "parziali";
  const fromDraft = location.state?.fromDraft;

  // Stati principali
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [parziali, setParziali] = useState<RigaParziale[]>([]);
  const [parzialiStorici, setParzialiStorici] = useState<RigaParziale[]>([]);
  const [confermaCollo, setConfermaCollo] = useState<{ [collo: number]: boolean }>({});
  const [modaleArticolo, setModaleArticolo] = useState<Articolo | null>(null);
  const [inputs, setInputs] = useState<RigaInput[]>([{ id: crypto.randomUUID(), quantita: "", collo: 1 }]);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [showEtichette, setShowEtichette] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "reset" | "parziale" | "chiudi">(null);
  const [isBusy, setIsBusy] = useState(false);

  // Ricerca
  const [skuSearch, setSkuSearch] = useState("");
  const [skuSearchError, setSkuSearchError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 10; // visualizza 10 alla volta
  const [itemsToShow, setItemsToShow] = useState(PAGE_SIZE);
  

function normalizza(str: string) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAllWords(target: string, queryWords: string[]) {
  const targetWords = normalizza(target).split(" ");
  return queryWords.every(qw =>
    targetWords.some(tw => tw === qw || tw.startsWith(qw))
  );
}


  // Filtro ricerca globale
const queryWords = normalizza(skuSearch).split(" ").filter(Boolean);

const articoliFiltrati = queryWords.length === 0
  ? articoli
  : articoli.filter(a =>
      matchAllWords(
        [a.model_number, a.vendor_product_id].join(" "),
        queryWords
      )
    );

  // Solo X articoli, tranne se ricerca attiva
  const articoliToShow = skuSearch.length > 0
    ? articoliFiltrati
    : articoliFiltrati.slice(0, itemsToShow);

  const canShowMore = skuSearch.length === 0 && articoliFiltrati.length > itemsToShow;

  // --- Reload universale: carica TUTTO, batchando
  const reloadAll = useCallback(async () => {
    if (!center || !data) return;
    // Articoli
    const articoliBatch = await fetchAllBatched(
      `${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/dettaglio-destinazione?center=${center}&data=${data}`,
      "articoli"
    );
    articoliBatch.sort((a, b) => a.model_number.localeCompare(b.model_number));
    setArticoli(articoliBatch);

    // Storici
    const storici = await fetchAllBatched(
      `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-storici?center=${center}&data=${data}`
    );
    setParzialiStorici(storici);

    // WIP
    const wipResp = await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${center}&data=${data}`);
    const wipJson = await wipResp.json();
    if (Array.isArray(wipJson)) {
      setParziali(wipJson);
      setConfermaCollo({});
    } else {
      setParziali(wipJson.parziali || []);
      setConfermaCollo(wipJson.confermaCollo || {});
    }
  }, [center, data]);

  // On mount
  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Ricerca manuale e auto-open
  useEffect(() => {
    const auto = location.state?.autoOpen;
    if (auto && articoli.length > 0) {
      const found = articoli.find(
        a => a.po_number === auto.po_number && a.model_number === auto.model_number
      );
      if (found) {
        setModaleArticolo(found);
        // Pulisci location.state SOLO l’autoOpen
        navigate(".", { replace: true, state: { ...location.state, autoOpen: undefined } });
      }
    }
    // eslint-disable-next-line
  }, [location.state, articoli]);

  // Quando apro modaleArticolo, prepopolo inputs
  useEffect(() => {
    if (!modaleArticolo) return;
    const wip = parziali.filter(
      p => p.model_number === modaleArticolo.model_number && p.po_number === modaleArticolo.po_number
    );
    if (wip.length > 0) {
      setInputs(wip.map(r => ({
        id: crypto.randomUUID(),
        quantita: r.quantita,
        collo: r.collo
      })));
    } else {
      setInputs([{ id: crypto.randomUUID(), quantita: "", collo: 1 }]);
    }
  }, [modaleArticolo, parziali]);

  // Funzioni di utility, input, conferme, etc
  function aggiornaInput(idx: number, campo: "quantita" | "collo", val: string | number) {
    setInputs((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              [campo]:
                campo === "quantita"
                  ? (typeof val === "string" ? val.replace(/\D/g, "") : val)
                  : val === "" ? "" : Number(val),
            }
          : r
      )
    );
    if (campo === "quantita" && Number(val) > getResiduoInput(idx)) {
      setShakeIdx(idx);
      setTimeout(() => setShakeIdx(null), 400);
    }
  }
  function aggiungiRiga() {
    setInputs((prev) => [...prev, { id: crypto.randomUUID(), quantita: "", collo: 1 }]);
  }
  function rimuoviRiga(idToRemove: string) {
    setInputs(prev => prev.filter(inp => inp.id !== idToRemove));
  }
  function handleOpenScanner() {
    if (inputRef.current) inputRef.current.blur();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
    setTimeout(() => setBarcodeModalOpen(true), 150);
  }

  async function salvaParzialiLive(nextParziali: RigaParziale[], nextConfermaCollo: any) {
    setIsBusy(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${center}&data=${data}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parziali: nextParziali, confermaCollo: nextConfermaCollo }),
    });
    setParziali(nextParziali);
    setConfermaCollo(nextConfermaCollo);
    setIsBusy(false);
  }
  async function salvaParzialiLiveGenerico(art: Articolo | null, nextInputs: RigaInput[]) {
    if (!art) return;
    setIsBusy(true);
    const nuoviParziali: RigaParziale[] = nextInputs
      .filter(r => Number(r.quantita) > 0 && r.collo > 0)
      .map(r => ({
        model_number: art.model_number,
        quantita: Number(r.quantita),
        collo: r.collo,
        po_number: art.po_number,
        confermato: false
      }));
    const altri = parziali.filter(
      p => p.model_number !== art.model_number || p.po_number !== art.po_number
    );
    await salvaParzialiLive([...altri, ...nuoviParziali], confermaCollo);
    setIsBusy(false);
  }
  async function resetParzialiWip() {
    if (!center || !data) return;
    setIsBusy(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center, data }),
    });
    setModaleArticolo(null);
    await reloadAll();
    setIsBusy(false);
  }
  async function confermaParziale() {
    if (!center || !data) return;
    setIsBusy(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip/conferma-parziale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center, data }),
    });
    setModaleArticolo(null);
    await reloadAll();
    setIsBusy(false);
  }
  async function generaSpedizione() {
    if (!center || !data) return;
    setIsBusy(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip/chiudi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center, data }),
    });
    setModaleArticolo(null);
    await reloadAll();
    setIsBusy(false);
  }
  async function aggiungiParziali() {
    if (!modaleArticolo) return;
    setIsBusy(true);
    await salvaParzialiLiveGenerico(modaleArticolo, inputs);
    setModaleArticolo(null);
    setIsBusy(false);
    await reloadAll();
  }
  async function confermaUnCollo(collo: number) {
    setIsBusy(true);
    const updated = { ...confermaCollo, [collo]: true };
    await salvaParzialiLive(parziali, updated);
    setIsBusy(false);
  }
  async function annullaConfermaCollo(collo: number) {
    setIsBusy(true);
    const updated = { ...confermaCollo, [collo]: false };
    await salvaParzialiLive(parziali, updated);
    setIsBusy(false);
  }

  // Ricerca scanner
  const handleScannerFound = async (ean: string, setError: (msg: string) => void) => {
    const found = articoli.find(a =>
      a.vendor_product_id === ean || a.model_number === ean
    );
    if (found) {
      setModaleArticolo(found);
      setBarcodeModalOpen(false);
      setSkuSearch("");
      setSkuSearchError("");
    } else {
      setError("Articolo non trovato! Riprova.");
    }
  };

  // Ricerca manuale
  function handleSkuSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!skuSearch.trim()) {
      setSkuSearchError("Inserisci SKU o EAN");
      return;
    }
    const found = articoli.find(a =>
      a.model_number === skuSearch.trim() ||
      a.vendor_product_id === skuSearch.trim()
    );
    if (found) {
      setModaleArticolo(found);
      setSkuSearch("");
      setSkuSearchError("");
    } else {
      setSkuSearchError("Articolo non trovato");
    }
  }


  // --------- UI HELPERS ---------
  function getResiduoInput(idx: number): number {
    if (!modaleArticolo) return 0;
    const totaleStorico = getParzialiStorici(modaleArticolo.model_number)
      .reduce((sum, r) => sum + r.quantita, 0);
    const sommaAltriInput = inputs
      .map((inp, i) => (i !== idx ? Number(inp.quantita) || 0 : 0))
      .reduce((a, b) => a + b, 0);
    const altri = parziali.filter(
      p =>
        !(
          p.model_number === modaleArticolo.model_number &&
          p.po_number === modaleArticolo.po_number
        )
    );
    const totaleWipAltri = altri
      .filter(p => p.model_number === modaleArticolo.model_number)
      .reduce((sum, r) => sum + r.quantita, 0);
    return Math.max(
      0,
      modaleArticolo.qty_ordered -
        totaleStorico -
        totaleWipAltri -
        sommaAltriInput
    );
  }
  function getParzialiStorici(model: string) {
    const storici = parzialiStorici.filter(p => p.model_number === model);
    const perParziale: { [num: number]: number } = {};
    storici.forEach((r: any) => {
      const parz = r.numero_parziale || 1;
      perParziale[parz] = (perParziale[parz] || 0) + r.quantita;
    });
    return Object.entries(perParziale).map(([parziale, quantita]) => ({ parziale, quantita }));
  }
  function totaleStorici(model: string) {
    return parzialiStorici.filter((p) => p.model_number === model).reduce((sum, r) => sum + r.quantita, 0);
  }
  function totaleWip(model: string) {
    return parziali.filter((p) => p.model_number === model).reduce((sum, r) => sum + r.quantita, 0);
  }
  function colliRiepilogo(): ColloRiepilogo[] {
    const gruppi: { [collo: number]: ColloRiepilogo } = {};
    for (const p of parziali) {
      if (!gruppi[p.collo])
        gruppi[p.collo] = { collo: p.collo, righe: [], confermato: !!confermaCollo[p.collo] };
      gruppi[p.collo].righe.push({ model_number: p.model_number, quantita: Number(p.quantita) });
    }
    return Object.values(gruppi).sort((a, b) => a.collo - b.collo);
  }
  const tuttiConfermati = colliRiepilogo().length > 0 && colliRiepilogo().every((c) => c.confermato);

  function exportColliPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text(`Riepilogo colli (NON confermati)`, 14, 18);
    doc.setFontSize(11);
    doc.text(`Centro: ${center}`, 14, 26);
    doc.text(`Data: ${data}`, 90, 26);

    let currentY = 36;
    colliRiepilogo().forEach((collo) => {
      doc.setFontSize(13);
      doc.text(`Collo ${collo.collo}${collo.confermato ? " (confermato)" : ""}`, 14, currentY);
      autoTable(doc, {
        startY: currentY + 3,
        head: [["SKU", "Quantità"]],
        body: collo.righe.map(r => [r.model_number, String(r.quantita)]),
        styles: { fontSize: 11 },
        headStyles: { fillColor: [6, 182, 212] },
        margin: { left: 14, right: 14 }
      });
      currentY = ((doc as any).lastAutoTable?.finalY ?? currentY + 40) + 8;
    });
    doc.output("dataurlnewwindow");
  }

  return (
    <div className="w-full max-w-[900px] mx-auto px-2 pb-24 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 mb-3 justify-between w-full">
        {fromDraft && (
          <button
            onClick={() => navigate(`/ordini-amazon/draft?barcode=${barcode}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-blue-700 font-semibold rounded-xl shadow hover:bg-blue-100 transition mb-4"
          >
            ⬅️ Torna al draft
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <Package className="text-blue-600 flex-shrink-0" size={26} />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-base text-blue-900 truncate">{center}</span>
            <span className="text-xs text-neutral-500 truncate">Data: {data}</span>
          </div>
        </div>
        <button
          onClick={() => navigate(from === "nuovi" ? "/ordini-amazon/nuovi" : "/ordini-amazon/parziali")}
          className="flex items-center gap-1 px-3 py-1 rounded-full border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 transition text-xs shadow-sm whitespace-nowrap font-medium"
          style={{ minWidth: 0, fontWeight: 500 }}
        >
          <CircleChevronLeft size={18} />
          Torna alla lista {from === "nuovi" ? "Nuovi" : "Parziali"} Vendor
        </button>
      </div>

      {/* Scanner + ricerca SKU/EAN */}
      <div className="flex items-center gap-2 mb-3 w-full">
        <form
          onSubmit={handleSkuSearch}
          className="flex items-center gap-1 flex-1 relative"
          autoComplete="off"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Cerca per SKU o EAN"
              value={skuSearch}
              onChange={e => setSkuSearch(e.target.value)}
              className="rounded-lg border border-cyan-400 px-3 py-2 text-[15px] outline-cyan-700 w-full font-medium"
              disabled={isBusy}
            />
          
          </div>
          <button
            type="submit"
            className="bg-cyan-600 text-white rounded-lg p-2 hover:bg-cyan-700 transition flex items-center"
            title="Cerca"
            disabled={isBusy}
          >
            <Search size={18} />
          </button>
        </form>
        <button
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-xl shadow hover:bg-gray-900 transition text-sm font-semibold"
          onClick={handleOpenScanner}
          type="button"
          disabled={isBusy}
        >
          <span className="hidden sm:inline">Scanner</span>
          <svg className="inline-block sm:hidden" width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M7 3v4M17 3v4M3 7h4M17 7h4M3 17h4M17 17h4M7 21v-4M17 21v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>
      {skuSearchError && (
        <div className="text-red-600 text-xs mb-2">{skuSearchError}</div>
      )}

      {/* Scanner modal */}
      <BarcodeScannerModal
        open={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        onFound={handleScannerFound}
      />

      {/* Tabella Articoli */}
      <div className="rounded-2xl shadow border bg-white/80 px-1 sm:px-2 py-2 mb-8 overflow-x-auto">
        <table className="w-full min-w-[340px] text-[16px]">
          <thead>
            <tr>
              <th className="py-2 px-2 text-left text-neutral-700 font-semibold text-sm">SKU</th>
              <th className="py-2 text-center text-neutral-700 font-semibold text-sm">Parziali precedenti</th>
              <th className="py-2 text-center text-neutral-700 font-semibold text-sm">Confermata</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {articoliToShow.map((art) => {
              const totStorici = totaleStorici(art.model_number);
              const wip = totaleWip(art.model_number);
              const confermata = totStorici + wip;
              const completa = confermata >= art.qty_ordered;
              const tuttiColliConfermati = colliRiepilogo().every(c => c.confermato);
              const disableGestisci = completa && tuttiColliConfermati;
              const hasStorici = getParzialiStorici(art.model_number).length > 0;
              let bgClass = "bg-gray-50";
              if (wip > 0) bgClass = "bg-blue-100";
              else if (hasStorici) bgClass = "bg-yellow-100";

              return (
                <tr key={art.model_number} className={`border-t ${bgClass} transition-all`}>
                  <td className="font-mono px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{art.model_number}</span>
                      {completa && hasStorici && (
                        <CheckCircle
                          size={18}
                          className="text-green-600 ml-0.5 sm:size-[18px] size-[50px]"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-bold text-blue-500">
                    {hasStorici ? (
                      <span className="text-xs">
                        {getParzialiStorici(art.model_number).map((r, i) => (
                          <span key={i} className="bg-blue-100 px-2 py-0.5 rounded font-bold text-lg sm:text-xs">
                            {r.quantita}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-xs">Nessuno</span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-center font-bold ${completa ? "text-green-600" : "text-blue-800"}`}>
                    {confermata}/{art.qty_ordered}
                  </td>
                  <td className="text-right">
                    <button
                      className={`rounded-full p-2 shadow transition
                        ${disableGestisci
                          ? "bg-gray-300 text-gray-400 line-through cursor-not-allowed"
                          : "bg-blue-500 text-white hover:bg-blue-700"}
                      `}
                      onClick={() => !disableGestisci && setModaleArticolo(art)}
                      disabled={disableGestisci || isBusy}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {canShowMore && (
          <div className="flex justify-center my-3">
            <button
              className="px-5 py-2 bg-cyan-700 text-white rounded-xl font-bold hover:bg-cyan-900"
              onClick={() => setItemsToShow(s => s + PAGE_SIZE)}
            >
              Visualizza altri
            </button>
          </div>
        )}
      </div>

      {/* MODALE INSERIMENTO PARZIALI */}
      {modaleArticolo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="bg-white rounded-2xl p-5 shadow-lg min-w-[90vw] sm:min-w-[360px] w-full max-w-sm relative border flex flex-col"
            style={{ maxHeight: "92vh", minWidth: 0, width: "100%" }}
          >
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => {
                setModaleArticolo(null);
                setSkuSearch("");
                setSkuSearchError("");
                setInputs([{ id: crypto.randomUUID(), quantita: "", collo: 1 }]);
              }}
              disabled={isBusy}
            >×</button>
            <div className="mb-1 font-bold text-blue-700 text-lg">Gestisci Parziali - {center}</div>
            <div className="mb-2 font-mono text-base flex items-center gap-3">
              <span className="bg-blue-100 px-2 py-1 rounded">
                {modaleArticolo.model_number} - Ordinati :{" "}
                <span className="inline-block px-2 py-0.5 bg-green-500 text-white rounded font-bold ml-1">
                  {modaleArticolo.qty_ordered}
                </span>
              </span>
            </div>
            <div className="mb-2 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
              <b>EAN:</b>
              {modaleArticolo.vendor_product_id || <span className="text-neutral-300">N/A</span>}
              {modaleArticolo.vendor_product_id && (
                <button
                  className="ml-2 px-2 py-1 bg-gray-100 border rounded-lg text-xs font-semibold hover:bg-gray-200 transition"
                  onClick={() => setShowEtichette(true)}
                >
                  Genera Etichette
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, maxHeight: "50vh" }}>
              <div className="mb-2">
                <div className="text-sm font-semibold mb-1">Parziali precedenti:</div>
                {getParzialiStorici(modaleArticolo.model_number).length === 0 ? (
                  <div className="text-neutral-400 text-xs">Nessun parziale inserito</div>
                ) : (
                  <span className="flex flex-wrap gap-2 text-xs">
                    {getParzialiStorici(modaleArticolo.model_number).map((r, i) => (
                      <span key={i} className="bg-blue-100 px-2 py-0.5 rounded font-bold">
                        {r.quantita}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2 mb-3">
                {inputs.length === 0 && (
                  <div className="text-center text-gray-500 my-4">
                    Nessun collo assegnato.<br />Aggiungi una riga o premi "Aggiungi" per eliminare tutti i colli di questo articolo.
                  </div>
                )}
                {inputs.map((inp, idx) => (
                  <div key={inp.id} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs mb-1">Quantità</label>
                      <input
                        type="number"
                        min={1}
                        max={getResiduoInput(idx)}
                        value={inp.quantita === 0 ? "" : inp.quantita}
                        onChange={e => {
                          let v = Number(e.target.value);
                          if (isNaN(v)) v = 0;
                          const max = getResiduoInput(idx);
                          if (v > max) {
                            v = max;
                            setShakeIdx(idx);
                            setTimeout(() => setShakeIdx(null), 400);
                          }
                          if (v < 1) v = 0;
                          aggiornaInput(idx, "quantita", v);
                        }}
                        className={`w-full border rounded-lg p-2 text-center font-bold text-blue-700 outline-blue-400 ${shakeIdx === idx ? "ring-2 ring-red-400 animate-shake" : ""}`}
                        placeholder="Quantità"
                        disabled={isBusy}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs mb-1">Collo</label>
                      <input
                        type="number"
                        min={1}
                        value={inp.collo === 0 ? "" : inp.collo}
                        onChange={e => {
                          let v = e.target.value;
                          if (v === "" || v === "0") {
                            aggiornaInput(idx, "collo", "");
                          } else {
                            let num = Number(v);
                            if (isNaN(num) || num < 1) num = 1;
                            aggiornaInput(idx, "collo", num);
                          }
                        }}
                        className="w-full border rounded-lg p-2 text-center font-bold outline-blue-400"
                        placeholder="Collo"
                        disabled={isBusy}
                      />
                    </div>
                    <button
                      className="ml-2 p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                      onClick={() => rimuoviRiga(inp.id)}
                      disabled={false || isBusy}
                      title="Rimuovi riga"
                    >
                      <Minus size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-between mb-1">
                <button
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 font-semibold rounded-full hover:bg-blue-200 transition"
                  onClick={aggiungiRiga}
                  disabled={isBusy}
                >
                  <Plus size={18} /> Aggiungi Collo
                </button>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-full shadow hover:bg-blue-700 transition"
                onClick={aggiungiParziali}
                disabled={
                  isBusy ||
                  (inputs.length > 0 &&
                    inputs.every((inp, idx) =>
                      !inp.quantita ||
                      inp.quantita <= 0 ||
                      inp.collo <= 0 ||
                      Number(inp.quantita) > getResiduoInput(idx)
                    )
                  )
                }
              >
                {isBusy ? "Salvataggio..." : "Aggiungi"}
              </button>
            </div>
            <style>
              {`
                @keyframes shake {
                  0% { transform: translateX(0);}
                  20% { transform: translateX(-5px);}
                  40% { transform: translateX(5px);}
                  60% { transform: translateX(-5px);}
                  80% { transform: translateX(5px);}
                  100% { transform: translateX(0);}
                }
                .animate-shake { animation: shake 0.4s; }
              `}
            </style>
          </div>
        </div>
      )}

      {/* RIEPILOGO COLLI */}
      <div className="mt-10">
        <div className="mb-4 flex justify-end">
          <button
            className="px-4 py-2 rounded bg-cyan-700 text-white font-semibold hover:bg-cyan-900"
            onClick={exportColliPDF}
            disabled={isBusy}
          >
            Esporta PDF colli attuali
          </button>
        </div>
        <h3 className="font-bold text-lg mb-3">Riepilogo colli</h3>
        {colliRiepilogo().length === 0 ? (
          <div className="text-neutral-400 text-sm">Nessun collo creato</div>
        ) : (
          <div className="flex flex-wrap gap-6">
            {colliRiepilogo().map((collo) => (
              <div
                key={collo.collo}
                className={`bg-white rounded-2xl shadow p-4 min-w-[180px] w-full max-w-xs relative border-2 ${
                  collo.confermato ? "border-green-500" : "border-blue-200"
                }`}
              >
                <div className="text-blue-700 font-bold mb-2">Collo {collo.collo}</div>
                <ul>
                  {collo.righe.map((r, i) => (
                    <li key={`${r.model_number}-${r.quantita}-${collo.collo}-${i}`} className="flex items-center gap-1 mb-1">
                      <span className="font-mono text-xs">{r.model_number}</span>
                      <span className="font-bold text-blue-900 text-xs">{r.quantita}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 mt-3">
                  {!collo.confermato ? (
                    <button
                      onClick={() => confermaUnCollo(collo.collo)}
                      className="w-full py-2 font-bold rounded-lg shadow bg-blue-600 text-white hover:bg-blue-800 transition"
                      disabled={isBusy}
                    >
                      Conferma
                    </button>
                  ) : (
                    <button
                      onClick={() => annullaConfermaCollo(collo.collo)}
                      className="w-full py-2 font-bold rounded-lg shadow bg-red-100 text-red-600 hover:bg-red-200 transition"
                      disabled={isBusy}
                    >
                      Annulla
                    </button>
                  )}
                </div>
                {collo.confermato && (
                  <div className="absolute top-2 right-2 text-green-500">
                    <CheckCircle size={20} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTONI FINALI SLIDE TO CONFIRM */}
      <div className="mt-12 flex flex-col sm:flex-row justify-end gap-4">
        {confirmAction === "reset" ? (
          <div className="w-full sm:w-auto">
            <SlideToConfirm
              onConfirm={() => { setConfirmAction(null); resetParzialiWip(); }}
              text="Scorri per svuotare tutto"
              colorClass="bg-red-500"
              disabled={parziali.length === 0 || isBusy}
            />
            <button
              className="block mt-2 mx-auto text-xs text-gray-400 hover:underline"
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={isBusy}
            >Annulla</button>
          </div>
        ) : (
          <button
            className="bg-red-500 text-white font-bold rounded-xl px-6 py-4 text-lg shadow-lg transition hover:bg-red-600 w-full sm:w-auto"
            onClick={() => setConfirmAction("reset")}
            disabled={parziali.length === 0 || isBusy}
          >
            Svuota tutto
          </button>
        )}

        {confirmAction === "parziale" ? (
          <div className="w-full sm:w-auto">
            <SlideToConfirm
              onConfirm={() => { setConfirmAction(null); confermaParziale(); }}
              text="Scorri per confermare"
              colorClass="bg-yellow-500"
              disabled={!tuttiConfermati || isBusy}
            />
            <button
              className="block mt-2 mx-auto text-xs text-gray-400 hover:underline"
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={isBusy}
            >Annulla</button>
          </div>
        ) : (
          <button
            className={`bg-yellow-500 text-white font-bold rounded-xl px-8 py-4 text-lg shadow-lg transition w-full sm:w-auto ${
              !tuttiConfermati || isBusy ? "opacity-40 cursor-not-allowed" : "hover:bg-yellow-600"
            }`}
            disabled={!tuttiConfermati || isBusy}
            onClick={() => setConfirmAction("parziale")}
          >
            Conferma Parziale
          </button>
        )}

        {confirmAction === "chiudi" ? (
          <div className="w-full sm:w-auto">
            <SlideToConfirm
              onConfirm={() => { setConfirmAction(null); generaSpedizione(); }}
              text="Scorri per chiudere ordine"
              colorClass="bg-green-600"
              disabled={!tuttiConfermati || isBusy}
            />
            <button
              className="block mt-2 mx-auto text-xs text-gray-400 hover:underline"
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={isBusy}
            >Annulla</button>
          </div>
        ) : (
          <button
            className={`bg-green-600 text-white font-bold rounded-xl px-8 py-4 text-lg shadow-lg transition w-full sm:w-auto ${
              !tuttiConfermati || isBusy ? "opacity-40 cursor-not-allowed" : "hover:bg-green-700"
            }`}
            disabled={!tuttiConfermati || isBusy}
            onClick={() => setConfirmAction("chiudi")}
          >
            Chiudi Ordine
          </button>
        )}
      </div>

      {/* MODALE ETICHETTE */}
      <GeneraEtichetteModal
        open={showEtichette}
        onClose={() => setShowEtichette(false)}
        sku={modaleArticolo?.model_number || ""}
        ean={modaleArticolo?.vendor_product_id || ""}
      />

      {/* Overlay BUSY */}
      {isBusy && (
        <div className="fixed inset-0 bg-black/30 z-[10000] flex items-center justify-center">
          <div className="bg-white/90 rounded-2xl px-8 py-6 shadow-xl border text-xl font-bold text-blue-700 animate-pulse">
            Attendere...
          </div>
        </div>
      )}
    </div>
  );
}