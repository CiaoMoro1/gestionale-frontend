import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchProductModal from "../modals/SearchProductModal";
import { supabase } from "../lib/supabase";
import BottomNav from "../components/layout/BottomNav"; // <--- Importa la bottom nav!

import {
  Search,
  ClipboardList,
  Package,
  ArrowLeftRight,
  ArrowDown,
} from "lucide-react";


export default function HomePage() {
  const [searchChoiceOpen, setSearchChoiceOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const navigate = useNavigate();

  const menuItems = [
    { label: "tracking", path: "/tracking", icon: <Search size={24} /> },
    { label: "Ordini", path: "/ordini", icon: <ClipboardList size={24} /> },
    { label: "Prodotti", path: "/prodotti", icon: <Package size={24} /> },
    { label: "Movimenti", path: "/movimenti", icon: <ArrowLeftRight size={24} /> },
    { label: "Imp/Exp", path: "/import", icon: <ArrowDown size={24} /> },
    { label: "Sync", path: "/sync", icon: <Package size={24} /> }
  ];

  // Callback scanner/codice manuale
  const handleProductSearch = async (barcode: string) => {
    // Cerca per EAN o SKU
    const { data: prodotti, error } = await supabase
      .from("products")
      .select("id, ean, sku")
      .or(`ean.eq.${barcode},sku.eq.${barcode}`)
      .limit(1);

    if (error) {
      alert("Errore nella ricerca prodotto!");
      return;
    }
    if (prodotti && prodotti.length > 0 && prodotti[0].id) {
      navigate(`/prodotti/${prodotti[0].id}`);
    } else {
      alert("Nessun prodotto trovato per questo codice!");
    }
  };

  return (
    <>
      <div className="space-y-4 pb-20">
        {/* pb-20 per non far coprire i bottoni dalla bottomnav su mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {menuItems.map(({ label, icon, path }) => (
            <button
              key={label}
              onClick={() => {
                if (path) navigate(path);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg shadow-md bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {icon}
              <span className="mt-2 text-sm font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* BOTTOM NAV MOBILE */}
      <BottomNav onSearch={() => setSearchChoiceOpen(true)} />

      {/* MODALE SCELTA */}
      {searchChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-7 shadow-lg flex flex-col items-center w-[95%] max-w-xs">
            <h2 className="text-lg font-bold mb-5">Come vuoi cercare?</h2>
            <button
              onClick={() => {
                setSearchChoiceOpen(false);
                setSearchOpen(true);
              }}
              className="w-full bg-cyan-700 hover:bg-cyan-900 text-white font-bold rounded-lg py-3 mb-3"
            >
              📷 Usa Fotocamera
            </button>
            <button
              onClick={() => {
                setSearchChoiceOpen(false);
                setManualOpen(true);
              }}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold rounded-lg py-3"
            >
              ⌨️ Inserisci Codice
            </button>
            <button
              onClick={() => setSearchChoiceOpen(false)}
              className="mt-4 text-gray-400 hover:text-black text-sm"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* MODALE INPUT MANUALE */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-7 shadow-lg flex flex-col items-center w-[95%] max-w-xs">
            <h2 className="text-lg font-bold mb-5">Inserisci EAN o SKU</h2>
            <input
              className="w-full border rounded-lg px-4 py-2 mb-4 text-lg"
              value={manualValue}
              onChange={e => setManualValue(e.target.value)}
              placeholder="EAN o SKU..."
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && manualValue) {
                  handleProductSearch(manualValue.trim());
                  setManualOpen(false);
                  setManualValue("");
                }
              }}
            />
            <div className="flex w-full gap-2">
              <button
                onClick={() => {
                  if (manualValue) {
                    handleProductSearch(manualValue.trim());
                    setManualOpen(false);
                    setManualValue("");
                  }
                }}
                className="flex-1 bg-cyan-700 hover:bg-cyan-900 text-white font-bold rounded-lg py-2"
                disabled={!manualValue}
              >
                Cerca
              </button>
              <button
                onClick={() => {
                  setManualOpen(false);
                  setManualValue("");
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-300 text-gray-700 font-bold rounded-lg py-2"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE FOTOCAMERA */}
      <SearchProductModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onBarcodeFound={handleProductSearch}
      />
    </>
  );
}
