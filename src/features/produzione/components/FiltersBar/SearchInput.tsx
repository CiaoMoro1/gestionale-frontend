import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;   // filtro locale immediato (client)
  onCommit: (v: string) => void;   // ricerca autorevole (DB) a commit/idle/Enter
  debounce?: number;               // ms per onChange “debounced”
  idleCommitMs?: number;           // ms inattività per onCommit auto
  sanitize?: boolean;              // rimuove % e sostituisce , con spazio (evita PGRST100)
};

export default function SearchInput({
  value,
  onChange,
  onCommit,
  debounce = 150,
  idleCommitMs = 600,
  sanitize = true,
}: Props) {
  const [local, setLocal] = useState(value ?? "");
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommitted = useRef<string>(value ?? "");
  const composing = useRef<boolean>(false);
  const isFocused = useRef<boolean>(false);

  const sanitizeQ = useCallback(
    (q: string) => (sanitize ? q.replace(/%/g, "").replace(/,/g, " ") : q),
    [sanitize]
  );

  // sync esterno → interno (non disturbare IME in corso)
  useEffect(() => {
    // NON riscrivere mentre l'utente sta digitando o è in IME
    if (isFocused.current || composing.current) return;
    setLocal(value ?? "");
    lastCommitted.current = value ?? "";
  }, [value]);

  // debounce onChange + idle onCommit
  useEffect(() => {
    if (composing.current) return;

    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      onChange(local); // raw, niente sanitize mentre scrivi
    }, Math.max(0, debounce));

    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      const next = sanitizeQ(local);
      if (next !== lastCommitted.current) {
        onCommit(next);
        lastCommitted.current = next;
      }
    }, Math.max(0, idleCommitMs));

    return () => {
      if (changeTimer.current) clearTimeout(changeTimer.current);
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, [local, debounce, idleCommitMs, onChange, onCommit, sanitizeQ]);

  function commitNow() {
    if (composing.current) return;
    if (commitTimer.current) clearTimeout(commitTimer.current);
    const next = sanitizeQ(local);
    if (next !== lastCommitted.current) {
      onCommit(next);
      lastCommitted.current = next;
    }
  }

  function clearAll() {
    setLocal("");
    onChange("");
    onCommit("");
    lastCommitted.current = "";
  }

  return (
    <div>
      <label htmlFor="search-sku-ean" className="block text-xs font-semibold mb-1">
        Cerca SKU/EAN
      </label>
      <input
        id="search-sku-ean"
        type="text"
        className="input input-bordered rounded-xl font-medium w-full px-4 py-2"
        placeholder='Esempi: "2p;" token finale esatto • "805...;" EAN esatto'
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; commitNow(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitNow();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            clearAll();
          }
        }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => {
          composing.current = false;
          onChange(local); // ancora raw
          commitNow();     // qui sanitizza e sincronizza con parent
        }}
        autoComplete="off"
        spellCheck={false}
        inputMode="search"
      />
    </div>
  );
}
