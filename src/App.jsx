import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { CartProvider } from '@/components/exmortis/CartContext';
import Layout from '@/components/exmortis/Layout';
import HomeSwitch from '@/components/prelaunch/HomeSwitch';
import PrelaunchGate from '@/components/prelaunch/PrelaunchGate';
import About from '@/pages/About';
import ShopPage from '@/pages/ShopPage';
import Checkout from '@/pages/Checkout';
import Powrot from '@/pages/Powrot';
import Glos from '@/pages/Glos';
import TestPage from '@/pages/TestPage';
import Events from '@/pages/Events';
import Login from '@/pages/Login';
import RegisterGate from '@/components/prelaunch/RegisterGate';
import SeoMeta from '@/components/seo/SeoMeta';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { lazy, Suspense } from 'react';
const Admin = lazy(() => import('@/pages/admin/Admin'));
const CmsPreview = lazy(() => import('@/pages/CmsPreview'));
const CoursePlayer = lazy(() => import('@/pages/CoursePlayer'));
const Cisza = lazy(() => import('@/pages/Cisza'));
import ProtectedRoute from '@/components/ProtectedRoute';
import { SiteContentProvider } from '@/components/exmortis/SiteContentProvider';
import { Navigate } from 'react-router-dom';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import { AdminModeProvider } from '@/components/admin/AdminModeContext';
import AdminBar from '@/components/admin/AdminBar';
import Account from '@/pages/Account';
import Regulamin from '@/pages/Regulamin';
import PolitykaCookies from '@/pages/PolitykaCookies';
import Odstapienie from '@/pages/Odstapienie';
import Kontakt from '@/pages/Kontakt';
import CookieBanner from '@/components/legal/CookieBanner';
import { PodcastPlayerProvider } from '@/components/exmortis/podcast/PlayerContext';
import CmsPage from '@/pages/CmsPage';
import CmsRoutePage from '@/components/cms/CmsRoutePage';
import Listopad from '@/pages/Listopad';
import ShopRedirect from '@/components/exmortis/shop/ShopRedirect';
import Obok from '@/pages/Obok';
import ObokSeria from '@/pages/ObokSeria';
import ObokNagranie from '@/pages/ObokNagranie';
import ListyPotwierdz from '@/pages/ListyPotwierdz';
import ZmianaAdresu from '@/pages/ZmianaAdresu';
import JoinMeeting from '@/pages/JoinMeeting';
import ErrorBoundary from '@/components/errors/ErrorBoundary';
import Rezerwacja from '@/pages/Rezerwacja';
import RezerwacjaTermin from '@/pages/RezerwacjaTermin';
import RezerwacjaZarzadzaj from '@/pages/RezerwacjaZarzadzaj';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <CartProvider>
      <AdminModeProvider>
      <AdminBar />
      <SiteContentProvider>
      <PodcastPlayerProvider>
      <PrelaunchGate>
      <SeoMeta />
      <ErrorBoundary full>
      <Suspense fallback={<div className="min-h-[100svh] bg-[#0A0A0B]" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterGate />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/admin/podglad-strony" element={<CmsPreview />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:section" element={<Admin />} />
          <Route element={<Layout />}>
            <Route path="/konto" element={<Account />} />
            <Route path="/konto/kurs/:accessId" element={<CoursePlayer />} />
          </Route>
        </Route>
        <Route path="/cisza" element={<Cisza />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomeSwitch />} />
          <Route path="/o-mnie" element={<About />} />
          <Route path="/skarbiec" element={<ShopPage />} />
          <Route path="/skarbiec/:slug" element={<CmsRoutePage slug="_produkt" />} />
          <Route path="/sklep" element={<ShopRedirect />} />
          <Route path="/sklep/:slug" element={<ShopRedirect />} />
          <Route path="/produkt/:slug" element={<ShopRedirect />} />
          <Route path="/kasa" element={<Checkout />} />
          <Route path="/powrot" element={<Powrot />} />
          <Route path="/glos" element={<Glos />} />
          <Route path="/glos/:slug" element={<CmsRoutePage slug="_odcinek" />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/spotkania" element={<Events />} />
          <Route path="/spotkania/:slug" element={<CmsRoutePage slug="_spotkanie" />} />
          <Route path="/spotkania/:slug/dolacz" element={<JoinMeeting />} />
          <Route path="/:short/dolacz" element={<JoinMeeting />} />
          <Route path="/polityka-prywatnosci" element={<PrivacyPolicy />} />
          <Route path="/regulamin" element={<Regulamin />} />
          <Route path="/polityka-cookies" element={<PolitykaCookies />} />
          <Route path="/odstapienie" element={<Odstapienie />} />
          <Route path="/kontakt" element={<Kontakt />} />
          <Route path="/rezerwacja/termin" element={<RezerwacjaTermin />} />
          <Route path="/rezerwacja/zarzadzaj" element={<RezerwacjaZarzadzaj />} />
          <Route path="/rezerwacja/:slug" element={<Rezerwacja />} />
          <Route path="/strona/:slug" element={<CmsPage />} />
          <Route path="/1-listopada" element={<Listopad />} />
          <Route path="/listy/potwierdz" element={<ListyPotwierdz />} />
          <Route path="/zmiana-adresu" element={<ZmianaAdresu />} />
          <Route path="/obok" element={<Obok />} />
          <Route path="/obok/:seria" element={<ObokSeria />} />
          <Route path="/obok/:seria/:numer" element={<ObokNagranie />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Routes>
      </Suspense>
      </ErrorBoundary>
      </PrelaunchGate>
      </PodcastPlayerProvider>
      <CookieBanner />
      </SiteContentProvider>
      </AdminModeProvider>
    </CartProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App