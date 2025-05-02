import { Link } from "react-router-dom";
import {
  Home as HomeIcon,
  ClipboardList,
  Package,
  ArrowLeftRight,
  ArrowDown,
} from "lucide-react";

const menuItems = [
  { label: "Home", path: "/", icon: <HomeIcon size={24} /> },
  { label: "Ordini", path: "/ordini", icon: <ClipboardList size={24} /> },
  { label: "Prodotti", path: "/prodotti", icon: <Package size={24} /> },
  { label: "Movimenti", path: "/movimenti", icon: <ArrowLeftRight size={24} /> },
  { label: "Imp/Exp", path: "/import", icon: <ArrowDown size={24} /> },
  { label: "Sync", path: "/sync", icon: <Package size={24} /> }
];

export default function HomePage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {menuItems.map(({ label, icon, path }) => (
          <Link
            key={label}
            to={path}
            className="flex flex-col items-center justify-center p-4 rounded-lg shadow-md bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {icon}
            <span className="mt-2 text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

