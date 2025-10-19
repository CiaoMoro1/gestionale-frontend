import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  debounce?: number;
  idleCommitMs?: number;
};

export default function SearchInput({
  value,
  onChange,
  onCommit,
  debounce = 250,
  idleCommitMs = 900,
}: Props) {
  const [local, setLocal] = useState(value ?? "");
  const changeTimer = useRef<number | undefined>(undefined);
  const commitTimer = useRef<number | undefined>(undefined);
  const lastCommitted = useRef<string>(value ?? "");
  const composing = useRef<boolean>(false);

  useEffect(() => {
    setLocal(value ?? "");
    lastCommitted.current = value ?? "";
  }, [value]);

  useEffect(() => {
    if (composing.current) return;

    clearTimeout(changeTimer.current);
    changeTimer.current = window.setTimeout(() => {
      onChange(local);
    }, Math.max(0, debounce));

    clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      if (local !== lastCommitted.current) {
        onCommit(local);
        lastCommitted.current = local;
      }
    }, Math.max(0, idleCommitMs));

    return () => {
      clearTimeout(changeTimer.current);
      clearTimeout(commitTimer.current);
    };
  }, [local, debounce, idleCommitMs, onChange, onCommit]);

  function commitNow() {
    if (composing.current) return;
    clearTimeout(commitTimer.current);
    if (local !== lastCommitted.current) {
      onCommit(local);
      lastCommitted.current = local;
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold mb-1">Cerca SKU/EAN</label>
      <input
        type="text"
        className="input input-bordered rounded-xl font-medium w-full px-4 py-2"
        placeholder='Esempi: "2p;" ultimo token esatto • "805...;" EAN esatto'
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commitNow}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitNow();
          }
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          onChange(local);
          commitNow();
        }}
        autoComplete="off"
        spellCheck={false}
        inputMode="search"
      />
    </div>
  );
}
