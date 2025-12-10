import React, { memo, type ReactNode, useEffect, useState } from "react";
import type { ProduzioneRow, StatoProduzione } from "@/features/produzione";
import { badgeCanale, badgeStato, rowBgByCanale } from "@/features/produzione";
import { Edit, Info } from "lucide-react";

/** Colore pastello deterministico per SKU (banda) */
function colorForSku(sku: string): string {
  let h = 4450;
  for (let i = 0; i < sku.length; i++) h = ((h << 5) + h) + sku.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}deg 70% 65%)`;
}

type Props = {
  row: ProduzioneRow;
  /** Tutte le righe (solo per fallback calcoli se non viene passata flowTotalsMap) */
  allRows: ProduzioneRow[];
  /** Calcolati in tabella per evitare confronti complicati in memo */
  isGroupStart: boolean;
  isGroupEnd: boolean;

  /** Mappa precomputata dei totali per (sku, canale); consigliata per performance */
  flowTotalsMap?: Map<string, Record<StatoProduzione, number>>;

  /** Selezione riga */
  selected: boolean;
  onSelect: (on: boolean) => void;

  /** Azioni riga */
  onInlineChangeDaStampare: (id: number, value: number) => Promise<void>;
  onOpenLogs: (rowId: number) => Promise<void>;
  onToggleCavallotti: (row: ProduzioneRow) => Promise<void>;
  onOpenCavallottoPdf: (sku: string, formato: string) => void;

  onOpenNota?: (row: ProduzioneRow) => void;
  onOpenDaProdurre?: (row: ProduzioneRow) => void;
  onOpenChangeState?: (row: ProduzioneRow) => void;
};

const ORDER_STATES: StatoProduzione[] = [
  "Da Stampare",
  "Stampato",
  "Calandrato",
  "Cucito",
  "Confezionato",
  "Trasferito",
  "Deposito",
];

const STATE_LABEL: Record<StatoProduzione, string> = {
  "Da Stampare": "Da Stampare",
  "Stampato": "Stampati",
  "Calandrato": "Calandrati",
  "Cucito": "Cuciti",
  "Confezionato": "Confezionati",
  "Trasferito": "Trasferiti",
  "Deposito": "In Deposito",
  "Rimossi": "Rimossi",
};

function RowViewBase({
  row, allRows, isGroupStart, isGroupEnd,
  flowTotalsMap, selected, onSelect,
  onInlineChangeDaStampare, onOpenLogs, onToggleCavallotti, onOpenCavallottoPdf,
  onOpenNota, onOpenDaProdurre, onOpenChangeState,
}: Props) {
  const rowBg = rowBgByCanale(row.canale);

  // Stato locale per la quantità "Da Stampare" (live UX)
  const [localDS, setLocalDS] = useState<number>(row.da_produrre);
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);

  // Resync quando cambia riga o valore sorgente
  useEffect(() => {
    setLocalDS(row.da_produrre);
    setSaving(false);
    setSaved(false);
  }, [row.id, row.da_produrre]);

  // Banda visiva laterale per SKU quando è presente almeno un'altra riga con lo stesso SKU
  const groupHasMultiple = allRows.some((r) => r !== row && r.sku === row.sku);

  const shadows: string[] = [];
  if (groupHasMultiple) shadows.push(`inset 6px 0 0 0 ${colorForSku(row.sku)}`); // banda SKU

  // Totali flusso per CANALE: lookup O(1) dalla mappa; fallback locale esplicito
  const totalsKey = `${row.sku}__${row.canale ?? ""}`;
  const initTotals: Record<StatoProduzione, number> = {
    "Da Stampare": 0, "Stampato": 0, "Calandrato": 0, "Cucito": 0,
    "Confezionato": 0, "Trasferito": 0, "Deposito": 0, "Rimossi": 0,
  };

  let flowTotals = flowTotalsMap?.get(totalsKey);
  if (!flowTotals) {
    const local: Record<StatoProduzione, number> = { ...initTotals };
    for (const g of allRows) {
      if (g.sku === row.sku && g.canale === row.canale) {
        local[g.stato_produzione] += g.da_produrre || 0;
      }
    }
    flowTotals = local;
  }

  // Per mostrare Qty live e riepilogo: DS usa localDS, gli altri stati come da flowTotals
  const othersTotal = ORDER_STATES
    .filter((st) => st !== "Da Stampare")
    .reduce((acc, st) => acc + (flowTotals[st] || 0), 0);

 const dsValue = (row.stato_produzione === "Da Stampare")
   ? localDS
   : (flowTotals["Da Stampare"] || 0);

 const summaryParts: ReactNode[] = [];
 for (const st of ORDER_STATES) {
   const q = st === "Da Stampare" ? dsValue : (flowTotals[st] || 0);
    if (q > 0) {
      if (summaryParts.length > 0) summaryParts.push(" + ");
      summaryParts.push(
        <span key={`sum-${st}`} className={st === "Da Stampare" ? "text-blue-900 font-bold" : ""}>
          {q} {STATE_LABEL[st]}
        </span>
      );
    }
  }

  const qtyColValue =
    row.stato_produzione === "Da Stampare" ? othersTotal + localDS : row.da_produrre;

  return (
    <tr
      className={`${rowBg} ${isGroupStart ? "border-t-2 border-slate-200 rounded-tl-xl" : ""} ${isGroupEnd ? "rounded-bl-xl" : ""} transition-colors duration-150 hover:brightness-95`}
      style={{ boxShadow: shadows.join(", ") }}
    >
      {/* Selezione */}
      <td className="w-[44px] px-2 py-2 text-center align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={selected ? "Deseleziona riga" : "Seleziona riga"}
        />
      </td>

      {/* SKU */}
      <td className="px-2 py-2 font-mono font-bold w-52 md:w-64 lg:w-[14rem] min-w-52 md:min-w-64 lg:min-w-[14rem] break-words">
        {row.sku}
      </td>

      {/* Data */}
      <td className="px-3 py-2 text-center">
        {row.start_delivery
          ? new Date(row.start_delivery).toLocaleDateString("it-IT")
          : "—"}
      </td>

      {/* Canale */}
      <td className="px-1 py-2 w-24 md:w-28 text-center align-middle">
        {badgeCanale(row.canale)}
      </td>

      {/* Qty grande */}
      <td className="px-2 py-2 text-center font-bold text-base text-blue-800 w-14 md:w-20 align-middle">
        <span style={{ fontSize: "clamp(1.1rem, 1.1vw + 0.6rem, 1.6rem)", lineHeight: 1 }}>
          {qtyColValue}
        </span>
        {row.modificata_manualmente === true && (
          <span
            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border bg-yellow-50 border-yellow-300 text-yellow-800 text-[11px] font-semibold whitespace-nowrap"
            title="Questa quantità è stata modificata manualmente"
          >
            <Edit className="w-3 h-3" />
            Mod. Manuale
          </span>
        )}
      </td>

      {/* Inseriti + edit DS */}
      <td className="px-2 py-2 text-center font-bold text-base text-blue-800 align-middle">
        <div className="text-xs text-gray-600 font-medium italic mb-1 leading-4">
          {summaryParts.length > 0 ? summaryParts : <span>0</span>}
        </div>

        {row.stato_produzione === "Da Stampare" ? (
          <div className="flex items-center gap-2 justify-center">
            <input
              type="number"
              min={0}
              value={localDS}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLocalDS(Number.isFinite(v) ? Math.max(0, v) : 0);
                setSaved(false);
              }}
              className="input input-bordered px-2 py-1 rounded-xl text-blue-800 font-bold w-20 text-center"
              aria-label="Modifica da produrre"
              onBlur={async (e) => {
                const v = Number(e.currentTarget.value);
                const next = Number.isFinite(v) ? Math.max(0, v) : 0;
                if (next === row.da_produrre) return;
                try {
                  setSaving(true);
                  await onInlineChangeDaStampare(row.id, next);
                  setSaved(true);
                } finally {
                  setSaving(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              }}
            />
            <span className="text-xs h-5 inline-flex items-center">
              {saving && <span className="text-slate-500">Salvataggio…</span>}
              {!saving && saved && <span className="text-emerald-700 font-semibold">Salvato ✓</span>}
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <span>{row.da_produrre}</span>
            {onOpenDaProdurre && (
              <button
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs bg-gray-100 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                title="Modifica quantità"
                aria-label="Modifica quantità"
                onClick={() => onOpenDaProdurre(row)}
              >
                <Edit className="w-4 h-4 text-cyan-700" />
                Modifica
              </button>
            )}
          </div>
        )}
      </td>

      {/* Stato */}
      <td className="px-3 py-2 text-center min-w-[160px]">
        {onOpenChangeState ? (
          <button
            type="button"
            className="inline-block rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-300"
            onClick={() => onOpenChangeState(row)}
            title="Cambia stato / Sposta quantità"
            aria-label="Cambia stato o sposta quantità"
          >
            {badgeStato(row.stato_produzione)}
          </button>
        ) : (
          badgeStato(row.stato_produzione)
        )}
      </td>

      {/* Nota */}
      <td className="px-3 py-2 text-center">
        {(() => {
          const hasNote = Boolean(row.note && row.note.trim());
          return (
            <button
              className={`px-2 py-1 rounded-xl border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300 ${
                hasNote
                  ? "bg-red-100 hover:bg-red-200 border-red-300 text-red-700"
                  : "bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700"
              }`}
              onClick={() => onOpenNota?.(row)}
              title={hasNote ? "Nota presente" : "Aggiungi nota"}
              aria-label={hasNote ? "Nota presente" : "Aggiungi nota"}
            >
              Nota
            </button>
          );
        })()}
      </td>

      {/* Cavallotti */}
      <td className="px-3 py-2 text-center">
        <button
          className={`inline-flex items-center rounded-xl px-2 py-1 border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-300 ${
            row.cavallotti ? "bg-green-200 text-green-700 border-green-300" : "bg-gray-200 text-gray-600 border-gray-300"
          }`}
          onClick={() => onToggleCavallotti(row)}
          title="Toggle cavallotti"
          aria-label={row.cavallotti ? "Disattiva cavallotti" : "Attiva cavallotti"}
        >
          {row.cavallotti ? "Cavallotti" : "No"}
        </button>
        {row.cavallotti && (
          <button
            className="ml-2 px-2 py-1 bg-cyan-100 border border-cyan-300 rounded-xl text-cyan-800 text-xs font-semibold hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            onClick={() => onOpenCavallottoPdf(row.sku, "A5")}
            title="Stampa Cavallotto"
            aria-label="Stampa cavallotto in PDF"
          >
            🏷️ PDF
          </button>
        )}
      </td>

      {/* EAN (fallback UX) */}
      <td className="px-3 py-2 font-mono truncate max-w-[16ch] md:max-w-[20ch]">
        {row.ean || "—"}
      </td>

      {/* Azioni: Log */}
      <td className="px-3 py-2 text-center">
        <button
          className="rounded-full p-2 bg-gray-100 hover:bg-blue-100 transition focus:outline-none focus:ring-2 focus:ring-cyan-300"
          title="Storico movimenti"
          aria-label="Apri storico movimenti"
          onClick={() => onOpenLogs(row.id)}
        >
          <Info size={18} className="text-blue-700" />
        </button>
      </td>
    </tr>
  );
}

/** memo robusto: re-render solo quando cambia qualcosa di rilevante per la UI */
export const ProduzioneRowView = memo(RowViewBase, (prev, next) => {
  const a = prev.row, b = next.row;
  return (
    prev.selected === next.selected &&
    prev.isGroupStart === next.isGroupStart &&
    prev.isGroupEnd === next.isGroupEnd &&
    a.id === b.id &&
    a.da_produrre === b.da_produrre &&
    a.stato_produzione === b.stato_produzione &&
    a.note === b.note &&
    a.cavallotti === b.cavallotti
  );
});

export default ProduzioneRowView;
