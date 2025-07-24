// components/SearchInput.tsx
import { Search, X } from "lucide-react";
import { useRef } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Cerca per SKU o EAN...",
  className = "",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`max-w-md w-full ${className}`}>
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/70 border border-cyan-200 shadow focus-within:ring-2 focus-within:ring-cyan-400 transition">
        <Search size={19} className="text-cyan-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[clamp(0.99rem,2vw,1.15rem)] text-gray-800 placeholder:text-gray-400 outline-none"
        />
        {value && (
          <button
            className="p-1 rounded-full hover:bg-cyan-100 transition"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Cancella"
            tabIndex={0}
          >
            <X size={17} className="text-cyan-300" />
          </button>
        )}
      </div>
    </div>
  );
}
