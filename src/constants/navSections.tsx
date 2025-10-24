import {
  ClipboardList,
  Package,
  ArrowLeftRight,
  ArrowDown,
  Boxes,
  Factory,
} from "lucide-react";
import { ReactNode } from "react";

export type NavItem = {
  label: string;
  icon: ReactNode;
  path?: string;
  items?: NavItem[];
};

export type NavSectionType = {
  label: string;
  icon: ReactNode;
  items: NavItem[];
};

export const navSections: NavSectionType[] = [
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
      { label: "Prelievo", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/prelievo" },
      { label: "Draft ⚡", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/draft" },
      { label: "Nuovi", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/nuovi" },
      { label: "Parziali", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/parziali" },
      { label: "Completi", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/completi" },
      {
        label: "Amministrazione",
        icon: <Boxes size={24} strokeWidth={1.5} />,
        items: [
          { label: "Fatture", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/fatturevendor" },
          { label: "Note Credito - Reso", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/notecreditoreso" },
        ]
      },
    ],
  },
  {
    label: "Magazzino",
    icon: <Package size={24} strokeWidth={1.5} />,
    items: [
      { label: "Gestione",  icon: <Package size={24} strokeWidth={1.5} />, path: "/magazzino/gestione" },
      { label: "Prodotti", icon: <Package size={24} strokeWidth={1.5} />, path: "/prodotti" },
      { label: "Movimenti", icon: <ArrowLeftRight size={24} strokeWidth={1.5} />, path: "/movimenti" },
    ],
  },
  {
    label: "Produzione",
    icon: <Factory size={24} strokeWidth={1.5} />,
    items: [
      { label: "Produzione Vendor", icon: <Factory size={24} strokeWidth={1.5} />, path: "/produzione-new" }
    ],
  },
  {
    label: "Strumenti",
    icon: <ArrowDown size={24} strokeWidth={1.5} />,
    items: [
      { label: "Import/Export", icon: <ArrowDown size={24} strokeWidth={1.5} />, path: "/import" },
      { label: "Sync", icon: <ArrowDown size={24} strokeWidth={1.5} />, path: "/sync" },
      { label: "Etichette Vendor", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/etichettevendor" },
    ],
  },
];
