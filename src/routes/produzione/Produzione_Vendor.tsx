import { useEffect, useState, useRef, useCallback, JSX } from "react";
import { Info, Check, X, ChevronDown, Edit, Trash, Loader2, Lock, MoveRight } from "lucide-react";
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { generateEAN13Barcode } from "../../utils/barcode-bwip";

/* ----------------------------- Tipi & Costanti ---------------------------- */
declare global {
  interface Window {
    APP_USER_NAME?: string;
  }
}

export type ProduzioneRow = {
  id: number;
  sku: string;
  ean: string;
  qty: number;
  plus?: number | null;
  riscontro?: number | null;
  radice: string;
  start_delivery: string | null;
  stato: string;
  stato_produzione:
    | "Da Stampare"
    | "Stampato"
    | "Calandrato"
    | "Cucito"
    | "Confezionato"
    | "Trasferito"
    | "Rimossi";
  da_produrre: number;
  cavallotti: boolean;
  note?: string | null;
  modificata_manualmente?: boolean;
  canale?: "Amazon Vendor" | "Amazon Seller" | "Sito";
};

export type ApiListResponse<T> = { data: T } | T;

export type ProductSuggest = {
  id: string;
  sku: string | null;
  ean: string | null;
  variant_title?: string | null;
  product_title?: string | null;
  image_url?: string | null;
  price?: number | null;
};

export type ToastType = "success" | "error";

export type Canale = "Amazon Vendor" | "Sito" | "Amazon Seller";

const CANALE_BADGE: Record<Canale, string> = {
  "Amazon Vendor": "bg-orange-100 border-orange-300 text-orange-800",
  Sito: "bg-green-100 border-green-300 text-green-800",
  "Amazon Seller": "bg-red-100 border-red-300 text-red-800",
};

export type SiteOrdersSummary = {
  orders_count: number;
  total_qty: number;
};

export type LogMovimento = {
  id?: number;
  created_at?: string;
  motivo?: string;
  stato_vecchio?: string | null;
  stato_nuovo?: string | null;
  qty_vecchia?: number | null;
  qty_nuova?: number | null;
  plus_vecchio?: number | null;
  plus_nuovo?: number | null;
  utente?: string | null;
  canale?: string | null;
  canale_label?: string | null;
};

export type StatoProduzione = ProduzioneRow["stato_produzione"];

const FLOW_STATES: StatoProduzione[] = [
  "Da Stampare",
  "Stampato",
  "Calandrato",
  "Cucito",
  "Confezionato",
  "Trasferito",
];

const TITOLO_DA_PRODURRE: Record<string, string> = {
  "": "Inseriti",
  "Da Stampare": "Da Stampare",
  Stampato: "Stampati",
  Calandrato: "Calandrati",
  Cucito: "Cuciti",
  Confezionato: "Confezionati",
  Trasferito: "Trasferiti",
  Rimossi: "Rimossi",
};

const STATI_PRODUZIONE: StatoProduzione[] = [
  "Da Stampare",
  "Stampato",
  "Calandrato",
  "Cucito",
  "Confezionato",
  "Trasferito",
  "Rimossi",
];

/* ------------------------------ Utilità testo ----------------------------- */
function delta(oldV?: number | null, newV?: number | null, unit = "pezzi"): string {
  const a = typeof oldV === "number" ? oldV : undefined;
  const b = typeof newV === "number" ? newV : undefined;
  if (typeof a === "undefined" && typeof b === "undefined") return "—";
  if (typeof a === "undefined") return `${b} ${unit}`;
  if (typeof b === "undefined") return `${a} ${unit}`;
  if (a === b) return `${b} ${unit}`;
  return `${a} → ${b} ${unit}`;
}

function normalizeMotivo(raw?: string | null): string {
  const s = (raw ?? "").toLowerCase();
  if (!s) return "Aggiornamento automatico (sistema)";
  if (s.startsWith("trigger insert")) return "Creazione riga (sistema)";
  if (s.startsWith("trigger update")) return "Aggiornamento automatico (sistema)";
  if (s.includes("spostamento a")) return raw!;
  if (s.includes("cambio stato")) return "Cambio stato";
  if (s.includes("modifica quantità")) return "Modifica quantità";
  if (s.includes("modifica plus")) return "Modifica plus";
  if (s.includes("inserimento manuale")) return "Inserimento manuale";
  return raw || "Aggiornamento";
}

function normalizeUtente(u?: string | null): string {
  const x = (u ?? "").trim().toLowerCase();
  if (!x || ["postgres", "postgrest", "supabase", "system", "sistema"].includes(x)) return "Sistema";
  return (u ?? "").trim();
}

function dedupeLogs(input: LogMovimento[]): LogMovimento[] {
  const seen = new Set<string>();
  const out: LogMovimento[] = [];
  for (const l of input) {
    const t = l.created_at ? Math.floor(new Date(l.created_at).getTime() / 1000) : 0;
    const key = [
      t,
      normalizeMotivo(l.motivo),
      l.stato_vecchio ?? "-",
      l.stato_nuovo ?? "-",
      String(l.qty_vecchia ?? "-"),
      String(l.qty_nuova ?? "-"),
      String(l.plus_vecchio ?? "-"),
      String(l.plus_nuovo ?? "-"),
    ].join("|");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(l);
    }
  }
  return out;
}

/* --------------------------------- Helpers -------------------------------- */
function estraiMisura(sku: string): string {
  const parts = sku.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function parseMisura(misura: string): [number, number] {
  const m = misura.match(/^(\d+)[xX](\d+)$/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [Number.NaN, Number.NaN];
}

function badgeCanale(c?: string) {
  const cls = (c && CANALE_BADGE[c as Canale]) || "bg-gray-100 border-gray-300 text-gray-600";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold ${cls}`}
    >
      {c || "—"}
    </span>
  );
}

function badgeStato(stato: StatoProduzione) {
  const color =
    stato === "Da Stampare"
      ? "from-blue-300 to-cyan-400 border-blue-400 text-blue-800"
      : stato === "Stampato"
      ? "from-green-300 to-green-200 border-green-400 text-green-800"
      : stato === "Calandrato"
      ? "from-purple-300 to-purple-400 border-purple-400 text-purple-900"
      : stato === "Cucito"
      ? "from-orange-200 to-orange-400 border-orange-300 text-orange-800"
      : stato === "Confezionato"
      ? "from-pink-100 to-pink-300 border-pink-400 text-pink-700"
      : stato === "Trasferito"
      ? "from-gray-200 to-gray-300 border-gray-400 text-gray-700"
      : "from-red-100 to-red-200 border-red-400 text-red-800";
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 font-semibold text-xs bg-gradient-to-tr ${color} shadow glass transition-all animate-badge-state`}
      style={{ letterSpacing: 1 }}
    >
      {stato}
    </span>
  );
}

function rowBgByCanale(canale?: string) {
  switch (canale) {
    case "Amazon Vendor":
      return "bg-orange-50";
    case "Sito":
      return "bg-green-50";
    case "Amazon Seller":
      return "bg-yellow-50";
    default:
      return "bg-white";
  }
}

function sameSku(a?: string, b?: string): boolean {
  return (a ?? "").trim().toUpperCase() === (b ?? "").trim().toUpperCase();
}

function currentUserName(): string {
  return window.APP_USER_NAME || localStorage.getItem("userName") || "Operatore";
}

function headersJson(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-USER-NAME": currentUserName(),
  };
}

function movedPieces(l: LogMovimento): number | null {
  const a = typeof l.qty_vecchia === "number" ? l.qty_vecchia : null;
  const b = typeof l.qty_nuova === "number" ? l.qty_nuova : null;
  if (a === null || b === null) return null;
  return a - b;
}

/* ----------------------- Tipi per la Flow Map dei log ---------------------- */

export type EdgeKey = `${StatoProduzione}->${StatoProduzione}`;

export type FlowEdge = {
  from: StatoProduzione;
  to: StatoProduzione;
  qty: number;
};

export type FlowGraph = {
  nodes: StatoProduzione[];
  edges: FlowEdge[];
};

function buildFlowGraph(logs: LogMovimento[]): FlowGraph {
  const edgesMap = new Map<EdgeKey, number>();
  for (const l of logs) {
    const motivo = (l.motivo ?? "").toLowerCase();
    const isSpost = motivo.startsWith("spostamento a");
    const from = (l.stato_vecchio ?? "") as StatoProduzione;
    const to = (l.stato_nuovo ?? "") as StatoProduzione;
    if (!isSpost) continue;
    if (!FLOW_STATES.includes(from) || !FLOW_STATES.includes(to)) continue;
    const m = movedPieces(l);
    const qty = m === null ? 0 : Math.abs(m);
    if (qty <= 0) continue;
    const key: EdgeKey = `${from}->${to}`;
    edgesMap.set(key, (edgesMap.get(key) ?? 0) + qty);
  }
  const edges: FlowEdge[] = [...edgesMap.entries()].map(([k, qty]) => {
    const [from, to] = k.split("->") as [StatoProduzione, StatoProduzione];
    return { from, to, qty };
  });
  return { nodes: FLOW_STATES, edges };
}

/* --------------------------------- Toast UI -------------------------------- */
function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2300);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={
        type === "success"
          ? "fixed top-6 left-1/2 z-[100] -translate-x-1/2 px-5 py-3 rounded-xl font-bold shadow-xl border text-center bg-green-100 border-green-300 text-green-800 animate-toast-pop"
          : "fixed top-6 left-1/2 z-[100] -translate-x-1/2 px-5 py-3 rounded-xl font-bold shadow-xl border text-center bg-red-100 border-red-300 text-red-700 animate-toast-pop"
      }
    >
      {message}
      <style>{`
        .animate-toast-pop { animation: toast-pop .5s cubic-bezier(.4,2,.3,1) both; }
        @keyframes toast-pop {
          0% { transform: translateX(-50%) scale(0.8); opacity:0; }
          100% { transform: translateX(-50%) scale(1); opacity:1; }
        }
      `}</style>
    </div>
  );
}

/* ================================ COMPONENTE =============================== */
export default function ProduzioneVendor() {
  const [allRows, setAllRows] = useState<ProduzioneRow[]>([]);
  const [rows, setRows] = useState<ProduzioneRow[]>([]);
  const [statoProduzione, setStatoProduzione] = useState<string>("");
  const [radice, setRadice] = useState<string>("");
  const [canale, setCanale] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [radiciOpen, setRadiciOpen] = useState(false);
  const radiciBoxRef = useRef<HTMLDivElement>(null);
  const [statiOpen, setStatiOpen] = useState(false);
  const statiBoxRef = useRef<HTMLDivElement>(null);
  const [selezionati, setSelezionati] = useState<number[]>([]);
  const [modaleNota, setModaleNota] = useState<{ id: number; nota: string } | null>(null);
  const [statoProduzioneOpenId, setStatoProduzioneOpenId] = useState<number | null>(null);
  const [logMovimentiOpen, setLogMovimentiOpen] = useState<{
    id: number;
    sku?: string;
    data: LogMovimento[];
    graph?: FlowGraph;
  } | null>(null);
  const [cavallottoModal, setCavallottoModal] = useState<string | null>(null);
  const [cavallottoLoading] = useState(false);
  const [exportMassivoOpen, setExportMassivoOpen] = useState(false);
  const [itemsToShow, setItemsToShow] = useState(20);
  const [modaleDaProdurre, setModaleDaProdurre] = useState<
    | {
        id: number;
        value: number;
        stato: string;
        qty: number;
        plus: number;
        riscontro: number;
      }
    | null
  >(null);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [loadingPatch, setLoadingPatch] = useState<boolean>(false);
  const [siteSummary, setSiteSummary] = useState<SiteOrdersSummary | null>(null);
  const [loadingSiteSummary, setLoadingSiteSummary] = useState(false);
  const [modaleMove, setModaleMove] = useState<
    | {
        id: number;
        sku: string;
        ean: string;
        canale?: string;
        start_delivery: string | null;
        fromState: StatoProduzione;
        toState: StatoProduzione;
        maxQty: number;
        qty: number;
      }
    | null
  >(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<{
    canale: "Amazon Seller" | "Sito" | "";
    sku: string;
    ean: string;
    qty: number | "";
    start_delivery: string;
    note: string;
    plus: number | "";
    cavallotti: boolean;
  }>({
    canale: "",
    sku: "",
    ean: "",
    qty: "",
    start_delivery: "",
    note: "",
    plus: "",
    cavallotti: false,
  });
  const [productQuery, setProductQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<ProductSuggest[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const suggestTimer = useRef<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [badgeAnim, setBadgeAnim] = useState<number>(0);
  const scrollTopRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLDivElement>(null);

  /* ------------------------- Gestione dropdown chiusura ------------------------- */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (radiciOpen && radiciBoxRef.current && !radiciBoxRef.current.contains(e.target as Node))
        setRadiciOpen(false);
      if (statiOpen && statiBoxRef.current && !statiBoxRef.current.contains(e.target as Node))
        setStatiOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [radiciOpen, statiOpen]);

  /* --------------------------------- Fetch rows -------------------------------- */
  useEffect(() => {
    const url = new URL(`${import.meta.env.VITE_API_URL}/api/produzione`);
    if (canale) url.searchParams.set("canale", canale);
    fetch(url.toString())
      .then((r) => r.json() as Promise<ApiListResponse<ProduzioneRow[]>>)
      .then((data) => {
        const array = Array.isArray(data) ? data : data?.data ?? [];
        setAllRows(array);
      })
      .catch(() => setAllRows([]));
  }, [badgeAnim, canale]);

  /* -------------------------- Autocomplete prodotti -------------------------- */
  useEffect(() => {
    if (!productQuery) {
      setSuggestions([]);
      return;
    }
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    suggestTimer.current = window.setTimeout(async () => {
      setLoadingSug(true);
      try {
        const url = new URL(`${import.meta.env.VITE_API_URL}/api/products/search`);
        url.searchParams.set("q", productQuery);
        const r = await fetch(url.toString());
        const data = (await r.json()) as ProductSuggest[];
        setSuggestions(data || []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSug(false);
      }
    }, 180);
    return () => {
      if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    };
  }, [productQuery]);

  /* ----------------------------- Ricerca intelligente ---------------------------- */
  const matchSmart = useCallback(
    (row: { sku: string; ean: string }, query: string): boolean => {
      const tokens = query.trim().split(/\s+/).filter(Boolean);
      const SKU = (row.sku || "").toUpperCase();
      const EAN = (row.ean || "").toUpperCase();
      const parts = SKU.split("-").filter(Boolean);
      const last = parts.length ? parts[parts.length - 1] : "";
      return tokens.every((tok) => {
        const exact = tok.endsWith(";");
        const t = tok.replace(/;$/, "").toUpperCase();
        if (!t) return true;
        if (exact) {
          if (/^\d+$/.test(t)) return EAN === t;
          return last === t;
        }
        return SKU.includes(t) || EAN.includes(t);
      });
    },
    []
  );

  /* ------------------------ riepilogo ordini per Sito ------------------------ */
  useEffect(() => {
    const sku = manualForm.sku?.trim();
    if (manualForm.canale === "Sito" && sku) {
      setLoadingSiteSummary(true);
      fetch(`${import.meta.env.VITE_API_URL}/api/orders/site/sku-summary?sku=${encodeURIComponent(sku)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: SiteOrdersSummary | null) => setSiteSummary(d))
        .catch(() => setSiteSummary(null))
        .finally(() => setLoadingSiteSummary(false));
    } else {
      setSiteSummary(null);
    }
  }, [manualForm.canale, manualForm.sku]);

  /* ----------------------------- Filtri & Ordinamento ----------------------------- */
  useEffect(() => {
    let filtrate = allRows.slice();
    if (statoProduzione) filtrate = filtrate.filter((r) => r.stato_produzione === (statoProduzione as StatoProduzione));
    if (radice) filtrate = filtrate.filter((r) => r.radice === radice);
    if (canale) filtrate = filtrate.filter((r) => r.canale === canale);
    if (search) filtrate = filtrate.filter((row) => matchSmart({ sku: row.sku, ean: row.ean }, search));
    filtrate.sort((a, b) => a.sku.localeCompare(b.sku, "it", { sensitivity: "base" }));
    setRows(filtrate);
    setSelezionati([]);
    setItemsToShow(20);
  }, [allRows, statoProduzione, radice, search, canale, matchSmart]);

  const ciSonoFiltri = !!statoProduzione || !!radice || !!search || !!canale;
  const righeDaMostrare: ProduzioneRow[] = ciSonoFiltri ? rows : rows.slice(0, itemsToShow);

  /* ------------------------------ Sync scroll header ------------------------------ */
  useEffect(() => {
    const topDiv = scrollTopRef.current;
    const tableDiv = scrollTableRef.current;
    if (!topDiv || !tableDiv) return;
    const handleTop = () => {
      tableDiv.scrollLeft = topDiv.scrollLeft;
    };
    const handleTable = () => {
      topDiv.scrollLeft = tableDiv.scrollLeft;
    };
    topDiv.addEventListener("scroll", handleTop);
    tableDiv.addEventListener("scroll", handleTable);
    return () => {
      topDiv.removeEventListener("scroll", handleTop);
      tableDiv.removeEventListener("scroll", handleTable);
    };
  }, [rows.length]);

  /* --------------------------------- Actions -------------------------------- */
  async function patchProduzione(id: number, body: Partial<ProduzioneRow & { password?: string }>): Promise<void> {
    setLoadingPatch(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/${id}`, {
        method: "PATCH",
        headers: headersJson(),
        body: JSON.stringify(body),
      });
      if (res.status === 403) {
        const data = (await res.json()) as { error?: string };
        setToast({ msg: data.error || "Password errata.", type: "error" });
        throw new Error(data.error || "Password errata.");
      }
      setBadgeAnim((b) => b + 1);
      setToast({ msg: "Aggiornato!", type: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore generico";
      setToast({ msg, type: "error" });
    } finally {
      setLoadingPatch(false);
    }
  }

  async function moveQtyToState(from: ProduzioneRow, toState: StatoProduzione | string, qty: number): Promise<void> {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/move-qty`, {
        method: "POST",
        headers: headersJson(),
        body: JSON.stringify({ from_id: from.id, to_state: toState, qty }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error((e && e.error) || "Spostamento non riuscito");
      }
      setBadgeAnim((b) => b + 1);
      setToast({ msg: `Spostati ${qty} pezzi in ${toState}.`, type: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore spostamento";
      setToast({ msg, type: "error" });
    }
  }

  async function submitManuale(): Promise<void> {
    if (!manualForm.canale || !manualForm.sku || !manualForm.qty) {
      setToast({ msg: "Compila i campi obbligatori (*).", type: "error" });
      return;
    }
    const payload = {
      canale: manualForm.canale,
      sku: manualForm.sku.trim(),
      ean: manualForm.ean.trim(),
      qty: Number(manualForm.qty),
      note: manualForm.note.trim(),
      plus: manualForm.plus ? Number(manualForm.plus) : 0,
      cavallotti: manualForm.cavallotti,
    };
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/manuale`, {
        method: "POST",
        headers: headersJson(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = (await res.json()) as { error?: string };
        throw new Error(e.error || "Errore inserimento");
      }
      setManualOpen(false);
      setManualForm({ canale: "", sku: "", ean: "", qty: "", start_delivery: "", plus: "", note: "", cavallotti: false });
      setProductQuery("");
      setSuggestions([]);
      setSiteSummary(null);
      setBadgeAnim((b) => b + 1);
      setToast({ msg: "Inserito in produzione!", type: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore inserimento";
      setToast({ msg, type: "error" });
    }
  }

  async function openMovimentiLog(produzioneId: number, sku?: string): Promise<void> {
    setLogMovimentiOpen({ id: produzioneId, sku, data: [] });
    let res: Response;
    try {
      res = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/${produzioneId}/log-unified?compact=1`, {
        headers: headersJson(),
      });
    } catch {
      res = await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/${produzioneId}/log`, { headers: headersJson() });
    }
    const arr = (await res.json()) as LogMovimento[] | { data?: LogMovimento[] };
    const data = Array.isArray(arr) ? arr : arr?.data ?? [];
    const clean = dedupeLogs(
      data.map((l) => ({ ...l, motivo: normalizeMotivo(l.motivo), utente: normalizeUtente(l.utente) }))
    );
    setLogMovimentiOpen({ id: produzioneId, sku, data: clean, graph: buildFlowGraph(clean) });
  }

  async function openCavallottoPdf(sku: string, formato: string): Promise<void> {
    window.open(
      `${import.meta.env.VITE_API_URL}/api/cavallotto/html?sku=${encodeURIComponent(sku)}&formato=${encodeURIComponent(formato)}`,
      "_blank"
    );
    setCavallottoModal(null);
  }

  async function handleModaleDaProdurreSave(): Promise<void> {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Password errata.";
      setPasswordError(msg);
    } finally {
      setLoadingPatch(false);
    }
  }

  async function azioneMassiva(stato: StatoProduzione): Promise<void> {
    if (selezionati.length === 0) return;
    setLoadingPatch(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/bulk`, {
      method: "PATCH",
      headers: headersJson(),
      body: JSON.stringify({ ids: selezionati, fields: { stato_produzione: stato } }),
    });
    setSelezionati([]);
    setBadgeAnim((b) => b + 1);
    setToast({ msg: `Segnato ${selezionati.length} come ${TITOLO_DA_PRODURRE[stato]}`, type: "success" });
    setLoadingPatch(false);
  }

  async function rimuoviDaProduzione(): Promise<void> {
    if (selezionati.length === 0) return;
    setLoadingPatch(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/produzione/bulk`, {
      method: "DELETE",
      headers: headersJson(),
      body: JSON.stringify({ ids: selezionati }),
    });
    setSelezionati([]);
    setBadgeAnim((b) => b + 1);
    setToast({ msg: "Rimosse dalla produzione!", type: "success" });
    setLoadingPatch(false);
  }

  /* --------------------------------- Export PDF -------------------------------- */
  async function exportPDF(orderBy: "az" | "misura"): Promise<void> {
    const dataExport = rows.filter((r) => selezionati.includes(r.id));
    const byRadice: Record<string, ProduzioneRow[]> = {};
    dataExport.forEach((r) => {
      if (!byRadice[r.radice]) byRadice[r.radice] = [];
      byRadice[r.radice].push(r);
    });
    Object.keys(byRadice).forEach((rad) => {
      const arr = byRadice[rad];
      if (!Array.isArray(arr)) return;
      arr.sort((a, b) => {
        if (orderBy === "misura") {
          const A = estraiMisura(a.sku),
            B = estraiMisura(b.sku);
          const [a1, a2] = parseMisura(A),
            [b1, b2] = parseMisura(B);
          if (!Number.isNaN(a1) && !Number.isNaN(b1)) {
            if (a1 !== b1) return a1 - b1;
            if (!Number.isNaN(a2) && !Number.isNaN(b2)) return a2 - b2;
          }
          return A.localeCompare(B, "it");
        }
        return a.sku.localeCompare(b.sku, "it");
      });
    });
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    let firstTable = true;
    for (const radiceKey of Object.keys(byRadice)) {
      if (!firstTable) doc.addPage();
      const startY = 15;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`Radice: ${radiceKey}`, 12, startY);
      firstTable = false;
      const barcodeMap: Record<string, string> = {};
      const bodyRows: Array<[string, string, string, string, number]> = [];
      for (const r of byRadice[radiceKey]) {
        let image = "";
        try {
          image = await generateEAN13Barcode(r.ean, 70, 70);
        } catch {
          image = "";
        }
        barcodeMap[r.ean] = image;
        bodyRows.push([" ", r.sku, r.ean, r.stato_produzione, r.da_produrre]);
      }
      autoTable(doc, {
        startY: startY + 3,
        head: [["Barcode", "SKU", "EAN", "Stato", "Quantità"]],
        body: bodyRows,
        theme: "grid",
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 12,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 11,
          valign: "middle",
          minCellHeight: 15,
          cellPadding: 2,
          overflow: "ellipsize",
        },
        alternateRowStyles: { fillColor: [245, 249, 255] },
        columnStyles: {
          0: { cellWidth: 40, halign: "center" },
          1: { cellWidth: 80 },
          2: { cellWidth: 50 },
          3: { cellWidth: 40 },
          4: { cellWidth: 30, halign: "center" },
        },
        didDrawCell: (data: CellHookData) => {
          if (data.column.index === 0) {
            const ean = String((data.row.raw as [string, string, string, string, number])[2] ?? "");
            const img = barcodeMap[ean];
            if (img) doc.addImage(img, "PNG", data.cell.x + 2, data.cell.y + 2, 30, 10);
          }
        },
      });
    }
    window.open(doc.output("bloburl"), "_blank");
  }

  /* ------------------------------ Computed UI ------------------------------ */
  const allVisibleIds = rows.map((r) => r.id);
  const selezioneTotale = selezionati.length === allVisibleIds.length && allVisibleIds.length > 0;
  const badgeStatoCounts = STATI_PRODUZIONE.map((st) => ({
    stato: st,
    count: allRows.filter(
      (r) =>
        (!radice || r.radice === radice) &&
        (!search || matchSmart({ sku: r.sku, ean: r.ean }, search)) &&
        (!canale || r.canale === canale) &&
        r.stato_produzione === st
    ).length,
  }));
  const badgeTuttiStati = allRows.filter(
    (r) =>
      (!radice || r.radice === radice) &&
      (!search || matchSmart({ sku: r.sku, ean: r.ean }, search)) &&
      (!canale || r.canale === canale)
  ).length;
  const radiciDisponibili = Array.from(
    new Set(
      allRows
        .filter(
          (r) => (!statoProduzione || r.stato_produzione === (statoProduzione as StatoProduzione)) && (!canale || r.canale === canale)
        )
        .map((r) => r.radice)
    )
  ).filter(Boolean);
  const badgeRadiceCounts = radiciDisponibili.map((rr) => ({
    radice: rr,
    count: allRows.filter(
      (row) =>
        (!statoProduzione || row.stato_produzione === (statoProduzione as StatoProduzione)) &&
        (!canale || row.canale === canale) &&
        row.radice === rr
    ).length,
  }));
  const badgeTutteRadici = allRows.filter(
    (row) =>
      (!statoProduzione || row.stato_produzione === (statoProduzione as StatoProduzione)) &&
      (!search || matchSmart({ sku: row.sku, ean: row.ean }, search)) &&
      (!canale || row.canale === canale)
  ).length;

  function badgeNota(r: ProduzioneRow) {
    const hasNote = r.note && r.note.trim() !== "";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer select-none ${
          hasNote
            ? "bg-red-100 text-red-600 border border-red-300 hover:bg-red-200 animate-bounce-badge"
            : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200"
        }`}
        onClick={() => setModaleNota({ id: r.id, nota: r.note || "" })}
        title={hasNote ? "Visualizza/modifica nota" : "Aggiungi nota"}
      >
        <Info size={15} /> Nota
      </span>
    );
  }

  function badgeCavallotti(val: boolean, onClick: () => void) {
    return val ? (
      <span
        onClick={onClick}
        className="inline-flex items-center cursor-pointer select-none rounded-xl px-2 py-1 bg-green-200 text-green-700 border border-green-300 shadow glass hover:scale-105 duration-100"
      >
        <Check className="w-4 h-4 mr-1" /> <b>Cavallotti</b>
      </span>
    ) : (
      <span
        onClick={onClick}
        className="inline-flex items-center cursor-pointer select-none rounded-xl px-2 py-1 bg-gray-200 text-gray-500 border border-gray-300 shadow glass hover:scale-105 duration-100"
      >
        <X className="w-4 h-4 mr-1" /> <b>No</b>
      </span>
    );
  }

  /* ---------------------------------- JSX ---------------------------------- */
  return (
    <div className="w-full max-w-[1280px] mx-auto px-3 pt-6 pb-12 font-sans">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {selezionati.length > 0 && (
        <div className="sticky top-2 z-40 flex flex-wrap items-center gap-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-6 py-3 mb-4 border morph-glass animate-fade-in">
          <span className="text-lg font-bold text-cyan-800 flex items-center gap-2">
            <Check className="w-5 h-5 text-cyan-600" />
            <span className="animate-badge-pop">{selezionati.length}</span> selezionat{selezionati.length === 1 ? "o" : "i"}
          </span>
          <div className="flex gap-2 flex-wrap">
            <span className="font-semibold text-gray-600 mr-2">Azioni massive:</span>
            {STATI_PRODUZIONE.map((st) => (
              <button
                key={st}
                className="px-4 py-2 rounded-xl font-bold shadow text-sm bg-gradient-to-tr from-blue-300 to-cyan-400 border border-blue-400 text-blue-800 hover:from-blue-400 hover:to-cyan-500 transition"
                onClick={() => azioneMassiva(st)}
                disabled={loadingPatch}
              >
                <ChevronDown className="w-4 h-4 inline-block mr-1" /> Segna come {TITOLO_DA_PRODURRE[st]}
              </button>
            ))}
            <button
              className="px-4 py-2 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-400 shadow text-sm ml-2"
              onClick={() => setSelezionati([])}
              disabled={loadingPatch}
            >
              <Trash className="w-4 h-4 inline-block mr-1" /> Deseleziona tutto
            </button>
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
              <Trash className="w-4 h-4 inline-block mr-1" /> Rimuovi da produzione
            </button>
          )}
          {loadingPatch && <Loader2 className="w-5 h-5 ml-4 animate-spin text-cyan-600" />}
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md rounded-2xl shadow px-5 py-4 mb-5 flex flex-wrap gap-3 items-end glass morph">
        <div className="relative" ref={statiBoxRef}>
          <label className="block text-xs font-semibold mb-1">Stato Produzione</label>
          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition focus:outline-none ${
              statiOpen ? "border-cyan-500 ring-2 ring-cyan-100" : "border-gray-300"
            }`}
            onClick={() => setStatiOpen(!statiOpen)}
            style={{ minWidth: 160 }}
          >
            {TITOLO_DA_PRODURRE[statoProduzione || ""] || "Inseriti"} <ChevronDown size={16} />
          </button>
          {statiOpen && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto animate-fade-in" style={{ minWidth: 180 }}>
              <div
                className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${
                  !statoProduzione ? "bg-cyan-100 text-cyan-900" : "text-cyan-700"
                }`}
                onClick={() => {
                  setStatoProduzione("");
                  setStatiOpen(false);
                }}
              >
                Inseriti <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs">{badgeTuttiStati}</span>
              </div>
              {STATI_PRODUZIONE.map((st) => (
                <div
                  key={st}
                  className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${
                    statoProduzione === st ? "bg-cyan-200 text-cyan-900" : "text-cyan-700"
                  }`}
                  onClick={() => {
                    setStatoProduzione(st);
                    setStatiOpen(false);
                  }}
                >
                  {TITOLO_DA_PRODURRE[st]} {" "}
                  <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs animate-badge-pop">
                    {badgeStatoCounts.find((x) => x.stato === st)?.count || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Canale</label>
          <select
            className="px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition focus:outline-none border-gray-300"
            value={canale}
            onChange={(e) => setCanale(e.target.value as Canale | "")}
            style={{ minWidth: 180 }}
          >
            <option value="">Tutti</option>
            <option value="Amazon Vendor">Amazon Vendor</option>
            <option value="Sito">Sito</option>
            <option value="Amazon Seller">Amazon Seller</option>
          </select>
        </div>

        <div className="relative" ref={radiciBoxRef}>
          <label className="block text-xs font-semibold mb-1">Radice</label>
          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition focus:outline-none ${
              radiciOpen ? "border-cyan-500 ring-2 ring-cyan-100" : "border-gray-300"
            }`}
            onClick={() => setRadiciOpen(!radiciOpen)}
            style={{ minWidth: 120 }}
          >
            {radice || "Tutte"} <ChevronDown size={16} />
          </button>
          {radiciOpen && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto animate-fade-in" style={{ minWidth: 140 }}>
              <div
                className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${
                  radice === "" ? "bg-cyan-100 text-cyan-900" : "text-cyan-700"
                }`}
                onClick={() => {
                  setRadice("");
                  setRadiciOpen(false);
                }}
              >
                Tutte {" "}
                <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs">{badgeTutteRadici}</span>
              </div>
              {badgeRadiceCounts.map(({ radice: r, count }) => (
                <div
                  key={r}
                  className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${
                    radice === r ? "bg-cyan-200 text-cyan-900" : "text-cyan-700"
                  }`}
                  onClick={() => {
                    setRadice(r);
                    setRadiciOpen(false);
                  }}
                >
                  {r} {" "}
                  <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs animate-badge-pop">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1">Cerca SKU/EAN</label>
          <input
            type="text"
            className="input input-bordered rounded-xl font-medium w-full px-4 py-2 glass"
            placeholder='Esempi: "2p;" per SKU che finiscono con -2P • "805...;" per EAN esatto'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className="ml-auto px-4 py-2 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow"
          onClick={() => setManualOpen(true)}
        >
          + Inserisci manuale
        </button>
      </div>

      <div ref={scrollTopRef} className="w-full overflow-x-auto h-0" />
      <div
        ref={scrollTableRef}
        className="rounded-2xl shadow-xl border bg-white/85 glass morph px-2 sm:px-4 py-2 mb-10 overflow-x-auto"
        style={{
          background: "linear-gradient(135deg, rgba(244,245,250,0.87) 60%,rgba(224,241,250,0.85) 100%)",
          boxShadow: "0 8px 32px 0 rgba(31,38,135,.16), 0 1.5px 4px #d2e3f8",
        }}
      >
        <table className="w-full min-w-[1300px] text-[16px] sm:text-[18px]">
          <thead className="bg-white/70 backdrop-blur sticky top-0 z-10">
            <tr className="border-b border-gray-200 text-slate-700">
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={selezioneTotale} onChange={(e) => setSelezionati(e.target.checked ? allVisibleIds : [])} />
              </th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Canale</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-center">
                {TITOLO_DA_PRODURRE[statoProduzione || ""] || "Inseriti"}
              </th>
              <th className="px-3 py-2 text-center">Stato</th>
              <th className="px-3 py-2 text-center">Nota</th>
              <th className="px-3 py-2 text-center">Cavallotti</th>
              <th className="px-3 py-2 text-left">EAN</th>
              <th className="px-3 py-2 text-left">Radice</th>
              <th className="px-3 py-2 text-center">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {righeDaMostrare.map((r, idx) => {
              const prev = idx > 0 ? righeDaMostrare[idx - 1] : null;
              const isGroupStart = !prev || !sameSku(prev?.sku, r.sku);
              const rowBg = rowBgByCanale(r.canale);
              return (
                <tr
                  key={r.id}
                  className={`${rowBg} ${isGroupStart ? "border-t-2 border-slate-200" : ""} transition-colors duration-150 hover:brightness-95`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selezionati.includes(r.id)}
                      onChange={(e) =>
                        setSelezionati((s) => (e.target.checked ? [...s, r.id] : s.filter((id) => id !== r.id)))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-bold">{r.sku}</td>
                  <td className="px-3 py-2">{badgeCanale(r.canale)}</td>
                  <td className="px-3 py-2 text-center font-bold text-base text-blue-800 relative">
                    <div className="flex flex-col items-center">
                      <span style={{ fontSize: "1.6em", lineHeight: 1 }}>
                        {(() => {
                          if (r.stato_produzione === "Da Stampare") {
                            const qty = r.qty ?? 0,
                              riscontro = r.riscontro ?? 0,
                              plus = r.plus ?? 0;
                            const lavorati = allRows
                              .filter(
                                (x) =>
                                  x.sku === r.sku &&
                                  x.ean === r.ean &&
                                  x.start_delivery === r.start_delivery &&
                                  x.stato_produzione !== "Da Stampare" &&
                                  x.stato_produzione !== "Rimossi" &&
                                  x.canale === r.canale
                              )
                              .reduce((sum, x) => sum + (x.da_produrre || 0), 0);
                            return Math.max(qty - riscontro - lavorati, 0) + plus;
                          }
                          return r.da_produrre;
                        })()}
                      </span>
                      {r.modificata_manualmente && (
                        <span
                          className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-900 rounded-full text-xs font-bold border border-yellow-300 animate-badge-pop whitespace-nowrap"
                          title="Questa quantità è stata modificata manualmente"
                          style={{ fontSize: "0.93em" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                            <path
                              d="M5 17h12M12 3l5 5m0 0l-8.5 8.5a2.828 2.828 0 01-4 0v0a2.828 2.828 0 010-4L17 8z"
                              stroke="#b68900"
                              strokeWidth="1.7"
                            />
                          </svg>
                          Modifica manuale
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center align-middle font-bold text-base text-blue-800">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500 font-medium italic">
                        {(() => {
                          const allOfThis = allRows.filter(
                            (rr) =>
                              rr.sku === r.sku &&
                              rr.ean === r.ean &&
                              rr.start_delivery === r.start_delivery &&
                              rr.canale === r.canale
                          );
                          const statoOrder: StatoProduzione[] = ["Stampato", "Calandrato", "Cucito", "Confezionato", "Trasferito"];
                          const statoLabel: Record<StatoProduzione, string> = {
                            "Da Stampare": "Da Stampare",
                            Stampato: "Stampati",
                            Calandrato: "Calandrati",
                            Cucito: "Cuciti",
                            Confezionato: "Confezionati",
                            Trasferito: "Trasferiti",
                            Rimossi: "Rimossi",
                          };
                          const parti: JSX.Element[] = [];
                          statoOrder.forEach((st) => {
                            const sum = allOfThis
                              .filter((x) => x.stato_produzione === st)
                              .reduce((tot, x) => tot + (x.da_produrre || 0), 0);
                            if (sum > 0) {
                              if (parti.length > 0) parti.push(<span key={`sep-${st}`}> + </span>);
                              parti.push(
                                <span key={st}>
                                  {sum} {statoLabel[st]}
                                </span>
                              );
                            }
                          });
                          const dsRow = allOfThis.find((x) => x.stato_produzione === "Da Stampare");
                          const ds = dsRow?.da_produrre ?? 0;
                          const plus = dsRow?.plus ?? 0;
                          const dsEff = plus > 0 ? ds - plus : ds;
                          if (dsEff > 0) {
                            if (parti.length > 0) parti.push(<span key="sep-ds"> + </span>);
                            parti.push(
                              <span key="ds" className="text-blue-900 font-bold">
                                {dsEff} Da Stampare
                              </span>
                            );
                          }
                          if (plus > 0) {
                            if (parti.length > 0) parti.push(<span key="sep-plus"> + </span>);
                            parti.push(
                              <span key="plusval" className="text-cyan-700 font-bold">
                                {plus} da plus
                              </span>
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
                            onBlur={(e) => {
                              const v = Number.isFinite(parseInt(e.target.value, 10)) ? parseInt(e.target.value, 10) : 0;
                              if (v !== r.da_produrre) patchProduzione(r.id, { da_produrre: v });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                            }}
                          />
                        ) : (
                          <>
                            <button
                              title="Modifica quantità (richiede password)"
                              className="relative p-1 rounded-full glass hover:bg-blue-100 transition"
                              onClick={() =>
                                setModaleDaProdurre({
                                  id: r.id,
                                  value: r.da_produrre,
                                  stato: r.stato_produzione,
                                  qty: r.qty,
                                  plus: r.plus ?? 0,
                                  riscontro: r.riscontro ?? 0,
                                })
                              }
                            >
                              <Edit className="w-5 h-5 text-cyan-600" />
                              <span className="absolute -top-1.5 -right-1.5 text-[12px]">
                                <Lock className="w-4 h-4 text-cyan-600" />
                              </span>
                            </button>
                            <button
                              title="Sposta parte dei pezzi a un altro stato"
                              className="p-1 rounded-full glass hover:bg-emerald-100 transition"
                              onClick={() =>
                                setModaleMove({
                                  id: r.id,
                                  sku: r.sku,
                                  ean: r.ean,
                                  canale: r.canale,
                                  start_delivery: r.start_delivery,
                                  fromState: r.stato_produzione,
                                  toState: "Trasferito",
                                  maxQty: r.da_produrre,
                                  qty: Math.max(1, Math.min(r.da_produrre, 1)),
                                })
                              }
                            >
                              <MoveRight className="w-5 h-5 text-emerald-600" />
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
                  <td className="px-3 py-2 text-center">{badgeNota(r)}</td>
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
                      onClick={() => openMovimentiLog(r.id, r.sku)}
                    >
                      <Info size={19} className="text-blue-700" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {righeDaMostrare.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center text-gray-400 py-6 text-lg">
                  Nessun articolo in produzione trovato.
                </td>
              </tr>
            )}
            {!ciSonoFiltri && rows.length > itemsToShow && (
              <tr>
                <td colSpan={11} className="text-center py-5">
                  <button
                    onClick={() => setItemsToShow((x) => x + 20)}
                    className="px-6 py-2 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-800 shadow"
                  >
                    Carica altri
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modaleDaProdurre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
          <div className="bg-white/90 rounded-2xl p-6 shadow-xl border max-w-xs w-full morph-glass relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setModaleDaProdurre(null)}
              aria-label="Chiudi"
            >
              ×
            </button>
            <div className="mb-2 text-xl font-bold text-blue-900">Modifica quantità</div>
            <div className="text-xs text-gray-500 mb-4">
              Quantità richiesta dal prelievo: <b>{modaleDaProdurre.qty}</b>
              {modaleDaProdurre.plus && modaleDaProdurre.plus > 0 && (
                <span className="ml-2 text-cyan-800 font-semibold">+ {modaleDaProdurre.plus} da plus</span>
              )}
            </div>
            <div className="mb-3">
              <label className="block text-xs mb-1 font-semibold">Nuovo valore</label>
              <input
                type="number"
                min={0}
                value={modaleDaProdurre.value}
                onChange={(e) =>
                  setModaleDaProdurre({
                    ...modaleDaProdurre,
                    value: Number.isFinite(parseInt(e.target.value, 10)) ? parseInt(e.target.value, 10) : 0,
                  })
                }
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
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>
            {passwordError && <div className="text-red-600 mb-2">{passwordError}</div>}
            <div className="flex gap-2 mt-4 justify-between">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                onClick={() => setModaleDaProdurre(null)}
              >
                Annulla
              </button>
              <button
                className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-800 shadow flex items-center gap-2"
                onClick={handleModaleDaProdurreSave}
                disabled={!passwordInput || loadingPatch}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {statoProduzioneOpenId !== null && (() => {
        const row = rows.find((r) => r.id === statoProduzioneOpenId);
        if (!row) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border flex flex-col w-full max-w-xs animate-fade-in relative">
              <button
                className="absolute top-2 right-3 text-neutral-400 hover:text-black text-2xl"
                onClick={() => setStatoProduzioneOpenId(null)}
              >
                ×
              </button>
              <div className="font-bold text-lg mb-3 text-gray-900 text-center">Cambia stato produzione</div>
              <div className="flex flex-col gap-2 my-1">
                {STATI_PRODUZIONE.map((stato) => (
                  <button
                    key={stato}
                    className={`w-full flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
                      row.stato_produzione === stato
                        ? "bg-cyan-200 text-cyan-900 border border-cyan-400 shadow"
                        : "bg-white hover:bg-cyan-50 text-cyan-700 border border-gray-200"
                    }`}
                    onClick={() => {
                      setModaleMove({
                        id: row.id,
                        sku: row.sku,
                        ean: row.ean,
                        canale: row.canale,
                        start_delivery: row.start_delivery,
                        fromState: row.stato_produzione,
                        toState: stato,
                        maxQty: row.da_produrre,
                        qty: row.da_produrre,
                      });
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

      {modaleMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border w-full max-w-sm animate-fade-in relative">
            <button
              className="absolute top-2 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setModaleMove(null)}
            >
              ×
            </button>
            <div className="font-bold text-lg mb-2 text-blue-900">Sposta quantità</div>
            <div className="text-xs text-gray-500 mb-3">
              {modaleMove.sku} • {badgeCanale(modaleMove.canale)} • {modaleMove.start_delivery}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Da</label>
                <div className="font-bold">{modaleMove.fromState}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">A</label>
                <select
                  className="w-full border rounded-xl px-3 py-2 font-bold"
                  value={modaleMove.toState}
                  onChange={(e) => setModaleMove({ ...modaleMove, toState: e.target.value as StatoProduzione })}
                >
                  {STATI_PRODUZIONE.filter((s) => s !== "Rimossi").map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-2">
              <label className="block text-xs font-semibold mb-1">Pezzi da spostare (max {modaleMove.maxQty})</label>
              <input
                type="number"
                min={1}
                max={modaleMove.maxQty}
                value={modaleMove.qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setModaleMove({
                    ...modaleMove,
                    qty: Number.isFinite(v) ? Math.max(1, Math.min(v, modaleMove.maxQty)) : 1,
                  });
                }}
                className="w-full border rounded-xl px-3 py-2 font-bold text-blue-800"
              />
            </div>
            <div className="flex justify-between mt-4">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                onClick={() => setModaleMove(null)}
              >
                Annulla
              </button>
              <button
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow flex items-center gap-2"
                onClick={async () => {
                  await moveQtyToState(
                    {
                      id: modaleMove.id,
                      sku: modaleMove.sku,
                      ean: modaleMove.ean,
                      qty: 0,
                      plus: 0,
                      riscontro: 0,
                      radice: "",
                      start_delivery: modaleMove.start_delivery,
                      stato: "",
                      stato_produzione: modaleMove.fromState,
                      da_produrre: modaleMove.maxQty,
                      cavallotti: false,
                      canale: modaleMove.canale,
                    } as ProduzioneRow,
                    modaleMove.toState,
                    modaleMove.qty
                  );
                  setModaleMove(null);
                }}
              >
                <MoveRight className="w-4 h-4" /> Sposta
              </button>
            </div>
          </div>
        </div>
      )}

      {modaleNota && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xs relative">
            <button
              className="absolute top-2 right-2 text-2xl text-gray-400 hover:text-black"
              onClick={() => setModaleNota(null)}
            >
              ×
            </button>
            <div className="font-bold text-lg mb-3">Nota produzione</div>
            <textarea
              className="w-full border rounded-xl p-2 mb-3"
              rows={4}
              placeholder="Scrivi una nota..."
              value={modaleNota.nota}
              onChange={(e) => setModaleNota({ ...modaleNota, nota: e.target.value })}
            />
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-blue-800"
              onClick={async () => {
                await patchProduzione(modaleNota.id, { note: modaleNota.nota });
                setModaleNota(null);
              }}
            >
              Salva
            </button>
          </div>
        </div>
      )}

      {logMovimentiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-4xl animate-fade-in relative p-0 overflow-hidden">
            <div className="px-6 py-4 border-b bg-gradient-to-br from-slate-50 to-white flex items-center justify-between">
              <div className="text-xl font-extrabold text-slate-900 tracking-tight">
                Flusso movimenti · <span className="font-mono font-black">{logMovimentiOpen.sku || "—"}</span>
              </div>
              <button
                className="text-2xl text-slate-400 hover:text-slate-700"
                onClick={() => setLogMovimentiOpen(null)}
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 bg-slate-50/60">
              {(() => {
                const graph = logMovimentiOpen.graph;
                if (!graph || graph.edges.length === 0) {
                  return <div className="text-center text-slate-500 py-10">Nessun movimento registrato.</div>;
                }
                const width = 980;
                const height = 280;
                const paddingX = 60;
                const nodeRadius = 22;
                const step = (width - paddingX * 2) / (FLOW_STATES.length - 1);
                const nodeY = 120;
                const positions = new Map<StatoProduzione, { x: number; y: number }>();
                FLOW_STATES.forEach((st, i) => positions.set(st, { x: paddingX + i * step, y: nodeY }));
                const edgeStroke = (from: StatoProduzione, to: StatoProduzione): { dasharray?: string } => {
                  const iFrom = FLOW_STATES.indexOf(from);
                  const iTo = FLOW_STATES.indexOf(to);
                  return iTo < iFrom ? { dasharray: "6,6" } : {};
                };
                const edgeColor = (from: StatoProduzione, to: StatoProduzione): string => {
                  const iFrom = FLOW_STATES.indexOf(from);
                  const iTo = FLOW_STATES.indexOf(to);
                  return iTo < iFrom ? "#b45309" : "#0e7490";
                };
                const labelFor = (from: StatoProduzione, to: StatoProduzione, qty: number): string => {
                  const iFrom = FLOW_STATES.indexOf(from);
                  const iTo = FLOW_STATES.indexOf(to);
                  const suffix = iTo < iFrom ? "rientrati" : "spostati";
                  return `${qty} ${suffix}`;
                };
                return (
                  <svg
                    width="100%"
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    role="img"
                    aria-label="Mappa flusso movimenti"
                  >
                    {graph.edges.map(({ from, to, qty }, idx) => {
                      const p1 = positions.get(from)!;
                      const p2 = positions.get(to)!;
                      const dx = Math.abs(p2.x - p1.x);
                      const dir = p2.x >= p1.x ? 1 : -1;
                      const curvature = Math.min(80, 24 + dx * 0.2);
                      const c1x = p1.x + dir * curvature;
                      const c1y = p1.y - 40;
                      const c2x = p2.x - dir * curvature;
                      const c2y = p2.y - 40;
                      const pathD = `M ${p1.x} ${p1.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
                      const midX = (p1.x + p2.x) / 2;
                      const midY = Math.min(p1.y, p2.y) - 48;
                      const strokeProps = edgeStroke(from, to);
                      const color = edgeColor(from, to);
                      return (
                        <g key={`${from}-${to}-${idx}`}> 
                          <path d={pathD} fill="none" stroke={color} strokeWidth={3} {...strokeProps} />
                          <polygon
                            points={`${p2.x},${p2.y} ${p2.x - 8 * (dir === 1 ? 1 : -1)},${p2.y - 6} ${p2.x - 8 * (dir === 1 ? 1 : -1)},${p2.y + 6}`}
                            fill={color}
                          />
                          <rect
                            x={midX - 36}
                            y={midY - 14}
                            width="72"
                            height="24"
                            rx="8"
                            fill="white"
                            stroke={color}
                            strokeWidth={1.2}
                          />
                          <text
                            x={midX}
                            y={midY + 3}
                            fontSize="12"
                            fill={color}
                            textAnchor="middle"
                            fontWeight={700}
                          >
                            {labelFor(from, to, qty)}
                          </text>
                        </g>
                      );
                    })}
                    {FLOW_STATES.map((st) => {
                      const p = positions.get(st)!;
                      return (
                        <g key={st}>
                          <circle cx={p.x} cy={p.y} r={nodeRadius} fill="white" stroke="#64748b" strokeWidth="1.5" />
                          <text x={p.x} y={p.y + 4} fontSize="11" fill="#0f172a" textAnchor="middle" fontWeight={700}>
                            {st === "Da Stampare" ? "DS" : st[0]}
                          </text>
                          <text x={p.x} y={p.y + 40} fontSize="12" fill="#334155" textAnchor="middle">
                            {st}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
            <div className="px-6 pb-5">
              <div className="text-sm font-semibold text-slate-700 mb-2">Dettaglio eventi (compresso)</div>
              <div className="grid gap-2 max-h-[32vh] overflow-y-auto pr-1">
                {logMovimentiOpen.data.map((log, i) => {
                  const when = log.created_at ? new Date(log.created_at) : null;
                  const dataStr = when ? when.toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "—";
                  const qta = delta(log.qty_vecchia, log.qty_nuova, "pezzi");
                  const pls = delta(log.plus_vecchio, log.plus_nuovo, "plus");
                  const isSpost = (log.motivo ?? "").toLowerCase().startsWith("spostamento a");
                  const moved = movedPieces(log);
                  const tag = isSpost && moved !== null && moved !== 0 ? (moved > 0 ? `${moved} spostati` : `${-moved} rientrati`) : null;
                  return (
                    <div
                      key={`${log.id ?? ""}-${i}`}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{dataStr}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            isSpost ? "bg-sky-50 text-sky-800 border-sky-200" : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          {log.motivo}
                        </span>
                        {(log.canale ?? log.canale_label) && (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {log.canale ?? log.canale_label}
                          </span>
                        )}
                        {tag && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            {tag}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-600">
                          Stato: <b>{log.stato_vecchio || "—"}</b> → <b>{log.stato_nuovo || "—"}</b>
                        </span>
                        <span className="text-xs text-slate-600">
                          Qty: <b>{qta}</b>
                        </span>
                        <span className="text-xs text-slate-600">
                          Plus: <b>{pls}</b>
                        </span>
                        <span className="text-xs text-slate-500">
                          Utente: <b>{log.utente || "Sistema"}</b>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            >
              ×
            </button>
            <div className="mb-4 font-bold text-lg text-blue-800">Stampa Cavallotto</div>
            <div className="mb-4">Scegli il formato</div>
            <div className="flex flex-col gap-2 mb-3">
              {["A5", "A4", "A3"].map((formato) => (
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
            >
              ×
            </button>
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

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border w-full max-w-md animate-fade-in relative">
            <button
              className="absolute top-2 right-3 text-neutral-400 hover:text-black text-2xl"
              onClick={() => setManualOpen(false)}
            >
              ×
            </button>
            <div className="font-bold text-lg mb-4 text-blue-900">Inserimento manuale in produzione</div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Canale *</label>
                <select
                  className="w-full border rounded-xl px-3 py-2"
                  value={manualForm.canale}
                  onChange={(e) => setManualForm((f) => ({ ...f, canale: e.target.value as "Amazon Seller" | "Sito" | "" }))}
                >
                  <option value="">Seleziona…</option>
                  <option value="Amazon Seller">Amazon Seller</option>
                  <option value="Sito">Sito</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Cerca prodotto (SKU/EAN)</label>
                <input
                  className="w-full border rounded-xl px-3 py-2"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder='Es. "2p;" per ultimo token esatto su SKU'
                />
                {loadingSug && <div className="text-xs text-gray-500 mt-1">Caricamento…</div>}
                {suggestions.length > 0 && (
                  <div className="mt-1 border rounded-xl bg-white shadow max-h-56 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <div
                        key={`${s.id}-${i}`}
                        className="px-3 py-2 hover:bg-cyan-50 cursor-pointer flex items-center gap-3"
                        onClick={() => {
                          setManualForm((f) => ({ ...f, sku: s.sku || "", ean: s.ean || "" }));
                          setProductQuery(s.sku || s.ean || "");
                          setSuggestions([]);
                        }}
                      >
                        {s.image_url ? (
                          <img src={s.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-100" />
                        )}
                        <div className="flex-1">
                          <div className="font-mono font-bold">{s.sku || "—"}</div>
                          <div className="text-xs text-gray-600">
                            {s.ean ? `EAN: ${s.ean} • ` : ""}
                            {s.product_title || s.variant_title || ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">SKU *</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2"
                    value={manualForm.sku}
                    onChange={(e) => setManualForm((f) => ({ ...f, sku: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">EAN</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2"
                    value={manualForm.ean}
                    onChange={(e) => setManualForm((f) => ({ ...f, ean: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Qty *</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded-xl px-3 py-2"
                    value={manualForm.qty}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, qty: e.target.value === "" ? "" : Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Plus</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border rounded-xl px-3 py-2"
                    value={manualForm.plus}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, plus: e.target.value === "" ? "" : Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
              {manualForm.canale === "Sito" && manualForm.sku.trim() && (
                <div className="rounded-xl border px-3 py-2 bg-green-50 text-green-900 text-sm">
                  {loadingSiteSummary ? (
                    <span>Verifica ordini Sito in corso…</span>
                  ) : siteSummary ? (
                    <span>
                      Ordini Sito per <b>{manualForm.sku}</b>: <b>{siteSummary.orders_count}</b> ordini – totale <b>{siteSummary.total_qty}</b>
                      pezzi
                    </span>
                  ) : (
                    <span>Nessun ordine Sito aperto per questo SKU.</span>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1">Nota</label>
                <input
                  className="w-full border rounded-xl px-3 py-2"
                  value={manualForm.note}
                  onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="cavallotti"
                  type="checkbox"
                  checked={manualForm.cavallotti}
                  onChange={(e) => setManualForm((f) => ({ ...f, cavallotti: e.target.checked }))}
                />
                <label htmlFor="cavallotti" className="text-sm">
                  Cavallotti
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-between">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                onClick={() => setManualOpen(false)}
              >
                Annulla
              </button>
              <button
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow"
                onClick={submitManuale}
              >
                Inserisci
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .morph-glass {
          backdrop-filter: blur(12px) saturate(120%);
          background: linear-gradient(120deg, rgba(240,248,255,0.92) 60%,rgba(216,241,250,0.95) 100%);
          box-shadow: 0 8px 24px 0 rgba(31, 38, 135, 0.14), 0 1.5px 4px #d2e3f8;
        }
        .glass {
          backdrop-filter: blur(8px) saturate(130%);
        }
        .morph {
          box-shadow: 0 8px 24px 0 rgba(180,210,255,0.12);
        }
        @keyframes fade-in {
          0% {
            opacity: 0;
            transform: translateY(-8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s;
        }
        @keyframes badge-pop {
          0% {
            transform: scale(0.6);
            opacity: 0.7;
          }
          70% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-badge-pop {
          animation: badge-pop 0.4s;
        }
        @keyframes bounce-badge {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        .animate-bounce-badge {
          animation: bounce-badge 1.3s infinite;
        }
        @keyframes badge-state {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-badge-state {
          animation: badge-state 0.3s;
        }
      `}</style>
    </div>
  );
}
