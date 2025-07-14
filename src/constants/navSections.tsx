import {
  ClipboardList,
  Package,
  ArrowLeftRight,
  ArrowDown,
  Boxes,
} from "lucide-react";

export const navSections = [
  {
    label: "Ordini Sito",
    icon: <ClipboardList size={24} strokeWidth={1.5} />,
    items: [
      { label: "Ordini", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/ordini" },
      { label: "Prelievo", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/prelievo" },
      { label: "Etichettati", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/etichettati" },
    ],
  },
  {
    label: "Ordini Vendor",
    icon: <Boxes size={24} strokeWidth={1.5} />,
    items: [
      { label: "Dashboard", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/dashboard" },
      { label: "Draft ⚡", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/draft" },
      { label: "Nuovi", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/nuovi" },
      { label: "Parziali", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/parziali" },
      { label: "Completi", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/completi" },
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
      { label: "Etichette Vendor", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/etichettevendor" }, // <--- AGGIUNTO QUI

    ],
  },
];
