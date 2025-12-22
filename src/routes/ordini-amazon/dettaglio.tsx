import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Package, CheckCircle, ChevronRight, CircleChevronLeft, Plus, Minus, Search } from "lucide-react";
import GeneraEtichetteModal from "../../components/GeneraEtichetteModal";
import BarcodeScannerModal from "../../components/BarcodeScannerModal";
import SlideToConfirm from "../../components/SlideToConfirm";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


type SaveWipPayload = {
  parziali: RigaParziale[];
  confermaCollo: Record<number, boolean>;
  merge?: boolean;
  numero_parziale?: number;
  client_last_modified_at?: string;
};


type Articolo = {
  model_number: string;        // SKU
  vendor_product_id: string;   // EAN
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

type RigaInput = { id: string; quantita: number | ""; collo: number; fromWip?: boolean };


type ColloRiepilogo = {
  collo: number;
  righe: { model_number: string; quantita: number }[];
  confermato: boolean;
};

type WipResponse =
  | RigaParziale[]
  | {
      parziali?: RigaParziale[];
      confermaCollo?: Record<number, boolean>;
    };

type LocationState = {
  barcode?: string;
  from?: "nuovi" | "parziali";
  fromDraft?: boolean;
  autoOpen?: { po_number: string; model_number: string } | undefined;
};

const PAGE_LIMIT = 200;
const PAGE_SIZE = 10; // visualizza 10 alla volta

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// fetch paginato + opzionale chiave
async function fetchAllBatched<T>(urlBase: string, key: string | null = null): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const limit = PAGE_LIMIT;
  // loop batching

  while (true) {
    const url = urlBase.includes("?")
      ? `${urlBase}&offset=${offset}&limit=${limit}`
      : `${urlBase}?offset=${offset}&limit=${limit}`;
    const res = await fetch(url);
    const json = await res.json();
    let lista: T[] = [];
    if (Array.isArray(json)) lista = json as T[];
    else if (key && Array.isArray(json[key])) lista = json[key] as T[];
    else if (json && key && json[key]) lista = json[key] as T[];
    all.push(...lista);
    if (lista.length < limit) break;
    offset += limit;
    await sleep(150);
  }
  return all;
}

// Per typed access a lastAutoTable
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

// ---- ricerca utils
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

export default function DettaglioDestinazione() {
  const { center, data } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;
  const barcode = state.barcode;
  const from = state.from === "nuovi" ? "nuovi" : "parziali";
  const fromDraft = state.fromDraft;

  // Stati principali
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [parziali, setParziali] = useState<RigaParziale[]>([]);
  const [parzialiStorici, setParzialiStorici] = useState<RigaParziale[]>([]);
  const [confermaCollo, setConfermaCollo] = useState<Record<number, boolean>>({});
  const [modaleArticolo, setModaleArticolo] = useState<Articolo | null>(null);
  const [inputs, setInputs] = useState<RigaInput[]>([{ id: crypto.randomUUID(), quantita: "", collo: 1 }]);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [showEtichette, setShowEtichette] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "reset" | "parziale" | "chiudi">(null);
  const [isBusy, setIsBusy] = useState(false);

  // Cavallotto (nuovo)
  const [cavallottoModal, setCavallottoModal] = useState<string | null>(null);
  const [cavallottoLoading, setCavallottoLoading] = useState(false);

  // Modale per singolo collo
  const [modaleCollo, setModaleCollo] = useState<number | null>(null);
  const [righeCollo, setRigheCollo] = useState<RigaParziale[]>([]);
  const [eanCollo, setEanCollo] = useState("");
  const [colloError, setColloError] = useState<string | null>(null);
  const eanColloInputRef = useRef<HTMLInputElement | null>(null);
  const [eanKeyboardEnabled, setEanKeyboardEnabled] = useState(false);  // 👈 NEW

  const errorAudioRef = useRef<HTMLAudioElement | null>(null);

  const [alertModal, setAlertModal] = useState<string | null>(null); // 👈 NEW
  const [confirmDeleteCollo, setConfirmDeleteCollo] = useState(false);

  // Ricerca
  const [skuSearch, setSkuSearch] = useState("");
  const [skuSearchError, setSkuSearchError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [reservedNewByRow, setReservedNewByRow] = useState<Record<string, number>>({});

  const [alertMessage, setAlertMessage] = useState<string | null>(null);


  const [itemsToShow, setItemsToShow] = useState(PAGE_SIZE);

    // Filtro ricerca globale
    const queryWords = normalizza(skuSearch).split(" ").filter(Boolean);

const colliInfo = useMemo(() => {
  // 1) Fonte autorevole: colli esistenti dal WIP (server)
  const exist = new Set<number>();
  for (const p of parziali) {
    const c = Number(p.collo) || 0;
    if (c > 0) exist.add(c);
  }

  // 2) Lock: colli confermati
  const confirmed = new Set<number>();
  for (const [k, v] of Object.entries(confermaCollo)) {
    if (v) confirmed.add(Number(k));
  }

  // 3) Primo mancante rispetto al WIP
  const firstMissingFrom = (s: Set<number>) => {
    let i = 1;
    while (s.has(i)) i++;
    return i;
  };
  const minMissingWip = firstMissingFrom(exist);

// 4) Prenotazioni locali: NUOVI numeri già “presi” da una riga
const reservedSet = new Set<number>(Object.values(reservedNewByRow || {}));

// 5) Next dinamico: salta solo i PRENOTATI
let nextDynamic = minMissingWip;
while (reservedSet.has(nextDynamic)) {
  nextDynamic += 1;
}

  const last = exist.size ? Math.max(...exist) : 0;
  const maxContinuousWip = (() => {
    let i = 1;
    while (exist.has(i)) i++;
    return i - 1; // es: exist={1,2,4} -> maxContinuousWip=2
  })();

  return {
    exist,            // colli già “reali” (WIP)
    confirmed,        // colli bloccati
    last,             // solo per UI
    minMissingWip,    // primo mancante nel WIP
    nextDynamic,      // prossimo collo NUOVO consentito (WIP + inputs correnti, senza buchi)
    maxContinuousWip, // ⬅️ fino a dove la sequenza è continua
  };
}, [parziali, confermaCollo, reservedNewByRow]);


const lastCollo = colliInfo.last;
const nextCollo = colliInfo.nextDynamic; // <-- usa questo ovunque
const [colloErrorIdx, setColloErrorIdx] = useState<number | null>(null);

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
    const articoliBatch = await fetchAllBatched<Articolo>(
      `${import.meta.env.VITE_API_URL}/api/amazon/vendor/orders/dettaglio-destinazione?center=${center}&data=${data}`,
      "articoli"
    );
    articoliBatch.sort((a, b) => a.model_number.localeCompare(b.model_number));
    setArticoli(articoliBatch);

    // Storici
    const storici = await fetchAllBatched<RigaParziale>(
      `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-storici?center=${center}&data=${data}`
    );
    setParzialiStorici(storici);

    // WIP
    const wipResp = await fetch(`${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${center}&data=${data}`);
    const wipJson = (await wipResp.json()) as WipResponse;
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
    const auto = state.autoOpen;
    if (auto && articoli.length > 0) {
      const found = articoli.find(
        a => a.po_number === auto.po_number && a.model_number === auto.model_number
      );
      if (found) {
        setModaleArticolo(found);
        // Pulisci solo autoOpen
        navigate(".", { replace: true, state: { ...state, autoOpen: undefined } });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, articoli]);

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
        collo: r.collo,
        fromWip: true,
      })));
      setReservedNewByRow({});
    } else {
      setInputs([{ id: crypto.randomUUID(), quantita: "", collo: 1, fromWip: false }]);
    }
  }, [modaleArticolo, parziali]);



    // autofocus input EAN quando apro il modale del collo
  useEffect(() => {
    // autofocus solo se la tastiera manuale è attiva
    if (modaleCollo !== null && eanKeyboardEnabled && eanColloInputRef.current) {
      eanColloInputRef.current.focus();
    }
  }, [modaleCollo, eanKeyboardEnabled]);



  useEffect(() => {
    const handler = () => {
      const audio = errorAudioRef.current;
      if (!audio) {
        return;
      }
      // tentativo di play+pause legato a un vero evento utente (touch/click)
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {
          // se fallisce, pazienza: sui prossimi tocchi riproveremo
        });

      // registriamo il priming solo una volta
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("click", handler);
    };

    window.addEventListener("touchstart", handler, { passive: true });
    window.addEventListener("click", handler, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("click", handler);
    };
  }, []);



  // Funzioni di utility, input, conferme, etc
  function aggiornaInput(idx: number, campo: "quantita" | "collo", val: string | number) {
    setInputs(prev => {
      // 1) aggiorna la riga target
      const updated = prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              [campo]:
                campo === "quantita"
                  ? (typeof val === "string" ? val.replace(/\D/g, "") : val)
                  : val === "" ? "" : Number(val),
            }
          : r
      );

      // 2) se ho cambiato "collo" e collide con un collo esistente, MERGE quantità e rimuovi duplicato
      if (campo === "collo") {
        const newCollo = Number(val) || 0;
        if (newCollo > 0) {
          // cerca un'altra riga con stesso collo
          const otherIdx = updated.findIndex((r, i) => i !== idx && Number(r.collo) === newCollo);
          if (otherIdx !== -1) {
            const qIdx = Number(updated[idx].quantita) || 0;
            const qOther = Number(updated[otherIdx].quantita) || 0;
            // somma quantità sulla riga "other" e rimuovi quella corrente
            const merged = updated.map((r, i) =>
              i === otherIdx ? { ...r, quantita: qIdx + qOther } : r
            ).filter((_, i) => i !== idx);
            setToast(`Unito sul collo #${newCollo}`);
            setTimeout(() => setToast(null), 1400);
            const removedId = prev[idx].id;
            setReservedNewByRow(prevRes => {
              if (!prevRes[removedId]) return prevRes;
              const rest = { ...prevRes };
              delete rest[removedId];
              return rest;
            });
            return merged;
          }
        }
      }
      return updated;
    });

    if (campo === "quantita" && Number(val) > getResiduoInput(idx)) {
      setShakeIdx(idx);
      setTimeout(() => setShakeIdx(null), 400);
    }
  }

function aggiungiRiga() {
  const newId = crypto.randomUUID(); // id della nuova riga

  setInputs(prev => {
    if (colliInfo.confirmed.has(nextCollo)) {
      setToast(`Collo #${nextCollo} è confermato: non aggiungibile`);
      setTimeout(() => setToast(null), 1400);
      return prev;
    }
    if (prev.some(r => Number(r.collo) === nextCollo)) {
      setToast(`Collo #${nextCollo} è già in modifica`);
      setTimeout(() => setToast(null), 1400);
      return prev;
    }
    return [...prev, { id: newId, quantita: "", collo: nextCollo, fromWip: false }];
  });

  setReservedNewByRow(prev => ({ ...prev, [newId]: nextCollo })); // prenota
  setToast(`Aggiunto collo #${nextCollo}`);
  setTimeout(() => setToast(null), 1400);
}
function rimuoviRiga(idToRemove: string) {
  setInputs(prev => prev.filter(inp => inp.id !== idToRemove));
  setReservedNewByRow(prev => {
    if (!(idToRemove in prev)) return prev;
    const rest = { ...prev };
    delete rest[idToRemove];
    return rest;
  });
}
  function handleOpenScanner() {
    if (inputRef.current) inputRef.current.blur();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
    setTimeout(() => setBarcodeModalOpen(true), 150);
  }

  function showAlert(msg: string) {
    // chiudi eventuale tastiera (soft keyboard)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setAlertMessage(msg);
  }

function playErrorSound() {
  const audio = errorAudioRef.current;
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // su mobile può fallire se non c'è ancora stato un gesto "di sblocco"
    });
  } catch {
    // non bloccare mai il flusso se l'audio fallisce
  }
}





  async function salvaParzialiLive(
    nextParziali: RigaParziale[],
    nextConfermaCollo: Record<number, boolean>,
    opts?: { silent?: boolean }
  ) {
    if (!center || !data) return;
    const silent = !!opts?.silent;

    if (!silent) setIsBusy(true);
    try {
      const latest = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${encodeURIComponent(
          center
        )}&data=${encodeURIComponent(data)}`
      ).then(r => r.json());

      const serverParziali: RigaParziale[] = Array.isArray(latest)
        ? latest
        : (latest?.parziali ?? []);
      const serverTs: string | undefined = Array.isArray(latest)
        ? undefined
        : latest?.last_modified_at;

      const payload: SaveWipPayload = {
        parziali: nextParziali.length ? nextParziali : serverParziali,
        confermaCollo: nextConfermaCollo,
        merge: true,
      };

      // SOLO se NON è silent mandiamo il timestamp per il locking ottimistico
      if (!silent && serverTs) {
        payload.client_last_modified_at = serverTs;
      }


      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${encodeURIComponent(
          center
        )}&data=${encodeURIComponent(data)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (res.status === 409) {
        if (!silent) {
          setToast("Aggiornato altrove, ricarico…");
          setTimeout(() => setToast(null), 3000);
        }
        await reloadAll();
        return;
      }
      if (!res.ok) {
        if (!silent) {
          setToast("Errore salvataggio.");
          setTimeout(() => setToast(null), 3000);
        }
        return;
      }

      setParziali(payload.parziali);
      setConfermaCollo(payload.confermaCollo);
    } finally {
      if (!silent) setIsBusy(false);
    }
  }


  async function salvaParzialiLiveGenerico(art: Articolo | null, nextInputs: RigaInput[]) {
    if (!art || !center || !data) return;
    setIsBusy(true);

    try {
      // 1) prendo LO STATO CORRENTE dal server (fonte di verità)
      const latest = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${encodeURIComponent(
          center
        )}&data=${encodeURIComponent(data)}`
      ).then(r => r.json());

      // latest può essere [] (API attuale) oppure {parziali, confermaCollo, numero_parziale,...}
      const serverParziali: RigaParziale[] = Array.isArray(latest)
        ? latest
        : (latest?.parziali ?? []);
      const serverConferma: Record<number, boolean> = Array.isArray(latest)
        ? {}
        : (latest?.confermaCollo ?? {});
      const serverNumeroParziale: number | undefined = Array.isArray(latest)
        ? undefined
        : latest?.numero_parziale;
      const serverUpdatedAt: string | undefined = Array.isArray(latest)
        ? undefined
        : latest?.last_modified_at;

      // 2) costruisco i parziali NUOVI per questo articolo (solo righe valide)
const tmp = nextInputs
  .filter(r => Number(r.quantita) > 0 && Number(r.collo) > 0)
  .map(r => ({ collo: Number(r.collo), quantita: Number(r.quantita) }));

// collapse per collo: somma quantità sullo stesso collo
const byCollo = new Map<number, number>();
for (const r of tmp) {
  byCollo.set(r.collo, (byCollo.get(r.collo) || 0) + r.quantita);
}

const nuoviParziali: RigaParziale[] = Array.from(byCollo.entries()).map(([collo, quantita]) => ({
  model_number: art.model_number,
  quantita,
  collo,
  po_number: art.po_number,
  confermato: false,
}));


      // 3) MERGE: tengo TUTTO ciò che non è dell’articolo, e sostituisco solo l’articolo corrente
      const mergedParziali = [
        ...serverParziali.filter(
          p => !(p.model_number === art.model_number && p.po_number === art.po_number)
        ),
        ...nuoviParziali,
      ];

      // 4) salvo lato server con modalità merge; invio versione (se disponibile) per evitare race
      const payload: SaveWipPayload = {
        parziali: mergedParziali,
        confermaCollo: serverConferma,
        merge: true,
      };
      if (serverNumeroParziale !== undefined) payload.numero_parziale = serverNumeroParziale;
      if (serverUpdatedAt) payload.client_last_modified_at = serverUpdatedAt;

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/amazon/vendor/parziali-wip?center=${encodeURIComponent(
          center
        )}&data=${encodeURIComponent(data)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      // 409 = conflitto versione (qualcun altro ha salvato prima di te)
      if (res.status === 409) {
        setToast("Aggiornamento rifiutato: i colli sono cambiati da un altro dispositivo. Ricarico…");
        setTimeout(() => setToast(null), 3000);
        await reloadAll();
        return;
      }
      if (!res.ok) {
        setToast("Errore nel salvataggio. Riprova.");
        return;
      }

      // 5) aggiorno UI locale coerentemente
      setParziali(mergedParziali);
      setConfermaCollo(serverConferma);
    } catch (err) {
      console.error("salvaParzialiLiveGenerico merge error:", err);
      setToast("Errore di rete nel salvataggio.");
    } finally {
      setIsBusy(false);
    }
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


  async function aggiungiColloVuoto() {
    if (!center || !data) return;
    const nuovo = colliInfo.nextDynamic;

    // se per qualche strano motivo esiste già confermato, blocca
    if (confermaCollo[nuovo]) {
      setToast(`Collo #${nuovo} è già confermato`);
      setTimeout(() => setToast(null), 2000);
      return;
    }

    await salvaParzialiLive(parziali, { ...confermaCollo, [nuovo]: false });
    setToast(`Collo #${nuovo} creato`);
    setTimeout(() => setToast(null), 1500);
  }


  function apriModaleCollo(collo: number) {
    if (isBusy) return;
    const righe = parziali.filter(p => p.collo === collo);
    setRigheCollo(righe);
    setEanCollo("");
    setColloError(null);
    setModaleCollo(collo);
  }


  function chiudiModaleCollo() {
    setModaleCollo(null);
    setRigheCollo([]);
    setEanCollo("");
    setColloError(null);
    setConfirmDeleteCollo(false);   // 👈 reset fase di conferma
  }

  // Calcola quanto residuo massimo puoi ancora mettere per (po, model) nel collo corrente
  function calcolaResiduoArticoloInCollo(
    prevRighe: RigaParziale[],
    po_number: string,
    model_number: string,
    excludeIndex?: number
  ): number {
    if (modaleCollo == null) return 0;

    const art = articoli.find(
      a => a.po_number === po_number && a.model_number === model_number
    );
    if (!art) return 0;

    const qtyOrdered = art.qty_ordered;

    // Storici già confermati
    const totalStorici = parzialiStorici
      .filter(p => p.po_number === po_number && p.model_number === model_number)
      .reduce((sum, r) => sum + r.quantita, 0);

    // WIP sugli altri colli (tutti tranne quello corrente)
    const totalWipAltriColli = parziali
      .filter(
        p =>
          p.po_number === po_number &&
          p.model_number === model_number &&
          p.collo !== modaleCollo
      )
      .reduce((sum, r) => sum + r.quantita, 0);

    // Quantità già nel collo corrente (in prevRighe), escludendo eventualmente una riga
    const qtyInCollo = prevRighe.reduce((sum, r, idx) => {
      if (
        excludeIndex !== undefined &&
        idx === excludeIndex
      ) {
        return sum;
      }
      if (
        r.po_number === po_number &&
        r.model_number === model_number
      ) {
        return sum + (Number(r.quantita) || 0);
      }
      return sum;
    }, 0);

    const residuo = qtyOrdered - totalStorici - totalWipAltriColli - qtyInCollo;
    return Math.max(0, residuo);
  }

  function aggiornaQuantitaRigaCollo(idx: number, nuovaQty: number) {
    setRigheCollo(prev => {
      const riga = prev[idx];
      if (!riga) return prev;

      const maxDisponibile = calcolaResiduoArticoloInCollo(
        prev,
        riga.po_number,
        riga.model_number,
        idx
      );

      let qty = Math.max(0, nuovaQty || 0);
      if (qty > maxDisponibile) {
        qty = maxDisponibile;
        const msg = "Limite massimo raggiunto per questo articolo";
        setColloError(msg);
        showAlert(msg);
        playErrorSound();
      }




      const next = [...prev];
      next[idx] = { ...riga, quantita: qty };

      // autosave silenzioso
      if (modaleCollo != null) {
        const collo = modaleCollo;
        const cleaned = next
          .map(r => ({ ...r, quantita: Number(r.quantita) || 0 }))
          .filter(r => r.quantita > 0);
        const altri = parziali.filter(p => p.collo !== collo);
        const mergedParziali = [...altri, ...cleaned];
        void salvaParzialiLive(mergedParziali, confermaCollo, { silent: true });
      }

      return next;
    });
  }

  function rimuoviRigaCollo(idx: number) {
    // Se è l'unica riga, proponi di eliminare l'intero collo
    if (righeCollo.length === 1) {
      const ok = window.confirm(
        "Questo è l'ultimo articolo del collo.\nVuoi eliminare l'intero collo?"
      );
      if (!ok) return;
      void eliminaColloCorrente();
      return;
    }

    // Più righe: conferma solo la rimozione della riga
    const ok = window.confirm("Vuoi davvero rimuovere questo articolo dal collo?");
    if (!ok) return;

    setRigheCollo(prev => prev.filter((_, i) => i !== idx));

    // autosave dopo la rimozione
    if (modaleCollo != null) {
      const collo = modaleCollo;
      setTimeout(() => {
        const cleaned = righeCollo
          .filter((_, i) => i !== idx)
          .map(r => ({ ...r, quantita: Number(r.quantita) || 0 }))
          .filter(r => r.quantita > 0);
        const altri = parziali.filter(p => p.collo !== collo);
        const mergedParziali = [...altri, ...cleaned];
        void salvaParzialiLive(mergedParziali, confermaCollo, { silent: true });
      }, 0);
    }
  }




  async function salvaColloCorrente() {
    if (modaleCollo == null) return;
    const collo = modaleCollo;

    const cleaned = righeCollo
      .map(r => ({ ...r, quantita: Number(r.quantita) || 0 }))
      .filter(r => r.quantita > 0);

    const altri = parziali.filter(p => p.collo !== collo);
    const mergedParziali = [...altri, ...cleaned];

    await salvaParzialiLive(mergedParziali, confermaCollo);
    chiudiModaleCollo();
  }

  async function eliminaColloCorrente() {
    if (modaleCollo == null) return;
    const collo = modaleCollo;

    const nuoviParziali = parziali.filter(p => p.collo !== collo);
    const newConferma: Record<number, boolean> = { ...confermaCollo };
    delete newConferma[collo];

    await salvaParzialiLive(nuoviParziali, newConferma);
    chiudiModaleCollo();
    setToast(`Collo #${collo} eliminato`);
    setTimeout(() => setToast(null), 2000);
  }



  function aggiungiEANAlCollo(eanRaw: string) {
    if (modaleCollo == null) return;
    const ean = eanRaw.trim();
    if (!ean) return;

    const found = articoli.find(
      a => a.vendor_product_id === ean || a.model_number === ean
    );
    if (!found) {
      const msg = "Articolo non trovato per questo EAN/SKU";
      setColloError(msg);
      showAlert(msg);
      playErrorSound();
      return;
    }


    setRigheCollo(prev => {
      const po = found.po_number;
      const mn = found.model_number;

      const residuo = calcolaResiduoArticoloInCollo(prev, po, mn);
      if (residuo <= 0) {
        const msg = "Quantità massima già raggiunta per questo articolo";
        setColloError(msg);
        showAlert(msg);
        playErrorSound();
        return prev;
      }


      const idx = prev.findIndex(
        r => r.model_number === mn && r.po_number === po
      );

      if (idx >= 0) {
        const next = [...prev];
        const currentQty = Number(next[idx].quantita) || 0;
        const nuovaQty = currentQty + 1;
        const maxQty = currentQty + residuo;
        const clamped = Math.min(nuovaQty, maxQty);

      if (clamped === currentQty) {
        const msg = "Quantità massima già raggiunta per questo articolo";
        setColloError(msg);
        showAlert(msg);
        playErrorSound();
        return prev;
      }


        next[idx] = {
          ...next[idx],
          quantita: clamped,
        };
        return next;
      }

      // nuovo articolo nel collo
      const toAdd = Math.min(1, residuo);
      return [
        ...prev,
        {
          model_number: found.model_number,
          po_number: found.po_number,
          quantita: toAdd,
          collo: modaleCollo,
          confermato: false,
        },
      ];
    });

    if (modaleCollo != null) {
      const collo = modaleCollo;
      const cleaned = righeCollo
        .map(r => ({ ...r, quantita: Number(r.quantita) || 0 }))
        .filter(r => r.quantita > 0);
      const altri = parziali.filter(p => p.collo !== collo);
      const mergedParziali = [...altri, ...cleaned];
      void salvaParzialiLive(mergedParziali, confermaCollo, { silent: true });
    }

    setEanCollo("");
    setColloError(null);
    setToast("Articolo aggiunto al collo");
    setTimeout(() => setToast(null), 1200);
  }


  function handleSubmitEanCollo(e: React.FormEvent) {
    e.preventDefault();
    if (!eanCollo.trim()) return;
    aggiungiEANAlCollo(eanCollo);
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
      const msg = "Articolo non trovato! Riprova.";
      setError(msg);
      showAlert(msg);
      playErrorSound();
    }
  };


  // Ricerca manuale
  function handleSkuSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!skuSearch.trim()) {
      const msg = "Inserisci SKU o EAN";
      setSkuSearchError(msg);
      showAlert(msg);
      playErrorSound();
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
      const msg = "Articolo non trovato";
      setSkuSearchError(msg);
      showAlert(msg);
      playErrorSound();
    }
  }


  // --------- UI HELPERS ---------
  function getParzialiStorici(model: string) {
    const storici = parzialiStorici.filter(p => p.model_number === model);
    const perParziale: { [num: number]: number } = {};
    storici.forEach((r: RigaParziale) => {
      const parz = r.numero_parziale || 1;
      perParziale[parz] = (perParziale[parz] || 0) + r.quantita;
    });
    return Object.entries(perParziale).map(([parziale, quantita]) => ({ parziale, quantita }));
  }
  function totaleStorici(model: string) {
    return parzialiStorici.filter(p => p.model_number === model).reduce((sum, r) => sum + r.quantita, 0);
  }
  function totaleWip(model: string) {
    return parziali.filter(p => p.model_number === model).reduce((sum, r) => sum + r.quantita, 0);
  }
  function getResiduoInput(idx: number): number {
    if (!modaleArticolo) return 0;
    const totaleStorico = getParzialiStorici(modaleArticolo.model_number)
      .reduce((sum, r) => sum + Number(r.quantita), 0);
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
  function colliRiepilogo(): ColloRiepilogo[] {
    const gruppi: { [collo: number]: ColloRiepilogo } = {};

    // 1) colli che hanno almeno una riga in parziali
    for (const p of parziali) {
      const c = Number(p.collo);
      if (!c) continue;
      if (!gruppi[c]) {
        gruppi[c] = {
          collo: c,
          righe: [],
          confermato: !!confermaCollo[c],
        };
      }
      gruppi[c].righe.push({
        model_number: p.model_number,
        quantita: Number(p.quantita),
      });
    }

    // 2) colli "vuoti": presenti solo in confermaCollo
    for (const [k, v] of Object.entries(confermaCollo)) {
      const c = Number(k);
      if (!c) continue;
      if (!gruppi[c]) {
        gruppi[c] = {
          collo: c,
          righe: [],
          confermato: !!v,
        };
      }
    }

    return Object.values(gruppi).sort((a, b) => a.collo - b.collo);
  }



  const tuttiConfermati = colliRiepilogo().length > 0 && colliRiepilogo().every(c => c.confermato);

  function exportColliPDF() {
    const doc: JsPDFWithAutoTable = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text(`Riepilogo colli (NON confermati)`, 14, 18);
    doc.setFontSize(11);
    doc.text(`Centro: ${center}`, 14, 26);
    doc.text(`Data: ${data}`, 90, 26);

    let currentY = 36;
    colliRiepilogo().forEach(collo => {
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
      currentY = (doc.lastAutoTable?.finalY ?? currentY + 40) + 8;
    });
    doc.output("dataurlnewwindow");
  }




  // ---- Helpers per bottoni +/- ----
function bumpQuantita(idx: number, delta: number) {
  const cur = Number(inputs[idx]?.quantita) || 0;
  let next = cur + delta;
  const max = getResiduoInput(idx);
  if (next > max) next = max;
  if (next < 0) next = 0;
  aggiornaInput(idx, "quantita", next);
}

function setColloSafe(idx: number, inpId: string, proposed: number) {
  if (Number.isNaN(proposed) || proposed < 1) proposed = 1;

  const { exist, confirmed, maxContinuousWip } = colliInfo;
  const nextRequired = colliInfo.nextDynamic;
  const reserved = reservedNewByRow[inpId]; // collo prenotato per QUESTA riga (se esiste)

  // Vietato usare un collo confermato
  if (confirmed.has(proposed)) {
    setColloErrorIdx(idx);
    setToast(`Collo #${proposed} è confermato`);
    setTimeout(() => setToast(null), 1400);
    setTimeout(() => setColloErrorIdx(null), 450);
    aggiornaInput(idx, "collo", reserved ?? nextRequired);
    return;
  }

  const isExisting = exist.has(proposed);

  // Se la riga ha una prenotazione attiva
  if (reserved !== undefined) {
    if (isExisting) {
      // Passi a un collo del WIP: libera la prenotazione
      setReservedNewByRow(prev => {
        if (!(inpId in prev)) return prev;
        const rest = { ...prev };
        delete rest[inpId];
        return rest;
      });
      if (proposed > maxContinuousWip) {
        setColloErrorIdx(idx);
        setToast(`Prima devi creare il collo #${maxContinuousWip + 1}`);
        setTimeout(() => setToast(null), 1600);
        setTimeout(() => setColloErrorIdx(null), 450);
        aggiornaInput(idx, "collo", maxContinuousWip + 1);
        return;
      }
      aggiornaInput(idx, "collo", proposed);
      return;
    } else {
      // Nuovo: DEV'ESSERE il prenotato
      if (proposed !== reserved) {
        setColloErrorIdx(idx);
        setToast(`Questa riga ha prenotato il collo #${reserved}`);
        setTimeout(() => setToast(null), 1400);
        setTimeout(() => setColloErrorIdx(null), 450);
        aggiornaInput(idx, "collo", reserved);
        return;
      }
      aggiornaInput(idx, "collo", proposed); // ok, è proprio il prenotato
      return;
    }
  }

  // La riga NON ha prenotazione
  if (isExisting) {
    // Ammesso solo entro la continuità
    if (proposed > maxContinuousWip) {
      setColloErrorIdx(idx);
      setToast(`Prima devi creare il collo #${maxContinuousWip + 1}`);
      setTimeout(() => setToast(null), 1600);
      setTimeout(() => setColloErrorIdx(null), 450);
      aggiornaInput(idx, "collo", maxContinuousWip + 1);
      return;
    }
    aggiornaInput(idx, "collo", proposed);
    return;
  }

  // Nuovo: DEVE essere il prossimo richiesto → prenota questa riga
  if (proposed !== nextRequired) {
    setColloErrorIdx(idx);
    setToast(`Prossimo collo valido: #${nextRequired}`);
    setTimeout(() => setToast(null), 1400);
    setTimeout(() => setColloErrorIdx(null), 450);
    aggiornaInput(idx, "collo", nextRequired);
    setReservedNewByRow(prev => ({ ...prev, [inpId]: nextRequired }));
    return;
  }

  // È esattamente il prossimo richiesto: prenota e accetta
  setReservedNewByRow(prev => ({ ...prev, [inpId]: nextRequired }));
  aggiornaInput(idx, "collo", proposed);
}
function bumpCollo(idx: number, delta: number) {
  const cur = Number(inputs[idx]?.collo) || 0;
  let next = cur + delta;
  if (next < 1) next = 1;

  const { maxContinuousWip, minMissingWip } = colliInfo;
  // Se c'è un buco, limita al prossimo richiesto (maxContinuousWip + 1)
  if (next > maxContinuousWip + 1) {
    next = Math.max(minMissingWip, maxContinuousWip + 1);
  }

  setColloSafe(idx, inputs[idx].id, next);
}



  // Cavallotto: apertura PDF (formati A5/A4/A3)
  function openCavallottoPdf(sku: string, formato: string) {
    setCavallottoLoading(true);
    window.open(
      `${import.meta.env.VITE_API_URL}/api/cavallotto/html?sku=${encodeURIComponent(sku)}&formato=${encodeURIComponent(formato)}`,
      "_blank"
    );
    setTimeout(() => {
      setCavallottoLoading(false);
      setCavallottoModal(null);
    }, 900);
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
              ref={inputRef}
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
            {articoliToShow.map(art => {
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
                        <CheckCircle size={18} className="text-green-600 ml-0.5 sm:size-[18px]" />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-bold text-blue-500">
                    {hasStorici ? (
                      <span className="text-xs">
                        {getParzialiStorici(art.model_number).map((r, i) => (
                          <span key={`${art.model_number}-parz-${i}`} className="bg-blue-100 px-2 py-0.5 rounded font-bold text-lg sm:text-xs">
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



      {/* MODALE GESTIONE COLLO */}
      {modaleCollo !== null && (
        <div
          className="fixed inset-0 z-[2147483647] pointer-events-auto"
          style={{ isolation: "isolate" }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={chiudiModaleCollo} />

          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2147483647]
                       bg-white rounded-2xl p-5 shadow-lg border flex flex-col w-full max-w-md"
            style={{
              maxHeight: "92vh",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            }}
          >
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={chiudiModaleCollo}
              disabled={isBusy}
            >
              ×
            </button>

            <div className="mb-1 font-bold text-blue-700 text-lg">
              Gestisci Collo #{modaleCollo}
            </div>
            <div className="mb-3 text-xs text-neutral-500">
              Scansiona EAN/SKU con la pistola o modifica le quantità manualmente.
            </div>

            {/* Input EAN */}
            <form onSubmit={handleSubmitEanCollo} className="mb-3 flex gap-2 items-center">
              <input
                ref={eanColloInputRef}
                type="text"
                inputMode={eanKeyboardEnabled ? "numeric" : "none"}   // 👈 prova a bloccare tastiera
                value={eanCollo}
                onChange={e => setEanCollo(e.target.value)}
                placeholder="EAN o SKU"
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                disabled={isBusy}
              />

  {/* NUOVO: bottone SVUOTA */}
  <button
    type="button"
    className="px-2 py-2 rounded-lg border text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50"
    onClick={() => {
      setEanCollo("");
      // rimetti il focus nel campo dopo averlo svuotato
      if (!isBusy && eanColloInputRef.current) {
        eanColloInputRef.current.focus();
      }
    }}
    disabled={isBusy || !eanCollo.trim()}
  >
    Svuota
  </button>

              <button
                type="button"
                className="px-2 py-2 rounded-lg border text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50"
                onClick={() => {
                  setEanKeyboardEnabled(k => !k);
                  // se la appena attivata, porta il focus sul campo
                  setTimeout(() => {
                    if (!isBusy && eanColloInputRef.current) {
                      eanColloInputRef.current.focus();
                    }
                  }, 50);
                }}
                disabled={isBusy}
              >
                {eanKeyboardEnabled ? "Nascondi" : "Tastiera"}
              </button>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
                disabled={isBusy || !eanCollo.trim()}
              >
                Aggiungi
              </button>
            </form>

            {colloError && (
              <div className="mb-2 text-xs text-red-600">{colloError}</div>
            )}

            {/* Lista righe del collo */}
            <div className="flex-1 overflow-auto mb-3 border rounded-lg p-2">
              {righeCollo.length === 0 ? (
                <div className="text-xs text-neutral-400">
                  Nessun articolo in questo collo. Scansiona un EAN/SKU per iniziare.
                </div>
              ) : (
                <table className="w-full text-xs">
<thead>
  <tr className="border-b">
    {/* SKU prende tutto lo spazio che può */}
    <th className="text-left py-1 pr-2 w-52">SKU</th>

    {/* colonne compatte, larghezza fissa piccola */}
    <th className="text-center py-1 w-10 sm:w-12">Prec.</th>
    <th className="text-center py-1 w-14 sm:w-16">Altri colli</th>
    <th className="text-center py-1 w-10 sm:w-12">Ord.</th>
    <th className="text-center py-1 w-12 sm:w-14">Residuo</th>
    <th className="text-center py-1 w-12 sm:w-14">Qtà</th>
    <th className="text-center py-1 w-6 sm:w-8"></th>
  </tr>
</thead>
<tbody>
  {righeCollo.map((r, idx) => {
    const art = articoli.find(
      a => a.po_number === r.po_number && a.model_number === r.model_number
    );
    const ordered = art?.qty_ordered ?? null;

    // Quantità confermata nei parziali PRECEDENTI (storici) per stesso PO+SKU
    const storiciQty = parzialiStorici
      .filter(
        p =>
          p.model_number === r.model_number &&
          p.po_number === r.po_number
      )
      .reduce((sum, rr) => sum + rr.quantita, 0);

    // Quantità presente in ALTRI colli del parziale corrente (stesso PO+SKU, collo diverso)
    const altriColliQty = parziali
      .filter(
        p =>
          p.model_number === r.model_number &&
          p.po_number === r.po_number &&
          p.collo !== modaleCollo
      )
      .reduce((sum, rr) => sum + rr.quantita, 0);

    // Residuo: quanto rimane ANCORA disponibile per altri pezzi (storici + WIP + questo collo)
    const residuo = calcolaResiduoArticoloInCollo(
      righeCollo,
      r.po_number,
      r.model_number
    );

    return (
      <tr
        key={`${r.po_number}-${r.model_number}-${idx}`}
        className="border-b last:border-0"
      >
        <td className="py-1 font-semibold text-xs">{r.model_number}</td>

        {/* Prec. = storici */}
        <td className="py-1 text-center text-base">
          {storiciQty > 0 ? (
            <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold">
              {storiciQty}
            </span>
          ) : (
            <span className="text-neutral-300">0</span>
          )}
        </td>

        {/* Altri colli = WIP altri colli stessa riga */}
        <td className="py-1 text-center text-base">
          {altriColliQty > 0 ? (
            <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
              {altriColliQty}
            </span>
          ) : (
            <span className="text-neutral-300">0</span>
          )}
        </td>

        {/* Ord. */}
        <td className="py-1 text-center text-base">
          {ordered !== null ? ordered : "-"}
        </td>

        {/* Residuo live */}
        <td className="py-1 text-center text-base">
          <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">
            {residuo}
          </span>
        </td>

        {/* Qtà = nel collo corrente */}
        <td className="py-1 text-center text-base">
          <input
            type="number"
            min={0}
            className="w-14 border rounded px-3 py-2 text-center text-sm"
            value={Number(r.quantita)}
            onChange={e =>
              aggiornaQuantitaRigaCollo(idx, Number(e.target.value) || 0)
            }
            disabled={isBusy}
          />
        </td>

        {/* X = elimina riga con conferma + autosave (come già stai facendo) */}
        <td className="py-1 text-center">
          <button
            type="button"
            className="text-red-500 text-xs font-bold px-1"
            onClick={() => rimuoviRigaCollo(idx)}
            disabled={isBusy}
            title="Rimuovi dal collo"
          >
            ✕
          </button>
        </td>
      </tr>
    );
  })}
</tbody>





                </table>
              )}
            </div>

<div className="flex gap-2 justify-between items-center">
  <div className="flex-1 max-w-[260px]">
    {!confirmDeleteCollo ? (
      // 1ª fase: bottone normale
      <button
        type="button"
        className="px-3 py-2 rounded-lg border text-sm text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50"
        onClick={() => setConfirmDeleteCollo(true)}
        disabled={isBusy}
      >
        Elimina collo
      </button>
    ) : (
      // 2ª fase: slide to confirm
      <SlideToConfirm
        onConfirm={() => {
          setConfirmDeleteCollo(false);
          void eliminaColloCorrente();
        }}
        text="Elimina collo"
        colorClass="bg-red-500"
        disabled={isBusy}
      />
    )}
  </div>

  <div className="flex gap-2 items-center">
    {confirmDeleteCollo && (
      <button
        type="button"
        className="px-2 py-1 rounded-lg border text-[11px]"
        onClick={() => setConfirmDeleteCollo(false)}
        disabled={isBusy}
      >
        Annulla
      </button>
    )}
    <button
      type="button"
      className="px-3 py-2 rounded-lg border text-sm"
      onClick={chiudiModaleCollo}
      disabled={isBusy}
    >
      Chiudi
    </button>
    <button
      type="button"
      className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50"
      onClick={salvaColloCorrente}
      disabled={isBusy}
    >
      Salva collo
    </button>
  </div>
</div>


          </div>
        </div>
      )}


      {/* MODALE INSERIMENTO PARZIALI */}
          {modaleArticolo && (
            <div
              // overlay FULLSCREEN con z-index estremo: supera qualsiasi bottomnav
              className="fixed inset-0 z-[2147483647] pointer-events-auto"
              style={{ isolation: "isolate" }} // crea stacking context ‘alto’ per i figli
            >
              {/* sfondo scuro */}
              <div className="absolute inset-0 bg-black/40" />

              {/* contenitore della card, centrato e SOPRA lo sfondo */}
              <div
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2147483647]
                          bg-white rounded-2xl p-5 shadow-lg border flex flex-col w-full max-w-sm"
                style={{
                  maxHeight: "92vh",
                  minWidth: "min(90vw, 720px)",
                  paddingBottom: "max(1rem, env(safe-area-inset-bottom))" // evita sovrapposizioni in basso
                }}
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
              {parziali.some(p => p.model_number === modaleArticolo.model_number && p.po_number === modaleArticolo.po_number) && (
  <div className="mb-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-300 text-yellow-900 text-xs font-semibold">
    Articolo già presente in questo parziale:
    {" "}
    {Array.from(new Set(
      parziali
        .filter(p => p.model_number === modaleArticolo.model_number && p.po_number === modaleArticolo.po_number)
        .map(p => p.collo)
    )).sort((a,b)=>a-b).map(c => `Collo ${c}`).join(", ")}
  </div>
)}
              {/* Bottoni stampa */}
              <div className="flex gap-2 mt-1">
                {modaleArticolo.vendor_product_id && (
                  <button
                    className="px-2 py-1 bg-gray-100 border rounded-lg text-xs font-semibold hover:bg-gray-200 transition"
                    onClick={() => setShowEtichette(true)}
                  >
                    Genera Etichette
                  </button>
                )}
                {/* nuovo: cavallotto su SKU */}
                <button
                  className="px-2 py-1 bg-indigo-100 border border-indigo-300 text-indigo-800 rounded-lg text-xs font-semibold hover:bg-indigo-200 transition"
                  onClick={() => setCavallottoModal(modaleArticolo.model_number)}
                >
                  Genera Cavallotto
                </button>
              </div>
            </div>
{/* Indicatore ultimo/prossimo collo */}
<div className="mb-3 flex items-center gap-2 text-xs">
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
    Ultimo collo: <b>{lastCollo}</b>
  </span>
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200">
    Prossimo disponibile: <b>{nextCollo}</b>
  </span>
</div>

            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, maxHeight: "50vh" }}>
              <div className="mb-2">
                <div className="text-sm font-semibold mb-1">Parziali precedenti:</div>
                {getParzialiStorici(modaleArticolo.model_number).length === 0 ? (
                  <div className="text-neutral-400 text-xs">Nessun parziale inserito</div>
                ) : (
                  <span className="flex flex-wrap gap-2 text-xs">
                    {getParzialiStorici(modaleArticolo.model_number).map((r, i) => (
                      <span key={`stor-${i}`} className="bg-blue-100 px-2 py-0.5 rounded font-bold">
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
                      <div className="rounded-lg border overflow-hidden">
                        <input
                          type="number"
                            inputMode="numeric"    // chiede tastiera numerica
                            pattern="\d*"          // limita a cifre
                            autoComplete="off"
                          min={1}
                          max={getResiduoInput(idx)}
                          value={inp.quantita === 0 ? "" : inp.quantita}
                          onChange={e => {
                            let vNum = Number(e.target.value);
                            if (isNaN(vNum)) vNum = 0;
                            const max = getResiduoInput(idx);
                            if (vNum > max) {
                              vNum = max;
                              setShakeIdx(idx);
                              setTimeout(() => setShakeIdx(null), 400);
                            }
                            if (vNum < 1) vNum = 0;
                            aggiornaInput(idx, "quantita", vNum);
                          }}
                          className={`w-full border-0 p-2 text-center font-bold text-blue-700 outline-blue-400 ${shakeIdx === idx ? "ring-2 ring-red-400 animate-shake" : ""}`}
                          placeholder="Quantità"
                          disabled={isBusy}
                        />
                        <div className="grid grid-cols-2 divide-x">
                          <button
                            type="button"
                            className="py-1.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                            onClick={() => bumpQuantita(idx, -1)}
                            disabled={isBusy}
                            aria-label="Diminuisci quantità"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="py-1.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                            onClick={() => bumpQuantita(idx, +1)}
                            disabled={isBusy}
                            aria-label="Aumenta quantità"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
  <label className="block text-xs mb-1">Collo</label>

  <div className={`rounded-lg border overflow-hidden ${colloErrorIdx === idx ? "ring-2 ring-red-500" : ""}`}>
    <input
      type="text"
      inputMode="numeric"
      pattern="\d*"
      autoComplete="off"
      value={inp.collo === 0 ? "" : String(inp.collo)}
onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = e.target.value.replace(/\D+/g, "");
  if (raw === "") { aggiornaInput(idx, "collo", ""); return; }
  const num = Math.max(1, Number(raw) || 1);
  setColloSafe(idx, inp.id, num);
}}
      className={`w-full border-0 p-2 text-center font-bold outline-blue-400 ${
        colloErrorIdx === idx ? "animate-shake text-red-700" : ""
      }`}
      placeholder={`Collo (prossimo: ${nextCollo})`}
      disabled={isBusy}
    />
    <div className="grid grid-cols-2 divide-x">
      <button
        type="button"
        className="py-1.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        onClick={() => bumpCollo(idx, -1)}
        disabled={isBusy}
        aria-label="Diminuisci numero collo"
      >
        −
      </button>
      <button
        type="button"
        className="py-1.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        onClick={() => bumpCollo(idx, +1)}
        disabled={isBusy}
        aria-label="Aumenta numero collo"
      >
        +
      </button>
    </div>
  </div>
</div>
                    <button
                      className="ml-2 p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                      onClick={() => rimuoviRiga(inp.id)}
                      disabled={isBusy}
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
                      Number(inp.quantita) <= 0 ||
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
        <div className="mb-4 flex justify-between items-center">
          <h3 className="font-bold text-lg">Riepilogo colli</h3>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded bg-cyan-700 text-white font-semibold hover:bg-cyan-900"
              onClick={exportColliPDF}
              disabled={isBusy}
            >
              Esporta PDF colli attuali
            </button>
            <button
              className="px-4 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-800"
              onClick={aggiungiColloVuoto}
              disabled={isBusy}
            >
              + Aggiungi collo
            </button>
          </div>
        </div>

        {colliRiepilogo().length === 0 ? (
          <div className="text-neutral-400 text-sm">Nessun collo creato</div>
        ) : (
          <div className="flex flex-wrap gap-6">
              {colliRiepilogo().map(collo => {
                const containsCurrent =
                  !!modaleArticolo &&
                  collo.righe.some(r => r.model_number === modaleArticolo.model_number);

                return (
                  <div
                    key={collo.collo}
                    className={`rounded-2xl shadow p-4 min-w-[180px] w-full max-w-xs relative border-2
                      ${collo.confermato ? "border-green-500" : "border-blue-200"}
                      ${containsCurrent ? "bg-yellow-50" : "bg-white"}
                      ${!collo.confermato ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition" : ""}
                    `}
                    onClick={() => !collo.confermato && apriModaleCollo(collo.collo)}
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
                      onClick={e => {
                        e.stopPropagation();          // 👈 blocca il click dal salire alla card
                        confermaUnCollo(collo.collo);
                      }}
                      className="w-full py-2 font-bold rounded-lg shadow bg-blue-600 text-white hover:bg-blue-800 transition"
                      disabled={isBusy}
                    >
                      Conferma
                    </button>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();          // 👈 idem qui
                        annullaConfermaCollo(collo.collo);
                      }}
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
              );
            })}
          </div>
        )}
      </div>
<audio
  ref={errorAudioRef}
  src="/sound/error-170796.mp3"
  preload="auto"
/>

{/* POPUP AVVISO ROSSO */}
{alertMessage && (
  <div
    className="fixed inset-0 z-[2147483647] flex items-center justify-center pointer-events-auto"
    style={{ isolation: "isolate" }}
  >
    <div className="absolute inset-0 bg-black/40" />
    <div className="relative bg-red-600 text-white rounded-2xl min-h-[60%] px-5 py-4 w-[90%] shadow-xl border border-red-300">
      <div className="flex items-center gap-2 mb-2 border-b border-red-300 pb-2">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/100">
          {/* semplice icona warning testuale */}
          <span className="text-3xl">⚠️</span>
        </div>
        <span className="font-extrabold text-3xl tracking-wide uppercase">
          ATTENZIONE
        </span>
      </div>
      <div className="text-3xl leading-snug ">
        {alertMessage}
      </div>
      <div className="flex justify-center mt-[20%]">
        <button
          type="button"
          className="px-4 py-1.5 rounded-lg bg-white text-red-700 text-[50px] font-semibold hover:bg-red-50"
          onClick={() => setAlertMessage(null)}
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}



    {/* Toast globale (senza portal, sopra a tutto) */}
    {toast && (
      <div
        className="fixed inset-0 z-[2147483647] pointer-events-none"
        style={{ isolation: "isolate" }} // crea uno stacking context superiore
      >
        <div className="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] pointer-events-auto">
          <div className="inline-block bg-neutral-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
            {toast}
          </div>
        </div>
      </div>
    )}


    {/* POPUP ALERT BLOCCANTE */}
    {alertModal && (
      <div
        className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40"
        style={{ isolation: "isolate" }}
      >
        <div className="bg-white rounded-2xl shadow-xl border px-5 py-4 w-full max-w-xs">
          <div className="mb-3 font-semibold text-base text-blue-800">
            Attenzione
          </div>
          <div className="mb-4 text-sm text-neutral-800 whitespace-pre-line">
            {alertModal}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-800"
              onClick={() => setAlertModal(null)}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )}



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

      {/* MODALE CAVALLOTTO */}
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
            {cavallottoLoading && <svg className="mx-auto animate-spin" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" opacity="0.9"/></svg>}
          </div>
        </div>
      )}

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
