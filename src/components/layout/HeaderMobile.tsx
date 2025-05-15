import { Menu } from "lucide-react";
import Logo from "../../assets/Logo_Gestionale_PETTI.svg";

interface HeaderMobileProps {
  onMenuToggle: () => void;
}

export default function HeaderMobile({ onMenuToggle }: HeaderMobileProps) {
  return (
    <div className="sm:hidden fixed top-0 left-0 right-0 bg-white shadow z-30 flex items-center justify-between px-4 py-3">
      <button
        onClick={onMenuToggle}
        className="text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
        aria-label="Apri menu"
      >
        <Menu size={28} />
      </button>
      <div className="flex-1 flex justify-center">
        <img src={Logo} alt="Logo Gestionale PETTI" className="h-12" />
      </div>
      <div className="w-7" /> {/* Placeholder per simmetria */}
    </div>
  );
}
