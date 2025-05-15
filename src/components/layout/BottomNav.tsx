import { ClipboardList, Home, Package, Search } from "lucide-react";
import NavLink from "../navigation/NavLink";

export default function BottomNav({ onSearch }: { onSearch: () => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-inner flex justify-around items-center sm:hidden py-2 z-50">
      <NavLink label="Home" icon={<Home size={24} strokeWidth={1.5} />} path="/" layout="vertical" />
      <NavLink label="Ordini" icon={<ClipboardList size={24} strokeWidth={1.5} />} path="/ordini" layout="vertical" />
      <NavLink label="Prodotti" icon={<Package size={24} strokeWidth={1.5} />} path="/prodotti" layout="vertical" />
      <button
        onClick={onSearch}
        className="flex flex-col items-center justify-center text-xs text-black/70"
      >
        <div className="relative h-10 w-10 flex items-center justify-center">
          <Search size={24} strokeWidth={1.5} />
        </div>
        <span className="mt-1 text-sm font-bold">Cerca</span>
      </button>
    </nav>
  );
}
