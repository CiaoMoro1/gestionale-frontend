import { useMemo } from "react";

export type CanaleMagazzino = "Amazon Vendor" | "Sito" | "Amazon Seller";
export type GiacenzeMap = Record<CanaleMagazzino, number>;
export type UseMap = Record<CanaleMagazzino, number>;

function n(v: unknown, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

type Tone = "neutral" | "warn" | "success" | "alert";

type CanaleUseCardProps = {
  label: string;
  available: number;          // disponibilità virtuale (readonly)
  baseline: number;           // giacenza iniziale (per i toni)
  value: number;              // “da usare” corrente per il canale
  maxPerCanale: number;       // cap per canale = giacenza + prev
  maxGlobaleResiduo: number;  // residuo globale = maxQty - somma(altri)
  onChange: (next: number) => void;
};

function toneForBox(baseline: number, available: number, value: number): Tone {
  // Rosso: non era disponibile e non stai usando nulla
  if (baseline <= 0 && value === 0) return "alert";
  // Verde: stai usando tutto il canale (available=0) e stai usando (>0)
  if (value > 0 && available === 0) return "success";
  // Giallo: uso parziale (stai usando e rimane disponibilità)
  if (value > 0 && available > 0) return "warn";
  // Neutro: non stai usando quel canale (value=0) e c'era disponibilità
  return "neutral";
}

function CanaleUseCard({
  label, available, baseline, value, maxPerCanale, maxGlobaleResiduo, onChange,
}: CanaleUseCardProps) {
  // Cap effettivo per questo canale: rispetto cap per canale e cap globale residuo
  const hardCap = Math.max(0, Math.min(maxPerCanale, maxGlobaleResiduo));
  const canPlus = value < hardCap;
  const canMinus = value > 0;

  const tone = toneForBox(baseline, available, value);

  // Bordo SEMPRE presente (per evitare "salti"); colori pastello per background e bordo
  const toneBox =
    tone === "alert"   ? "bg-red-50 border border-red-200"
    : tone === "success" ? "bg-emerald-50 border border-emerald-200"
    : tone === "warn"    ? "bg-amber-50 border border-amber-200"
                         : "bg-white border border-slate-200";
  const toneNumber =
    tone === "alert"   ? "text-red-700"
    : tone === "success" ? "text-emerald-700"
    : tone === "warn"    ? "text-amber-700"
                         : "text-slate-900";

  return (
    <div className={`${toneBox} rounded-md p-2 text-center text-sm`}>
      <div className="font-semibold">{label}</div>

      {/* Disponibili (solo visuale) */}
      <div className="text-sm text-slate-500 ">Disponibili</div>
      <div className={`text-2xl font-mono ${toneNumber}`}>{available}</div>

      {/* Da usare: − input + */}
      <div className="text-xs text-slate-500">Da usare</div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <button
          className="w-7 h-7 rounded-full border hover:bg-slate-100"
          onClick={() => onChange(value - 1)}
          disabled={!canMinus}
          aria-label={`Diminuisci ${label}`}
        >−</button>

        <input
          type="number"
          className="w-[64px] text-center font-mono text-base border rounded-md px-1 py-1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value || 0))}
          min={0}
          max={hardCap}
        />

        <button
          className="w-7 h-7 rounded-full border hover:bg-slate-100"
          onClick={() => onChange(value + 1)}
          disabled={!canPlus}
          aria-label={`Aumenta ${label}`}
        >+</button>
      </div>

      {/* Azioni rapide: svuota (rosso) / tutto (blu) */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <button
          type="button"
          className="px-2 py-1 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => onChange(0)}
          disabled={value === 0}
          title="Porta a 0"
        >
          Svuota
        </button>
        <button
          type="button"
          className="px-2 py-1 text-xs rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          onClick={() => onChange(hardCap)}
          disabled={value >= hardCap}
          title="Usa tutto il disponibile"
        >
          Tutto
        </button>
      </div>
    </div>
  );
}

export type CanaliProps = {
  giacenze: GiacenzeMap;                 // giacenze reali (API) all'apertura/refresh
  prevBy: UseMap;                        // baseline già usata (persistita)
  useBy: UseMap;                         // target corrente "Da usare"
  maxQty: number;                        // cap globale (qty ordine)
  onChange: (nextUseBy: UseMap) => void; // callback al genitore
};

export default function DisponibiliCanali({
  giacenze, prevBy, useBy, maxQty, onChange,
}: CanaliProps) {
  const canali: [CanaleMagazzino, string][] = [
    ["Amazon Vendor", "Vendor"],
    ["Sito", "Sito"],
    ["Amazon Seller", "Seller"],
  ];

  const useTotal = useMemo(
    () => n(useBy["Amazon Vendor"]) + n(useBy["Sito"]) + n(useBy["Amazon Seller"]),
    [useBy]
  );

  // Disponibilità virtuale = giacenza + (prev - use)
  const available: UseMap = {
    "Amazon Vendor": Math.max(0, n(giacenze["Amazon Vendor"]) + (n(prevBy["Amazon Vendor"]) - n(useBy["Amazon Vendor"]))),
    "Sito": Math.max(0, n(giacenze["Sito"]) + (n(prevBy["Sito"]) - n(useBy["Sito"]))),
    "Amazon Seller": Math.max(0, n(giacenze["Amazon Seller"]) + (n(prevBy["Amazon Seller"]) - n(useBy["Amazon Seller"]))),
  };

  // Cap per canale = giacenza + prev (puoi liberare ciò che avevi usato)
  const maxPerCanale: UseMap = {
    "Amazon Vendor": n(giacenze["Amazon Vendor"]) + n(prevBy["Amazon Vendor"]),
    "Sito": n(giacenze["Sito"]) + n(prevBy["Sito"]),
    "Amazon Seller": n(giacenze["Amazon Seller"]) + n(prevBy["Amazon Seller"]),
  };

  // Clamp per canale (cap) e globale (somma ≤ maxQty)
  function setUse(canale: CanaleMagazzino, next: number) {
    const curVal = n(useBy[canale]);
    const otherSum = useTotal - curVal;          // somma degli altri canali
    const maxGlobaleResiduo = maxQty - otherSum; // cap globale residuo
    const capCanale = n(maxPerCanale[canale]);   // cap per canale
    const allowedCap = Math.max(0, Math.min(capCanale, maxGlobaleResiduo));
    const bounded = Math.max(0, Math.min(Math.floor(next), allowedCap));
    if (bounded === curVal) return;
    onChange({ ...useBy, [canale]: bounded });
  }

  return (
    <div className="mb-3 p-2 rounded-lg border bg-slate-50">
      <div className="text-xs text-slate-600 mb-1">Disponibili</div>

      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        {canali.map(([k, label]) => {
          const cur = n(useBy[k]);
          const other = useTotal - cur;
          const maxGlobaleResiduo = maxQty - other;
          return (
            <CanaleUseCard
              key={k}
              label={label}
              available={available[k]}
              baseline={n(giacenze[k])}
              value={cur}
              maxPerCanale={maxPerCanale[k]}
              maxGlobaleResiduo={maxGlobaleResiduo}
              onChange={(next) => setUse(k, next)}
            />
          );
        })}
      </div>

      <div className="mt-2 text-xs flex items-center justify-between">
        <div className="text-slate-600">Da usare totale</div>
        <div className="font-semibold">{useTotal}</div>
      </div>
      {useTotal >= maxQty && (
        <div className="text-[11px] text-red-600 mt-1 text-right">
          Limite massimo raggiunto ({maxQty})
        </div>
      )}
    </div>
  );
}
