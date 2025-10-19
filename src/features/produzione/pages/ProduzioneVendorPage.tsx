import { useMemo, useState, useEffect, useDeferredValue, useTransition } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useProduzioneData,
  STATI_PRODUZIONE,
  TITOLO_DA_PRODURRE,
  StatoProduzione,
  ProduzioneRow,
  buildPdfPlaceholder,
} from "@/features/produzione";
import SelectionBar from "../components/SelectionBar";
import FiltersBar from "../components/FiltersBar/FiltersBar";
import { ProduzioneTable } from "../components/Table/ProduzioneTable";
import { confirmToast } from "@/components/ui/confirmToast";
import { FLOW_STATES } from "@/features/produzione";

// Modals
import NotaModal from "../components/Modals/NotaModal";
import DaProdurreModal from "../components/Modals/DaProdurreModal";
import MoveQtyModal from "../components/Modals/MoveQtyModal";
import CavallottoModal from "../components/Modals/CavallottoModal";
import ExportMassivoModal from "../components/Modals/ExportMassivoModal";
import LogMovimentiModal from "../components/Modals/LogMovimentiModal/LogMovimentiModal";


  const STATO_ORDER: Record<string, number> = (() => {
    const order = [...FLOW_STATES, "Rimossi"]; // ordine forte: Da Stampare → ... → Deposito → Rimossi
    const map: Record<string, number> = {};
    order.forEach((s, i) => { map[s] = i; });
    return map;
  })();



type ManualPayload = {
  canale: "Amazon Seller" | "Sito";
  sku: string;
  ean?: string;
  qty: number;
  note?: string;
  plus?: number;
  cavallotti?: boolean;
};

export default function ProduzioneVendorPage() {
  /* URL filters */
  const [sp, setSp] = useSearchParams();
  const stato = sp.get("stato") ?? "";
  const radice = sp.get("radice") ?? "";
  const searchUrl = sp.get("q") ?? "";
  const canale = sp.get("canale") ?? "";

  // stato locale della ricerca (fluido, NON URL)
  const [searchLocal, setSearchLocal] = useState<string>(searchUrl);

  // differisci la query per evitare ricalcoli mentre si digita
  const deferredSearch = useDeferredValue(searchLocal);
  const [isPending, startTransition] = useTransition();

  // se cambia l'URL (es. back/forward), riallinea il campo
  useEffect(() => {
    setSearchLocal(searchUrl);
  }, [searchUrl]);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    if (!v) next.delete(k);
    else next.set(k, v);
    setSp(next, { replace: true });
  };
  const setParamString = (k: string) => (v: string) => setParam(k, v);

  /* Data: usa la ricerca differita per aggiornare i dati */
  const { rows, allRows, badge, isLoading, api, sameSku } = useProduzioneData({
    stato,
    radice,
    search: deferredSearch,
    canale,
  });


const sortedRows = useMemo(() => {
  const byCanale = (c?: string | null) => (c || "").toUpperCase();
  return [...rows].sort((a, b) => {
    const sa = a.sku.toUpperCase(), sb = b.sku.toUpperCase();
    const dSku = sa.localeCompare(sb, "it", { sensitivity: "base" });
    if (dSku !== 0) return dSku;

    const dCan = byCanale(a.canale).localeCompare(byCanale(b.canale), "it", { sensitivity: "base" });
    if (dCan !== 0) return dCan;

    const ia = STATO_ORDER[a.stato_produzione] ?? 999;
    const ib = STATO_ORDER[b.stato_produzione] ?? 999;
    return ia - ib;
  });
}, [rows]);



  // defera anche le righe per non far ricalcolare la tabella mentre si digita
  const deferredRows = useDeferredValue(sortedRows);

  // --- PAGINAZIONE (10 righe di default, disattivata se i filtri sono attivi) ---
  const [itemsToShow, setItemsToShow] = useState<number>(10);

  // attivo se qualsiasi filtro o la search locale ha un valore
  const filtersActive = !!(
    (stato && stato.trim()) ||
    (radice && radice.trim()) ||
    (canale && canale.trim()) ||
    (searchLocal && searchLocal.trim())
  );

  /* Selection */
  const [selected, setSelected] = useState<number[]>([]);

  // Reset paginazione e selezione quando cambiano i filtri/url
  useEffect(() => {
    setItemsToShow(10);
    setSelected([]);
  }, [stato, radice, canale, searchUrl]);

  // Righe visibili: se filtri attivi → tutte; altrimenti paginazione
  const visibleRows = useMemo(
    () => (filtersActive ? deferredRows : deferredRows.slice(0, itemsToShow)),
    [deferredRows, itemsToShow, filtersActive]
  );

  const allVisibleIds = useMemo<number[]>(() => visibleRows.map((r) => r.id), [visibleRows]);
  const selezioneTotale = selected.length > 0 && selected.length === allVisibleIds.length;
  const toggleSelectOne = (id: number, on: boolean) =>
    setSelected((s) => (on ? Array.from(new Set([...s, id])) : s.filter((x) => x !== id)));
  const toggleSelectAll = (on: boolean) => setSelected(on ? allVisibleIds : []);

  /* Export */
  const [exportOpen, setExportOpen] = useState<boolean>(false);
  const selectedRows = useMemo<ProduzioneRow[]>(
    () => sortedRows.filter((r) => selected.includes(r.id)),
    [sortedRows, selected]
  );
  async function handleExport(orderBy: "az" | "misura") {
    if (selectedRows.length === 0) return;
    await buildPdfPlaceholder(selectedRows, orderBy);
  }

  /* Busy per bulk */
  const [bulkBusy, setBulkBusy] = useState(false);

  /* Carica a magazzino (Supabase RPC) + rimozione righe caricate */
  async function handleBulkCaricaMagazzino() {
    if (selected.length === 0) return;

    const ok = await confirmToast({
      title: "Carica a magazzino",
      message: `Stai per caricare in magazzino ${selected.length} righe selezionate.`,
      from: "Produzione",
      to: "Magazzino",
      confirmLabel: "Carica e rimuovi",
      cancelLabel: "Annulla",
    });
    if (!ok) return;

    setBulkBusy(true);
    try {
      // mappa id -> riga
      const byId = new Map<number, ProduzioneRow>();
      sortedRows.forEach((r) => byId.set(r.id, r));

      // payload per backend: qty = da_produrre
      const items = selected
        .map((id) => byId.get(id))
        .filter((r): r is ProduzioneRow => Boolean(r))
        .map((r) => ({
          id: r.id,
          sku: r.sku,
          ean: r.ean ?? null,
          canale: r.canale ?? "Amazon Vendor",
          qty: Math.max(0, r.da_produrre || 0),
        }))
        .filter((it) => it.qty > 0);

      if (items.length === 0) {
        setSelected([]);
        return;
      }

      // carico su Supabase (RPC lato backend)
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/magazzino/carica-da-produzione`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!(resp.ok || resp.status === 207)) {
        // esito parziale/errore: non rimuovo righe
        console.error("Carica magazzino KO:", resp.statusText);
        return;
      }

      // rimuovi dalla produzione le righe caricate (solo quelle con qty>0)
      const movedIds = new Set(items.map((it) => it.id));
      const toDelete = selected.filter((id) => movedIds.has(id));
      if (toDelete.length > 0) {
        await api.bulkDelete(toDelete);
      }

      // pulizia selezione
      setSelected([]);
    } finally {
      setBulkBusy(false);
    }
  }

  /* Nota */
  const [notaState, setNotaState] = useState<{ open: boolean; id: number | null; value: string }>(
    { open: false, id: null, value: "" }
  );
  const openNota = (row: ProduzioneRow) =>
    setNotaState({ open: true, id: row.id, value: row.note ?? "" });
  const closeNota = () => setNotaState((s) => ({ ...s, open: false }));
  async function saveNota() {
    if (!notaState.id) return;
    await api.patchProduzione({ id: notaState.id, body: { note: notaState.value } });
    setNotaState({ open: false, id: null, value: "" });
  }

  /* Da produrre */
  const [dpState, setDpState] = useState<{
    open: boolean;
    id: number | null;
    value: number;
    stato: StatoProduzione | "";
    qtyPrelievo: number;
    plus: number;
    requirePassword: boolean;
    password: string;
    error?: string;
    loading?: boolean;
  }>({
    open: false,
    id: null,
    value: 0,
    stato: "",
    qtyPrelievo: 0,
    plus: 0,
    requirePassword: true,
    password: "",
  });

  function openDaProdurre(row: ProduzioneRow) {
    const requirePassword = row.stato_produzione !== "Da Stampare";
    setDpState({
      open: true,
      id: row.id,
      value: row.da_produrre,
      stato: row.stato_produzione,
      qtyPrelievo: row.qty,
      plus: row.plus ?? 0,
      requirePassword,
      password: "",
    });
  }
  const closeDaProdurre = () =>
    setDpState((s) => ({ ...s, open: false, password: "", error: undefined }));

  async function saveDaProdurre() {
    if (!dpState.id) return;
    setDpState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      await api.patchProduzione({
        id: dpState.id,
        body: {
          da_produrre: dpState.value,
          ...(dpState.requirePassword ? { password: dpState.password } : {}),
        },
      });
      setDpState((s) => ({ ...s, open: false, loading: false, password: "" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore";
      setDpState((s) => ({ ...s, error: msg, loading: false }));
    }
  }

  /* Move qty / Cambia stato */
  const [moveState, setMoveState] = useState<{
    open: boolean;
    row: ProduzioneRow | null;
    toState: StatoProduzione;
    qty: number;
  }>({ open: false, row: null, toState: "Trasferito", qty: 1 });

  const closeMove = () => setMoveState({ open: false, row: null, toState: "Trasferito", qty: 1 });
  async function confirmMove(row: ProduzioneRow, to: StatoProduzione, qty: number) {
    await api.moveQtyToState(row, to, qty);
    closeMove();
  }

  /* Cavallotto */
  const [cavState, setCavState] = useState<{ open: boolean; sku: string | null; loading?: boolean }>(
    { open: false, sku: null }
  );
  const openCavallotto = (skuParam: string) => setCavState({ open: true, sku: skuParam });
  const closeCavallotto = () => setCavState({ open: false, sku: null });
  function openCavPdf(skuParam: string, formato: string) {
    const url = api.cavallottoPdfUrl(skuParam, formato);
    window.open(url, "_blank");
    closeCavallotto();
  }

  /* Logs */
  const [logState, setLogState] = useState<{
    open: boolean;
    produzioneId: number | null;
    sku?: string;
    canale?: string | null;
    canaliDisponibili?: string[];
    selectedCanale?: string | null;
    data: ReturnType<typeof import("@/features/produzione").dedupeLogs>;
    graph: ReturnType<typeof import("@/features/produzione").buildFlowGraph> | null;
  }>({ open: false, produzioneId: null, data: [], graph: null });

  async function openLogs(produzioneId: number) {
    const prod = await api.getProduzione(produzioneId);
    const skuMeta = prod?.sku;
    const canaleMeta = prod?.canale ?? null;
    const canali = Array.from(
      new Set(allRows.filter((r) => r.sku === skuMeta).map((r) => r.canale ?? "—"))
    );

    setLogState({
      open: true,
      produzioneId,
      sku: skuMeta,
      canale: canaleMeta,
      canaliDisponibili: canali,
      selectedCanale: canaleMeta,
      data: [],
      graph: { nodes: [], edges: [] },
    });

    const raw = await api.getLogs(produzioneId);
    const { dedupeLogs, normalizeMotivo, normalizeUtente, buildFlowGraph } = await import(
      "@/features/produzione"
    );
    const norm = raw.map((l) => ({
      ...l,
      motivo: normalizeMotivo(l.motivo),
      utente: normalizeUtente(l.utente),
    }));
    const clean = dedupeLogs(norm);
    const graph = buildFlowGraph(clean, allRows);
    setLogState((s) => ({ ...s, data: clean, graph }));
  }
  const closeLogs = () => setLogState((s) => ({ ...s, open: false }));

  /* Bulk ops con conferma */
  async function handleBulkSetState(st: StatoProduzione) {
    if (selected.length === 0) return;
    const ok = await confirmToast({
      title: "Cambia stato",
      message: `Impostare ${selected.length} righe su “${TITOLO_DA_PRODURRE[st]}”?`,
      confirmLabel: "Conferma",
      cancelLabel: "Annulla",
      from: "Stato corrente",
      to: TITOLO_DA_PRODURRE[st],
    });
    if (!ok) return;

    setSelected([]); // UI più immediata
    await api.bulkSetState(selected, st);
  }

  async function handleBulkDelete() {
    if (selected.length === 0) return;
    const ok = await confirmToast({
      title: "Rimuovi selezionati",
      message: `Rimuovere ${selected.length} righe dalla produzione?`,
      confirmLabel: "Rimuovi",
      cancelLabel: "Annulla",
    });
    if (!ok) return;

    await api.bulkDelete(selected);
    setSelected([]);
  }

  /* Conteggi per canale (locali) */
  const byCanale = useMemo((): { canale: "Amazon Vendor" | "Sito" | "Amazon Seller"; count: number }[] => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const c = (r.canale ?? "Amazon Vendor") as "Amazon Vendor" | "Sito" | "Amazon Seller";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    const canaliList: Array<"Amazon Vendor" | "Sito" | "Amazon Seller"> = [
      "Amazon Vendor",
      "Sito",
      "Amazon Seller",
    ];
    return canaliList.map((c) => ({ canale: c, count: counts.get(c) ?? 0 }));
  }, [rows]);
  const tuttiCanali = useMemo(() => byCanale.reduce((acc, x) => acc + (x.count || 0), 0), [byCanale]);

  return (
    <div className="w-full max-w-6xl mx-auto pb-12">
      <FiltersBar
        stato={stato}
        radice={radice}
        canale={canale}
        searchLocal={searchLocal}
        onSearchChange={(v: string) => startTransition(() => setSearchLocal(v))} // live (transizione)
        onSearchCommit={(v: string) => setParam("q", v)} // Enter/blur/idle → URL
        setStato={setParamString("stato")}
        setRadice={setParamString("radice")}
        setCanale={setParamString("canale")}
        badge={{
          byStato: badge.byStato,
          tutteStati: badge.tutteStati,
          radiciDisponibili: badge.radiciDisponibili,
          byRadice: badge.byRadice,
          tutteRadici: badge.tutteRadici,
          byCanale,
          tuttiCanali,
        }}
        isLoading={isLoading || isPending}
        onManualInsert={async (payload: ManualPayload) => {
          await api.insertManual(payload);
        }}
        onSearchSuggest={api.searchProducts}
        onFetchSiteSummary={api.fetchSiteSummary}
      />

      {selected.length > 0 && (
        <SelectionBar
          count={selected.length}
          states={STATI_PRODUZIONE}
          stateLabels={TITOLO_DA_PRODURRE}
          onClear={() => setSelected([])}
          onBulkSetState={handleBulkSetState}
          onBulkDelete={handleBulkDelete}
          onExportPdf={() => setExportOpen(true)}
          onBulkCaricaMagazzino={handleBulkCaricaMagazzino}
          disabled={bulkBusy}
          currentState= {stato as StatoProduzione}
        />
      )}

      <ProduzioneTable
        rows={visibleRows}
        allRows={allRows}
        sameSku={sameSku}
        selectedIds={selected}
        onToggleSelect={toggleSelectOne}
        onToggleSelectAll={toggleSelectAll}
        selectAllChecked={selezioneTotale}
        onInlineChangeDaStampare={async (id, value) =>
          api.patchProduzione({ id, body: { da_produrre: value } })
        }
        onOpenLogs={async (rowId) => openLogs(rowId)}
        onToggleCavallotti={async (row) =>
          api.patchProduzione({ id: row.id, body: { cavallotti: !row.cavallotti } })
        }
        onOpenCavallottoPdf={(skuParam) => openCavallotto(skuParam)}
        onOpenNota={openNota}
        onOpenDaProdurre={openDaProdurre}
        onOpenChangeState={(row) => {
          setMoveState({
            open: true,
            row,
            toState: "Trasferito",                // destinazione predefinita
            qty: Math.max(0, row.da_produrre || 0) // DEFAULT: MAX
          });
        }}
      />

      {/* Paginazione: visibile SOLO quando i filtri NON sono attivi */}
      {!filtersActive && rows.length > itemsToShow && (
        <div className="w-full flex justify-center mt-3">
          <button
            className="px-4 py-2 rounded-xl font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow"
            onClick={() => setItemsToShow((n) => Math.min(n + 10, rows.length))}
          >
            Mostra altri
          </button>
        </div>
      )}

      {!filtersActive && itemsToShow > 10 && (
        <div className="w-full flex justify-center mt-2">
          <button
            className="px-4 py-2 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300"
            onClick={() => setItemsToShow(10)}
          >
            Mostra meno
          </button>
        </div>
      )}

      <NotaModal
        open={notaState.open}
        value={notaState.value}
        onChange={(v: string) => setNotaState((s) => ({ ...s, value: v }))}
        onClose={closeNota}
        onSave={saveNota}
      />

      <DaProdurreModal
        open={dpState.open}
        qtyPrelievo={dpState.qtyPrelievo}
        plus={dpState.plus}
        value={dpState.value}
        statoCorrente={dpState.stato || "—"}
        requirePassword={dpState.requirePassword}
        password={dpState.password}
        setValue={(v: number) => setDpState((s) => ({ ...s, value: v }))}
        setPassword={(p: string) => setDpState((s) => ({ ...s, password: p }))}
        error={dpState.error}
        loading={dpState.loading}
        onClose={closeDaProdurre}
        onSave={saveDaProdurre}
      />

      <MoveQtyModal
        open={moveState.open}
        row={moveState.row}
        toState={moveState.toState}
        setToState={(s: StatoProduzione) => setMoveState((st) => ({ ...st, toState: s }))}
        qty={moveState.qty}
        setQty={(n: number) => setMoveState((st) => ({ ...st, qty: n }))}
        onClose={closeMove}
        onMove={confirmMove}
        statiDisponibili={STATI_PRODUZIONE.filter((s) => s !== "Rimossi")}
      />

      <CavallottoModal
        open={cavState.open}
        sku={cavState.sku}
        onClose={closeCavallotto}
        onOpenPdf={openCavPdf}
      />

      <ExportMassivoModal
        open={exportOpen}
        selectedRows={selectedRows}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />

      <LogMovimentiModal
        open={logState.open}
        sku={logState.sku}
        canale={logState.canale}
        canaliDisponibili={logState.canaliDisponibili}
        selectedCanale={logState.selectedCanale ?? null}
        setSelectedCanale={(c: string | null) => setLogState((s) => ({ ...s, selectedCanale: c }))}
        data={logState.data}
        graph={logState.graph}
        allRows={allRows}
        onClose={closeLogs}
      />
    </div>
  );
}
