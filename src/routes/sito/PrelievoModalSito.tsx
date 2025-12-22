// src/components/sito/PrelievoModalSito.tsx
import { useEffect, useMemo, useState } from "react";
import GeneraEtichetteModal from "@/components/GeneraEtichetteModal";
import DisponibiliCanali, {
  type GiacenzeMap,
  type CanaleMagazzino,
  type UseMap,
} from "@/components/DisponibiliCanali";

/** === Tipi per il SITO, copiati da PrelievoRow Vendor === */
export type SitoPrelievoRow = {
  id: number;
  stato: "manca" | "parziale" | "completo" | "in verifica";
  sku: string;
  ean: string;
  centri?: Record<string, number>;
  qty: number;
  riscontro: number | null; // TOTALE (da magazzino + manuale)
  plus: number | null;
  radice: string;
  note?: string;
  magazzino_usato?: number;
  mag_usato_by_canale?: Record<CanaleMagazzino, number>;
};

type Props = {
  open: boolean;
  row: SitoPrelievoRow | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

/** Util: safe number */
function n(v: unknown, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

/* ==============================
   Modale: Scelta formato Cavallotto
   ============================== */
type CavForm = "A5" | "A4" | "A3";
function CavallottoChooser({
  sku,
  loading,
  onClose,
  onOpenPdf,
}: {
  sku: string;
  loading: boolean;
  onClose: () => void;
  onOpenPdf: (sku: string, formato: CavForm) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center relative">
        <button
          className="absolute top-2 right-3 text-2xl text-gray-300 hover:text-black"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ×
        </button>
        <div className="mb-1 font-bold text-lg text-blue-800">
          Stampa Cavallotto
        </div>
        <div className="text-xs text-neutral-600 mb-4">
          SKU: <b>{sku}</b>
        </div>
        <div className="mb-4">Scegli il formato</div>
        <div className="flex flex-col gap-2 mb-3">
          {(["A5", "A4", "A3"] as const).map((formato) => (
            <button
              key={formato}
              className="bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-800 font-semibold py-2 rounded-xl disabled:opacity-50"
              onClick={() => onOpenPdf(sku, formato)}
              disabled={loading}
            >
              {formato}
            </button>
          ))}
        </div>
        {loading && <div className="text-indigo-600 text-sm">Generazione…</div>}
      </div>
    </div>
  );
}

/* ==============================
   Modale principale: Prelievo SITO
   ============================== */
export default function PrelievoModalSito({
  open,
  row,
  onClose,
  onSaved,
}: Props) {
  const API = import.meta.env.VITE_API_URL;

  // ===== Stato locale modale
  const [riscontro, setRiscontro] = useState<number | null>(null); // TOTALE
  const [plus, setPlus] = useState<number | null>(null);
  const [note, setNote] = useState<string>("");
  const [riscontroError, setRiscontroError] = useState(false);

  const [giacenze, setGiacenze] = useState<GiacenzeMap>({
    "Amazon Vendor": 0,
    Sito: 0,
    "Amazon Seller": 0,
  });

  const [prevBy, setPrevBy] = useState<UseMap>({
    "Amazon Vendor": 0,
    Sito: 0,
    "Amazon Seller": 0,
  });
  const [useBy, setUseBy] = useState<UseMap>({
    "Amazon Vendor": 0,
    Sito: 0,
    "Amazon Seller": 0,
  });

  const [showEtichette, setShowEtichette] = useState(false);
  const [cavallottoModalSku, setCavallottoModalSku] = useState<string | null>(
    null
  );
  const [cavallottoLoading, setCavallottoLoading] = useState<boolean>(false);

  // ===== Apertura modale → inizializza campi
  useEffect(() => {
    if (!open || !row) return;

    const prev = row.mag_usato_by_canale ?? {
      "Amazon Vendor": n(row.magazzino_usato),
      Sito: 0,
      "Amazon Seller": 0,
    };

    const prevSafe: UseMap = {
      "Amazon Vendor": Math.max(0, n(prev["Amazon Vendor"])),
      Sito: Math.max(0, n(prev["Sito"])),
      "Amazon Seller": Math.max(0, n(prev["Amazon Seller"])),
    };
    setPrevBy(prevSafe);
    setUseBy(prevSafe);

    const r0 = row.riscontro;
    setRiscontro(
      r0 !== null && r0 !== undefined ? n(r0) : n(row.qty)
    );

    setPlus(row.plus ?? 0);
    setNote(row.note ?? "");
    setRiscontroError(false);
  }, [open, row?.id, row]);

  // ===== Carica giacenze quando si apre modale o cambia sku/ean
  const sku = row?.sku ?? "";
  const ean = row?.ean ?? "";

  useEffect(() => {
    if (!open || !row) return;
    const ctrl = new AbortController();

    (async () => {
      try {
        const params = new URLSearchParams({ sku });
        if (ean) params.set("ean", ean);
        const resp = await fetch(
          `${API}/api/magazzino/giacenze?${params.toString()}`,
          { signal: ctrl.signal }
        );
        if (!resp.ok) {
          setGiacenze({
            "Amazon Vendor": 0,
            Sito: 0,
            "Amazon Seller": 0,
          });
          return;
        }
        type GiacenzaRow = {
          canale: keyof GiacenzeMap;
          qty: number;
        };
        const arr = (await resp.json()) as GiacenzaRow[];
        const next: GiacenzeMap = {
          "Amazon Vendor": 0,
          Sito: 0,
          "Amazon Seller": 0,
        };
        (arr || []).forEach((g) => {
          next[g.canale as CanaleMagazzino] = n(g.qty);
        });
        setGiacenze(next);
      } catch {
        setGiacenze({
          "Amazon Vendor": 0,
          Sito: 0,
          "Amazon Seller": 0,
        });
      }
    })();

    return () => ctrl.abort();
  }, [open, sku, ean, API, row]);

  // ===== Derivati
  const useTotal = useMemo(
    () =>
      n(useBy["Amazon Vendor"]) +
      n(useBy["Sito"]) +
      n(useBy["Amazon Seller"]),
    [useBy]
  );
  const maxQty = n(row?.qty);
  const minRiscontro = useTotal;

  useEffect(() => {
    if (!open) return;
    setRiscontro((prev) => {
      const cur = n(prev, 0);
      const bounded = Math.max(minRiscontro, Math.min(cur, maxQty));
      setRiscontroError(bounded < minRiscontro);
      return bounded;
    });
  }, [open, minRiscontro, maxQty]);

  const riscontroEff = n(riscontro);
  const manualeExtraRiscontro = Math.max(0, riscontroEff - useTotal);
  const copertoPreview = riscontroEff;
  const daProdurrePreview = Math.max(0, maxQty - riscontroEff) + n(plus);

  const usedDetail = (Object.entries(useBy) as [CanaleMagazzino, number][])
    .filter(([, v]) => n(v) > 0)
    .map(
      ([k, v]) => `${n(v)} ${k.replace("Amazon ", "")}`
    )
    .join(" + ");

  const copertoBreakdown =
    `Totale riscontro: ${riscontroEff}` +
    ` — Da usare: ${useTotal}${
      usedDetail ? ` (${usedDetail})` : ""
    }` +
    (manualeExtraRiscontro
      ? ` • Manuale: ${manualeExtraRiscontro}`
      : "");

  function handleRiscontroChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const raw = e.target.value;
    const num = raw === "" ? null : Number(raw);
    if (num === null || Number.isNaN(num)) {
      setRiscontro(null);
      setRiscontroError(false);
      return;
    }
    const bounded = Math.max(minRiscontro, Math.min(num, maxQty));
    setRiscontro(bounded);
    setRiscontroError(num < minRiscontro);
  }

  function stepRiscontro(delta: number) {
    setRiscontro((prev) => {
      const cur = n(prev, 0);
      const next = Math.max(
        minRiscontro,
        Math.min(cur + delta, maxQty)
      );
      setRiscontroError(next < minRiscontro);
      return next;
    });
  }

  function stepPlus(delta: number) {
    setPlus((prev) => {
      const cur = n(prev, 0);
      const next = Math.max(0, cur + delta);
      return next;
    });
  }

  async function salva(riscontroOverride?: number) {
    if (!row) return;
    const riscontroToSend =
      typeof riscontroOverride === "number"
        ? riscontroOverride
        : n(riscontro);
    const plusToSend = n(plus);

    const magByCanaleTarget: Record<CanaleMagazzino, number> = {
      "Amazon Vendor": n(useBy["Amazon Vendor"]),
      Sito: n(useBy["Sito"]),
      "Amazon Seller": n(useBy["Amazon Seller"]),
    };
    const totaleNew = Object.values(magByCanaleTarget).reduce(
      (a, b) => a + n(b),
      0
    );

    // 🔹 ENDPOINT ADATTATO PER SITO
    const res = await fetch(`${API}/api/prelievi-sito/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        riscontro: riscontroToSend,
        plus: plusToSend,
        note: note ?? "",
        magazzino_usato: totaleNew,
        mag_usato_by_canale: magByCanaleTarget,
      }),
    });

    if (!res.ok) {
      let errMsg = "Errore di validazione!";
      try {
        const errJson = (await res.json()) as { error?: string };
        errMsg = errJson?.error || errMsg;
      } catch {
        // ignore
      }
      window.alert(errMsg);
      return;
    }

    await onSaved?.();
    onClose();
  }

  function openCavallottoPdf(skuParam: string, formato: CavForm) {
    setCavallottoLoading(true);
    try {
      const url = new URL(`${API}/api/cavallotto/html`);
      url.searchParams.set("sku", skuParam);
      url.searchParams.set("formato", formato);
      window.open(url.toString(), "_blank");
    } finally {
      setCavallottoLoading(false);
      setCavallottoModalSku(null);
    }
  }

  if (!open || !row) return null;

  return (
    <>
      {/* MODALE PRELIEVO SITO */}
      <div className="fixed inset-0 z-50 flex justify-center bg-black/40">
        <div className="w-[97%] max-h-[90%] sm:w-[50%] top-1 overflow-y-auto bg-white rounded-2xl shadow-lg border relative">
          {/* Header sticky */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b px-5 py-3 flex items-center justify-between">
            <div className="font-bold text-blue-700 text-lg">
              Modifica Prelievo Sito
            </div>
            <button
              className="text-neutral-400 hover:text-black text-2xl leading-none"
              onClick={onClose}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            <div className="mb-2 font-mono text-base flex items-center gap-3">
              <span className="bg-blue-100 px-2 py-1 rounded">
                {row.sku}
              </span>
            </div>

            <div className="mb-2 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
              <b>EAN:</b> {row.ean}
              <div className="flex gap-2 mt-1">
                <button
                  className="px-2 py-1 bg-gray-100 border rounded-lg text-xs font-semibold hover:bg-gray-200 transition"
                  onClick={() => setShowEtichette(true)}
                  disabled={!row.sku || !row.ean}
                  title="Genera etichette"
                >
                  🏷️ Genera Etichette
                </button>
                <button
                  className="px-2 py-1 bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-800 hover:bg-indigo-200 transition"
                  onClick={() => setCavallottoModalSku(row.sku)}
                  disabled={!row.sku}
                  title="Genera cavallotto"
                >
                  🖨️ Genera Cavallotto
                </button>
              </div>
            </div>

            {/* Disponibili & Da usare */}
            <DisponibiliCanali
              giacenze={giacenze}
              prevBy={prevBy}
              useBy={useBy}
              maxQty={maxQty}
              onChange={(next) => setUseBy(next)}
            />

            {/* Campi riscontro / plus / note */}
            <div className="flex flex-col gap-2 mb-3">
              <div>
                <label className="block text-xs mb-1">
                  Riscontro (TOTALE) — min {minRiscontro} • max {maxQty}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100"
                    onClick={() => stepRiscontro(-1)}
                    aria-label="Diminuisci riscontro"
                    disabled={n(riscontro) <= minRiscontro}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={minRiscontro}
                    max={maxQty}
                    value={riscontro ?? ""}
                    onChange={handleRiscontroChange}
                    className={`flex-1 border rounded-lg p-2 text-center font-bold text-blue-700 outline-blue-400 transition-all ${
                      riscontroError
                        ? "border-red-500 ring-2 ring-red-400 animate-shake"
                        : ""
                    }`}
                    style={{ fontSize: 20 }}
                  />
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100"
                    onClick={() => stepRiscontro(+1)}
                    aria-label="Aumenta riscontro"
                    disabled={n(riscontro) >= maxQty}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1">
                  Plus (extra produzione)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100"
                    onClick={() => stepPlus(-1)}
                    aria-label="Diminuisci plus"
                    disabled={n(plus) <= 0}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={plus ?? ""}
                    onChange={(e) =>
                      setPlus(
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    className="flex-1 border rounded-lg p-2 text-center font-bold outline-blue-400"
                    style={{ fontSize: 20 }}
                  />
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100"
                    onClick={() => stepPlus(+1)}
                    aria-label="Aumenta plus"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1">Note</label>
                <textarea
                  className="w-full border rounded-lg p-2 text-blue-800 outline-blue-400 min-h-[60px] resize-y"
                  placeholder="Note operatore…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* Footer azioni */}
              <div className="pt-4 pb-1 flex justify-between gap-2">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 font-bold rounded-full shadow hover:bg-red-200 transition text-sm"
                  onClick={() => salva(0)}
                >
                  Niente disponibile
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-full shadow hover:bg-blue-700 transition text-sm"
                  onClick={() => salva()}
                  disabled={
                    riscontro === null || riscontro < minRiscontro
                  }
                >
                  Salva
                </button>
              </div>
            </div>

            {/* Anteprima */}
            <div className="mt-1 p-2 rounded-lg border bg-amber-50">
              <div className="text-xs text-amber-800 font-semibold mb-1">
                Anteprima
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="bg-white rounded-md border p-2">
                  <div className="text-[11px] text-slate-500">
                    Coperto (totale)
                  </div>
                  <div className="text-lg font-mono font-bold text-slate-800">
                    {copertoPreview}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {copertoBreakdown}
                  </div>
                </div>
                <div className="bg-white rounded-md border p-2">
                  <div className="text-[11px] text-slate-500">
                    Da produrre (con plus)
                  </div>
                  <div className="text-lg font-mono font-bold text-slate-800">
                    {daProdurrePreview}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALE ETICHETTE */}
      <div className="relative z-[70]">
        <GeneraEtichetteModal
          open={showEtichette}
          onClose={() => setShowEtichette(false)}
          sku={row?.sku || ""}
          ean={row?.ean || ""}
        />
      </div>

      {/* MODALE CAVALLOTTO */}
      {cavallottoModalSku && (
        <CavallottoChooser
          sku={cavallottoModalSku}
          loading={cavallottoLoading}
          onClose={() => setCavallottoModalSku(null)}
          onOpenPdf={openCavallottoPdf}
        />
      )}
    </>
  );
}
