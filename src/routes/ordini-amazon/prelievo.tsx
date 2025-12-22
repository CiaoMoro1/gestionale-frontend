import { useEffect, useRef, useState } from "react";
import { ChevronRight,} from "lucide-react";
import { useParams } from "react-router-dom";
import PrelievoModal, { PrelievoRow } from "../../components/PrelievoModal";
import SearchInput from "@/features/produzione/components/FiltersBar/SearchInput";

/* ===========================
   Utils ricerca / ordinamento
=========================== */
function normalizza(str: string) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function matchAllWords(target: string, queryWords: string[]) {
  const targetWords = normalizza(target).split(" ");
  return queryWords.every((qw) => targetWords.some((tw) => tw === qw || tw.startsWith(qw)));
}

// --- Helpers sorting/filtri "MZ-" + grouping radici ---
function stripMZ(sku: string): string {
  return (sku || "").replace(/^MZ-?/i, ""); // toglie MZ- o MZ
}
// Usato per ordinare SKU: ignora MZ- e usa tutto lo sku normalizzato
function sortKeySku(sku: string): string {
  return stripMZ(sku).toUpperCase();
}

function lastSkuSegmentRaw(skuNoMZ: string): string {
  // prendi l’ultimo segmento “visibile” separato da - _ / . o spazi
  const parts = skuNoMZ
    .trim()
    .split(/[-_\s/.]+/g)
    .filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : "";
  // normalizza in “tight” per confronti stabili
  return (last || "")
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}


// Mappa di "collasso" radici come richiesto
const RADICE_COLLAPSE: Record<string, string> = {
  CCSCDN: "CCSCD",
  CENTRO: "CENTROTAVOLA",
  CENTROTAVOLAN: "CENTROTAVOLA",
  CENTROD: "CENTROTAVOLA",
  CLFDN: "CLFD",
  CPRFDN: "CPRFD",
  CPRFLLDN: "CPRFLLD",
  RNNCDN: "RNNCD",
  TOVCDN: "TOVCD",
  TENDA:  "CSA",
  CFD: "CFDM",
  TPCDN: "TPCD",
};
// Collassa la radice
function collapseRadice(radice: string | undefined | null): string {
  const r = (radice || "").toUpperCase().trim();
  return RADICE_COLLAPSE[r] ?? r;
}

// Radice grezza ricavata dallo SKU, ignorando MZ-
function radiceFromSku(sku: string): string {
  const base = stripMZ(sku).toUpperCase();
  const first = base.split("-")[0] || "";
  return first.trim();
}

// Radice finale per UI/filtri: MZ-ignorata + collasso
function radiceFromRow(r: PrelievoRow): string {
  return collapseRadice(radiceFromSku(r.sku));
}

/* ===========================
   Toast
=========================== */
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2300);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed top-6 left-1/2 z-[100] -translate-x-1/2 px-5 py-3 rounded-xl font-bold shadow-xl border text-center
      ${type === "success" ? "bg-green-100 border-green-300 text-green-800" : "bg-red-100 border-red-300 text-red-700"}
      animate-toast-pop`}
    >
      {message}
      <style>{`
        .animate-toast-pop { animation: toast-pop .5s cubic-bezier(.4,2,.3,1) both; }
        @keyframes toast-pop {
          0% { transform: translateX(-50%) scale(0.8); opacity:0; }
          100% { transform: translateX(-50%) scale(1); opacity:1;}
        }
      `}</style>
    </div>
  );
}

/* ===========================
   Pagina
=========================== */
export default function DettaglioPrelievo() {
  const { data } = useParams<{ data: string }>();

  const [prelievi, setPrelievi] = useState<PrelievoRow[]>([]);
  const [allPrelieviData, setAllPrelieviData] = useState<PrelievoRow[]>([]);
  const [modaleArticolo, setModaleArticolo] = useState<PrelievoRow | null>(null);

  const [search, setSearch] = useState("");
  const [radice, setRadice] = useState<string>("");
  const [radiciOpen, setRadiciOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [progressActive, setProgressActive] = useState(false);
  const [progressPerc, setProgressPerc] = useState(0);
  const [progressText, setProgressText] = useState<string>("");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Import data
  const [dateDisponibili, setDateDisponibili] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importData, setImportData] = useState<string | null>(null);

  const radiciBoxRef = useRef<HTMLDivElement>(null);

  // --- Paginazione su Totali (senza filtro radice)
  const PAGE_SIZE = 10;
  const [itemsToShow, setItemsToShow] = useState(PAGE_SIZE);




  
  // Chiudi dropdown radici cliccando fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (radiciBoxRef.current && !radiciBoxRef.current.contains(e.target as Node)) {
        setRadiciOpen(false);
      }
    }
    if (radiciOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [radiciOpen]);

  // Date disponibili
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/date-importabili`)
      .then((res) => res.json())
      .then(setDateDisponibili)
      .catch(() => setDateDisponibili([]));
  }, []);

  // Carica TUTTI i prelievi della data (per tabella e per elenco radici)
  useEffect(() => {
    if (data) setImportData(data);
    const url = `${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`;
    fetch(url).then(res => res.json()).then((lista: PrelievoRow[]) => {
      setPrelievi(lista);
      setAllPrelieviData(lista);
      setItemsToShow(PAGE_SIZE);
    });
  }, [data]);

  // Reset selezione quando cambi filtro
  useEffect(() => {
    setSelectedIds([]);
  }, [radice, data, search]);

  // Radici disponibili (collassate e ordinate)
  const allRadici =
    Array.from(new Set(allPrelieviData.map(radiceFromRow).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));

  // --- Filtro ricerca (supporta suffisso ;)
  function normalizeTight(s: string) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]/g, "");  // rimuove tutto tranne lettere/numeri
  }

  const raw = (search || "").trim();
  const tokens = raw.split(/\s+/).filter(Boolean);
  const suffixTokens = tokens
    .filter((t) => t.endsWith(";"))
    .map((t) => t.slice(0, -1))
    .map(normalizeTight)
    .filter(Boolean);
  const normalTokens = tokens
    .filter((t) => !t.endsWith(";"))
    .map(normalizza);

  // 1) Filtro radice (client) su prelievi
  const prelieviAfterRadice = radice
    ? prelievi.filter(r => radiceFromRow(r) === radice)
    : prelievi;

  // 2) Filtro search (ignora MZ-)
   const prelieviAfterSearch = (search.length > 0)
     ? prelieviAfterRadice.filter(r => {
         const skuNoMZ = stripMZ(r.sku);
   
         // --- token normali: tutte le parole devono matchare (word/prefix) su SKU+EAN
         const baseOk = normalTokens.length === 0
           ? true
           : matchAllWords(`${skuNoMZ} ${r.ean || ""}`, normalTokens);
   
         // --- token con ';' = "chiusura esatta del segmento finale"
         const lastSegTight = lastSkuSegmentRaw(skuNoMZ);  // <-- niente .at(-1)
         const suffixOk = suffixTokens.length === 0
           ? true
           : suffixTokens.some(suf => lastSegTight === suf); // suf è già normalizeTight
   
         // --- fallback "contains" SOLO se non sto usando ';'
         const allowFallback = suffixTokens.length === 0;
         const skuTight = normalizeTight(skuNoMZ);
         const eanTight = normalizeTight(r.ean || "");
         const searchTight = normalizeTight(search.replace(/;+/g, "")); // togli i ';' dal fallback
         const fallbackOk = allowFallback
           ? (searchTight ? (skuTight.includes(searchTight) || eanTight.includes(searchTight)) : true)
           : false;
   
         return (baseOk && suffixOk) || fallbackOk;
       })
     : prelieviAfterRadice;

  // 3) Ordinamento A→Z ignorando MZ-
  let prelieviToShow = [...prelieviAfterSearch].sort((a, b) =>
    sortKeySku(a.sku).localeCompare(sortKeySku(b.sku), "it", { sensitivity: "base" })
  );

  // 4) Paginazione solo per Totali (senza radice e senza ricerca)
  const isTotali = !radice;
  const canPaginate = isTotali && !search && prelieviToShow.length > itemsToShow;
  if (isTotali && !search) {
    prelieviToShow = prelieviToShow.slice(0, itemsToShow);
  }

// --- Admin guard (password = "petti") ---------------------------------------
    const ADMIN_PWD = "petti";

    function askAdminPassword(): boolean {
      const pwd = window.prompt("Inserisci password amministratore:");
      if (pwd === null) return false; // utente ha annullato
      const ok = pwd === ADMIN_PWD;
      if (!ok) setToast({ msg: "Password errata.", type: "error" });
      return ok;
    }

    // wrapper per i bottoni protetti
    async function secureReload() {
      if (!askAdminPassword()) return;
      window.location.reload();
    }

    async function secureSvuotaLista() {
      if (!askAdminPassword()) return;
      await svuotaLista();
    }

  // --- ProgressBar
  function ProgressBar({ perc, text }: { perc: number; text: string }) {
    return (
      <div className="fixed top-0 left-0 w-full z-[120] pointer-events-none">
        <div className="w-full flex flex-col items-center">
          <div className="mt-2 mb-1 text-sm font-bold text-cyan-800 animate-pulse bg-white/80 px-2 py-1 rounded-xl shadow">
            {text}
          </div>
          <div className="relative w-[88vw] max-w-[540px] h-3 rounded-xl overflow-hidden bg-cyan-100 shadow">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-cyan-600 transition-all duration-300"
              style={{ width: perc + "%", minWidth: perc > 0 ? "12%" : "0" }}
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

  // --- Apertura modale (inizializza tutto dentro il componente Modale)
  function openModaleArticolo(row: PrelievoRow) {
    setModaleArticolo(row);
  }

  // --- Refresh liste (riuso da onSaved nel modale)
  async function refreshListe() {
    // ricarica sempre TUTTO (coerente con filtro client radice)
    const urlAll = `${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`;
    const [res1, res2] = await Promise.all([fetch(urlAll), fetch(urlAll)]);
    const lista1: PrelievoRow[] = await res1.json();
    const lista2: PrelievoRow[] = await res2.json();
    setPrelievi(lista1);
    setAllPrelieviData(lista2);
  }

  // --- Azioni massive (invariato)
  async function completaFiltrati() {
    const pendingIds = prelieviToShow
      .filter((r) => r.stato === "in verifica")
      .map((r) => r.id);
    if (pendingIds.length === 0) {
      alert("Non ci sono articoli pending da completare in questo filtro.");
      return;
    }
    if (!window.confirm("Vuoi segnare tutti i pending filtrati come MANCA?")) return;

    try {
      setProgressActive(true);
      setProgressPerc(20);
      setProgressText("Completamento prelievi filtrati…");

      const setRes = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingIds, fields: { riscontro: 0 } }),
      });
      if (!setRes.ok) throw new Error("Impossibile aggiornare i prelievi (bulk).");

      setProgressPerc(75);
      setProgressText("Sincronizzo produzione (filtrati)…");

      setProgressPerc(100);
      setProgressText("Completato!");
      setTimeout(() => setProgressActive(false), 600);

      await refreshListe();
      setSelectedIds([]);
      setToast({ msg: "Completati filtrati e pulita produzione!", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Errore durante la pulizia.", type: "error" });
      setProgressActive(false);
    }
  }

  async function completaSelezionati() {
    // filtra SOLO i PENDING (stato === "in verifica")
    const ids = selectedIds.filter(id => {
      const r = prelieviToShow.find(x => x.id === id);
      return r?.stato === "in verifica";
    });
    if (ids.length === 0) {
      alert("Nessun PENDING selezionato.");
      return;
    }
    if (!window.confirm("Vuoi segnare come MANCA i selezionati?")) return;

    try {
      setProgressActive(true);
      setProgressPerc(20);
      setProgressText("Completamento prelievi selezionati…");

      const setRes = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          fields: { riscontro: 0 } // opzionale: aggiungi plus: 0 per non creare DS
          // fields: { riscontro: 0, plus: 0 },
        }),
      });
      if (!setRes.ok) throw new Error("Impossibile aggiornare i prelievi selezionati.");

      setProgressPerc(100);
      setProgressText("Completato!");
      setTimeout(() => setProgressActive(false), 600);

      await refreshListe();
      setSelectedIds([]);
      setToast({ msg: "Completati selezionati!", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Errore durante il completamento.", type: "error" });
      setProgressActive(false);
    }
  }


  async function completaPending() {
    try {
      const urlAll = `${import.meta.env.VITE_API_URL}/api/prelievi?data=${encodeURIComponent(data || "")}`;
      const resPrelievi = await fetch(urlAll);
      const tuttiPrelievi: PrelievoRow[] = await resPrelievi.json();
      const pendingIds = tuttiPrelievi
        .filter((r) => r.stato === "in verifica")
        .map((r) => r.id);

      if (pendingIds.length === 0) {
        alert("Non ci sono articoli pending da completare.");
        return;
      }
      if (!window.confirm("Sei sicuro di voler segnare tutti i pending come MANCA?")) return;

      setProgressActive(true);
      setProgressPerc(25);
      setProgressText("Completo tutti i pending…");

      const setRes = await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingIds, fields: { riscontro: 0 } }),
      });
      if (!setRes.ok) throw new Error("Impossibile aggiornare i prelievi (bulk).");

      setProgressPerc(85);
      setProgressText("Sincronizzo produzione (globale)…");

      setProgressPerc(100);
      setProgressText("Completato!");
      setTimeout(() => setProgressActive(false), 700);

      await refreshListe();
      setSelectedIds([]);
      setToast({ msg: "Completato tutto e pulita produzione!", type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Errore durante la pulizia.", type: "error" });
      setProgressActive(false);
    }
  }

  async function svuotaLista() {
    if (!window.confirm("Sei sicuro di voler svuotare tutta la lista prelievi? Operazione IRREVERSIBILE!")) return;
    await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/svuota`, { method: "DELETE" });
    setPrelievi([]);
    setAllPrelieviData([]);
    setToast({ msg: "Lista prelievi svuotata!", type: "success" });
  }

  // SCHERMATA import data (se lista vuota)
  if (!importLoading && prelievi.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <div className="max-w-md w-full bg-white rounded-xl p-8 shadow text-center flex flex-col items-center gap-6">
          <div className="text-2xl font-bold mb-4 text-blue-800">Importa prelievi</div>
          <div className="mb-2">Seleziona la data da importare:</div>
          <select
            className="select select-bordered w-full"
            onChange={async (e) => {
              const selected = e.target.value;
              if (!selected) return;
              setImportLoading(true);
              setImportData(selected);
              setProgressActive(true);
              setProgressPerc(15);
              setProgressText("Importazione prelievi in corso...");
              await fetch(`${import.meta.env.VITE_API_URL}/api/prelievi/importa`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: selected }),
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
            {dateDisponibili.map((date) => (
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
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 justify-between w-full pt-2">
    {/* Title + date */}
    <div className="flex items-center gap-3 min-w-0">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 text-xl">📦</span>
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-base text-blue-900 truncate">Prelievo</span>
        <span className="text-xs text-neutral-500 truncate">
          Data: {data || importData || "-"}
        </span>
      </div>
    </div>

    {/* Toolbar */}
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-auto">
      {/* Completa tutto */}
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500 text-white font-semibold shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
        onClick={completaPending}
        title="Imposta tutti i 'in verifica' del giorno come MANCA"
        aria-label="Completa tutto"
      >
        ✓ Completa TUTTO
      </button>

      {/* Completa filtrati */}
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 text-white font-semibold shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
        onClick={completaFiltrati}
        title="Completa solo gli articoli nel filtro corrente"
        aria-label="Completa filtrati"
      >
        ⛃ Completa filtrati
      </button>

      {/* Completa selezionati (con count) */}
      <button
        type="button"
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl font-semibold shadow-sm focus:outline-none focus:ring-2 ${
          selectedIds.length > 0
            ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-300"
            : "bg-gray-200 text-gray-400 cursor-not-allowed focus:ring-transparent"
        }`}
        onClick={completaSelezionati}
        title={selectedIds.length > 0 ? "Completa solo i selezionati" : "Seleziona almeno una riga"}
        aria-label="Completa selezionati"
        disabled={selectedIds.length === 0}
      >
        ✓ Completa selezionati
        <span className={`ml-1 inline-flex items-center justify-center rounded-full px-2 text-xs ${
          selectedIds.length > 0 ? "bg-white/20" : "bg-gray-300"
        }`}>
          {selectedIds.length}
        </span>
      </button>

      {/* Importa nuova data (Refresh) */}
      <button
        type="button"
        onClick={secureReload}   // <-- protetto da password
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-300 text-cyan-800 bg-white hover:bg-cyan-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
        title="Importa una nuova data (ricarica)"
        aria-label="Importa nuova data"
      >
        ↻ Importa nuova data
      </button>
      {/* Svuota lista (destructive) */}
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-red-300 text-red-700 hover:bg-red-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-200"
        onClick={secureSvuotaLista}   // <-- protetto da password
        title="Svuota lista prelievi"
        aria-label="Svuota lista prelievi"
      >
        🗑️ Svuota lista
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
            className={`w-[220px] flex justify-between items-center px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition focus:outline-none ${
              radiciOpen ? "border-cyan-500 ring-2 ring-cyan-100" : "border-gray-300"
            }`}
            onClick={() => setRadiciOpen(!radiciOpen)}
          >
            {radice ? radice : "Totali"}
            <span className="ml-2">{radiciOpen ? "▲" : "▼"}</span>
          </button>
          {radiciOpen && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto animate-fade-in min-w-[220px]">
              <div
                className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${radice === "" ? "bg-cyan-100 text-cyan-900" : "text-cyan-700"}`}
                onClick={() => { setRadice(""); setRadiciOpen(false); }}
              >
                Totali
              </div>
              {allRadici.map((r) => (
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
        {/* Ricerca */}
        <div className="flex-1 min-w-[180px]">
          <SearchInput
            value={search}
            onChange={(q) => {
              setSearch(q);
              // se hai già una lista "prelievi" in stato, filtra qui:
              // setPrelieviVisibili(filterLocal(q, prelievi));
            }}
            onCommit={() => { /* opzionale in client-only */ }}
            debounce={150}
            idleCommitMs={600}
          />
        </div>
      </div>

      {/* Tabella */}
      <div className="rounded-2xl shadow border bg-white/80 px-0 py-2 mb-8 overflow-x-auto">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[820px] text-[15px] sm:text-[17px]">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="px-2 py-2 text-center w-[44px]">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === prelieviToShow.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(prelieviToShow.map((r) => r.id));
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
                <th className="px-2 py-2 text-center">Pren.</th>
                <th className="px-2 py-2 text-left">EAN</th>
                <th className="sticky right-0 z-10 bg-white/95 border-l-2 border-base-200 shadow-lg px-2 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {prelieviToShow.map((r) => {
                const processed = r.riscontro !== null && r.stato !== "in verifica";
                return (
                  <tr key={r.id} className={`${processed ? "bg-cyan-50" : ""} border-b border-gray-200 last:border-b-0`}>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds((sel) => [...sel, r.id]);
                          else setSelectedIds((sel) => sel.filter((id) => id !== r.id));
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
                          }`}
                        style={{ minWidth: 80, letterSpacing: 1.1 }}
                      >
                        {(r.stato === "in verifica" ? "pending" : r.stato).toUpperCase()}
                      </div>
                    </td>
                    <td className="font-mono px-2 py-2">{r.sku}</td>
                    <td className="text-center font-semibold px-2 py-2">{r.qty}</td>
                    <td className="text-center px-2 py-2">{r.riscontro ?? ""}</td>
                    <td className="text-center px-2 py-2">{r.plus ?? ""}</td>
                    <td className="text-center px-2 py-2">
                      {typeof r.magazzino_usato === "number" && r.magazzino_usato > 0 && (
                        <span className="inline-flex items-center justify-center text-xs font-bold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-300">
                          {r.magazzino_usato}
                        </span>
                      )}
                    </td>
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
                  <td colSpan={9} className="text-center text-gray-400 py-6 text-lg">
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
              onClick={() => setItemsToShow((n) => n + 20)}
            >
              Mostra altri
            </button>
          </div>
        )}
      </div>

      {/* Modale estratto */}
      <PrelievoModal
        open={!!modaleArticolo}
        row={modaleArticolo}
        onClose={() => setModaleArticolo(null)}
        onSaved={async () => {
          await refreshListe();
          setToast({ msg: "Prelievo aggiornato!", type: "success" });
        }}
      />

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
