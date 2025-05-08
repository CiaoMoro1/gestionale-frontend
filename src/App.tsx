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
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./assets/Logo_Gestionale_PETTI.svg";


const HomePage = lazy(() => import("./routes/Home"));
const Prodotti = lazy(() => import("./routes/Prodotti"));
const SyncPage = lazy(() => import("./routes/Sync"));
const LoginPage = lazy(() => import("./routes/LoginPage"));
const ProductDetail = lazy(() => import("./routes/ProductDetail"));
const Ordini = lazy(() => import("./routes/Ordini"));
const OrdineDetail = lazy(() => import("./routes/OrdineDetail"));

function AppContent() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

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

  if (session === undefined) {
    return <div className="h-screen w-screen bg-white" />; // placeholder pulito
  }
  
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

    if (layout === "vertical") {
      return (
        <Link
          to={path}
          onClick={onClick}
          className="flex flex-col items-center justify-center relative text-xs text-black/70"
          aria-label={label}
        >
          <div className="relative h-10 w-10 flex items-center justify-center">
            <AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="active-circle"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{
                    scale: [0.5, 1.2, 1],
                    opacity: 1,
                    rotate: [0, 360],
                    transition: {
                      duration: 0.5,
                      ease: "easeInOut",
                    },
                  }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute w-10 h-10 rounded-full bg-black/30 z-0"
                />
              )}
            </AnimatePresence>
            <div className="relative z-10">{icon}</div>
          </div>
          <span className="mt-1 text-sm font-bold">{label}</span>
        </Link>
      );
    }

    return (
      <Link
        to={path}
        onClick={onClick}
        className={`flex items-center gap-2 px-2 py-2 text-sm rounded-md ${
          isActive ? "text-black font-semibold" : "text-black/50"
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-black`}
        aria-label={label}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="h-screen flex flex-col sm:flex-row bg-gray-100 relative">
          {/* Header (mobile) */}
          <div className="sm:hidden fixed top-0 left-0 right-0 bg-white shadow z-30 flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <Menu size={28} />
            </button>
            <div className="flex-1 flex justify-center">
              <img src={Logo} alt="Logo" className="h-12" />
            </div>
            <div className="w-7" /> {/* placeholder per simmetria */}
          </div>


      {/* Sidebar (desktop) */}
      <aside className="hidden sm:fixed sm:inset-y-0 sm:left-0 sm:w-48 sm:flex sm:flex-col sm:bg-white sm:shadow-md z-40">
        <div className="flex justify-center items-center h-20 border-b">
          <img src={Logo} alt="Logo" className="h-10" />
        </div>

        <nav className="flex-1 flex flex-col items-center justify-start space-y-4 pt-6">
          {navItems.map((item) => (
            <NavLink key={item.label} {...item} layout="horizontal" />
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


      {/* Drawer menu (mobile) */}
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
          <h2 className="text-lg font-bold text-black/80">Menu</h2>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
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

      {/* Main content */}
      <main className="flex-1 sm:ml-40 sm:p-4 flex flex-col justify-between sm:items-center">
      <section className="safe-bottom flex-grow w-full mx-auto px-4 sm:px-8 max-w-screen-lg pt-4 sm:pt-0">

            <Suspense fallback={<></>}>
                <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<HomePage />} />
                <Route path="/prodotti" element={<Prodotti />} />
                <Route path="/ordini" element={<Ordini />} />
                <Route path="/ordini/:id" element={<OrdineDetail />} />
                <Route path="/sync" element={<SyncPage />} />
                <Route path="/prodotti/:id" element={<ProductDetail />} />
              </Routes>
            </Suspense>
        </section>
      </main>

      {/* Bottom nav (mobile only) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-inner flex justify-around items-center sm:hidden py-2 z-50">
        {navItems.map((item) => (
          <NavLink key={item.label} {...item} layout="vertical" />
        ))}
      </nav>
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
