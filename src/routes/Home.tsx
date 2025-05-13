import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchProductModal from "../modals/SearchProductModal";

import {
  Search,
  ClipboardList,
  Package,
  ArrowLeftRight,
  ArrowDown,
} from "lucide-react";

export default function HomePage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { label: "Cerca", icon: <Search size={24} />, action: "search" },
    { label: "Ordini", path: "/ordini", icon: <ClipboardList size={24} /> },
    { label: "Prodotti", path: "/prodotti", icon: <Package size={24} /> },
    { label: "Movimenti", path: "/movimenti", icon: <ArrowLeftRight size={24} /> },
    { label: "Imp/Exp", path: "/import", icon: <ArrowDown size={24} /> },
    { label: "Sync", path: "/sync", icon: <Package size={24} /> }
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {menuItems.map(({ label, icon, path, action }) => (
            <button
              key={label}
              onClick={() => {
                if (action === "search") setSearchOpen(true);
                else if (path) navigate(path);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg shadow-md bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {icon}
              <span className="mt-2 text-sm font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <SearchProductModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
