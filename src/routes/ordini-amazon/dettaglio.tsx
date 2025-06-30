import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Package, CheckCircle, ChevronRight, Plus, Minus, Search } from "lucide-react";
// Importa qui la libreria barcode se vuoi generare png in locale

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
};
type RigaInput = { quantita: number | ""; collo: number };
type ColloRiepilogo = {
  collo: number;
  righe: { model_number: string; quantita: number }[];
  confermato: boolean;
};
type ParzialeStorico = {
  model_number: string;
  quantita: number;
  collo: number;
  numero_parziale?: number;
};

export default function DettaglioDestinazione() {
  const { center, data } = useParams();
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [parziali, setParziali] = useState<RigaParziale[]>([]);
  const [parzialiStorici, setParzialiStorici] = useState<RigaParziale[]>([]);
  const [confermaCollo, setConfermaCollo] = useState<{ [collo: number]: boolean }>({});
  const [modaleArticolo, setModaleArticolo] = useState<Articolo | null>(null);
  const [inputs, setInputs] = useState<RigaInput[]>([{ quantita: "", collo: 1 }]);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Carica dati all'apertura
  useEffect(() => {
    if (!center || !data) return;
    fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/dettaglio-destinazione?center=${center}&data=${data}`)
      .then((res) => res.json())
      .then((json) => {
        const lista = json.articoli || [];
        lista.sort((a: Articolo, b: Articolo) => a.model_number.localeCompare(b.model_number));
        setArticoli(lista);
      });
    fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-storici?center=${center}&data=${data}`)
      .then(res => res.json())
      .then((storici: RigaParziale[]) => setParzialiStorici(storici));
    fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${center}&data=${data}`)
      .then(res => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setParziali(json);
          setConfermaCollo({});
        } else {
          setParziali(json.parziali || []);
          setConfermaCollo(json.confermaCollo || {});
        }
      });
  }, [center, data]);

  // --- Funzioni di utilità
  function aggiornaInput(idx: number, campo: "quantita" | "collo", val: string | number) {
    setInputs((prev) => {
      const updated = prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              [campo]:
                campo === "quantita"
                  ? (typeof val === "string" ? val.replace(/\D/g, "") : val)
                  : Number(val),
            }
          : r
      );
      salvaParzialiLiveGenerico(modaleArticolo, updated);
      // Se tutto vuoto, cancella da supabase
      if (updated.every(x => !x.quantita || Number(x.quantita) === 0)) {
        resetParzialiWip();
      }
      return updated;
    });
    if (campo === "quantita" && Number(val) > getResiduoInput(idx)) {
      setShakeIdx(idx);
      setTimeout(() => setShakeIdx(null), 400);
    }
  }
  function aggiungiRiga() {
    setInputs((prev) => [...prev, { quantita: "", collo: 1 }]);
  }
  function rimuoviRiga(idx: number) {
    setInputs((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function salvaParzialiLive(nextParziali: RigaParziale[], nextConfermaCollo: any) {
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${center}&data=${data}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parziali: nextParziali, confermaCollo: nextConfermaCollo }),
    });
    setParziali(nextParziali);
    setConfermaCollo(nextConfermaCollo);
  }
  async function salvaParzialiLiveGenerico(art: Articolo | null, nextInputs: RigaInput[]) {
    if (!art) return;
    const nuoviParziali: RigaParziale[] = nextInputs
      .filter(r => Number(r.quantita) > 0 && r.collo > 0)
      .map(r => ({
        model_number: art.model_number,
        quantita: Number(r.quantita),
        collo: r.collo,
        po_number: art.po_number,
        confermato: false
      }));
    const altri = parziali.filter(p => p.model_number !== art.model_number);
    await salvaParzialiLive([...altri, ...nuoviParziali], confermaCollo);
  }
  async function resetParzialiWip() {
    if (!center || !data) return;
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center, data }),
    });
    window.location.reload();
  }
  async function confermaParziale() {
    if (!center || !data) return;
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip/conferma-parziale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center, data }),
    });
    window.location.reload();
  }
  async function generaSpedizione() {
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip/chiudi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center, data }),
    });
    window.location.reload();
  }
  async function aggiungiParziali() {
    if (!modaleArticolo) return;
    await salvaParzialiLiveGenerico(modaleArticolo, inputs);
    setModaleArticolo(null);
  }
  async function confermaUnCollo(collo: number) {
    const updated = { ...confermaCollo, [collo]: true };
    await salvaParzialiLive(parziali, updated);
  }
  async function annullaConfermaCollo(collo: number) {
    const updated = { ...confermaCollo, [collo]: false };
    await salvaParzialiLive(parziali, updated);
  }

  // Ricerca: attiva scanner e apri modale articolo se trovato
  async function handleBarcodeScan(ean: string) {
    const found = articoli.find(a => a.vendor_product_id === ean);
    setShowScanner(false);
    if (found) setModaleArticolo(found);
    else alert("Articolo non trovato");
  }

  // --------- UI HELPERS
  function getResiduoInput(idx: number): number {
    if (!modaleArticolo) return 0;
    const totaleStorico = getParzialiStorici(modaleArticolo.model_number)
      .reduce((sum, r) => sum + r.quantita, 0);
    const colliInput = inputs.map(inp => inp.collo);
    const parzialiAltriCollo = parziali.filter(
      p => p.model_number === modaleArticolo.model_number &&
        !colliInput.includes(p.collo)
    );
    const totaleWipAltriCollo = parzialiAltriCollo.reduce((sum, r) => sum + r.quantita, 0);
    const sommaAltriInput = inputs
      .map((inp, i) => (i !== idx ? Number(inp.quantita) || 0 : 0))
      .reduce((a, b) => a + b, 0);
    return Math.max(0, modaleArticolo.qty_ordered - totaleStorico - totaleWipAltriCollo - sommaAltriInput);
  }

  function getParzialiStorici(model: string) {
    // Raggruppa per numero_parziale (se presente)
    const storici = parzialiStorici.filter(p => p.model_number === model);
    const perParziale: { [num: number]: number } = {};
    storici.forEach((r: any) => {
      const parz = r.numero_parziale || 1;
      perParziale[parz] = (perParziale[parz] || 0) + r.quantita;
    });
    // Ritorna [{parziale: 1, quantita: X}, ...]
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

  // --------- UI START
  return (
    <div className="w-full max-w-[900px] mx-auto px-2 pb-24 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Package className="text-blue-600" size={32} />
          <div>
            <span className="block font-bold text-xl sm:text-2xl uppercase">{center}</span>
            <span className="block text-sm text-neutral-500">Data: {data}</span>
          </div>
        </div>
        <button
          className="ml-auto flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-800 transition sm:text-base text-sm"
          onClick={() => setShowScanner(true)}
        >
          <Search size={18} /> Cerca Articolo
        </button>
      </div>

      {/* Tabella Articoli */}
      <div className="rounded-2xl shadow border bg-white/70 px-1 sm:px-2 py-2 mb-8 overflow-x-auto">
        <table className="w-full min-w-[340px] text-[15px]">
          <thead>
            <tr>
              <th className="py-2 px-2 text-left text-neutral-700 font-semibold">SKU</th>
              <th className="py-2 text-center text-neutral-700 font-semibold">Parziali precedenti</th>
              <th className="py-2 text-center text-neutral-700 font-semibold">Confermata</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {articoli.map((art) => {
              const totStorici = totaleStorici(art.model_number);
              const confermata = totStorici + totaleWip(art.model_number);
              const completa = confermata >= art.qty_ordered;
              return (
                <tr key={art.model_number} className="border-t">
                  <td className="font-mono px-2 py-2">{art.model_number}</td>
                  <td className="px-2 py-2 text-center font-bold text-blue-500">
                    {/* Parziali precedenti sintesi */}
                    {getParzialiStorici(art.model_number).length === 0 ? (
                      <span className="text-neutral-400 text-xs">Nessuno</span>
                    ) : (
                      <span className="text-xs">
                        {getParzialiStorici(art.model_number).map((r, i) => (
                          <span key={i} className="inline-block mr-1">
                            {r.quantita}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-center font-bold ${completa ? "text-green-600" : "text-blue-800"}`}>
                    {confermata}/{art.qty_ordered}
                  </td>
                  <td className="text-right">
                    <button
                      className={`rounded-full p-2 shadow transition
                        ${completa ? "bg-gray-300 text-gray-400 line-through cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-700"}
                      `}
                      onClick={() => !completa && setModaleArticolo(art)}
                      disabled={completa}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODALE */}
      {modaleArticolo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-5 shadow-lg min-w-[90vw] sm:min-w-[360px] w-full max-w-sm relative border">
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setModaleArticolo(null)}
            >×</button>
            <div className="mb-1 font-bold text-blue-700 text-lg">Gestisci Parziali</div>
            <div className="mb-2 font-mono text-base flex items-center gap-3">
              <span className="bg-blue-100 px-2 py-1 rounded">{modaleArticolo.model_number}</span>
              <button
                className="ml-2 px-2 py-1 bg-gray-100 border rounded-lg text-xs font-semibold hover:bg-gray-200 transition"
                onClick={() => {
                  // Esempio generazione barcode: console.log(modaleArticolo.model_number, modaleArticolo.vendor_product_id)
                  alert("Generazione etichette non ancora implementata!");
                }}
              >
                Genera Etichette
              </button>
            </div>
            <div className="mb-2 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
              <b>EAN:</b>
              {modaleArticolo.vendor_product_id || <span className="text-neutral-300">N/A</span>}
              {/* Puoi mettere qui una funzione barcode png */}
            </div>
            {/* Parziali precedenti sintesi */}
            <div className="mb-2">
              <div className="text-sm font-semibold mb-1">Parziali precedenti:</div>
              {getParzialiStorici(modaleArticolo.model_number).length === 0 ? (
                <div className="text-neutral-400 text-xs">Nessun parziale inserito</div>
              ) : (
                <span className="flex flex-wrap gap-2 text-xs">
                  {getParzialiStorici(modaleArticolo.model_number).map((r, i) => (
                    <span key={i} className="bg-blue-100 px-2 py-0.5 rounded font-bold">
                      {r.parziale}°: {r.quantita}
                    </span>
                  ))}
                </span>
              )}
            </div>
            {/* Input Quantità + Collo affiancati, multipli */}
            <div className="flex flex-col gap-2 mb-3">
              {inputs.map((inp, idx) => (
                <div key={idx} className="flex gap-2 items-end">
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
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs mb-1">Collo</label>
                    <input
                      type="number"
                      min={1}
                      value={inp.collo === 0 ? "" : inp.collo}
                      onChange={e => {
                        let v = Number(e.target.value);
                        if (isNaN(v)) v = 1;
                        if (v < 1) v = 1;
                        aggiornaInput(idx, "collo", v);
                      }}
                      className="w-full border rounded-lg p-2 text-center font-bold outline-blue-400"
                      placeholder="Collo"
                    />
                  </div>
                  <button
                    className="ml-2 p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                    onClick={() => rimuoviRiga(idx)}
                    disabled={inputs.length === 1}
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
              >
                <Plus size={18} /> Aggiungi Collo
              </button>
            </div>
            <div className="flex justify-end">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-full shadow hover:bg-blue-700 transition"
                onClick={aggiungiParziali}
                disabled={
                  inputs.every((inp, idx) =>
                    !inp.quantita ||
                    inp.quantita <= 0 ||
                    inp.collo <= 0 ||
                    Number(inp.quantita) > getResiduoInput(idx)
                  )
                }
              >
                Aggiungi
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
                    <li key={i} className="flex justify-between mb-1">
                      <span className="font-mono text-xs">{r.model_number}</span>
                      <span className="font-bold text-blue-900">{r.quantita}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 mt-3">
                  {!collo.confermato ? (
                    <button
                      onClick={() => confermaUnCollo(collo.collo)}
                      className="w-full py-2 font-bold rounded-lg shadow bg-blue-600 text-white hover:bg-blue-800 transition"
                    >
                      Conferma
                    </button>
                  ) : (
                    <button
                      onClick={() => annullaConfermaCollo(collo.collo)}
                      className="w-full py-2 font-bold rounded-lg shadow bg-red-100 text-red-600 hover:bg-red-200 transition"
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
      {/* TASTI FINALI */}
      <div className="mt-12 flex flex-col sm:flex-row justify-end gap-4">
        <button
          className="bg-red-500 text-white font-bold rounded-xl px-6 py-4 text-lg shadow-lg transition hover:bg-red-600 w-full sm:w-auto"
          onClick={resetParzialiWip}
          disabled={parziali.length === 0}
        >
          Svuota tutto
        </button>
        <button
          className={`bg-yellow-500 text-white font-bold rounded-xl px-8 py-4 text-lg shadow-lg transition w-full sm:w-auto ${
            !tuttiConfermati ? "opacity-40 cursor-not-allowed" : "hover:bg-yellow-600"
          }`}
          disabled={!tuttiConfermati}
          onClick={confermaParziale}
        >
          Conferma Parziale
        </button>
        <button
          className={`bg-green-600 text-white font-bold rounded-xl px-8 py-4 text-lg shadow-lg transition w-full sm:w-auto ${
            !tuttiConfermati ? "opacity-40 cursor-not-allowed" : "hover:bg-green-700"
          }`}
          disabled={!tuttiConfermati}
          onClick={generaSpedizione}
        >
          Chiudi Ordine
        </button>
      </div>

      {/* --- MODALE SCANNER --- */}
      {showScanner && (
        <BarcodeScannerModal
          open={showScanner}
          onClose={() => setShowScanner(false)}
          onFound={handleBarcodeScan}
        />
      )}
    </div>
  );
}

// --- Scanner Modal Minimal ---
function BarcodeScannerModal({ open, onClose, onFound }: { open: boolean; onClose: () => void; onFound: (ean: string) => void }) {
  const scannerRef = useRef<any>(null);
  useEffect(() => {
    if (!open) return;
    let stopped = false;
    // Simula scanning barcode dopo 2s (mock)
    const timeout = setTimeout(() => {
      if (!stopped) {
        onFound(prompt("Simula scansione EAN. Inserisci EAN trovato:") || "");
      }
    }, 2000);
    return () => {
      stopped = true;
      clearTimeout(timeout);
    };
  }, [open, onFound]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md flex flex-col items-center relative">
        <button onClick={onClose} className="absolute top-2 right-3 text-xl text-gray-400 hover:text-gray-700">×</button>
        <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">Scannerizza codice a barre</h2>
        <div className="w-full flex items-center justify-center h-32 bg-gray-100 border rounded-xl mb-3">
          {/* Qui puoi integrare vero Html5Qrcode */}
          <span className="text-gray-400">[Barcode Scanner Video]</span>
        </div>
        <p className="text-center text-sm text-gray-600 px-2 mb-2">
          Inquadra il codice a barre<br />
          <span className="text-cyan-700 font-semibold">restando dentro il riquadro</span>
        </p>
        <button onClick={onClose} className="text-cyan-700 font-semibold hover:underline text-sm transition">Chiudi</button>
      </div>
    </div>
  );
}
