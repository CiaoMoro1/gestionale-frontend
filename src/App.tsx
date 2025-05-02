import type { Session } from "@supabase/supabase-js";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import {
  Home,
  ClipboardList,
  Package,
  ArrowLeftRight,
  ArrowDown,
  Menu,
  LogOut,
} from "lucide-react";
import { supabase } from "./lib/supabase";

const HomePage = lazy(() => import("./routes/Home"));
const Prodotti = lazy(() => import("./routes/Prodotti"));
const SyncPage = lazy(() => import("./routes/Sync"));
const LoginPage = lazy(() => import("./routes/LoginPage"));

function AppContent() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session)
    );
    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!session && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { label: "Home", icon: <Home size={24} />, path: "/" },
    { label: "Ordini", icon: <ClipboardList size={24} />, path: "/ordini" },
    { label: "Prodotti", icon: <Package size={24} />, path: "/prodotti" },
    { label: "Movimenti", icon: <ArrowLeftRight size={24} />, path: "/movimenti" },
    { label: "Imp/Exp", icon: <ArrowDown size={24} />, path: "/import" },
  ];

  const NavLink = ({
    label,
    icon,
    path,
    layout = "horizontal",
    onClick,
  }: {
    label: string;
    icon: React.ReactNode;
    path: string;
    layout?: "horizontal" | "vertical";
    onClick?: () => void;
  }) => {
    const isActive = location.pathname === path;

    const baseClass =
      layout === "vertical"
        ? "flex flex-col items-center gap-1 text-sm"
        : "flex items-center gap-2 px-2 py-2 text-sm";

    return (
      <Link
        to={path}
        onClick={onClick}
        className={`${baseClass} rounded-md ${
          isActive ? "text-blue-600 font-semibold" : "text-gray-700"
        } hover:text-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300`}
        aria-label={label}
      >
        {icon}
        <span className={layout === "vertical" ? "text-xs mt-1" : ""}>{label}</span>
      </Link>
    );
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="h-screen flex flex-col sm:flex-row bg-gray-100 relative">
      {/* Header mobile */}
      <div className="sm:hidden p-4 flex items-center justify-between">
        <button
          onClick={() => setIsMenuOpen(true)}
          className="text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          <Menu size={28} />
        </button>
        <h2 className="text-xl font-bold text-blue-500">Gestionale PETTI</h2>
      </div>

      {/* Sidebar desktop */}
      <aside className="hidden sm:flex sm:flex-col sm:w-64 sm:bg-white sm:shadow-md sm:py-6">
        <h2 className="text-xl font-bold text-blue-500 text-center mb-6">Gestionale PETTI</h2>
        <nav className="flex flex-col items-center space-y-4">
          {navItems.map((item) => (
            <NavLink key={item.label} {...item} layout="horizontal" />
          ))}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-red-500 hover:underline mt-4"
          >
            <LogOut size={18} /> Logout
          </button>
        </nav>
      </aside>

      {/* Overlay e menu mobile */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-20 sm:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 w-64 h-full bg-white shadow-md z-30 transform transition-transform duration-300 sm:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-blue-500">Menu</h2>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col items-start px-4 py-4 space-y-4">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              {...item}
              layout="horizontal"
              onClick={() => setIsMenuOpen(false)}
            />
          ))}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-red-500 hover:underline mt-4"
          >
            <LogOut size={18} /> Logout
          </button>
        </nav>
      </aside>

      {/* Contenuto principale */}
      <main className="flex-1 p-4 sm:p-8 flex flex-col justify-between sm:items-center">
        <section className="flex-grow w-full mx-auto sm:max-w-5xl sm:bg-white sm:rounded-xl sm:shadow-md sm:p-6 p-4">
          <Suspense fallback={<div>Caricamento...</div>}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/prodotti" element={<Prodotti />} />
              <Route path="/sync" element={<SyncPage />} />
            </Routes>
          </Suspense>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
