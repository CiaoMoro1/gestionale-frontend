/* src/App.tsx */
import { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

import Sidebar from "./components/layout/Sidebar";
import BottomNav from "./components/layout/BottomNav";
import MobileDrawer from "./components/layout/MobileDrawer";
import SearchProductModal from "./modals/SearchProductModal";
import HeaderMobile from "./components/layout/HeaderMobile";
import { Toaster } from "react-hot-toast";


// ==============================
// Lazy load di TUTTE le pagine
// ==============================
const LoginPage = lazy(() => import("./routes/LoginPage"));

const HomePage = lazy(() => import("./routes/Home"));
const Prodotti = lazy(() => import("./routes/Prodotti"));
const SyncPage = lazy(() => import("./routes/Sync"));
const Ordini = lazy(() => import("./routes/sito/OrdiniSito"));
const OrdineDetail = lazy(() => import("./routes/OrdineDetail"));
const Movimenti = lazy(() => import("./routes/Movimenti"));
const ProductDetailWrapper = lazy(() => import("./routes/ProductDetailWrapper"));
const Etichettati = lazy(() => import("./routes/sito/OrdiniEtichettati"));
const PrelievoSito = lazy(() => import("./routes/sito/PrelievoSito"));
const ConfermaPrelievo = lazy(() => import("./routes/ConfermaPrelievo"));

const OrdiniAmazonDashboard = lazy(() => import("./routes/ordini-amazon/dashboard"));
const RiepilogoNuovi = lazy(() => import("./routes/ordini-amazon/nuovi"));
const DettaglioDestinazione = lazy(() => import("./routes/ordini-amazon/dettaglio"));
const Parziali = lazy(() => import("./routes/ordini-amazon/parziali"));
const DraftOrdini = lazy(() => import("./routes/ordini-amazon/draft"));
const CompletatiOrdini = lazy(() => import("./routes/ordini-amazon/completi"));
const EtichetteVendor = lazy(() => import("./routes/ordini-amazon/etichettevendor"));
const PrelievoAmazon = lazy(() => import("./routes/ordini-amazon/prelievo"));
const FattureVendor = lazy(() => import("./routes/ordini-amazon/fatturevendor"));
const NoteCreditoResoPage = lazy(() => import("./routes/ordini-amazon/notecreditoreso"));
const NoteCreditoOrdini = lazy(() => import("./routes/ordini-amazon/notecreditoordini"));
const NoteCreditoCoopPage = lazy(() => import("./routes/ordini-amazon/note-credito-coop"));
const PagamentiAmazonPage = lazy(() => import("./routes/ordini-amazon/payments-amazon"));
const FattureGeneraliPage = lazy(() => import("./routes/ordini-amazon/fatturegenerali"));


const ProduzioneVendorPage = lazy(() => import("@/features/produzione/pages/ProduzioneVendorPage"));
const GestioneMagazzinoPage = lazy(() => import("./routes/magazzino/gestione"));

const OrdiniProntiSpedizioneSito = lazy(() => import("./routes/sito/OrdiniProntiSpedizione"));
const OrdiniInLavorazioneSito = lazy(() => import("./routes/sito/OrdiniInLavorazione"));



const OrdiniSeller = lazy(() => import("./routes/seller/OrdiniSeller"));
const PrelievoSeller = lazy(() => import("./routes/seller/PrelievoSeller"));
const OrdiniInLavorazioneSeller = lazy(() => import("./routes/seller/OrdiniInLavorazioneSeller"));
const OrdiniProntiSpedizioneSeller = lazy(() => import("./routes/seller/OrdiniProntiSpedizioneSeller"));
const OrdineSellerDetail = lazy(() => import("./routes/seller/OrdineSellerDetail"));
const OrdineSellerEtichettati = lazy(() => import("./routes/seller/OrdiniSellerEtichettati"));


const TrackingPage = lazy(() => import("./routes/tracking/Tracking"));


// ==============================

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

  // Stato "loading" iniziale auth
  if (session === undefined) {
    return <div className="h-screen w-screen bg-white" />;
  }

  // Se non loggato e non sei sulla /login → redirect
  if (!session && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className="min-h-screen bg-gray-200 grid grid-cols-1
                 sm:grid-cols-[12rem,1fr] md:grid-cols-[12rem,1fr] lg:grid-cols-[15rem,1fr]
                 relative"
    >
      <Toaster position="top-center" />

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
          <section className="safe-bottom flex-grow mx-auto w-[100%]">
            <Suspense fallback={<div>Caricamento...</div>}>
              <Routes>
                {/* Auth */}
                <Route path="/login" element={<LoginPage />} />

                {/* Generali */}
                <Route path="/" element={<HomePage />} />
                <Route path="/prodotti" element={<Prodotti />} />
                <Route path="/prodotti/:id" element={<ProductDetailWrapper />} />
                <Route path="/sync" element={<SyncPage />} />
                <Route path="/movimenti" element={<Movimenti />} />

                {/* Sito */}
                <Route path="/sito/ordini" element={<Ordini />} />
                <Route path="/sito/prelievo" element={<PrelievoSito />} />
                <Route path="/sito/etichettati" element={<Etichettati />} />
                <Route path="/sito/ordini-pronti" element={<OrdiniProntiSpedizioneSito />} />
                <Route path="/sito/ordini-lavorazione" element={<OrdiniInLavorazioneSito />} />

                {/* Dettaglio ordini Sito generico */}
                <Route path="/ordini/:id" element={<OrdineDetail />} />
                <Route path="/prelievo/:id" element={<ConfermaPrelievo />} />

                {/* Amazon ordini / dashboard */}
                <Route path="/ordini-amazon/dashboard" element={<OrdiniAmazonDashboard />} />
                <Route path="/ordini-amazon/nuovi" element={<RiepilogoNuovi />} />
                <Route
                  path="/ordini-amazon/dettaglio/:center/:data"
                  element={<DettaglioDestinazione />}
                />
                <Route path="/ordini-amazon/parziali" element={<Parziali />} />
                <Route path="/ordini-amazon/draft" element={<DraftOrdini />} />
                <Route path="/ordini-amazon/completi" element={<CompletatiOrdini />} />
                <Route path="/ordini-amazon/etichettevendor" element={<EtichetteVendor />} />
                <Route path="/ordini-amazon/prelievo" element={<PrelievoAmazon />} />
                <Route path="/ordini-amazon/fatturevendor" element={<FattureVendor />} />
                <Route path="/ordini-amazon/notecreditoreso" element={<NoteCreditoResoPage />} />
                <Route
                  path="/ordini-amazon/nota-credito-upload"
                  element={<NoteCreditoOrdini />}
                />
                <Route path="/ordini-amazon/notacreditocoop" element={<NoteCreditoCoopPage />} />
                <Route path="/ordini-amazon/pagamenti" element={<PagamentiAmazonPage />} />
                <Route path="/ordini-amazon/fatturegenerali" element={<FattureGeneraliPage />} />

                {/* Produzione / Magazzino */}
                <Route path="/produzione-new" element={<ProduzioneVendorPage />} />
                <Route path="/magazzino/gestione" element={<GestioneMagazzinoPage />} />

                {/* Seller */}
                <Route path="/seller/ordini" element={<OrdiniSeller />} />
                <Route path="/seller/prelievo" element={<PrelievoSeller />} />
                <Route path="/seller/ordini-lavorazione" element={<OrdiniInLavorazioneSeller />} />
                <Route path="/seller/ordini-pronti" element={<OrdiniProntiSpedizioneSeller />} />
                <Route path="/seller/ordini/:id" element={<OrdineSellerDetail />} />
                <Route path="/seller/ordini/etichettati" element={<OrdineSellerEtichettati />} />
                 {/* tracking */}
                 <Route path="/tracking" element={<TrackingPage />} />
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
