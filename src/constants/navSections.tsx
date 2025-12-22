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
      { label: "Ordini", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/sito/ordini" },
      { label: "Prelievo", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/sito/prelievo" },
      { label: "Pronti per Spedizione", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/sito/ordini-pronti" },
      { label: "In Lavorazione", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/sito/ordini-lavorazione" },
      { label: "Etichettati", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/sito/etichettati" },
    ],
  },
    {
    label: "Ordini Seller",
    icon: (
      <img
        src="/icons/Logo_Seller.png"
        alt="Ordini Seller"
        className="w-6 h-6 object-contain"
      />
    ),
    items: [
      { label: "Ordini", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/seller/ordini" },
      { label: "Prelievo", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/seller/prelievo" },
      { label: "Pronti per Spedizione", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/seller/ordini-pronti" },
      { label: "In Lavorazione", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/seller/ordini-lavorazione" },
      { label: "Etichettati", icon: <ClipboardList size={24} strokeWidth={1.5} />, path: "/seller/ordini/etichettati" },
    ],
  },
  {
    label: "Ordini Vendor",
    icon: (
      <img
        src="/icons/Logo_Vendor.png"
        alt="Ordini Vendor"
        className="w-6 h-6 object-contain"
      />
    ),
    items: [
      { label: "Dashboard", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/dashboard" },
      { label: "Prelievo", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/prelievo" },
      { label: "Draft ⚡", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/draft" },
      { label: "Nuovi", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/nuovi" },
      { label: "Parziali", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/parziali" },
      { label: "Completi", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/completi" },
    
    ],
  },
  {
          label: "Amministrazione",
        icon: <Boxes size={24} strokeWidth={1.5} />,
        items: [
          { label: "Fatture Vendor", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/fatturevendor" },
          { label: "Fatture Generali", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/fatturegenerali" },
          { label: "Note Credito - Reso", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/notecreditoreso" },
          { label: "Note Credito - Coop", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/notacreditocoop" },
          { label: "Pagamenti Amazon", icon: <Boxes size={24} strokeWidth={1.5} />, path: "/ordini-amazon/pagamenti" },
        ]
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
      { label: "Produzione", icon: <Factory size={24} strokeWidth={1.5} />, path: "/produzione-new" }
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
