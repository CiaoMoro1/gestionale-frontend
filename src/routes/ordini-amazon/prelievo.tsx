import { useEffect, useState, useRef } from "react";
import { ChevronRight, Plus, Trash, Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import GeneraEtichetteModal from "../../components/GeneraEtichetteModal";

// ========== UTILS ==========
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

// ========== COMPONENTI UI ==========

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

type PrelievoRow = {
  id: number;
  stato: string;
  sku: string;
  ean: string;
  centri: Record<string, number>;
  qty: number;
  riscontro: number | null;
  plus: number | null;
  radice: string;
  note?: string;
};

export default function DettaglioPrelievo() {
  const { data } = useParams<{ data: string }>();
  const [prelievi, setPrelievi] = useState<PrelievoRow[]>([]);
  const [allPrelieviData, setAllPrelieviData] = useState<PrelievoRow[]>([]);
  const [modaleArticolo, setModaleArticolo] = useState<PrelievoRow | null>(null);
  const [riscontro, setRiscontro] = useState<number | null>(null);
  const [plus, setPlus] = useState<number | null>(null);
  const [note, setNote] = useState<string>("");
  const [riscontroError, setRiscontroError] = useState(false);
  const [search, setSearch] = useState("");
  const [radice, setRadice] = useState<string>("");
  const [radiciOpen, setRadiciOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: "success" | "error" } | null>(null);
  const [progressActive, setProgressActive] = useState(false);
  const [progressPerc, setProgressPerc] = useState(0);
  const [progressText, setProgressText] = useState<string>("");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // --- Responsive/Paginazione su totali ---
  const PAGE_SIZE = 10;
  const [itemsToShow, setItemsToShow] = useState(PAGE_SIZE);

  // Import date logic
  const [dateDisponibili, setDateDisponibili] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importData, setImportData] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const radiciBoxRef = useRef<HTMLDivElement>(null);

  // === Etichette & Cavallotto ===
  const [showEtichette, setShowEtichette] = useState(false);
  const [cavallottoModalSku, setCavallottoModalSku] = useState<string | null>(null);
  const [cavallottoLoading, setCavallottoLoading] = useState(false);

  function openCavallottoPdf(sku: string, formato: string) {
    setCavallottoLoading(true);
    window.open(
      `${import.meta.env.VITE_API_URL}/api/cavallotto/html?sku=${encodeURIComponent(sku)}&formato=${encodeURIComponent(formato)}`,
      "_blank"
    );
    setTimeout(() => {
      setCavallottoLoading(false);
      setCavallottoModalSku(null);
    }, 900);
  }

  // --- Chiudi dropdown radici cliccando fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (radiciBoxRef.current && !radiciBoxRef.current.contains(e.target as Node)) {
        setRadiciOpen(false);
      }
    }
    if (radiciOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [radiciOpen]);

  // --- Carica date disponibili per import
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/date-importabili`)
      .then(res => res.json())
      .then(setDateDisponibili)
      .catch(() => setDateDisponibili([]));
  }, []);

  // --- Carica tutte le righe (per radici disponibili)
  useEffect(() => {
    if (data) setImportData(data);
    fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`)
      .then(res => res.json())
      .then((lista: PrelievoRow[]) => setAllPrelieviData(lista));
  }, [data]);

  // --- Carica prelievi filtrati per radice
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}${radice ? `&radice=${encodeURIComponent(radice)}` : ""}`)
      .then(res => res.json())
      .then((lista: PrelievoRow[]) => setPrelievi(lista));
    setItemsToShow(PAGE_SIZE);
  }, [data, radice]);

  // Deseleziona tutto quando cambi filtro
  useEffect(() => {
    setSelectedIds([]);
  }, [radice, data, search]);

  // --- Radici
  const allRadici = Array.from(new Set(allPrelieviData.map(r => r.radice))).filter(Boolean);

  // --- Filtro ricerca
  const queryWords = normalizza(search).split(" ").filter(Boolean);
  let prelieviToShow = search.length > 0
    ? prelievi.filter(r => matchAllWords(r.sku + " " + r.ean, queryWords))
    : prelievi;

  // --- Paginazione solo per Totali senza ricerca
  const isTotali = !radice;
  const canPaginate = isTotali && prelieviToShow.length > itemsToShow;
  if (isTotali && !search) {
    prelieviToShow = prelieviToShow.slice(0, itemsToShow);
  }

  // --- MODALE ARTICOLO ---
  function openModaleArticolo(row: PrelievoRow) {
    setModaleArticolo(row);
    setRiscontro(row.riscontro ?? row.qty);
    setPlus(row.plus ?? 0);
    setNote(row.note ?? "");
    setRiscontroError(false);
  }

  function ProgressBar({ perc, text }: { perc: number, text: string }) {
    return (
      <div className="fixed top-0 left-0 w-full z-[120] pointer-events-none">
        <div className="w-full flex flex-col items-center">
          <div className="mt-2 mb-1 text-sm font-bold text-cyan-800 animate-pulse bg-white/80 px-2 py-1 rounded-xl shadow">
            {text}
          </div>
          <div className="relative w-[88vw] max-w-[540px] h-3 rounded-xl overflow-hidden bg-cyan-100 shadow">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-cyan-600 transition-all duration-300"
              style={{
                width: perc + "%",
                minWidth: perc > 0 ? "12%" : "0"
              }}
            />
            <div
              className="absolute top-0 left-0 h-full w-full animate-bar-stripes"
              style={{ background: "repeating-linear-gradient(90deg,#d5f3fc 0 10px,transparent 10px 20px)" }}
            />
          </div>
        </div>
        <style>{`
          @keyframes bar-stripes {
            0% { background-position-x: 0;}
            100% { background-position-x: 40px;}
          }
          .animate-bar-stripes {
            animation: bar-stripes 0.7s linear infinite;
            opacity: 0.18;
          }
        `}</style>
      </div>
    );
  }

  async function salvaModificaPrelievo(riscontroVal?: number) {
    if (!modaleArticolo) return;
    const riscontroToSend = typeof riscontroVal === "number" ? riscontroVal : riscontro;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/${modaleArticolo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        riscontro: riscontroToSend ?? null,
        plus: plus ?? null,
        note: note ?? ""
      })
    });

    if (!res.ok) {
      let msg = "Errore di validazione!";
      try {
        const err = await res.json();
        msg = err.error || msg;
      } catch {// no-op: l'errore viene ignorato volutamente// 
      }
      setToast({ msg, type: "error" });
      return;
    }

    const res1 = await fetch(
      `${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}${radice ? `&radice=${encodeURIComponent(radice)}` : ""}`
    );
    setPrelievi(await res1.json());

    const res2 = await fetch(
      `${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`
    );
    setAllPrelieviData(await res2.json());

    setModaleArticolo(null);
    setRiscontroError(false);
    setToast({ msg: "Prelievo aggiornato!", type: "success" });
  }

  function handleRiscontroChange(e: React.ChangeEvent<HTMLInputElement>) {
    const max = modaleArticolo?.qty ?? 0;
    const value = e.target.value === "" ? null : Number(e.target.value);
    if (value !== null && value > max) {
      setRiscontro(max);
      setRiscontroError(true);
      setTimeout(() => setRiscontroError(false), 1000);
    } else if (value !== null && value < 0) {
      setRiscontro(0);
    } else {
      setRiscontro(value);
      setRiscontroError(false);
    }
  }

    // --- AZIONI MASSIVE ---

  async function completaFiltrati() {
    const pendingIds = prelieviToShow
      .filter(r => r.stato === "pending" || r.stato === "in verifica")
      .map(r => r.id);

    if (pendingIds.length === 0) {
      alert("Non ci sono articoli pending da completare in questo filtro.");
      return;
    }
    if (!window.confirm("Vuoi segnare tutti i pending filtrati come MANCA?")) return;

    try {
      setProgressActive(true); setProgressPerc(20); setProgressText("Completamento prelievi filtrati…");

      // 1) riscontro=0
      const setRes = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingIds, fields: { riscontro: 0 } })
      });
      if (!setRes.ok) throw new Error("Impossibile aggiornare i prelievi (bulk).");

      setProgressPerc(75); setProgressText("Sincronizzo produzione (filtrati)…");

      // 2) pulizia produzione parziale
      const body = radice ? { radice } : { ids: pendingIds };
      const cleanRes = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/pulisci-da-stampare-parziale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!cleanRes.ok) throw new Error("Pulizia produzione parziale fallita.");

      setProgressPerc(100); setProgressText("Completato!");
      setTimeout(() => setProgressActive(false), 600);

      // 3) refresh liste
      const res1 = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}${radice ? `&radice=${encodeURIComponent(radice)}` : ""}`);
      setPrelievi(await res1.json());
      const res2 = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`);
      setAllPrelieviData(await res2.json());
      setSelectedIds([]);
      setToast({ msg: "Completati filtrati e pulita produzione!", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Errore durante la pulizia.", type: "error" });
      setProgressActive(false);
    }
  }

  async function completaSelezionati() {
    const ids = selectedIds;
    if (ids.length === 0) return;
    if (!window.confirm("Vuoi segnare come MANCA i selezionati?")) return;

    try {
      setProgressActive(true); setProgressPerc(20); setProgressText("Completamento prelievi selezionati…");

      const setRes = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, fields: { riscontro: 0 } })
      });
      if (!setRes.ok) throw new Error("Impossibile aggiornare i prelievi selezionati.");

      setProgressPerc(75); setProgressText("Sincronizzo produzione (selezionati)…");

      const cleanRes = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/pulisci-da-stampare-parziale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!cleanRes.ok) throw new Error("Pulizia produzione parziale fallita.");

      setProgressPerc(100); setProgressText("Completato!");
      setTimeout(() => setProgressActive(false), 600);

      const res1 = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}${radice ? `&radice=${encodeURIComponent(radice)}` : ""}`);
      setPrelievi(await res1.json());
      const res2 = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`);
      setAllPrelieviData(await res2.json());
      setSelectedIds([]);
      setToast({ msg: "Completati selezionati e pulita produzione!", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Errore durante la pulizia.", type: "error" });
      setProgressActive(false);
    }
  }


  async function completaPending() {
    try {
      const resPrelievi = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`);
      const tuttiPrelievi: PrelievoRow[] = await resPrelievi.json();
      const pendingIds = tuttiPrelievi.filter(r => r.stato === "pending" || r.stato === "in verifica").map(r => r.id);

      if (pendingIds.length === 0) {
        alert("Non ci sono articoli pending da completare.");
        return;
      }
      if (!window.confirm("Sei sicuro di voler segnare tutti i pending come MANCA?")) return;

      setProgressActive(true); setProgressPerc(25); setProgressText("Completo tutti i pending…");

      const setRes = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingIds, fields: { riscontro: 0 } })
      });
      if (!setRes.ok) throw new Error("Impossibile aggiornare i prelievi (bulk).");

      setProgressPerc(85); setProgressText("Sincronizzo produzione (globale)…");

      const cleanRes = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/pulisci-da-stampare`, { method: "POST" });
      if (!cleanRes.ok) throw new Error("Pulizia produzione globale fallita.");

      setProgressPerc(100); setProgressText("Completato!");
      setTimeout(() => setProgressActive(false), 700);

      const res1 = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}${radice ? `&radice=${encodeURIComponent(radice)}` : ""}`);
      setPrelievi(await res1.json());
      const res2 = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`);
      setAllPrelieviData(await res2.json());
      setSelectedIds([]);
      setToast({ msg: "Completato tutto e pulita produzione!", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Errore durante la pulizia.", type: "error" });
      setProgressActive(false);
    }
  }


  async function svuotaLista() {
    if (!window.confirm("Sei sicuro di voler svuotare tutta la lista prelievi? L'operazione è IRREVERSIBILE!")) return;
    await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/svuota`, { method: "DELETE" });
    setPrelievi([]);
    setAllPrelieviData([]);
    setToast({ msg: "Lista prelievi svuotata!", type: "success" });
  }

  // --- SCHERMATA IMPORTA DATA (se prelievi vuoti) ---
  if (!importLoading && prelievi.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <div className="max-w-md w-full bg-white rounded-xl p-8 shadow text-center flex flex-col items-center gap-6">
          <div className="text-2xl font-bold mb-4 text-blue-800">Importa prelievi</div>
          <div className="mb-2">Seleziona la data da importare:</div>
          <select
            className="select select-bordered w-full"
            onChange={async e => {
              const selected = e.target.value;
              if (!selected) return;
              setImportLoading(true);
              setImportData(selected);
              setProgressActive(true); setProgressPerc(15); setProgressText("Importazione prelievi in corso...");
              await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/importa`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: selected })
              });
              setProgressPerc(99);
              setTimeout(() => {
                setProgressPerc(100);
                setTimeout(() => setProgressActive(false), 600);
                window.location.reload();
              }, 400);
            }}
            defaultValue=""
          >
            <option value="" disabled>Seleziona una data</option>
            {dateDisponibili.map(date => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
          {importLoading && <span className="loading loading-spinner loading-lg mt-3"></span>}
        </div>
      </div>
    );
  }

  // ---- SCHERMATA PRELIEVI ----
  return (
    <div className="w-full max-w-[1100px] mx-auto px-1 pb-10 font-sans">
      {progressActive && <ProgressBar perc={progressPerc} text={progressText} />}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 mb-3 justify-between w-full pt-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-blue-700 text-2xl">📦</span>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-base text-blue-900 truncate">Prelievo</span>
            <span className="text-xs text-neutral-500 truncate">
              Data: {data || importData || "-"}
            </span>
          </div>
        </div>
        <div className="flex gap-2 items-center ml-auto flex-wrap">
          <button
            className="btn btn-sm px-4 py-2 rounded-full bg-red-500 text-white font-bold shadow hover:bg-red-700 transition text-base"
            onClick={completaPending}
            title="Imposta tutti i pending come manca"
          >
            Completa TUTTO
          </button>
          <button
            className="btn btn-sm px-4 py-2 rounded-full bg-yellow-500 text-white font-bold shadow hover:bg-yellow-700 transition text-base"
            onClick={completaFiltrati}
            title="Completa solo i prelievi filtrati"
          >
            Completa filtrati
          </button>
          <button
            className={`btn btn-sm px-4 py-2 rounded-full font-bold shadow transition text-base ${selectedIds.length > 0 ? "bg-green-500 text-white hover:bg-green-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
            onClick={completaSelezionati}
            title="Completa solo i selezionati"
            disabled={selectedIds.length === 0}
          >
            Completa selezionati
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 px-3 py-1 rounded-full border border-gray-300 text-gray-700 bg-white hover:bg-cyan-100 transition text-xs shadow-sm whitespace-nowrap font-medium"
          >
            <Plus size={16} />
            Importa nuova data
          </button>
          <button
            className="btn btn-sm px-4 py-2 rounded-full bg-gray-300 text-gray-700 font-bold shadow hover:bg-gray-400 transition text-base ml-2 flex items-center gap-2"
            onClick={svuotaLista}
            title="Svuota lista prelievi"
          >
            <Trash size={16} /> Svuota lista
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-end gap-4 mb-3">
        {/* Filtro radice */}
        <div className="relative" ref={radiciBoxRef}>
          <label className="block text-xs font-semibold mb-1">Radice prodotto</label>
          <button
            type="button"
            className={`w-[140px] flex justify-between items-center px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition focus:outline-none ${radiciOpen ? "border-cyan-500 ring-2 ring-cyan-100" : "border-gray-300"}`}
            onClick={() => setRadiciOpen(!radiciOpen)}
          >
            {radice ? radice : "Totali"}
            <span className="ml-2">{radiciOpen ? "▲" : "▼"}</span>
          </button>
          {radiciOpen && (
            <div
              className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto animate-fade-in"
              style={{ minWidth: 140 }}
            >
              <div
                className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${radice === "" ? "bg-cyan-100 text-cyan-900" : "text-cyan-700"}`}
                onClick={() => { setRadice(""); setRadiciOpen(false); }}
              >
                Totali
              </div>
              {allRadici.map(r => (
                <div
                  key={r}
                  className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${radice === r ? "bg-cyan-200 text-cyan-900" : "text-cyan-700"}`}
                  onClick={() => { setRadice(r); setRadiciOpen(false); }}
                >
                  {r}
                </div>
              ))}
            </div>
          )}
          <style>{`
            @keyframes fade-in {
              0% { opacity: 0; transform: translateY(-8px);}
              100% { opacity: 1; transform: translateY(0);}
            }
            .animate-fade-in { animation: fade-in 0.2s; }
          `}</style>
        </div>
        {/* Ricerca */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold mb-1">Cerca per SKU o EAN</label>
          <input
            type="text"
            className="rounded-xl border border-cyan-400 px-3 py-2 text-[15px] outline-cyan-700 w-full font-medium"
            placeholder="Cerca per SKU o EAN"
            value={search}
            ref={inputRef}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabella Prelievi */}
      <div className="rounded-2xl shadow border bg-white/80 px-0 py-2 mb-8 overflow-x-auto">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[700px] text-[15px] sm:text-[17px]">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="px-2 py-2 text-center w-[44px]">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === prelieviToShow.length}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedIds(prelieviToShow.map(r => r.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
                <th className="px-2 py-2 text-left" style={{ minWidth: 80 }}>Stato</th>
                <th className="px-2 py-2 text-left">SKU</th>
                <th className="px-2 py-2 text-center">Totale</th>
                <th className="px-2 py-2 text-center">Riscontro</th>
                <th className="px-2 py-2 text-center">Plus</th>
                <th className="px-2 py-2 text-left">EAN</th>
                <th className="sticky right-0 z-10 bg-white/95 border-l-2 border-base-200 shadow-lg px-2 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {prelieviToShow.map((r) => {
                const processed = r.riscontro !== null && r.stato !== "in verifica";
                return (
                  <tr
                    key={r.id}
                    className={`
                      ${processed ? "bg-cyan-50" : ""}
                      border-b border-gray-200 last:border-b-0
                    `}
                  >
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedIds(sel => [...sel, r.id]);
                          } else {
                            setSelectedIds(sel => sel.filter(id => id !== r.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div
                        className={`rounded-xl py-2 font-bold text-[13px] flex items-center justify-center
                          ${
                          r.stato === "completo"
                            ? "bg-green-100 text-green-800 border border-green-400"
                            : r.stato === "parziale"
                              ? "bg-yellow-100 text-yellow-800 border border-yellow-400"
                              : r.stato === "manca"
                                ? "bg-red-100 text-red-700 border border-red-400"
                                : "bg-gray-100 text-gray-700 border border-gray-300"
                          }
                        `}
                        style={{ minWidth: 80, letterSpacing: 1.1 }}
                      >
                        {(r.stato === "in verifica" ? "pending" : r.stato).toUpperCase()}
                      </div>
                    </td>
                    <td className="font-mono px-2 py-2">{r.sku}</td>
                    <td className="text-center font-semibold px-2 py-2">{r.qty}</td>
                    <td className="text-center px-2 py-2">{r.riscontro ?? ""}</td>
                    <td className="text-center px-2 py-2">{r.plus ?? ""}</td>
                    <td className="font-mono px-2 py-2">{r.ean}</td>
                    <td className="sticky right-0 z-10 bg-white/95 border-l-2 border-base-200 shadow-lg text-center min-w-[54px] px-2 py-2">
                      <button
                        className="rounded-full p-2 shadow bg-blue-500 text-white hover:bg-blue-700"
                        onClick={() => openModaleArticolo(r)}
                        aria-label="Modifica"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {prelieviToShow.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-6 text-lg">
                    Nessun articolo trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {canPaginate && (
          <div className="flex justify-center mt-4">
            <button
              className="px-6 py-2 bg-cyan-700 text-white rounded-xl shadow font-bold text-base hover:bg-cyan-900"
              onClick={() => setItemsToShow(n => n + 20)}
            >Mostra altri</button>
          </div>
        )}
      </div>

      {/* MODALE MODIFICA */}
      {modaleArticolo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-5 shadow-lg w-full max-w-sm relative border flex flex-col">
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setModaleArticolo(null)}
            >×</button>

            <div className="mb-1 font-bold text-blue-700 text-lg">Modifica Prelievo</div>

            <div className="mb-2 font-mono text-base flex items-center gap-3">
              <span className="bg-blue-100 px-2 py-1 rounded">{modaleArticolo.sku}</span>
            </div>

            <div className="mb-2 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
              <b>EAN:</b> {modaleArticolo.ean}
              <div className="flex gap-2 mt-1">
                <button
                  className="px-2 py-1 bg-gray-100 border rounded-lg text-xs font-semibold hover:bg-gray-200 transition"
                  onClick={() => setShowEtichette(true)}
                  disabled={!modaleArticolo.sku || !modaleArticolo.ean}
                  title="Genera etichette"
                >
                  🏷️ Genera Etichette
                </button>
                <button
                  className="px-2 py-1 bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-800 hover:bg-indigo-200 transition"
                  onClick={() => setCavallottoModalSku(modaleArticolo.sku)}
                  disabled={!modaleArticolo.sku}
                  title="Genera cavallotto"
                >
                  🖨️ Genera Cavallotto
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-3">
              <div>
                <label className="block text-xs mb-1">Riscontro (max {modaleArticolo.qty})</label>
                <input
                  type="number"
                  min={0}
                  max={modaleArticolo.qty}
                  value={riscontro ?? ""}
                  onChange={handleRiscontroChange}
                  className={`w-full border rounded-lg p-2 text-center font-bold text-blue-700 outline-blue-400 transition-all
                    ${riscontroError ? "border-red-500 ring-2 ring-red-400 animate-shake" : ""}
                  `}
                  placeholder="Riscontro"
                  style={{ fontSize: 20 }}
                />
                <style>
                  {`
                    @keyframes fade-in {
                      0% { opacity: 0; transform: translateY(-8px);}
                      100% { opacity: 1; transform: translateY(0);}
                    }
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
              <div>
                <label className="block text-xs mb-1">Plus (extra produzione)</label>
                <input
                  type="number"
                  min={0}
                  value={plus ?? ""}
                  onChange={e =>
                    setPlus(e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="w-full border rounded-lg p-2 text-center font-bold outline-blue-400"
                  placeholder="Plus"
                  style={{ fontSize: 20 }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Note</label>
                <textarea
                  className="w-full border rounded-lg p-2 text-blue-800 outline-blue-400 min-h-[60px] resize-y"
                  placeholder="Note operatore…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between gap-2 mt-3">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 font-bold rounded-full shadow hover:bg-red-200 transition text-sm"
                onClick={() => salvaModificaPrelievo(0)}
                style={{ minWidth: 0 }}
              >
                Niente disponibile
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-full shadow hover:bg-blue-700 transition text-sm"
                onClick={() => salvaModificaPrelievo()}
                disabled={riscontro === null || riscontro < 0}
                style={{ minWidth: 0 }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE ETICHETTE */}
      <GeneraEtichetteModal
        open={showEtichette}
        onClose={() => setShowEtichette(false)}
        sku={modaleArticolo?.sku || ""}
        ean={modaleArticolo?.ean || ""}
      />

      {/* MODALE CAVALLOTTO */}
      {cavallottoModalSku && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center relative">
            <button
              className="absolute top-2 right-3 text-2xl text-gray-300 hover:text-black"
              onClick={() => setCavallottoModalSku(null)}
            >×</button>
            <div className="mb-4 font-bold text-lg text-blue-800">Stampa Cavallotto</div>
            <div className="mb-4">Scegli il formato</div>
            <div className="flex flex-col gap-2 mb-3">
              {["A5", "A4", "A3"].map(formato => (
                <button
                  key={formato}
                  className="bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-800 font-semibold py-2 rounded-xl"
                  onClick={() => openCavallottoPdf(cavallottoModalSku, formato)}
                  disabled={cavallottoLoading}
                >
                  {formato}
                </button>
              ))}
            </div>
            {cavallottoLoading && <Loader2 className="mx-auto animate-spin text-indigo-600" />}
          </div>
        </div>
      )}

      <style>
        {`
        @media (max-width: 850px) {
          .font-sans { font-size: 15px; }
          table { font-size: 13.5px; }
          th, td { padding: 7px 5px !important; }
        }
        @media (max-width: 600px) {
          .font-sans { font-size: 13px; }
          table { font-size: 12.3px; }
          th, td { padding: 5px 3px !important; }
        }
        `}
      </style>
    </div>
  );
}
