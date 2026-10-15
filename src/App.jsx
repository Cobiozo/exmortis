import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { appParams } from '@/lib/app-params';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { CartProvider } from '@/components/exmortis/CartContext';
import Layout from '@/components/exmortis/Layout';
import HomeSwitch from '@/components/prelaunch/HomeSwitch';
import PrelaunchGate from '@/components/prelaunch/PrelaunchGate';
const About = lazyPage(() => import('@/pages/About'));
const Rozdroza = lazyPage(() => import('@/pages/Rozdroza'));
const ShopPage = lazyPage(() => import('@/pages/ShopPage'));
const Checkout = lazyPage(() => import('@/pages/Checkout'));
const Powrot = lazyPage(() => import('@/pages/Powrot'));
const Glos = lazyPage(() => import('@/pages/Glos'));
const TestPage = lazyPage(() => import('@/pages/TestPage'));
const Events = lazyPage(() => import('@/pages/Events'));
import Login from '@/pages/Login';
import RegisterGate from '@/components/prelaunch/RegisterGate';
import SeoMeta from '@/components/seo/SeoMeta';
import Analytics from '@/components/analytics/Analytics';
const ForgotPassword = lazyPage(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('@/pages/ResetPassword'));
import { Suspense, lazy } from 'react';
import lazyPage from '@/lib/lazyPage';
const Admin = lazyPage(() => import('@/pages/admin/Admin'));
const CmsPreview = lazyPage(() => import('@/pages/CmsPreview'));
const CoursePlayer = lazyPage(() => import('@/pages/CoursePlayer'));
const Cisza = lazyPage(() => import('@/pages/Cisza'));
const Karta = lazyPage(() => import('@/pages/Karta'));
const Bilet = lazyPage(() => import('@/pages/Bilet'));
const Skaner = lazyPage(() => import('@/pages/Skaner'));
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginRedirect from '@/components/LoginRedirect';
import { SiteContentProvider } from '@/components/exmortis/SiteContentProvider';
const PrivacyPolicy = lazyPage(() => import('@/pages/PrivacyPolicy'));
import { AdminModeProvider } from '@/components/admin/AdminModeContext';
import AdminBar from '@/components/admin/AdminBar';
const Account = lazyPage(() => import('@/pages/Account'));
const Regulamin = lazyPage(() => import('@/pages/Regulamin'));
const PolitykaCookies = lazyPage(() => import('@/pages/PolitykaCookies'));
const Odstapienie = lazyPage(() => import('@/pages/Odstapienie'));
import Kontakt from '@/pages/Kontakt';
import CookieBanner from '@/components/legal/CookieBanner';
import { PodcastPlayerProvider } from '@/components/exmortis/podcast/PlayerContext';
const CmsPage = lazyPage(() => import('@/pages/CmsPage'));
import CmsRoutePage from '@/components/cms/CmsRoutePage';
import Listopad from '@/pages/Listopad';
import ShopRedirect from '@/components/exmortis/shop/ShopRedirect';
const Obok = lazyPage(() => import('@/pages/Obok'));
const ObokSeria = lazyPage(() => import('@/pages/ObokSeria'));
const ObokNagranie = lazyPage(() => import('@/pages/ObokNagranie'));
const ListyPotwierdz = lazyPage(() => import('@/pages/ListyPotwierdz'));
const ListyWypis = lazyPage(() => import('@/pages/ListyWypis'));
const ZmianaAdresu = lazyPage(() => import('@/pages/ZmianaAdresu'));
import JoinMeeting from '@/pages/JoinMeeting';
import ErrorBoundary from '@/components/errors/ErrorBoundary';
const Rezerwacja = lazyPage(() => import('@/pages/Rezerwacja'));
const RezerwacjaTermin = lazyPage(() => import('@/pages/RezerwacjaTermin'));
const RezerwacjaZarzadzaj = lazyPage(() => import('@/pages/RezerwacjaZarzadzaj'));
import { CrisisProvider } from '@/components/crisis/CrisisContext';
import CrisisHelpButton from '@/components/crisis/CrisisHelpButton';
import PwaSetup from '@/components/pwa/PwaSetup';
const InstallHint = lazy(() => import('@/components/pwa/InstallHint'));
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Kółko ładowania tylko dla zalogowanych (sprawdzenie konta). Gość widzi stronę od razu —
  // publiczne ustawienia aplikacji dochodzą w tle (wcześniej każdy gość czekał na nie przed pierwszym obrazem).
  if ((isLoadingPublicSettings || isLoadingAuth) && appParams.token) {
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
      <Analytics />
      <ErrorBoundary full>
      <CrisisProvider>
      <CrisisHelpButton />
      <PwaSetup />
      <Suspense fallback={null}><InstallHint /></Suspense>
      <Suspense fallback={<div className="min-h-[100svh] bg-[#0A0A0B]" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterGate />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
          <Route path="/admin/podglad-strony" element={<CmsPreview />} />
          <Route path="/skaner" element={<Skaner />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:section" element={<Admin />} />
          <Route element={<Layout />}>
            <Route path="/konto" element={<Account />} />
            <Route path="/konto/kurs/:accessId" element={<CoursePlayer />} />
            <Route path="/konto/rozdroza/*" element={<Rozdroza />} />
          </Route>
        </Route>
        <Route path="/cisza" element={<Cisza />} />
        <Route path="/karta" element={<Karta />} />
        <Route path="/bilet" element={<Bilet />} />
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
          <Route path="/listy/wypis" element={<ListyWypis />} />
          <Route path="/zmiana-adresu" element={<ZmianaAdresu />} />
          <Route path="/obok" element={<Obok />} />
          <Route path="/obok/:seria" element={<ObokSeria />} />
          <Route path="/obok/:seria/:numer" element={<ObokNagranie />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Routes>
      </Suspense>
      </CrisisProvider>
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