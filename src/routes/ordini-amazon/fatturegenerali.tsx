import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/button";
import { FileText, Download, Plus, Save, CheckCircle2, RefreshCcw, X } from "lucide-react";

const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "";

type StatoFattura = "BOZZA" | "XML_GENERATO" | "INVIATO_MANUALE" | "ANNULLATO";
type TipoDocumento = "TD01" | "TD04" | "TD02" | "TD03" | "TD05" | "TD06";

type PrezzoMode = "NET" | "GROSS"; // NET=IVA esclusa, GROSS=IVA inclusa

type ClienteSede = {
  indirizzo: string;
  numero_civico?: string | null;
  cap: string;
  comune: string;
  provincia?: string | null;
  nazione: string;
};

type ClienteSnapshot = {
  denominazione: string;
  piva?: string | null;
  cf?: string | null;
  codice_destinatario?: string | null;
  pec?: string | null;
  sede: ClienteSede;
};

type RigaInput = {
  descrizione: string;
  quantita: number;
  prezzo_input: number; // quello che digiti (NET o GROSS a seconda di prezzo_mode)
  prezzo_mode: PrezzoMode;
  sconto_percent?: number | null;
  aliquota_iva: number;
  natura?: string | null;
};

type RigaDB = {
  id: number;
  fattura_id: number;
  n_linea: number;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number; // NETTO su DB
  sconto_percent: number | null;
  aliquota_iva: number;
  natura: string | null;
  totale_riga: number; // NETTO
};

type FatturaGenerale = {
  id: number;
  created_at: string;
  updated_at: string;
  source: string;
  stato: StatoFattura;
  tipo_documento: TipoDocumento;
  data_documento: string; // YYYY-MM-DD
  year: number;
  seq: number;
  numero: number;
  progressivo_invio: string;
  causale: string | null;
  tot_imponibile: number | string;
  tot_iva: number | string;
  tot_documento: number | string;
  cliente_snapshot: ClienteSnapshot | string;
  xml_path: string | null;
  p7m_path: string | null;
};

type FiltersState = {
  filterYear: string;
  filterMonth: string;
  filterDay: string;
  filterStato: string;
  search: string;
  sortBy: "data" | "totale";
  sortDir: "asc" | "desc";
};

function toITDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseClienteSnapshot(v: ClienteSnapshot | string | null | undefined): ClienteSnapshot {
  if (!v) return emptyCliente();
  if (typeof v === "object") return v as ClienteSnapshot;
  const s = String(v).trim();
  if (!s) return emptyCliente();
  try {
    const parsed = JSON.parse(s) as unknown;
    if (parsed && typeof parsed === "object") return parsed as ClienteSnapshot;
    return emptyCliente();
  } catch {
    return emptyCliente();
  }
}

function emptyCliente(): ClienteSnapshot {
  return {
    denominazione: "",
    piva: "",
    cf: "",
    codice_destinatario: "",
    pec: "",
    sede: {
      indirizzo: "",
      numero_civico: "",
      cap: "",
      comune: "",
      provincia: "",
      nazione: "IT",
    },
  };
}

function emptyRiga(): RigaInput {
  return {
    descrizione: "",
    quantita: 1,
    prezzo_input: 0,
    prezzo_mode: "GROSS", // default IVA inclusa (puoi cambiarlo a NET se preferisci)
    sconto_percent: null,
    aliquota_iva: 22,
    natura: null,
  };
}

function loadSavedFilters(): FiltersState {
  try {
    const raw = localStorage.getItem("fatture-generali-filtri");
    if (!raw) {
      return {
        filterYear: "",
        filterMonth: "",
        filterDay: "",
        filterStato: "",
        search: "",
        sortBy: "data",
        sortDir: "desc",
      };
    }
    const parsed = JSON.parse(raw) as Partial<FiltersState>;
    return {
      filterYear: parsed.filterYear ?? "",
      filterMonth: parsed.filterMonth ?? "",
      filterDay: parsed.filterDay ?? "",
      filterStato: parsed.filterStato ?? "",
      search: parsed.search ?? "",
      sortBy: parsed.sortBy ?? "data",
      sortDir: parsed.sortDir ?? "desc",
    };
  } catch {
    return {
      filterYear: "",
      filterMonth: "",
      filterDay: "",
      filterStato: "",
      search: "",
      sortBy: "data",
      sortDir: "desc",
    };
  }
}

export default function FattureGeneraliPage() {
  // ---- filters
  const saved = useMemo(loadSavedFilters, []);
  const [filterYear, setFilterYear] = useState<string>(saved.filterYear);
  const [filterMonth, setFilterMonth] = useState<string>(saved.filterMonth);
  const [filterDay, setFilterDay] = useState<string>(saved.filterDay);
  const [filterStato, setFilterStato] = useState<string>(saved.filterStato);
  const [search, setSearch] = useState<string>(saved.search);
  const [sortBy, setSortBy] = useState<"data" | "totale">(saved.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(saved.sortDir);

  useEffect(() => {
    const data: FiltersState = { filterYear, filterMonth, filterDay, filterStato, search, sortBy, sortDir };
    localStorage.setItem("fatture-generali-filtri", JSON.stringify(data));
  }, [filterYear, filterMonth, filterDay, filterStato, search, sortBy, sortDir]);

  // ---- editor state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("TD01");
  const [dataDocumento, setDataDocumento] = useState<string>(todayISO());
  const [causale, setCausale] = useState<string>("");

  const [cliente, setCliente] = useState<ClienteSnapshot>(emptyCliente());
  const [righe, setRighe] = useState<RigaInput[]>([emptyRiga()]);

  const [stato, setStato] = useState<StatoFattura>("BOZZA");
  const [numero, setNumero] = useState<number | null>(null);
  const [xmlPath, setXmlPath] = useState<string | null>(null);

  const canEdit = stato === "BOZZA";

  // ---- list query
  const {
    data: fatture = [],
    isLoading: loadingList,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["fatture-generali-list"],
    queryFn: async (): Promise<FatturaGenerale[]> => {
      const res = await axios.get(`${API_BASE_URL}/api/fatture_generali/list`);
      return res.data as FatturaGenerale[];
    },
  });

  // ---- dettaglio (via Supabase)
  const loadDettaglio = async (id: number): Promise<{ fattura: FatturaGenerale; righe: RigaDB[] }> => {
    const { data: f, error: e1 } = await supabase.from("fatture_generali").select("*").eq("id", id).single();
    if (e1) throw e1;
    if (!f) throw new Error("Fattura non trovata");

    const { data: righeDb, error: e2 } = await supabase
      .from("fatture_generali_righe")
      .select("*")
      .eq("fattura_id", id)
      .order("n_linea", { ascending: true });
    if (e2) throw e2;

    return { fattura: f as FatturaGenerale, righe: (righeDb || []) as RigaDB[] };
  };

  // ---- date sets for filters
  const tutteLeDateUniche = useMemo(() => {
    const set = new Set<string>();
    for (const f of fatture) set.add(f.data_documento);
    return Array.from(set).sort().reverse();
  }, [fatture]);

  const anniDisponibili = useMemo(() => {
    return Array.from(new Set(tutteLeDateUniche.map((d) => d.substring(0, 4)))).sort().reverse();
  }, [tutteLeDateUniche]);

  const mesiDisponibili = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const anno of anniDisponibili) {
      out[anno] = Array.from(
        new Set(tutteLeDateUniche.filter((d) => d.startsWith(anno)).map((d) => d.substring(5, 7)))
      ).sort();
    }
    return out;
  }, [anniDisponibili, tutteLeDateUniche]);

  const giorniDisponibili = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const anno of anniDisponibili) {
      for (const mese of mesiDisponibili[anno] || []) {
        const key = `${anno}-${mese}`;
        out[key] = Array.from(new Set(tutteLeDateUniche.filter((d) => d.startsWith(key)))).sort().reverse();
      }
    }
    return out;
  }, [anniDisponibili, mesiDisponibili, tutteLeDateUniche]);

  const fattureFiltrate = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filtered = fatture.filter((f) => {
      const okStato = !filterStato || f.stato === filterStato;
      const okYear = !filterYear || f.data_documento.startsWith(filterYear);
      const okMonth = !filterMonth || f.data_documento.substring(5, 7) === filterMonth;
      const okDay = !filterDay || f.data_documento === filterDay;

      const cs = parseClienteSnapshot(f.cliente_snapshot);
      const clienteDen = (cs.denominazione || "").toLowerCase();
      const numeroStr = String(f.numero || "");

      const okSearch =
        !s ||
        numeroStr.includes(s) ||
        clienteDen.includes(s) ||
        (f.tipo_documento || "").toLowerCase().includes(s) ||
        (f.causale || "").toLowerCase().includes(s);

      return okStato && okYear && okMonth && okDay && okSearch;
    });

    filtered.sort((a, b) => {
      if (sortBy === "data") {
        const cmp = a.data_documento.localeCompare(b.data_documento);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const ta = Number(a.tot_documento || 0);
      const tb = Number(b.tot_documento || 0);
      const cmp = ta - tb;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [fatture, filterDay, filterMonth, filterStato, filterYear, search, sortBy, sortDir]);

  // ---- righe computed: prezzo_input può essere NET o GROSS
  const righeComputed = useMemo(() => {
    return righe.map((r) => {
      const qta = clampNum(Number(r.quantita || 0), 0, 999999);
      const input = clampNum(Number(r.prezzo_input || 0), 0, 999999999);
      const sconto = r.sconto_percent == null ? null : clampNum(Number(r.sconto_percent), 0, 100);
      const aliq = clampNum(Number(r.aliquota_iva || 0), 0, 100);

      // sconto sull’input (quello che stai inserendo)
      let unitAfterDiscount = input;
      if (sconto != null) unitAfterDiscount = unitAfterDiscount * (1 - sconto / 100);

      // converto a NETTO solo se input è LORDO
      const divisore = (r.prezzo_mode === "GROSS" && aliq > 0) ? (1 + aliq / 100) : 1;
      const puNetto = unitAfterDiscount / divisore;

      const totaleNetto = round2(qta * puNetto);
      const ivaRiga = aliq > 0 ? round2(totaleNetto * (aliq / 100)) : 0;
      const totaleLordo = round2(totaleNetto + ivaRiga);

      return {
        ...r,
        quantita: qta,
        prezzo_input: input,
        prezzo_unitario_netto: round2(puNetto),
        totale_riga_netto: totaleNetto,
        iva_riga: ivaRiga,
        totale_riga_lordo: totaleLordo,
      };
    });
  }, [righe]);

  const previewTotali = useMemo(() => {
    const imponibile = round2(righeComputed.reduce((sum, r) => sum + r.totale_riga_netto, 0));
    const iva = round2(righeComputed.reduce((sum, r) => sum + r.iva_riga, 0));
    const totale = round2(imponibile + iva);
    return { imponibile, iva, totale };
  }, [righeComputed]);

  const resetForm = () => {
    setSelectedId(null);
    setTipoDocumento("TD01");
    setDataDocumento(todayISO());
    setCausale("");
    setCliente(emptyCliente());
    setRighe([emptyRiga()]);
    setStato("BOZZA");
    setNumero(null);
    setXmlPath(null);
  };

  // righe da inviare: evito righe completamente vuote (ma se vuoi salvarle lo stesso, togli il filter)
  const buildRighePayload = () => {
    return righeComputed
      .filter((r) => (r.descrizione || "").trim() !== "")
      .map((r) => ({
        descrizione: r.descrizione,
        quantita: r.quantita,
        prezzo_unitario: r.prezzo_unitario_netto, // ✅ NETTO al backend
        sconto_percent: null, // sconto già applicato lato UI (eviti doppia applicazione)
        aliquota_iva: r.aliquota_iva,
        natura: r.natura,
      }));
  };

  const validateForXml = (): string[] => {
    const errors: string[] = [];

    if (!cliente.denominazione.trim()) errors.push("Cliente: denominazione mancante");
    const piva = (cliente.piva || "").trim();
    const cf = (cliente.cf || "").trim();
    if (!piva && !cf) errors.push("Cliente: P.IVA o CF mancante");

    const sede = cliente.sede;
    if (!sede.indirizzo.trim()) errors.push("Cliente: indirizzo mancante");
    if (!sede.cap.trim()) errors.push("Cliente: CAP mancante");
    if (!sede.comune.trim()) errors.push("Cliente: comune mancante");
    if (!sede.nazione.trim()) errors.push("Cliente: nazione mancante");

    const cd = (cliente.codice_destinatario || "").trim();
    const pec = (cliente.pec || "").trim();
    if (!cd && !pec) errors.push("Cliente: Codice Destinatario o PEC mancante");

    const payload = buildRighePayload();
    if (payload.length === 0) errors.push("Inserisci almeno una riga (con descrizione)");

    righeComputed.forEach((r, idx) => {
      if (r.aliquota_iva === 0 && !(r.natura || "").trim()) {
        errors.push(`Riga ${idx + 1}: Natura obbligatoria con IVA 0%`);
      }
    });

    return errors;
  };

  const createBozza = async () => {
    try {
      const toastId = toast.loading("Creazione bozza...");

      const res = await axios.post(`${API_BASE_URL}/api/fatture_generali/create`, {
        tipo_documento: tipoDocumento,
        data_documento: dataDocumento,
        causale: causale || null,
        cliente_snapshot: cliente,
        righe: buildRighePayload(), // ✅ così le righe NON spariscono
      });

      const created = res.data as { id: number; numero: number; progressivo_invio: string; stato: StatoFattura };

      toast.dismiss(toastId);
      toast.success(`Bozza creata: ${created.numero}`);

      setSelectedId(created.id);
      setNumero(created.numero);
      setStato(created.stato);

      await refetchList();
    } catch {
      toast.error("Errore creazione bozza");
    }
  };

  const salva = async () => {
    if (!selectedId) {
      toast.error("Crea prima la bozza");
      return;
    }
    try {
      const toastId = toast.loading("Salvataggio...");

      await axios.put(`${API_BASE_URL}/api/fatture_generali/${selectedId}`, {
        cliente_snapshot: cliente,
        causale: causale || null,
        righe: buildRighePayload(),
      });

      toast.dismiss(toastId);
      toast.success("Salvato ✓");
      await refetchList();
    } catch {
      toast.error("Errore salvataggio");
    }
  };

  const generaXml = async () => {
    if (!selectedId) {
      toast.error("Crea prima la bozza");
      return;
    }

    const errors = validateForXml();
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }

    try {
      const toastId = toast.loading("Generazione XML...");
      await salva();

      const res = await axios.post(`${API_BASE_URL}/api/fatture_generali/${selectedId}/generate`, {});
      const out = res.data as { ok: boolean; xml_path: string };

      toast.dismiss(toastId);
      toast.success("XML generato ✓");
      setStato("XML_GENERATO");
      setXmlPath(out.xml_path);

      await refetchList();
    } catch {
      toast.error("Errore generazione XML");
    }
  };

  const scaricaXml = () => {
    if (!selectedId) return;
    window.open(`${API_BASE_URL}/api/fatture_generali/download/${selectedId}`, "_blank", "noopener,noreferrer");
  };

  const segnaInviato = async () => {
    if (!selectedId) return;
    try {
      const toastId = toast.loading("Aggiornamento stato...");
      await axios.post(`${API_BASE_URL}/api/fatture_generali/${selectedId}/mark-sent`, {});
      toast.dismiss(toastId);
      toast.success("Segnata come INVIATO_MANUALE ✓");
      setStato("INVIATO_MANUALE");
      await refetchList();
    } catch {
      toast.error("Errore aggiornamento stato");
    }
  };

  const apriDaLista = async (id: number) => {
    try {
      const toastId = toast.loading("Apertura fattura...");
      const detail = await loadDettaglio(id);
      toast.dismiss(toastId);

      setSelectedId(detail.fattura.id);
      setNumero(detail.fattura.numero);
      setStato(detail.fattura.stato);
      setTipoDocumento(detail.fattura.tipo_documento);
      setDataDocumento(detail.fattura.data_documento);
      setCausale(detail.fattura.causale || "");
      setCliente(parseClienteSnapshot(detail.fattura.cliente_snapshot));
      setXmlPath(detail.fattura.xml_path);

      // dal DB abbiamo solo NETTO => in UI impostiamo mode NET e input=netto
      const mapped: RigaInput[] =
        detail.righe.length > 0
          ? detail.righe.map((r) => ({
              descrizione: r.descrizione,
              quantita: Number(r.quantita),
              prezzo_input: Number(r.prezzo_unitario), // netto
              prezzo_mode: "NET",
              sconto_percent: null,
              aliquota_iva: Number(r.aliquota_iva || 0),
              natura: r.natura,
            }))
          : [emptyRiga()];

      setRighe(mapped);
    } catch {
      toast.error("Errore apertura fattura (RLS?)");
    }
  };

  const addRiga = () => setRighe((prev) => [...prev, emptyRiga()]);
  const delRiga = (idx: number) => setRighe((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  return (
    <div className="w-full max-w-5xl mx-auto px-2 pb-24 font-sans">
      <Toaster />

      <div className="flex items-center gap-2 mb-6">
        <FileText className="text-blue-600" size={28} />
        <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight">Fatture Generali (Manuali)</h2>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select className="border rounded-lg p-2 text-sm" value={filterStato} onChange={(e) => setFilterStato(e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="BOZZA">BOZZA</option>
          <option value="XML_GENERATO">XML_GENERATO</option>
          <option value="INVIATO_MANUALE">INVIATO_MANUALE</option>
          <option value="ANNULLATO">ANNULLATO</option>
        </select>

        <select
          className="border rounded-lg p-2 text-sm"
          value={filterYear}
          onChange={(e) => {
            setFilterYear(e.target.value);
            setFilterMonth("");
            setFilterDay("");
          }}
        >
          <option value="">Tutti gli anni</option>
          {anniDisponibili.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {filterYear && (
          <select
            className="border rounded-lg p-2 text-sm"
            value={filterMonth}
            onChange={(e) => {
              setFilterMonth(e.target.value);
              setFilterDay("");
            }}
          >
            <option value="">Tutti i mesi</option>
            {(mesiDisponibili[filterYear] || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}

        {filterYear && filterMonth && (
          <select className="border rounded-lg p-2 text-sm" value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
            <option value="">Tutti i giorni</option>
            {(giorniDisponibili[`${filterYear}-${filterMonth}`] || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          className="border rounded-lg p-2 text-sm w-full sm:w-auto"
          placeholder="Cerca numero / cliente / causale…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex items-center gap-2 text-xs ml-auto flex-wrap">
          <span className="font-semibold text-gray-700">Ordina:</span>
          <button
            className={`px-2 py-1 rounded ${sortBy === "data" ? "bg-blue-200 font-bold" : "bg-gray-100"}`}
            onClick={() => setSortBy("data")}
          >
            Data
          </button>
          <button
            className={`px-2 py-1 rounded ${sortBy === "totale" ? "bg-blue-200 font-bold" : "bg-gray-100"}`}
            onClick={() => setSortBy("totale")}
          >
            Totale
          </button>
          <button className="px-2 py-1 rounded bg-gray-200" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
            ⇅
          </button>

          <Button className="bg-blue-700 text-white hover:bg-blue-900 px-4" onClick={() => refetchList()}>
            <RefreshCcw className="inline mr-1" size={16} /> Aggiorna
          </Button>
          <Button className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 px-4" onClick={resetForm}>
            <X className="inline mr-1" size={16} /> Nuova
          </Button>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LISTA */}
        <div className="bg-white rounded-2xl shadow border p-4">
          <h3 className="text-lg font-bold mb-3 text-blue-800">Fatture</h3>

          {loadingList ? (
            <div className="text-center text-blue-700 py-6 font-semibold">Caricamento…</div>
          ) : fattureFiltrate.length === 0 ? (
            <div className="text-neutral-400 text-sm">Nessuna fattura trovata.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-[15px]">
                <thead>
                  <tr>
                    <th className="py-3 px-3 text-center">Numero</th>
                    <th className="py-3 px-3 text-center">Data</th>
                    <th className="py-3 px-3 text-center">Cliente</th>
                    <th className="py-3 px-3 text-center">Totale</th>
                    <th className="py-3 px-3 text-center">Stato</th>
                    <th className="py-3 px-3 text-center">Apri</th>
                  </tr>
                </thead>
                <tbody>
                  {fattureFiltrate.map((f, idx) => {
                    const cs = parseClienteSnapshot(f.cliente_snapshot);
                    return (
                      <tr key={f.id} className={`border-b ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                        <td className="px-3 py-3 font-bold text-center">{f.numero}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">{toITDate(f.data_documento)}</td>
                        <td className="px-3 py-3">{cs.denominazione || "-"}</td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          € {Number(f.tot_documento || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-center">{f.stato}</td>
                        <td className="px-3 py-3 text-center">
                          <Button className="bg-blue-700 text-white hover:bg-blue-900" onClick={() => void apriDaLista(f.id)}>
                            Apri
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* EDITOR */}
        <div className="bg-white rounded-2xl shadow border p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-bold text-blue-800">Editor fattura</h3>
              <div className="text-sm text-gray-700">
                Stato: <b>{stato}</b>{" "}
                {numero != null ? (
                  <>
                    — Numero: <b>{numero}</b>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {!selectedId ? (
                <Button className="bg-blue-700 text-white hover:bg-blue-900" onClick={() => void createBozza()}>
                  <Plus className="inline mr-1" size={16} /> Crea bozza
                </Button>
              ) : (
                <>
                  <Button className="bg-blue-700 text-white hover:bg-blue-900" disabled={!canEdit} onClick={() => void salva()}>
                    <Save className="inline mr-1" size={16} /> Salva
                  </Button>
                  <Button className="bg-emerald-700 text-white hover:bg-emerald-900" disabled={!canEdit} onClick={() => void generaXml()}>
                    <CheckCircle2 className="inline mr-1" size={16} /> Genera XML
                  </Button>
                  <Button className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-50" disabled={stato === "BOZZA"} onClick={scaricaXml}>
                    <Download className="inline mr-1" size={16} /> Scarica
                  </Button>
                  <Button className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-50" disabled={stato !== "XML_GENERATO"} onClick={() => void segnaInviato()}>
                    Segna inviato
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Dati documento */}
          <div className="border rounded-xl p-3 mb-3">
            <div className="font-bold text-blue-900 mb-2">Dati documento</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Tipo documento</span>
                <select className="border rounded-lg p-2 text-sm" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)} disabled={!!selectedId && !canEdit}>
                  <option value="TD01">TD01 - Fattura</option>
                  <option value="TD04">TD04 - Nota credito</option>
                  <option value="TD02">TD02</option>
                  <option value="TD03">TD03</option>
                  <option value="TD05">TD05</option>
                  <option value="TD06">TD06</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Data documento</span>
                <input className="border rounded-lg p-2 text-sm" type="date" value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} disabled={!!selectedId && !canEdit} />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Causale (opzionale)</span>
                <input className="border rounded-lg p-2 text-sm" value={causale} onChange={(e) => setCausale(e.target.value)} disabled={!!selectedId && !canEdit} placeholder="Riferimento / descrizione..." />
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="border rounded-xl p-3 mb-3">
            <div className="font-bold text-blue-900 mb-2">Cliente</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Denominazione</span>
                <input className="border rounded-lg p-2 text-sm" value={cliente.denominazione} onChange={(e) => setCliente((c) => ({ ...c, denominazione: e.target.value }))} disabled={!!selectedId && !canEdit} />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">P.IVA</span>
                <input className="border rounded-lg p-2 text-sm" value={cliente.piva || ""} onChange={(e) => setCliente((c) => ({ ...c, piva: e.target.value }))} disabled={!!selectedId && !canEdit} />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Codice Fiscale</span>
                <input className="border rounded-lg p-2 text-sm" value={cliente.cf || ""} onChange={(e) => setCliente((c) => ({ ...c, cf: e.target.value }))} disabled={!!selectedId && !canEdit} />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Codice destinatario (7) / PEC</span>
                <div className="grid grid-cols-2 gap-2">
                  <input className="border rounded-lg p-2 text-sm" value={cliente.codice_destinatario || ""} onChange={(e) => setCliente((c) => ({ ...c, codice_destinatario: e.target.value }))} disabled={!!selectedId && !canEdit} placeholder="0000000 / XXXXXXX" />
                  <input className="border rounded-lg p-2 text-sm" value={cliente.pec || ""} onChange={(e) => setCliente((c) => ({ ...c, pec: e.target.value }))} disabled={!!selectedId && !canEdit} placeholder="pec@..." />
                </div>
              </div>
            </div>

            <div className="mt-3 font-semibold text-gray-800">Sede</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <input className="border rounded-lg p-2 text-sm" value={cliente.sede.indirizzo} onChange={(e) => setCliente((c) => ({ ...c, sede: { ...c.sede, indirizzo: e.target.value } }))} disabled={!!selectedId && !canEdit} placeholder="Indirizzo" />
              <input className="border rounded-lg p-2 text-sm" value={cliente.sede.numero_civico || ""} onChange={(e) => setCliente((c) => ({ ...c, sede: { ...c.sede, numero_civico: e.target.value } }))} disabled={!!selectedId && !canEdit} placeholder="Numero civico" />
              <input className="border rounded-lg p-2 text-sm" value={cliente.sede.cap} onChange={(e) => setCliente((c) => ({ ...c, sede: { ...c.sede, cap: e.target.value } }))} disabled={!!selectedId && !canEdit} placeholder="CAP" />
              <input className="border rounded-lg p-2 text-sm" value={cliente.sede.comune} onChange={(e) => setCliente((c) => ({ ...c, sede: { ...c.sede, comune: e.target.value } }))} disabled={!!selectedId && !canEdit} placeholder="Comune" />
              <input className="border rounded-lg p-2 text-sm" value={cliente.sede.provincia || ""} onChange={(e) => setCliente((c) => ({ ...c, sede: { ...c.sede, provincia: e.target.value } }))} disabled={!!selectedId && !canEdit} placeholder="Provincia" />
              <input className="border rounded-lg p-2 text-sm" value={cliente.sede.nazione} onChange={(e) => setCliente((c) => ({ ...c, sede: { ...c.sede, nazione: e.target.value } }))} disabled={!!selectedId && !canEdit} placeholder="Nazione" />
            </div>
          </div>

          {/* Righe */}
          <div className="border rounded-xl p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-bold text-blue-900">Righe</div>
              <Button className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-50" disabled={!!selectedId && !canEdit} onClick={addRiga}>
                <Plus className="inline mr-1" size={16} /> Riga
              </Button>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full min-w-[1100px] text-[14px]">
                <thead>
                  <tr>
                    <th className="py-2 px-2 text-left">Descrizione</th>
                    <th className="py-2 px-2 text-center">Q.tà</th>
                    <th className="py-2 px-2 text-center">Tipo prezzo</th>
                    <th className="py-2 px-2 text-center">Prezzo</th>
                    <th className="py-2 px-2 text-center">Sconto%</th>
                    <th className="py-2 px-2 text-center">IVA%</th>
                    <th className="py-2 px-2 text-center">Natura (se 0)</th>
                    <th className="py-2 px-2 text-center">Netto unit.</th>
                    <th className="py-2 px-2 text-center">Tot. netto</th>
                    <th className="py-2 px-2 text-center">Tot. lordo</th>
                    <th className="py-2 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {righeComputed.map((r, idx) => (
                    <tr key={idx} className={`border-b ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                      <td className="px-2 py-2">
                        <input
                          className="border rounded-lg p-2 text-sm w-full"
                          value={r.descrizione}
                          onChange={(e) => setRighe((prev) => prev.map((x, i) => (i === idx ? { ...x, descrizione: e.target.value } : x)))}
                          disabled={!!selectedId && !canEdit}
                        />
                      </td>

                      <td className="px-2 py-2 text-center">
                        <input
                          className="border rounded-lg p-2 text-sm w-24 text-right"
                          type="number"
                          value={r.quantita}
                          onChange={(e) => setRighe((prev) => prev.map((x, i) => (i === idx ? { ...x, quantita: Number(e.target.value) } : x)))}
                          disabled={!!selectedId && !canEdit}
                        />
                      </td>

                      <td className="px-2 py-2 text-center">
                        <select
                          className="border rounded-lg p-2 text-sm w-36"
                          value={r.prezzo_mode}
                          onChange={(e) =>
                            setRighe((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, prezzo_mode: e.target.value as PrezzoMode } : x))
                            )
                          }
                          disabled={!!selectedId && !canEdit}
                        >
                          <option value="GROSS">LORDO (IVA incl.)</option>
                          <option value="NET">NETTO (IVA escl.)</option>
                        </select>
                      </td>

                      <td className="px-2 py-2 text-center">
                        <input
                          className="border rounded-lg p-2 text-sm w-28 text-right"
                          type="number"
                          value={r.prezzo_input}
                          onChange={(e) => setRighe((prev) => prev.map((x, i) => (i === idx ? { ...x, prezzo_input: Number(e.target.value) } : x)))}
                          disabled={!!selectedId && !canEdit}
                        />
                      </td>

                      <td className="px-2 py-2 text-center">
                        <input
                          className="border rounded-lg p-2 text-sm w-24 text-right"
                          type="number"
                          value={r.sconto_percent ?? ""}
                          onChange={(e) =>
                            setRighe((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, sconto_percent: e.target.value === "" ? null : Number(e.target.value) } : x
                              )
                            )
                          }
                          disabled={!!selectedId && !canEdit}
                        />
                      </td>

                      <td className="px-2 py-2 text-center">
                        <select
                          className="border rounded-lg p-2 text-sm w-24"
                          value={r.aliquota_iva}
                          onChange={(e) => setRighe((prev) => prev.map((x, i) => (i === idx ? { ...x, aliquota_iva: Number(e.target.value) } : x)))}
                          disabled={!!selectedId && !canEdit}
                        >
                          <option value={22}>22</option>
                          <option value={10}>10</option>
                          <option value={4}>4</option>
                          <option value={0}>0</option>
                        </select>
                      </td>

                      <td className="px-2 py-2 text-center">
                        <input
                          className="border rounded-lg p-2 text-sm w-28"
                          value={r.natura || ""}
                          onChange={(e) => setRighe((prev) => prev.map((x, i) => (i === idx ? { ...x, natura: e.target.value } : x)))}
                          disabled={!!selectedId && !canEdit ? true : r.aliquota_iva !== 0}
                          placeholder={r.aliquota_iva === 0 ? "Es. N2.2" : ""}
                        />
                      </td>

                      <td className="px-2 py-2 text-center whitespace-nowrap text-xs text-gray-700">{r.prezzo_unitario_netto.toFixed(4)}</td>

                      <td className="px-2 py-2 text-center whitespace-nowrap font-semibold">
                        € {r.totale_riga_netto.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="px-2 py-2 text-center whitespace-nowrap text-gray-700">
                        € {r.totale_riga_lordo.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="px-2 py-2 text-center">
                        <Button className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-50" disabled={!!selectedId && !canEdit} onClick={() => delRiga(idx)}>
                          X
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totali */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border rounded-xl p-3">
                <div className="text-xs text-gray-600">Imponibile (senza IVA)</div>
                <div className="text-xl font-bold">€ {previewTotali.imponibile.toFixed(2)}</div>
              </div>
              <div className="border rounded-xl p-3">
                <div className="text-xs text-gray-600">IVA</div>
                <div className="text-xl font-bold">€ {previewTotali.iva.toFixed(2)}</div>
              </div>
              <div className="border rounded-xl p-3">
                <div className="text-xs text-gray-600">Totale documento</div>
                <div className="text-xl font-bold">€ {previewTotali.totale.toFixed(2)}</div>
              </div>
            </div>

            {xmlPath && (
              <div className="mt-3 text-xs text-gray-700">
                XML salvato: <span className="font-mono">{xmlPath}</span>
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-600">
            Nota: l’XML/FatturaPA vuole prezzi <b>NETTI</b>. Qui puoi inserire NETTO o LORDO, ma il sistema salva sempre l’imponibile corretto.
          </div>
        </div>
      </div>
    </div>
  );
}
