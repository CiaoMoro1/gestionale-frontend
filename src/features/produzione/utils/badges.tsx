/* src/features/produzione/utils/badges.tsx */
import type { Canale, StatoProduzione } from "../types";
import { CANALE_BADGE, STATE_STYLES } from "../constants";

export function badgeCanale(c?: string) {
  const cls = (c && CANALE_BADGE[c as Canale]) || "bg-gray-100 border-gray-300 text-gray-600";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold whitespace-nowrap truncate max-w-[110px] ${cls}`}
      title={c || "—"}
    >
      {c || "—"}
    </span>
  );
}

export function rowBgByCanale(canale?: string) {
  switch (canale) {
    case "Amazon Vendor": return "bg-orange-200/5";
    case "Sito":          return "bg-green-500/5";
    case "Amazon Seller": return "bg-red-500/5";
    default:              return "bg-white";
  }
}

export function badgeStato(stato: StatoProduzione) {
  // Usa STATE_STYLES per colori coerenti e accessibili
  const sty = STATE_STYLES[stato];
  return (
    <span
      className="inline-block rounded-full bg- border px-3 py-1 font-semibold text-xs bg-gradient-to-tr animate-badge-state"
      style={{
        background: `linear-gradient(135deg, ${sty.fill}, #ffffff)`,
        borderColor: sty.stroke,
        color: sty.text,
        letterSpacing: 1,
      }}
    >
      {stato}
    </span>
  );
}
