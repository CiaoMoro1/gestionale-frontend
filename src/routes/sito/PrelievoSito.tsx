// src/routes/sito/PrelievoSito.tsx

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import { supabase } from "../../lib/supabase";
import PrelievoModalSito, {
  type SitoPrelievoRow,
} from "../sito/PrelievoModalSito";
import SearchInput from "@/features/produzione/components/FiltersBar/SearchInput";
import type { Ordine } from "../../types/ordini";

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
  return queryWords.every((qw) =>
    targetWords.some(
      (tw) => tw === qw || tw.startsWith(qw)
    )
  );
}

// --- Helpers sorting/filtri "MZ-" + grouping radici ---
function stripMZ(sku: string): string {
  return (sku || "").replace(/^MZ-?/i, "");
}
function sortKeySku(sku: string): string {
  return stripMZ(sku).toUpperCase();
}

function lastSkuSegmentRaw(skuNoMZ: string): string {
  const parts = skuNoMZ
    .trim()
    .split(/[-_\s/.]+/g)
    .filter(Boolean);
  const last =
    parts.length > 0 ? parts[parts.length - 1] : "";
  return (last || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

// Mappa di collasso radici (stessa logica vendor)
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
  TENDA: "CSA",
  CFD: "CFDM",
  TPCDN: "TPCD",
};
function collapseRadice(radice: string | undefined | null): string {
  const r = (radice || "").toUpperCase().trim();
  return RADICE_COLLAPSE[r] ?? r;
}
function radiceFromSku(sku: string): string {
  const base = stripMZ(sku).toUpperCase();
  const first = base.split("-")[0] || "";
  return first.trim();
}
function radiceFromRow(r: SitoPrelievoRow): string {
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
      ${
        type === "success"
          ? "bg-green-100 border-green-300 text-green-800"
          : "bg-red-100 border-red-300 text-red-700"
      }
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
   Pagina Prelievo Sito
=========================== */
export default function PrelievoSito() {
  const API = import.meta.env.VITE_API_URL as string;

  const [prelievi, setPrelievi] = useState<SitoPrelievoRow[]>([]);
  const [allPrelieviData, setAllPrelieviData] = useState<SitoPrelievoRow[]>([]);
  const [modaleArticolo, setModaleArticolo] =
    useState<SitoPrelievoRow | null>(null);

  const [orders, setOrders] = useState<Ordine[]>([]);

  const [search, setSearch] = useState("");
  const [radice, setRadice] = useState<string>("");
  const [radiciOpen, setRadiciOpen] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const [progressActive, setProgressActive] = useState(false);
  const [progressPerc, setProgressPerc] = useState(0);
  const [progressText, setProgressText] = useState<string>("");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const radiciBoxRef = useRef<HTMLDivElement | null>(null);

  // Paginazione (solo su Totali, no filtro/search)
  const PAGE_SIZE = 10;
  const [itemsToShow, setItemsToShow] = useState<number>(PAGE_SIZE);

  // Chiudi dropdown radici cliccando fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        radiciBoxRef.current &&
        !radiciBoxRef.current.contains(e.target as Node)
      ) {
        setRadiciOpen(false);
      }
    }
    if (radiciOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [radiciOpen]);

  // Carica TUTTI i prelievi SITO + ordini in prelievo
  useEffect(() => {
    (async () => {
      // 1) prelievi Sito (SKU aggregati)
      try {
        const res = await fetch(`${API}/api/prelievi-sito`);
        if (!res.ok) {
          setPrelievi([]);
          setAllPrelieviData([]);
        } else {
          const lista = (await res.json()) as SitoPrelievoRow[];

          const filtered = lista.filter(
            (r) =>
              r.sku.toUpperCase().trim() !==
              "COMMISSIONE PAGAMENTO ALLA CONSEGNA"
          );

          setPrelievi(filtered);
          setAllPrelieviData(filtered);
          setItemsToShow(PAGE_SIZE);
        }

      } catch {
        setPrelievi([]);
        setAllPrelieviData([]);
      }

      // 2) ordini in prelievo (Supabase)
      try {
        const { data: ordersData, error } = await supabase
          .from("orders")
          .select("*")
          .eq("stato_ordine", "prelievo")
          .neq("fulfillment_status", "annullato")
          .order("created_at", { ascending: false });

        if (error || !ordersData) {
          setOrders([]);
        } else {
          setOrders(ordersData as Ordine[]);
        }
      } catch {
        setOrders([]);
      }
    })();
  }, [API]);

  // Reset selezione quando cambi filtro o search
  useEffect(() => {
    setSelectedIds([]);
  }, [radice, search]);

  // Radici disponibili (collassate e ordinate)
  const allRadici =
    Array.from(
      new Set(allPrelieviData.map(radiceFromRow).filter(Boolean))
    ).sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );

  // --- Filtro ricerca (supporta suffisso ';' come Vendor)
  function normalizeTight(s: string) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]/g, "");
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

  // 1) Filtro radice
  const prelieviAfterRadice = radice
    ? prelievi.filter((r) => radiceFromRow(r) === radice)
    : prelievi;

  // 2) Filtro search (ignora MZ-)
  const prelieviAfterSearch =
    search.length > 0
      ? prelieviAfterRadice.filter((r) => {
          const skuNoMZ = stripMZ(r.sku);

          const baseOk =
            normalTokens.length === 0
              ? true
              : matchAllWords(
                  `${skuNoMZ} ${r.ean || ""}`,
                  normalTokens
                );

          const lastSegTight = lastSkuSegmentRaw(skuNoMZ);
          const suffixOk =
            suffixTokens.length === 0
              ? true
              : suffixTokens.some(
                  (suf) => lastSegTight === suf
                );

          const allowFallback = suffixTokens.length === 0;
          const skuTight = normalizeTight(skuNoMZ);
          const eanTight = normalizeTight(r.ean || "");
          const searchTight = normalizeTight(
            search.replace(/;+/g, "")
          );

          const fallbackOk = allowFallback
            ? searchTight
              ? skuTight.includes(searchTight) ||
                eanTight.includes(searchTight)
              : true
            : false;

          return (baseOk && suffixOk) || fallbackOk;
        })
      : prelieviAfterRadice;

  // 3) Ordinamento A→Z ignorando MZ-
  let prelieviToShow = [...prelieviAfterSearch].sort((a, b) =>
    sortKeySku(a.sku).localeCompare(
      sortKeySku(b.sku),
      "it",
      { sensitivity: "base" }
    )
  );

  // 4) Paginazione (solo Totali, no search)
  const isTotali = !radice;
  const canPaginate =
    isTotali &&
    !search &&
    prelieviToShow.length > itemsToShow;
  if (isTotali && !search) {
    prelieviToShow = prelieviToShow.slice(0, itemsToShow);
  }

  // --- Admin guard (come Vendor) ---
  const ADMIN_PWD = "petti";

  function askAdminPassword(): boolean {
    const pwd = window.prompt(
      "Inserisci password amministratore:"
    );
    if (pwd === null) return false;
    const ok = pwd === ADMIN_PWD;
    if (!ok)
      setToast({
        msg: "Password errata.",
        type: "error",
      });
    return ok;
  }

  async function secureReload() {
    if (!askAdminPassword()) return;
    window.location.reload();
  }

  async function secureSvuotaLista() {
    if (!askAdminPassword()) return;
    await svuotaLista();
  }

  async function setRiscontroRapido(row: SitoPrelievoRow, nuovoRiscontro: number) {
    // 1) salviamo lo stato precedente per eventuale rollback
    setPrelievi((prev) =>
      prev.map((r) => {
        if (r.id !== row.id) return r;

        const qty = r.qty;
        let nuovoStato: SitoPrelievoRow["stato"];

        if (nuovoRiscontro <= 0) {
          nuovoStato = "manca";
        } else if (nuovoRiscontro >= qty) {
          nuovoStato = "completo";
        } else {
          nuovoStato = "parziale";
        }

        return {
          ...r,
          riscontro: nuovoRiscontro,
          stato: nuovoStato,
        };
      })
    );

    // aggiorniamo anche la copia completa usata per i filtri
    setAllPrelieviData((prev) =>
      prev.map((r) => {
        if (r.id !== row.id) return r;

        const qty = r.qty;
        let nuovoStato: SitoPrelievoRow["stato"];

        if (nuovoRiscontro <= 0) {
          nuovoStato = "manca";
        } else if (nuovoRiscontro >= qty) {
          nuovoStato = "completo";
        } else {
          nuovoStato = "parziale";
        }

        return {
          ...r,
          riscontro: nuovoRiscontro,
          stato: nuovoStato,
        };
      })
    );

    // 2) chiamata al backend (senza refreshListe, così non perdi la posizione)
    try {
      const res = await fetch(`${API}/api/prelievi-sito/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riscontro: nuovoRiscontro }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || "Errore aggiornamento riscontro");
      }

      // opzionale: se vuoi, qui potresti fare un refresh leggero di UNA sola riga se il backend calcola altro,
      // ma io eviterei per non toccare lo scroll.
    } catch (err) {
      // se fallisce, mostriamo l’errore e (se vuoi) potremmo ricaricare, ma io ora mi limito al toast
      setToast({
        msg: err instanceof Error ? err.message : "Errore aggiornamento riscontro",
        type: "error",
      });
      // volendo qui potremmo fare un refreshListe() per riallineare, ma ti riporterebbe in cima:
      // io lo lascerei così per ora.
    }
  }


  // --- ProgressBar (copiata vendor) ---
  function ProgressBar({
    perc,
    text,
  }: {
    perc: number;
    text: string;
  }) {
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
                minWidth: perc > 0 ? "12%" : "0",
              }}
            />
            <div
              className="absolute top-0 left-0 h-full w-full animate-bar-stripes"
              style={{
                background:
                  "repeating-linear-gradient(90deg,#d5f3fc 0 10px,transparent 10px 20px)",
              }}
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

  // --- Apertura modale ---
  function openModaleArticolo(row: SitoPrelievoRow) {
    setModaleArticolo(row);
  }

  // --- Refresh liste dopo salvataggio modale / processa ---
  async function refreshListe() {
    // ricarica prelievi sito
    const urlAll = `${API}/api/prelievi-sito`;
    const res1 = await fetch(urlAll);
    const lista1 = (await res1.json()) as SitoPrelievoRow[];

    const filtered = lista1.filter(
      (r) =>
        r.sku.toUpperCase().trim() !==
        "COMMISSIONE PAGAMENTO ALLA CONSEGNA"
    );

    setPrelievi(filtered);
    setAllPrelieviData(filtered);
    setItemsToShow(PAGE_SIZE);

    // ricarica ordini in prelievo
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .eq("stato_ordine", "prelievo")
      .neq("fulfillment_status", "annullato")
      .order("created_at", { ascending: false });

    setOrders((ordersData as Ordine[]) || []);
    setItemsToShow(PAGE_SIZE);
  }

  // --- Azioni massive ---

  // Completa TUTTO: marca tutti i "in verifica" come MANCA (riscontro = 0)
  async function completaPending() {
    try {
      const urlAll = `${API}/api/prelievi-sito`;
      const resPrelievi = await fetch(urlAll);
      const tuttiPrelievi =
        (await resPrelievi.json()) as SitoPrelievoRow[];
      const pendingIds = tuttiPrelievi
        .filter((r) => r.stato === "in verifica")
        .map((r) => r.id);

      if (pendingIds.length === 0) {
        window.alert(
          "Non ci sono articoli pending da completare."
        );
        return;
      }
      if (
        !window.confirm(
          "Sei sicuro di voler segnare tutti i pending come MANCA?"
        )
      )
        return;

      setProgressActive(true);
      setProgressPerc(25);
      setProgressText("Completo tutti i pending…");

      const setRes = await fetch(
        `${API}/api/prelievi-sito/bulk`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: pendingIds,
            fields: { riscontro: 0 },
          }),
        }
      );
      if (!setRes.ok)
        throw new Error(
          "Impossibile aggiornare i prelievi (bulk)."
        );

      setProgressPerc(100);
      setProgressText("Completato!");
      setTimeout(() => setProgressActive(false), 700);

      await refreshListe();
      setSelectedIds([]);
      setToast({
        msg: "Tutti i pending segnati come MANCA.",
        type: "success",
      });
    } catch (err) {
      setToast({
        msg:
          err instanceof Error
            ? err.message
            : "Errore durante la pulizia.",
        type: "error",
      });
      setProgressActive(false);
    }
  }

  // Processa Ordini: applica riscontri agli ordini, aggiorna stage, genera produzione
  async function processaOrdini() {
    if (
      !window.confirm(
        "Vuoi processare gli ordini in prelievo in base ai riscontri?"
      )
    )
      return;

    try {
      setProgressActive(true);
      setProgressPerc(20);
      setProgressText("Analizzo riscontri e ordini...");

      const res = await fetch(
        `${API}/api/prelievi-sito/processa`,
        { method: "POST" }
      );

      if (!res.ok) {
        const errJson = await res
          .json()
          .catch(() => ({ error: "Errore sconosciuto" }));
        throw new Error(
          errJson?.error ||
            "Errore nel processamento ordini."
        );
      }

      setProgressPerc(90);
      setProgressText("Aggiorno schermo...");

      await refreshListe();

      setProgressPerc(100);
      setProgressText("Completato!");
      setTimeout(() => setProgressActive(false), 600);

      setToast({
        msg: "Ordini processati correttamente.",
        type: "success",
      });
    } catch (err) {
      setToast({
        msg:
          err instanceof Error
            ? err.message
            : "Errore durante il processamento ordini.",
        type: "error",
      });
      setProgressActive(false);
    }
  }

  async function svuotaLista() {
    if (
      !window.confirm(
        "Sei sicuro di voler svuotare tutta la lista prelievi? Operazione IRREVERSIBILE!"
      )
    )
      return;
    await fetch(`${API}/api/prelievi-sito/svuota`, {
      method: "DELETE",
    });
    setPrelievi([]);
    setAllPrelieviData([]);
    setOrders([]);
    setToast({
      msg: "Lista prelievi svuotata!",
      type: "success",
    });
  }

  // Empty state
  if (prelievi.length === 0 && orders.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        {toast && (
          <Toast
            message={toast.msg}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        <div className="max-w-md w-full bg-white rounded-xl p-8 shadow text-center flex flex-col items-center gap-4">
          <div className="text-2xl font-bold mb-2 text-blue-800">
            Nessun articolo in prelievo
          </div>
          <div className="text-sm text-gray-500">
            Seleziona ordini dalla pagina Ordini Sito e
            spostali in prelievo.
          </div>
        </div>
      </div>
    );
  }

  // ---- SCHERMATA PRELIEVI SITO ----
  return (
    <div className="w-full max-w-[1100px] mx-auto px-1 pb-10 font-sans">
      {progressActive && (
        <ProgressBar
          perc={progressPerc}
          text={progressText}
        />
      )}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 justify-between w-full pt-2">
        {/* Title */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 text-xl">
            📦
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-base text-blue-900 truncate">
              Prelievo Sito
            </span>
            <span className="text-xs text-neutral-500 truncate">
              Articoli attualmente in prelievo
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-auto">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500 text-white font-semibold shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
            onClick={completaPending}
            aria-label="Completa tutto (pending → manca)"
          >
            ✓ Completa TUTTO
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-700 text-white font-semibold shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            onClick={processaOrdini}
            aria-label="Processa ordini"
          >
            ⚙️ Processa ordini
          </button>

          <button
            type="button"
            onClick={secureReload}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-300 text-cyan-800 bg-white hover:bg-cyan-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
            aria-label="Ricarica"
          >
            ↻ Ricarica
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-red-300 text-red-700 hover:bg-red-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            onClick={secureSvuotaLista}
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
          <label className="block text-xs font-semibold mb-1">
            Radice prodotto
          </label>
          <button
            type="button"
            className={`w-[220px] flex justify-between items-center px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition focus:outline-none ${
              radiciOpen
                ? "border-cyan-500 ring-2 ring-cyan-100"
                : "border-gray-300"
            }`}
            onClick={() => setRadiciOpen(!radiciOpen)}
          >
            {radice ? radice : "Totali"}
            <span className="ml-2">
              {radiciOpen ? "▲" : "▼"}
            </span>
          </button>
          {radiciOpen && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto animate-fade-in min-w-[220px]">
              <div
                className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${
                  radice === ""
                    ? "bg-cyan-100 text-cyan-900"
                    : "text-cyan-700"
                }`}
                onClick={() => {
                  setRadice("");
                  setRadiciOpen(false);
                }}
              >
                Totali
              </div>
              {allRadici.map((r) => (
                <div
                  key={r}
                  className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${
                    radice === r
                      ? "bg-cyan-200 text-cyan-900"
                      : "text-cyan-700"
                  }`}
                  onClick={() => {
                    setRadice(r);
                    setRadiciOpen(false);
                  }}
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
          <SearchInput
            value={search}
            onChange={(q: string) => {
              setSearch(q);
            }}
            onCommit={() => {
              // opzionale
            }}
            debounce={150}
            idleCommitMs={600}
          />
        </div>
      </div>

      {/* Tabella prelievi SITO (righe SKU aggregate) */}
      <div className="rounded-2xl shadow border bg-white/80 px-0 py-2 mb-8 overflow-x-auto">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[820px] text-[15px] sm:text-[17px]">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="px-2 py-2 text-center w-[44px]">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length > 0 &&
                      selectedIds.length ===
                        prelieviToShow.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(
                          prelieviToShow.map((r) => r.id)
                        );
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
                <th
                  className="px-2 py-2 text-left"
                  style={{ minWidth: 80 }}
                >
                  Stato
                </th>
                <th className="px-2 py-2 text-left">
                  SKU
                </th>
                <th className="px-2 py-2 text-center">
                  Totale richiesto
                </th>
                <th className="px-2 py-2 text-center">
                  Riscontro
                </th>
                <th className="px-2 py-2 text-center">
                  Plus
                </th>
                <th className="px-2 py-2 text-center">
                  Pren.
                </th>
                <th className="px-2 py-2 text-left">
                  EAN
                </th>
                <th className="sticky right-0 z-10 bg-white/95 border-l-2 border-base-200 shadow-lg px-2 py-2">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {prelieviToShow.map((r) => {
                const processed =
                  r.riscontro !== null &&
                  r.stato !== "in verifica";
                const magUsato = r.magazzino_usato ?? 0;

                return (
                  <tr
                    key={r.id}
                    className={`${
                      processed ? "bg-cyan-50" : ""
                    } border-b border-gray-200 last:border-b-0`}
                  >
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(
                          r.id
                        )}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedIds((sel) => [
                              ...sel,
                              r.id,
                            ]);
                          else
                            setSelectedIds((sel) =>
                              sel.filter(
                                (id) => id !== r.id
                              )
                            );
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
                        style={{
                          minWidth: 80,
                          letterSpacing: 1.1,
                        }}
                      >
                        {(
                          r.stato === "in verifica"
                            ? "pending"
                            : r.stato
                        ).toUpperCase()}
                      </div>
                    </td>
                    <td className="font-mono px-2 py-2">
                      {r.sku}
                    </td>
                    <td className="text-center font-semibold px-2 py-2">
                      {r.qty}
                    </td>
                    <td className="text-center px-2 py-2">
                      {/* Valore numerico attuale */}
                      <div className="font-mono text-sm mb-1">
                        {r.riscontro ?? "—"}
                      </div>

                      {/* Toggle rapido Manca (0) / Completo (max qty) */}
                      <div className="inline-flex items-center gap-1">
                        {/* Manca = 0 */}
                        <button
                          type="button"
                          className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${
                            (r.riscontro ?? 0) === 0
                              ? "bg-red-600 text-white border-red-700"
                              : "bg-white text-red-600 border-red-400 hover:bg-red-50"
                          }`}
                          onClick={() => void setRiscontroRapido(r, 0)}
                        >
                          0
                        </button>

                        {/* Completo = qty */}
                        <button
                          type="button"
                          className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${
                            r.riscontro !== null &&
                            r.riscontro >= r.qty &&
                            r.qty > 0
                              ? "bg-green-600 text-white border-green-700"
                              : "bg-white text-green-600 border-green-400 hover:bg-green-50"
                          }`}
                          onClick={() => void setRiscontroRapido(r, r.qty)}
                        >
                          {r.qty}
                        </button>
                      </div>
                    </td>

                    <td className="text-center px-2 py-2">
                      {r.plus ?? ""}
                    </td>
                    <td className="text-center px-2 py-2">
                      {magUsato > 0 ? (
                        <span className="inline-flex items-center justify-center text-xs font-bold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-300">
                          {magUsato}
                        </span>
                      ) : null}
                    </td>
                    <td className="font-mono px-2 py-2">
                      {r.ean}
                    </td>
                    <td className="sticky right-0 z-10 bg-white/95 border-l-2 border-base-200 shadow-lg text-center min-w-[54px] px-2 py-2">
                      <button
                        className="rounded-full p-2 shadow bg-blue-500 text-white hover:bg-blue-700"
                        onClick={() =>
                          openModaleArticolo(r)
                        }
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
                  <td
                    colSpan={9}
                    className="text-center text-gray-400 py-6 text-lg"
                  >
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
              onClick={() =>
                setItemsToShow((n) => n + 20)
              }
            >
              Mostra altri
            </button>
          </div>
        )}
      </div>

      {/* Tabella ORDINI in prelievo SITO */}
      <div className="overflow-x-auto bg-white shadow border rounded-xl mt-6">
        <table className="min-w-[700px] w-full text-sm">
          <thead className="bg-black/90 text-white">
            <tr>
              <th className="p-3 text-left">Ordine</th>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-right">Totale</th>
              <th className="p-3 text-center">Pagamento</th>
              <th className="p-3 text-center">Data</th>
              <th className="p-3 text-center">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b last:border-0"
              >
                <td className="p-3 font-semibold">
                  {order.number}
                </td>
                <td className="p-3">
                  {order.customer_name}
                </td>
                <td className="p-3 text-right">
                  € {order.total?.toFixed(2)}
                </td>
                <td className="p-3 text-center">
                  {order.payment_status}
                </td>
                <td className="p-3 text-center">
                  {new Date(
                    order.created_at
                  ).toLocaleDateString("it-IT")}
                </td>
                <td className="p-3 text-center">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-red-600 text-white text-xs hover:bg-red-700 shadow"
                    onClick={async () => {
                      // 1) rimetti l'ordine a NUOVO
                      await supabase
                        .from("orders")
                        .update({
                          stato_ordine: "nuovo",
                          stage: null,   // <-- importante: stage NULL come da Supabase UI
                        })
                        .eq("id", order.id);

                      // 2) ricarica prelievi + ordini
                      await refreshListe();
                    }}
                  >
                    Rimuovi da prelievo
                  </button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-gray-400 py-4"
                >
                  Nessun ordine in prelievo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modale SITO */}
      <PrelievoModalSito
        open={!!modaleArticolo}
        row={modaleArticolo}
        onClose={() => setModaleArticolo(null)}
        onSaved={async () => {
          await refreshListe();
          setToast({
            msg: "Prelievo aggiornato!",
            type: "success",
          });
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
