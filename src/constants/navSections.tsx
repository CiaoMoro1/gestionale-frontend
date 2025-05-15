import {
  ClipboardList,
  Package,
  ArrowLeftRight,
  ArrowDown,
} from "lucide-react";

export const navSections = [
  {
    label: "Ordini",
    icon: <ClipboardList size={24} strokeWidth={1.5} />,
    items: [
      { label: "Ordini", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/ordini" },
      { label: "Prelievo", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/prelievo" },
    ],
  },
  {
    label: "Magazzino",
    icon: <Package size={24} strokeWidth={1.5} />,
    items: [
      { label: "Prodotti", icon: <Package size={24} strokeWidth={1.5} />, path: "/prodotti" },
      { label: "Movimenti", icon: <ArrowLeftRight size={24} strokeWidth={1.5} />, path: "/movimenti" },
    ],
  },
  {
    label: "Strumenti",
    icon: <ArrowDown size={24} strokeWidth={1.5} />,
    items: [
      { label: "Import/Export", icon: <ArrowDown size={24} strokeWidth={1.5} />, path: "/import" },
      { label: "Sync", icon: <ArrowDown size={24} strokeWidth={1.5} />, path: "/sync" },
    ],
  },
];
