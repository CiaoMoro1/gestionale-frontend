import { useEffect, useRef, useState } from "react";
import type { ProductSuggest, SiteOrdersSummary } from "@/features/produzione";

/* Tipi per submit */
type SubmitPayload = {
  canale: "Amazon Seller" | "Sito";
  sku: string;
  ean?: string;
  qty: number;
  note?: string;
  plus?: number;
  cavallotti?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: SubmitPayload) => Promise<void>;
  onSuggest: (q: string, signal?: AbortSignal) => Promise<unknown>;
  onFetchSiteSummary: (sku: string) => Promise<SiteOrdersSummary | null>;
};

/* Helpers */
function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null;
}
function toStringOrNull(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}
function toNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function unwrapArray(u: unknown): unknown[] {
  if (Array.isArray(u)) return u;
  if (isRecord(u)) {
    const keys = ["data", "results", "items", "rows", "hits", "payload"];
    for (const k of keys) {
      const v = u[k];
      if (Array.isArray(v)) return v as unknown[];
      if (isRecord(v) && Array.isArray(v["items"])) return v["items"] as unknown[];
    }
  }
  return [];
}
function normalizeSuggest(u: unknown): ProductSuggest {
  const r = isRecord(u) ? u : {};
  const id = toStringOrNull(r["id"]) ?? toStringOrNull(r["sku"]) ?? Math.random().toString(36).slice(2);
  return {
    id,
    sku: toStringOrNull(r["sku"]),
    ean: toStringOrNull(r["ean"]),
    variant_title: toStringOrNull(r["variant_title"]),
    product_title: toStringOrNull(r["product_title"]),
    image_url: toStringOrNull(r["image_url"]),
    price: toNumberOrNull(r["price"]),
  };
}
function withTimeout<T>(p: Promise<T>, ms = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

const MAX_SUGGEST = 30;

export default function ManualInsertModal({
  open,
  onClose,
  onSubmit,
  onSuggest,
  onFetchSiteSummary,
}: Props) {
  /* Form */
  const [canale, setCanale] = useState<"" | "Amazon Seller" | "Sito">("");
  const [sku, setSku] = useState("");
  const [ean, setEan] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [plus, setPlus] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [cavallotti, setCavallotti] = useState(false);

  /* Ricerca */
  const [q, setQ] = useState("");
  const [sug, setSug] = useState<ProductSuggest[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [errorSug, setErrorSug] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  /* Site summary */
  const [siteInfo, setSiteInfo] = useState<SiteOrdersSummary | null>(null);
  const [loadingSite, setLoadingSite] = useState(false);

  /* Submit error */
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* Guards + callback stabili + dedupe */
  const reqIdRef = useRef(0);
  const onSuggestRef = useRef(onSuggest);
  useEffect(() => { onSuggestRef.current = onSuggest; }, [onSuggest]);
  const lastQRef = useRef<string>("");

  const siteAbortRef = useRef<AbortController | null>(null);
  const onFetchSiteSummaryRef = useRef(onFetchSiteSummary);
  useEffect(() => { onFetchSiteSummaryRef.current = onFetchSiteSummary; }, [onFetchSiteSummary]);
  const lastSiteSkuRef = useRef<string>("");              // ultimo SKU risolto con successo
  const inflightSiteSkuRef = useRef<string | null>(null); // SKU con fetch in corso

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = "manual-insert-suggest-listbox";

  /* Scroll lock pagina sotto */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  /* Focus & reset on open/close */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ(""); setSug([]); setActiveIndex(-1);
      setErrorSug(null); setSubmitError(null);
      setCanale(""); setSku(""); setEan("");
      setQty(""); setPlus(""); setNote(""); setCavallotti(false);
      setSiteInfo(null); lastQRef.current = "";
      siteAbortRef.current?.abort();
      siteAbortRef.current = null;
      lastSiteSkuRef.current = "";
      inflightSiteSkuRef.current = null;
      setLoadingSite(false);
    }
  }, [open]);

  /* Ricerca suggerimenti (debounce, abort, timeout, dedupe) */
  useEffect(() => {
    if (!open) return;

    const raw = q.trim();
    if (raw.length < 2) {
      setSug([]); setLoadingSug(false); setErrorSug(null); setActiveIndex(-1);
      lastQRef.current = "";
      return;
    }
    const isEan = /^\d{6,}$/.test(raw);
    const norm = isEan ? raw : raw.toUpperCase();
    const effective = !isEan && norm.length <= 3 && !norm.endsWith(";") ? norm + ";" : norm;

    if (effective === lastQRef.current) return;
    lastQRef.current = effective;

    const myReqId = ++reqIdRef.current;
    let cancelled = false;
    const ctrl = new AbortController();
    setLoadingSug(true); setErrorSug(null);

    const t = setTimeout(async () => {
      try {
        const res = await withTimeout(Promise.resolve(onSuggestRef.current(effective, ctrl.signal)), 4000);
        if (cancelled || myReqId !== reqIdRef.current) return;
        const arr = unwrapArray(res).map(normalizeSuggest).slice(0, MAX_SUGGEST);
        setSug(arr);
        setActiveIndex(arr.length ? 0 : -1);
        if (!arr.length) setErrorSug("Nessun risultato.");
      } catch {
        if (cancelled || myReqId !== reqIdRef.current) return;
        setSug([]); setActiveIndex(-1); setErrorSug("Errore durante la ricerca.");
      } finally {
        if (!cancelled && myReqId === reqIdRef.current) setLoadingSug(false);
      }
    }, 220);

    return () => { cancelled = true; ctrl.abort(); clearTimeout(t); setLoadingSug(false); };
  }, [q, open]);

  /* Riepilogo Sito (coordinato, dedupe, abort) */
  useEffect(() => {
    if (!open) return;
    const s = sku.trim();
    if (canale !== "Sito" || !s) {
      siteAbortRef.current?.abort(); siteAbortRef.current = null;
      setSiteInfo(null); lastSiteSkuRef.current = ""; inflightSiteSkuRef.current = null;
      setLoadingSite(false);
      return;
    }
    if (s === lastSiteSkuRef.current || s === inflightSiteSkuRef.current) return;

    siteAbortRef.current?.abort();
    const ctrl = new AbortController();
    siteAbortRef.current = ctrl;
    inflightSiteSkuRef.current = s;
    setLoadingSite(true);

    (async () => {
      try {
        const d = await onFetchSiteSummaryRef.current(s);
        if (ctrl.signal.aborted) return;
        setSiteInfo(d); lastSiteSkuRef.current = s;
      } catch {
        if (ctrl.signal.aborted) return;
        setSiteInfo(null);
      } finally {
        if (!ctrl.signal.aborted) setLoadingSite(false);
        if (inflightSiteSkuRef.current === s) inflightSiteSkuRef.current = null;
      }
    })();

    return () => { ctrl.abort(); };
  }, [canale, sku, open]);

  function acceptSuggestion(s: ProductSuggest) {
    const nextSku = s.sku || "";
    setSku(nextSku);
    setEan(s.ean || "");
    setQ(s.sku || s.ean || "");
    setSug([]); setActiveIndex(-1);

    // fetch immediata sito coordinata con l’effetto
    if (canale === "Sito" && nextSku && nextSku !== lastSiteSkuRef.current) {
      siteAbortRef.current?.abort();
      const ctrl = new AbortController();
      siteAbortRef.current = ctrl;
      inflightSiteSkuRef.current = nextSku;
      setLoadingSite(true);
      (async () => {
        try {
          const d = await onFetchSiteSummaryRef.current(nextSku);
          if (ctrl.signal.aborted) return;
          setSiteInfo(d); lastSiteSkuRef.current = nextSku;
        } catch {
          if (ctrl.signal.aborted) return;
          setSiteInfo(null);
        } finally {
          if (!ctrl.signal.aborted) setLoadingSite(false);
          if (inflightSiteSkuRef.current === nextSku) inflightSiteSkuRef.current = null;
        }
      })();
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    try {
      if (!canale || !sku || !qty) {
        setSubmitError("Compila i campi obbligatori (Canale, SKU, Qty).");
        return;
      }
      await onSubmit({
        canale,
        sku: sku.trim(),
        ean: ean.trim() || undefined,
        qty: Number(qty),
        note: note.trim() || undefined,
        plus: plus === "" ? undefined : Number(plus),
        cavallotti,
      });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore durante l'inserimento.";
      setSubmitError(msg);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* CARD a dimensione fissa con body scrollabile */}
      <div
        className="bg-white rounded-2xl shadow-2xl border w-[92vw] max-w-lg relative max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal
        aria-labelledby="manual-insert-title"
      >
        {/* Close */}
        <button
          className="absolute top-2 right-3 text-2xl text-neutral-400 hover:text-black"
          onClick={onClose}
          type="button"
          aria-label="Chiudi"
        >×</button>

        {/* Header */}
        <div id="manual-insert-title" className="font-bold text-lg px-6 pt-6 text-blue-900">
          Inserimento manuale in produzione
        </div>

        {/* Body scrollabile */}
        <div className="grid gap-3 px-6 py-6 overflow-y-auto flex-1 min-h-0">
          {/* Canale */}
          <div>
            <label className="block text-xs font-semibold mb-1">Canale *</label>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={canale}
              onChange={(e) => setCanale(e.target.value as "Amazon Seller" | "Sito" | "")}
            >
              <option value="">Seleziona…</option>
              <option value="Amazon Seller">Amazon Seller</option>
              <option value="Sito">Sito</option>
            </select>
          </div>

          {/* Ricerca prodotti */}
          <div className="relative">
            <label className="block text-xs font-semibold mb-1">Cerca prodotto (SKU/EAN)</label>
            <input
              ref={inputRef}
              className="w-full border rounded-xl px-3 py-2"
              value={q}
              onChange={(e) => { setQ(e.target.value); setErrorSug(null); }}
              onKeyDown={(e) => {
                if (!sug.length) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => (i + 1) % sug.length); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => (i - 1 + sug.length) % sug.length); }
                else if (e.key === "Enter") {
                  if (activeIndex >= 0 && activeIndex < sug.length) { e.preventDefault(); acceptSuggestion(sug[activeIndex]); }
                } else if (e.key === "Escape") { setSug([]); setActiveIndex(-1); }
              }}
              placeholder='Es. "ACC" o "ACC;" per token esatto • "805..." per EAN'
              aria-autocomplete="list"
              aria-controls={sug.length ? listboxId : undefined}
              aria-expanded={!!sug.length}
              role="combobox"
            />
            {loadingSug && <div className="text-xs text-gray-500 mt-1">Caricamento…</div>}
            {!loadingSug && errorSug && <div className="text-xs text-red-600 mt-1">{errorSug}</div>}
            {!loadingSug && !errorSug && q.trim().length >= 2 && (
              <div className="text-[11px] text-slate-500 mt-1">Trovati: <b>{sug.length}</b></div>
            )}

            {/* Lista suggerimenti assoluta, non allunga il layout */}
            {sug.length > 0 && (
              <div
                id={listboxId}
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1 border rounded-xl bg-white shadow max-h-56 overflow-y-auto z-[9999]"
              >
                {sug.map((s, i) => {
                  const active = i === activeIndex;
                  return (
                    <div
                      key={`${s.id}-${i}`}
                      role="option"
                      aria-selected={active}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-3 ${active ? "bg-cyan-50" : "hover:bg-cyan-50"}`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => acceptSuggestion(s)}
                    >
                      <img
                        src={s.image_url || undefined}
                        alt=""
                        loading="lazy"
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded object-cover bg-gray-100"
                      />
                      <div className="flex-1">
                        <div className="font-mono font-bold">{s.sku || "—"}</div>
                        <div className="text-xs text-gray-600">
                          {s.ean ? `EAN: ${s.ean} • ` : ""}{s.product_title || s.variant_title || ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SKU/EAN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">SKU *</label>
              <input className="w-full border rounded-xl px-3 py-2" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">EAN</label>
              <input className="w-full border rounded-xl px-3 py-2" value={ean} onChange={(e) => setEan(e.target.value)} />
            </div>
          </div>

          {/* Qty/Plus */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Qty *</label>
              <input type="number" min={1} className="w-full border rounded-xl px-3 py-2"
                     value={qty} onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Plus</label>
              <input type="number" min={0} className="w-full border rounded-xl px-3 py-2"
                     value={plus} onChange={(e) => setPlus(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>

          {/* Riepilogo Sito */}
          {canale === "Sito" && sku.trim() && (
            <div className="rounded-xl border px-3 py-2 bg-green-50 text-green-900 text-sm">
              {loadingSite ? "Verifica ordini Sito in corso…" :
               siteInfo ? <>Ordini Sito per <b>{sku}</b>: <b>{siteInfo.orders_count}</b> ordini – totale <b>{siteInfo.total_qty}</b> pezzi</> :
               "Nessun ordine Sito aperto per questo SKU."}
            </div>
          )}

          {/* Nota + cavallotti */}
          <div>
            <label className="block text-xs font-semibold mb-1">Nota</label>
            <input className="w-full border rounded-xl px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cavallotti} onChange={(e) => setCavallotti(e.target.checked)} />
            Cavallotti
          </label>

          {submitError && <div className="text-sm text-red-600">{submitError}</div>}
        </div>

        {/* Footer fisso */}
        <div className="flex gap-2 justify-between px-6 py-4 border-t bg-white/90">
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300" onClick={onClose} type="button">
            Annulla
          </button>
          <button
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow"
            onClick={handleSubmit}
            disabled={!canale || !sku || !qty || Number(qty) < 1}
            type="button"
          >
            Inserisci
          </button>
        </div>
      </div>
    </div>
  );
}
