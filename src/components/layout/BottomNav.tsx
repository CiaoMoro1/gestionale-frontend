import { ClipboardList, Home, Boxes, Package, Search } from "lucide-react";
import NavLink from "../navigation/NavLink";

export default function BottomNav({ onSearch }: { onSearch: () => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-inner flex justify-around items-center sm:hidden py-2 z-50">
      <NavLink
        label="Home"
        icon={<Home size={24} strokeWidth={1.5} />}
        path="/"
        layout="vertical"
        variant="bottom"
      />
      <NavLink
        label="Ordini"
        icon={<ClipboardList size={24} strokeWidth={1.5} />}
        path="/ordini"
        layout="vertical"
        variant="bottom"
      />
      <NavLink
        label="⚡Draft⚡"
        icon={<Boxes size={24} strokeWidth={1.5} />}
        path="/ordini-amazon/draft"
        layout="vertical"
        variant="bottom"
      />
      <NavLink
        label="Prodotti"
        icon={<Package size={24} strokeWidth={1.5} />}
        path="/prodotti"
        layout="vertical"
        variant="bottom"
      />

      {/* Bottone cerca: chiama onSearch passato dal parent */}
      <button
        onClick={onSearch}
        className="flex flex-col items-center justify-center text-xs transition-all duration-200 group"
        tabIndex={0}
        aria-label="Cerca"
      >
        <div className="relative h-10 w-10 flex items-center justify-center">
          <Search size={24} strokeWidth={1.5} className="relative z-10 text-black/60 group-hover:text-black" />
        </div>
        <span className="mt-1 text-[clamp(0.7rem,1.5vw,0.94rem)] font-semibold text-black/70 group-hover:text-black">
          Cerca
        </span>
      </button>
    </nav>
  );
}
