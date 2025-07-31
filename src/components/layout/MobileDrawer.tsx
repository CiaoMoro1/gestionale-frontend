import { Home, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import NavLink from "../navigation/NavLink";
import NavSection from "../navigation/NavSection";
import { navSections } from "../../constants/navSections";
import { supabase } from "../../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { useVendorBadgeCounts } from "../../hooks/useVendorBadgeCounts";

export type NavItem = {
  label: string;
  icon: React.ReactNode;
  path?: string;
  items?: NavItem[];
};

export type NavSectionType = {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
}

export default function MobileDrawer({ isOpen, onClose, session }: Props) {
  const { nuoviCount, parzialiCount } = useVendorBadgeCounts();

  // Mappa path → badge count
  const badgeMap: Record<string, number | undefined> = {
    "/ordini-amazon/nuovi": nuoviCount,
    "/ordini-amazon/parziali": parzialiCount,
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-20 sm:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 w-11/12 h-full bg-white shadow-md z-30 transform transition-transform duration-300 sm:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-black/80">Menu</h2>
          <button
            onClick={onClose}
            className="text-gray-600 focus:outline-none"
          >
            ✕
          </button>
        </div>

        <nav
          className="
            flex flex-col items-start px-3 py-4 space-y-2
            overflow-y-auto min-h-0 overscroll-contain
            flex-1
            max-h-[calc(100vh-64px)] pb-32
          "
          style={{
            overscrollBehavior: 'contain',
          }}
        >
          <NavLink
            label="Home"
            icon={<Home size={24} strokeWidth={1.5} />}
            path="/"
            layout="horizontal"
            onClick={onClose}
          />

          {navSections.map((section) => (
            <NavSection
              key={section.label}
              label={section.label}
              icon={section.icon}
              items={section.items}
              layout="horizontal"
              onNavigate={onClose}
              badges={badgeMap}
            />
          ))}

          {session ? (
            <button
              onClick={logout}
              className="flex items-center gap-2 text-red-500 hover:underline mt-4 px-2"
            >
              <LogOut size={18} /> Logout
            </button>
          ) : (
            <Link
              to="/login"
              onClick={onClose}
              className="flex items-center gap-2 text-green-600 hover:underline mt-4 px-2"
            >
              <LogOut size={18} /> Login
            </Link>
          )}
        </nav>
      </aside>
    </>
  );
}
