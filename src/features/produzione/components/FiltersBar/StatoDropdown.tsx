import { useState, useRef, useEffect } from "react";
import type { StatoProduzione } from "@/features/produzione";
import { TITOLO_DA_PRODURRE } from "@/features/produzione";

type Count = { stato: StatoProduzione; count: number };

type Props = {
  value: string;
  onChange: (v: string) => void;
  counts: Count[];
  totale: number;
  isLoading?: boolean;
};

export default function StatoDropdown({ value, onChange, counts, totale }: Props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (open && boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <label className="block text-xs font-semibold mb-1">Stato Produzione</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition ${
          open ? "border-cyan-500 ring-2 ring-cyan-100" : "border-gray-300"
        }`}
        style={{ minWidth: 170 }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{TITOLO_DA_PRODURRE[value || ""] || "Inseriti"}</span>
        <span aria-hidden className="inline-block w-3" />
        <svg width="14" height="14" viewBox="0 0 20 20" className="opacity-70" aria-hidden="true">
          <path d="M6 8l4 4 4-4" stroke="#0ea5e9" strokeWidth="2" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg max-h-72 overflow-y-auto"
          role="listbox"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${
              !value ? "bg-cyan-100 text-cyan-900" : "text-cyan-700"
            }`}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            role="option"
            aria-selected={!value}
          >
            Inseriti{" "}
            <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs">
              {totale}
            </span>
          </div>

          {counts.map((c) => (
            <div
              key={c.stato}
              className={`px-3 py-2 hover:bg-cyan-50 cursor-pointer text-base rounded-xl font-semibold ${
                value === c.stato ? "bg-cyan-200 text-cyan-900" : "text-cyan-700"
              }`}
              onClick={() => {
                onChange(c.stato);
                setOpen(false);
              }}
              role="option"
              aria-selected={value === c.stato}
            >
              {TITOLO_DA_PRODURRE[c.stato]}{" "}
              <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs">
                {c.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
