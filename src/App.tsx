/* src/App.tsx */
import { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

import Sidebar from "./components/layout/Sidebar";
import BottomNav from "./components/layout/BottomNav";
import MobileDrawer from "./components/layout/MobileDrawer";
import SearchProductModal from "./modals/SearchProductModal";
import HeaderMobile from "./components/layout/HeaderMobile";
import ConfermaPrelievo from "./routes/ConfermaPrelievo";
import { Toaster } from "react-hot-toast";

import RiepilogoNuovi from "./routes/ordini-amazon/nuovi";
import DettaglioDestinazione from "./routes/ordini-amazon/dettaglio";
import Parziali from "./routes/ordini-amazon/parziali";
import DraftOrdini from "./routes/ordini-amazon/draft";
import CompletatiOrdini from "./routes/ordini-amazon/completi";
/* import ProduzioneVendor from "./routes/produzione/Produzione_Vendor";*/
import NoteCreditoResoPage from "./routes/ordini-amazon/notecreditoreso";

import ProduzioneVendorPage from "@/features/produzione/pages/ProduzioneVendorPage";


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
const EtichetteVendor = lazy(() => import("./routes/ordini-amazon/etichettevendor"));
const PrelievoAmazon = lazy(() => import("./routes/ordini-amazon/prelievo"));
const FattureVendor = lazy(() => import("./routes/ordini-amazon/fatturevendor"));
const NoteCreditoOrdini = lazy(() => import("./routes/ordini-amazon/notecreditoordini"));

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
    <div className="min-h-screen bg-gray-200 grid grid-cols-1
                    sm:grid-cols-[12rem,1fr] md:grid-cols-[12rem,1fr] lg:grid-cols-[15rem,1fr]
                    relative">
      <Toaster position="top-center" /> {/* Provider toast globale */}

      {/* Header Mobile */}
      <HeaderMobile onMenuToggle={() => setIsMenuOpen(true)} />

      {/* Sidebar Desktop */}
      <div className="hidden sm:block sticky top-0 self-start h-screen overflow-y-auto">
        <Sidebar />
      </div>

      {/* Drawer Mobile */}
      <MobileDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} session={session} />

      {/* Main Content */}
    <main className="flex-1 flex flex-col overflow-x-hidden">
      <div className="container mx-auto px-3 lg:px-4">
        <section className=" safe-bottom flex-grow mx-auto w-[100%] ">
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
              <Route path="/ordini-amazon/dettaglio/:center/:data" element={<DettaglioDestinazione />} />
              <Route path="/ordini-amazon/parziali" element={<Parziali />} />
              <Route path="/prelievo" element={<Prelievo />} />
              <Route path="/prelievo/:id" element={<ConfermaPrelievo />} />
              <Route path="/ordini-amazon/dashboard" element={<OrdiniAmazonDashboard />} />
              <Route path="/etichettati" element={<Etichettati />} />
              <Route path="/ordini-amazon/nuovi" element={<RiepilogoNuovi />} />
              <Route path="/ordini-amazon/draft" element={<DraftOrdini />} />
              <Route path="/ordini-amazon/completi" element={<CompletatiOrdini />} />
              <Route path="/ordini-amazon/etichettevendor" element={<EtichetteVendor />} />
              <Route path="/ordini-amazon/prelievo" element={<PrelievoAmazon />} />
            {/* Redirect legacy paths  <Route path="/produzione-vendor" element={<ProduzioneVendor />} />*/}
              <Route path="/ordini-amazon/fatturevendor" element={<FattureVendor />} />
              <Route path="/ordini-amazon/notecreditoreso" element={<NoteCreditoResoPage />} />
              <Route path="/ordini-amazon/nota-credito-upload" element={<NoteCreditoOrdini />} />
              <Route path="/produzione-new" element={<ProduzioneVendorPage />} />

            </Routes>
          </Suspense>
        </section>
      </div>  
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
      <AppContent />
    </BrowserRouter>
  );
}
