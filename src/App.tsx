import { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Sidebar from "./components/layout/Sidebar";
import BottomNav from "./components/layout/BottomNav";
import MobileDrawer from "./components/layout/MobileDrawer";
import SearchProductModal from "./modals/SearchProductModal";
import HeaderMobile from "./components/layout/HeaderMobile";
import ConfermaPrelievo from "./routes/ConfermaPrelievo";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import RiepilogoNuovi from "./routes/ordini-amazon/nuovi";

// Lazy load delle route
const HomePage = lazy(() => import("./routes/Home"));
const Prodotti = lazy(() => import("./routes/Prodotti"));
const SyncPage = lazy(() => import("./routes/Sync"));
const LoginPage = lazy(() => import("./routes/LoginPage"));
const Ordini = lazy(() => import("./routes/Ordini"));
const OrdineDetail = lazy(() => import("./routes/OrdineDetail"));
const Movimenti = lazy(() => import("./routes/Movimenti"));
const ProductDetailWrapper = lazy(() => import("./routes/ProductDetailWrapper"));
const Etichettati = lazy(() => import("./routes/Etichettati"));
const Prelievo = lazy(() => import("./routes/Prelievo"));
const OrdiniAmazonDashboard = lazy(() => import("./routes/ordini-amazon/dashboard"));

// ⚡ QueryClient React Query v5+ (con error handler globale)
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => {
      toast.error(
        "Errore: " +
          (err instanceof Error
            ? err.message
            : typeof err === "string"
            ? err
            : "Errore sconosciuto")
      );
    },
  }),
  mutationCache: new MutationCache({
    onError: (err) => {
      toast.error(
        "Errore: " +
          (err instanceof Error
            ? err.message
            : typeof err === "string"
            ? err
            : "Errore sconosciuto")
      );
    },
  }),
});

function AppContent() {
  const location = useLocation();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    return <div className="h-screen w-screen bg-white" />;
  }

  if (!session && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-gray-200 relative">
      <Toaster position="top-center" /> {/* Provider toast globale */}

      {/* Header Mobile */}
      <HeaderMobile onMenuToggle={() => setIsMenuOpen(true)} />

      {/* Sidebar Desktop */}
      <Sidebar />

      {/* Drawer Mobile */}
      <MobileDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} session={session} />

      {/* Main Content */}
      <main className="flex-1 sm:ml-40 sm:p-4 flex flex-col justify-between sm:items-center">
        <section className="safe-bottom flex-grow w-full mx-auto px-4 sm:px-8 max-w-screen-lg pt-4 sm:pt-0">
          <Suspense fallback={<div>Caricamento...</div>}>
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
              <Route path="/prelievo/:id" element={<ConfermaPrelievo />} />
              <Route path="/ordini-amazon/dashboard" element={<OrdiniAmazonDashboard />} />
              <Route path="/etichettati" element={<Etichettati />} />
              <Route path="/ordini-amazon/nuovi" element={<RiepilogoNuovi />} />
            </Routes>
          </Suspense>
        </section>
      </main>

      {/* Bottom Navigation Mobile */}
      <BottomNav onSearch={() => setSearchOpen(true)} />

      {/* Modal di ricerca prodotto */}
      <SearchProductModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </BrowserRouter>
  );
}
