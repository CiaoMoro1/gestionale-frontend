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
  Search,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./assets/Logo_Gestionale_PETTI.svg";
import SearchProductModal from "./modals/SearchProductModal";



const HomePage = lazy(() => import("./routes/Home"));
const Prodotti = lazy(() => import("./routes/Prodotti"));
const SyncPage = lazy(() => import("./routes/Sync"));
const LoginPage = lazy(() => import("./routes/LoginPage"));
const Ordini = lazy(() => import("./routes/Ordini"));
const OrdineDetail = lazy(() => import("./routes/OrdineDetail"));
const Movimenti = lazy(() => import("./routes/Movimenti"));
const ProductDetailWrapper = lazy(() => import("./routes/ProductDetailWrapper"));
const Prelievo = lazy(() => import("./routes/Prelievo"));

const navSections = [
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




function AppContent() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);

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
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{
                    scale: [0.5, 1.2, 1],
                    opacity: 1,
                    rotate: [0, 180],
                    transition: {
                      duration: 1,
                      ease: "easeInOut",
                    },
                  }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute w-10 h-10 rounded-xl bg-gradient-to-br from-black/50 via-black/20 to-gray-300 z-0"
                />
              )}
            </AnimatePresence>
            <div className="relative z-10">{icon}</div>
          </div>
          <span className="mt-1 text-[clamp(0.7rem,1.5vw,0.875rem)] font-medium text-black/80">{label}</span>
        </Link>
      );
    }

    return (
<Link
  to={path}
  onClick={onClick}
  className={`relative flex items-center gap-2 px-8 py-2 text-sm w-full transition-colors duration-200
    ${isActive ? "text-black font-semibold bg-gray-200" : "text-black/50 hover:bg-black/5"}
    focus:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-l-3xl rounded-r-s`}
  aria-label={label}
>
  {isActive && (
    <span className="absolute right-[-12px] top-0 bottom-0 w-6 bg-gray-200  z-[-1]" />
  )}

  {icon}
  <span className="text-[clamp(0.85rem,1.8vw,1rem)] font-semibold text-black">{label}</span>
</Link>
    );
  };

const NavSection = ({
  label,
  icon,
  items,
  layout,
  onNavigate,
}: {
  label: string;
  icon: React.ReactNode;
  items: { label: string; icon: React.ReactNode; path: string }[];
  layout: "horizontal" | "vertical";
  onNavigate?: () => void;
}) => {
  const location = useLocation();
  const [open, setOpen] = useState(
    items.some((i) => i.path === location.pathname)
  );

  useEffect(() => {
    if (items.some((i) => i.path === location.pathname)) {
      setOpen(true);
    }
  }, [location.pathname]);

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen(!open)}
        className={`relative w-full flex items-center justify-between gap-2 px-8 py-2 text-sm text-black font-semibold hover:bg-black/5 transition rounded-l-3xl rounded-r-s`}
      >
        <div className="flex items-center gap-2">
          <span className="text-black/70">{icon}</span>
          <span>{label}</span>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="text-black/50"
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex flex-col gap-1 pl-6 mt-1"
          >
            {items.map((item) => (
              <NavLink
                key={item.path}
                {...item}
                layout={layout}
                onClick={onNavigate}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};



  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-gray-200 relative">
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


        <nav className="flex-1 flex flex-col items-start justify-start space-y-2 pt-6 w-full">
          <NavLink label="Home" icon={<Home size={24} strokeWidth={1.5} />} path="/" layout="horizontal" />
          {navSections.map((section) => (
            <NavSection key={section.label} {...section} layout="horizontal" />
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
        className={`fixed top-0 left-0 w-11/12 h-full bg-white shadow-md z-30 transform transition-transform duration-300 sm:hidden ${
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

        <nav className="flex flex-col items-start px-3 py-4 space-y-2">
          {/* HOME come voce indipendente */}
          <NavLink
            label="Home"
            icon={<Home size={24} strokeWidth={1.5} />}
            path="/"
            layout="horizontal"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Sezioni espandibili */}
          {navSections.map((section) => (
            <NavSection
              key={section.label}
              {...section}
              layout="horizontal"
              onNavigate={() => setIsMenuOpen(false)}
            />
          ))}

          {/* Login/Logout dinamico */}
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
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-2 text-green-600 hover:underline mt-4 px-2"
            >
              <LogOut size={18} /> Login
            </Link>
          )}
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
                <Route path="/prodotti/:id" element={<ProductDetailWrapper />} />
                <Route path="/movimenti" element={<Movimenti />} />
                <Route path="/prelievo" element={<Prelievo />} />
              </Routes>
            </Suspense>
        </section>
      </main>

      {/* Bottom nav (mobile only) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-inner flex justify-around items-center sm:hidden py-2 z-50">
        <NavLink label="Home" icon={<Home size={24} strokeWidth={1.5} />} path="/" layout="vertical" />
        <NavLink label="Ordini" icon={<ClipboardList size={24} strokeWidth={1.5} />} path="/ordini" layout="vertical" />
        <NavLink label="Prodotti" icon={<Package size={24} strokeWidth={1.5} />} path="/prodotti" layout="vertical" />
        <button
          onClick={() => setSearchOpen(true)}
          className="flex flex-col items-center justify-center text-xs text-black/70"
        >
          <div className="relative h-10 w-10 flex items-center justify-center">
            <Search size={24} strokeWidth={1.5} />
          </div>
          <span className="mt-1 text-sm font-bold">Cerca</span>
        </button>
      </nav>

      <SearchProductModal open={searchOpen} onClose={() => setSearchOpen(false)} />

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