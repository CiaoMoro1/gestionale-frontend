// components/SearchInput.tsx

import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Cerca...",
  className = "",
}: SearchInputProps) {
  return (
    <div className={`mb-4 max-w-md mx-auto ${className}`}>
      <div className="flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md bg-white/60 border border-black/20 shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
        <Search size={20} className="text-black/50 shrink-0" />
        <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[clamp(0.9rem,2vw,1.1rem)] text-gray-800 placeholder:text-gray-400 
                    outline-none focus:outline-none focus:ring-0 focus:border-transparent"
        />
      </div>
    </div>
  );
}
