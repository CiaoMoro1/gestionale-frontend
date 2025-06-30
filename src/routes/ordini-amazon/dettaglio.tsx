import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Package, CheckCircle, ChevronRight, Plus, Minus } from "lucide-react";

// --- Tipi dati
type Articolo = {
  model_number: string;
  vendor_product_id: string;
  qty_ordered: number;
  po_number: string;   // <--- AGGIUNGI QUESTO!
};
type RigaParziale = {
  model_number: string;
  quantita: number;
  collo: number;
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
};

export default function DettaglioDestinazione() {
  const { center, data } = useParams();
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [parziali, setParziali] = useState<RigaParziale[]>([]);
  const [parzialiStorici, setParzialiStorici] = useState<ParzialeStorico[]>([]);
  const [confermaCollo, setConfermaCollo] = useState<{ [collo: number]: boolean }>({});
  const [modaleArticolo, setModaleArticolo] = useState<Articolo | null>(null);
  const [inputs, setInputs] = useState<RigaInput[]>([{ quantita: "", collo: 1 }]);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);

  // Carica dati all'apertura
  useEffect(() => {
    if (!center || !data) return;
    // 1. Articoli
    fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/dettaglio-destinazione?center=${center}&data=${data}`)
      .then((res) => res.json())
      .then((json) => {
        const lista = json.articoli || [];
        lista.sort((a: Articolo, b: Articolo) => a.model_number.localeCompare(b.model_number));
        setArticoli(lista);
      });
    // 2. Parziali storici
    fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-storici?center=${center}&data=${data}`)
      .then(res => res.json())
      .then((storici: ParzialeStorico[]) => setParzialiStorici(storici));
    // 3. Parziali WIP (in lavorazione)
    // 3. Parziali WIP (in lavorazione)
  fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${center}&data=${data}`)
    .then(res => res.json())
    .then((json) => {
      if (Array.isArray(json)) {
        setParziali(json);             // l'API ha restituito un array puro
        setConfermaCollo({});          // nessun confermaCollo disponibile (reset)
      } else {
        setParziali(json.parziali || []);
        setConfermaCollo(json.confermaCollo || {});
      }
    });

  }, [center, data]);

  // --- AGGIORNAMENTO LIVE su Supabase
  async function salvaParzialiLive(nextParziali: RigaParziale[], nextConfermaCollo: any) {
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${center}&data=${data}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parziali: nextParziali,
        confermaCollo: nextConfermaCollo
      }),
    });
    setParziali(nextParziali);
    setConfermaCollo(nextConfermaCollo);
  }
  

  // --- Modale apertura/modifica
  function openParzialeModale(art: Articolo) {
    setModaleArticolo(art);
    // Popola gli input con i dati wip esistenti di questo articolo
    const esistenti = parziali.filter((p) => p.model_number === art.model_number);
    if (esistenti.length > 0) {
      setInputs(esistenti.map(p => ({
        quantita: p.quantita,
        collo: p.collo,
      })));
    } else {
      setInputs([{ quantita: "", collo: 1 }]);
    }
    setShakeIdx(null);
  }

  // Parziali storici per uno SKU (già evasi/spediti)
  function getParzialiStorici(model: string) {
    return parzialiStorici.filter((p) => p.model_number === model);
  }
  function totaleStorici(model: string) {
    return getParzialiStorici(model).reduce((sum, r) => sum + r.quantita, 0);
  }
  function totaleWip(model: string) {
    return parziali.filter((p) => p.model_number === model).reduce((sum, r) => sum + r.quantita, 0);
  }

  function getResiduoInput(idx: number): number {
    if (!modaleArticolo) return 0;

    // Parziali storici (confermati)
    const totaleStorico = getParzialiStorici(modaleArticolo.model_number)
      .reduce((sum, r) => sum + r.quantita, 0);

    // Collo degli input modale (cioè quelli che sto per cambiare/salvare)
    const colliInput = inputs.map(inp => inp.collo);

    // Parziali WIP (già salvati) per questo articolo, MA NON nei colli che sto modificando adesso
    const parzialiAltriCollo = parziali.filter(
      p =>
        p.model_number === modaleArticolo.model_number &&
        !colliInput.includes(p.collo)
    );
    const totaleWipAltriCollo = parzialiAltriCollo.reduce((sum, r) => sum + r.quantita, 0);

    // Somma input modale tranne quello corrente
    const sommaAltriInput = inputs
      .map((inp, i) => (i !== idx ? Number(inp.quantita) || 0 : 0))
      .reduce((a, b) => a + b, 0);

    return Math.max(
      0,
      modaleArticolo.qty_ordered - totaleStorico - totaleWipAltriCollo - sommaAltriInput
    );
  }


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
      // Salva live ogni modifica per l'articolo attuale
      salvaParzialiLiveGenerico(modaleArticolo, updated);
      return updated;
    });
    if (campo === "quantita" && Number(val) > getResiduoInput(idx)) {
      setShakeIdx(idx);
      setTimeout(() => setShakeIdx(null), 400);
    }
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
        confermato: false      // <-- sempre presente!
      }));
    const altri = parziali.filter(p => p.model_number !== art.model_number);
    await salvaParzialiLive([...altri, ...nuoviParziali], confermaCollo);
  }

  function aggiungiRiga() {
    setInputs((prev) => [...prev, { quantita: "", collo: 1 }]);
  }
  function rimuoviRiga(idx: number) {
    setInputs((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function aggiungiParziali() {
    if (!modaleArticolo) return;
    // Aggiorna i parziali su Supabase SOLO per questo articolo
    await salvaParzialiLiveGenerico(modaleArticolo, inputs);
    setModaleArticolo(null);
  }

  // --- Collo: conferma/annulla live
  async function confermaUnCollo(collo: number) {
    const updated = { ...confermaCollo, [collo]: true };
    await salvaParzialiLive(parziali, updated);
  }
  async function annullaConfermaCollo(collo: number) {
    const updated = { ...confermaCollo, [collo]: false };
    await salvaParzialiLive(parziali, updated);
  }

  // Tutti colli confermati?
  const tuttiConfermati = colliRiepilogo().length > 0 && colliRiepilogo().every((c) => c.confermato);

  // --- Riepilogo colli (in tempo reale)
  function colliRiepilogo(): ColloRiepilogo[] {
    const gruppi: { [collo: number]: ColloRiepilogo } = {};
    for (const p of parziali) {
      if (!gruppi[p.collo])
        gruppi[p.collo] = { collo: p.collo, righe: [], confermato: !!confermaCollo[p.collo] };
      gruppi[p.collo].righe.push({ model_number: p.model_number, quantita: Number(p.quantita) });
    }
    return Object.values(gruppi).sort((a, b) => a.collo - b.collo);
  }

  // --- Conferma spedizione: POST conferma a backend
  async function generaSpedizione() {
    await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip/conferma`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ center, data }),
    });
    // Forza ricarica dati storici/wip appena confermi!
    window.location.reload();
  }

  // --- UI
  return (
    <div className="w-full max-w-[900px] mx-auto px-2 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Package className="text-blue-600" size={32} />
        <div className="flex-1">
          <span className="block font-bold text-xl uppercase">{center}</span>
          <span className="block text-sm text-neutral-500">Data: {data}</span>
        </div>
      </div>
      {/* Tabella Articoli */}
      <div className="rounded-2xl shadow border bg-white/70 px-2 py-2 mb-8 overflow-x-auto">
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
              return (
                <tr key={art.model_number} className="border-t">
                  <td className="font-mono px-2 py-2">
                    <span className="inline-block bg-blue-100 px-2 py-1 rounded">
                      {art.model_number}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center font-bold text-blue-500">
                    {/* Dettaglio parziali storici */}
                    {totStorici === 0 ? (
                      <span className="text-neutral-400 text-xs">Nessuno</span>
                    ) : (
                      <span>
                        {getParzialiStorici(art.model_number).map((p, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded px-2 py-0.5 mr-1 text-xs font-bold"
                          >
                            Collo {p.collo}
                            <span className="bg-blue-200 text-blue-900 rounded px-1 ml-1">
                              {p.quantita}
                            </span>
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center font-bold text-blue-800">
                    {confermata}/{art.qty_ordered}
                  </td>
                  <td className="text-right">
                    <button
                      className="bg-blue-500 text-white rounded-full p-2 shadow hover:bg-blue-700 transition"
                      onClick={() => openParzialeModale(art)}
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
          <div className="bg-white rounded-2xl p-7 shadow-lg min-w-[360px] w-full max-w-sm relative border">
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setModaleArticolo(null)}
            >
              ×
            </button>
            <div className="mb-1 font-bold text-blue-700 text-lg">Gestisci Parziali</div>
            <div className="mb-2 font-mono text-base">
              <span className="bg-blue-100 px-2 py-1 rounded">{modaleArticolo.model_number}</span>
            </div>
            <div className="mb-2 text-xs text-neutral-500">
              <b>EAN:</b> {modaleArticolo.vendor_product_id || <span className="text-neutral-300">N/A</span>}
            </div>
            {/* Parziali precedenti */}
            <div className="mb-2">
              <div className="text-sm font-semibold mb-1">Parziali precedenti:</div>
              {getParzialiStorici(modaleArticolo.model_number).length === 0 ? (
                <div className="text-neutral-400 text-xs">Nessun parziale inserito</div>
              ) : (
                <ul className="space-y-1 text-xs">
                  {getParzialiStorici(modaleArticolo.model_number).map((p, idx) => (
                    <li key={idx} className="flex gap-3 items-center">
                      <span className="font-mono text-blue-900">{p.quantita}</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">Collo {p.collo}</span>
                    </li>
                  ))}
                </ul>
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
                className={`bg-white rounded-2xl shadow p-4 min-w-[180px] relative border-2 ${
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
      {/* TASTO GENERA SPEDIZIONE */}
      <div className="mt-12 flex justify-end">
        <button
          className={`bg-green-600 text-white font-bold rounded-xl px-8 py-4 text-lg shadow-lg transition ${
            !tuttiConfermati ? "opacity-40 cursor-not-allowed" : "hover:bg-green-700"
          }`}
          disabled={!tuttiConfermati}
          onClick={generaSpedizione}
        >
          Genera Spedizione
        </button>
      </div>
    </div>
  );
}
