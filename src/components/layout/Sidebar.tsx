import { Home, LogOut } from "lucide-react";
import Logo from "../../assets/Logo_Gestionale_PETTI.svg";
import NavLink from "../navigation/NavLink";
import NavSection from "../navigation/NavSection";
import { navSections, NavSectionType } from "../../constants/navSections";
import { supabase } from "../../lib/supabase";
import { useVendorBadgeCounts } from "../../hooks/useVendorBadgeCounts";

export default function Sidebar() {
  const { nuoviCount, parzialiCount } = useVendorBadgeCounts();

  const badgeMap: Record<string, number | undefined> = {
    "/ordini-amazon/nuovi": nuoviCount,
    "/ordini-amazon/parziali": parzialiCount,
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside className="hidden sm:fixed sm:inset-y-0 sm:left-0 sm:w-54 sm:flex sm:flex-col sm:bg-white sm:shadow-md z-40">
      <div className="flex justify-center items-center h-20 border-b">
        <img src={Logo} alt="Logo" className="h-10" />
      </div>
      <nav className="flex-1 flex flex-col items-start justify-start space-y-2 pt-6 w-full
        overflow-y-auto min-h-0 max-h-[calc(100vh-80px-56px)]
        overscroll-contain">
        <NavLink
          label="Home"
          icon={<Home size={24} strokeWidth={1.5} />}
          path="/"
          layout="horizontal"
        />
        {navSections.map((section: NavSectionType) => (
          <NavSection
            key={section.label}
            label={section.label}
            icon={section.icon}
            items={section.items}
            layout="horizontal"
            badges={badgeMap}
          />
        ))}
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={logout}
          className="flex items-center gap-2 text-red-500 hover:underline"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}
